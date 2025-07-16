class PacmanGridEnvironment {
    constructor(gridSize = 10) {
        this.gridSize = gridSize;
        this.maxSteps = 300;
        this.rewardScale = 0.02; // GLOBAL reward scaling factor (tune here)
        this.loopWindow = 15;
        this.loopThreshold = 3;
        this.requiredPowerPellets = 2;
        this.demoMode = false;
        this.reset();
    }

    setDemoMode(enabled) {
        this.demoMode = enabled;
    }

    reset() {
        // Layout: 0=empty, 1=wall, 2=pellet, 3=power pellet
        this.grid = Array.from({length: this.gridSize}, () => Array(this.gridSize).fill(2));
        
        // Add borders
        for (let i = 0; i < this.gridSize; i++) {
            this.grid[0][i] = 1;
            this.grid[this.gridSize-1][i] = 1;
            this.grid[i][0] = 1;
            this.grid[i][this.gridSize-1] = 1;
        }
        
        // Teleporter holes (center of each wall)
        const mid = Math.floor(this.gridSize/2);
        this.grid[0][mid] = 0;
        this.grid[this.gridSize-1][mid] = 0;
        this.grid[mid][0] = 0;
        this.grid[mid][this.gridSize-1] = 0;
        
        // Add some internal walls for a simple maze
        for (let i = 2; i < this.gridSize-2; i++) {
            if (i !== mid) {
                this.grid[2][i] = 1;
                this.grid[this.gridSize-3][i] = 1;
            }
        }
        for (let i = 3; i < this.gridSize-3; i++) {
            if (i !== mid) {
                this.grid[i][3] = 1;
                this.grid[i][this.gridSize-4] = 1;
            }
        }
        
        // Place Pac-Man
        this.pacman = { x: 1, y: 1 };
        
        // Place ghost
        this.ghost = { x: this.gridSize-2, y: this.gridSize-2 };
        
        // Place 2 power pellets
        this.grid[mid][mid] = 3; // First power pellet at (5, 5)
        this.grid[1][this.gridSize-2] = 3; // Second power pellet at (8, 1)
        
        // Remove pellets from walls and starting positions
        this.grid[this.pacman.y][this.pacman.x] = 0;
        this.grid[this.ghost.y][this.ghost.x] = 0;
        
        // Clear paths to objectives
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x] === 1) continue;
                if (this.grid[y][x] !== 3) this.grid[y][x] = 2;
            }
        }
        
        this.powerTimer = 0;
        this.powerPelletsEaten = 0;
        this.score = 0;
        this.done = false;
        this.steps = 0;
        this.recentPositions = [];
        this.collectedAllPowerPellets = false;
        this.lastPosition = { x: this.pacman.x, y: this.pacman.y };
        this.stationaryCount = 0;
        this.ghostCaught = false;
        
        // Reset ghost position tracking to prevent loops
        this.ghostRecentPositions = [];
        
        // Ghost movement timing for flee mode
        this.ghostMoveCounter = 0;
        
        return this.getState();
    }

    getState() {
        // Flattened state: pacman x, pacman y, ghost x, ghost y, grid (flattened pellets/power pellets only), powerPelletsEaten
        let pelletMap = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                pelletMap.push(this.grid[y][x] === 2 ? 1 : (this.grid[y][x] === 3 ? 2 : 0));
            }
        }
        return [this.pacman.x, this.pacman.y, this.ghost.x, this.ghost.y, ...pelletMap, this.powerPelletsEaten];
    }

    getCurrentObjective() {
        if (this.powerPelletsEaten === 0) {
            return 0; // Objective 1: Eat first power pellet
        } else if (this.powerPelletsEaten === 1 && this.powerTimer === 0) {
            return 1; // Objective 2: Eat second power pellet
        } else {
            return 2; // Objective 3: Eat the ghost
        }
    }

    getTargetPowerPelletDistance(objective) {
        const mid = Math.floor(this.gridSize/2);
        
        let targetPos;
        if (objective === 0) {
            // Model 1: Always target center power pellet (5, 5)
            targetPos = { x: mid, y: mid };
        } else if (objective === 1) {
            // Model 2: Always target corner power pellet (8, 1)  
            targetPos = { x: this.gridSize-2, y: 1 };
        } else {
            // Model 3: No power pellets to target
            return Infinity;
        }
        
        // Check if target power pellet still exists
        if (this.grid[targetPos.y][targetPos.x] === 3) {
            const distance = Math.abs(this.pacman.x - targetPos.x) + Math.abs(this.pacman.y - targetPos.y);
            // Debug: Log target info every 10 steps
            if (this.steps % 10 === 0) {
                console.log(`Model ${objective + 1}: Target pellet at (${targetPos.x}, ${targetPos.y}), distance: ${distance}, agent at (${this.pacman.x}, ${this.pacman.y})`);
            }
            return distance;
        }
        
        return Infinity; // Power pellet already eaten
    }

    getPreviousTargetPowerPelletDistance(action, objective) {
        const moves = [[0,-1], [0,1], [-1,0], [1,0]];
        const [dx, dy] = moves[action];
        const prevX = this.pacman.x - dx;
        const prevY = this.pacman.y - dy;
        
        const mid = Math.floor(this.gridSize/2);
        
        let targetPos;
        if (objective === 0) {
            // Model 1: Always target center power pellet (5, 5)
            targetPos = { x: mid, y: mid };
        } else if (objective === 1) {
            // Model 2: Always target corner power pellet (8, 1)
            targetPos = { x: this.gridSize-2, y: 1 };
        } else {
            // Model 3: No power pellets to target
            return Infinity;
        }
        
        // Check if target power pellet still exists
        if (this.grid[targetPos.y][targetPos.x] === 3) {
            return Math.abs(prevX - targetPos.x) + Math.abs(prevY - targetPos.y);
        }
        
        return Infinity; // Power pellet already eaten
    }

    getClosestPowerPelletDistance() {
        const mid = Math.floor(this.gridSize/2);
        const powerPelletPositions = [
            { x: mid, y: mid }, // First power pellet at (5, 5)
            { x: this.gridSize-2, y: 1 } // Second power pellet at (8, 1)
        ];
        
        let closestDist = Infinity;
        for (const pos of powerPelletPositions) {
            if (this.grid[pos.y][pos.x] === 3) {
                const dist = Math.abs(this.pacman.x - pos.x) + Math.abs(this.pacman.y - pos.y);
                closestDist = Math.min(closestDist, dist);
            }
        }
        return closestDist;
    }

    getPreviousClosestPowerPelletDistance(action) {
        const moves = [[0,-1], [0,1], [-1,0], [1,0]];
        const [dx, dy] = moves[action];
        const prevX = this.pacman.x - dx;
        const prevY = this.pacman.y - dy;
        
        const mid = Math.floor(this.gridSize/2);
        const powerPelletPositions = [
            { x: mid, y: mid }, // First power pellet at (5, 5)
            { x: this.gridSize-2, y: 1 } // Second power pellet at (8, 1)
        ];
        
        let closestDist = Infinity;
        for (const pos of powerPelletPositions) {
            if (this.grid[pos.y][pos.x] === 3) {
                const dist = Math.abs(prevX - pos.x) + Math.abs(prevY - pos.y);
                closestDist = Math.min(closestDist, dist);
            }
        }
        return closestDist;
    }

    getObjectiveBasedReward(action, prevDist, newDist) {
        const objective = this.getCurrentObjective();
        let reward = -1; // Base step penalty (simplified)
        
        // MASSIVE penalty for not moving - sitting still should be worse than dying!
        if (this.pacman.x === this.lastPosition.x && this.pacman.y === this.lastPosition.y) {
            this.stationaryCount++;
            reward -= 10;
        } else {
            this.stationaryCount = 0;
            reward += 1; // Small bonus for moving
        }
        
        switch (objective) {
            case 0: // Objective 1: Eat first power pellet
                reward += this.getRewardForFirstPowerPellet(action, prevDist, newDist);
                break;
            case 1: // Objective 2: Eat second power pellet
                reward += this.getRewardForSecondPowerPellet(action, prevDist, newDist);
                break;
            case 2: // Objective 3: Eat the ghost
                reward += this.getRewardForEatingGhost(action, prevDist, newDist);
                break;
        }
        
        return reward;
    }

    getRewardForFirstPowerPellet(action, prevDist, newDist) {
        // Dense shaping reward: move closer to target pellet (+5), farther (-5)
        const prevTargetDist = this.getPreviousTargetPowerPelletDistance(action, 0);
        const targetDist = this.getTargetPowerPelletDistance(0);
        let reward = 0;
        if (targetDist < prevTargetDist) reward += 10; // stronger positive shaping
        else if (targetDist > prevTargetDist) reward -= 5;
        
        // Bonus when adjacent to target pellet to help final step
        if (targetDist <= 1) reward += 200;
        
        // Ghost proximity penalty when not powered up
        const ghostDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
        if (this.powerTimer === 0 && ghostDist <= 2) reward -= 2;
        return reward;
    }

    getRewardForSecondPowerPellet(action, prevDist, newDist) {
        // Dense shaping reward for second target power pellet (corner 8,1)
        const prevTargetDist = this.getPreviousTargetPowerPelletDistance(action, 1);
        const targetDist = this.getTargetPowerPelletDistance(1);
        let reward = 0;
        if (targetDist < prevTargetDist) reward += 10; // stronger positive shaping
        else if (targetDist > prevTargetDist) reward -= 5;
        
        if (targetDist <= 1) reward += 200;
        
        const ghostDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
        if (this.powerTimer === 0 && ghostDist <= 2) reward -= 2;
        return reward;
    }

    getRewardForEatingGhost(action, prevDist, newDist) {
        // Dense shaping for chasing ghost when powered up
        let reward = 0;
        if (this.powerTimer > 0) {
            if (newDist < prevDist) reward += 100; // Strong reward for getting closer
            else if (newDist > prevDist) reward -= 50; // Strong penalty for moving away
            if (newDist <= 3) reward += 50; // Bonus for being nearby
            if (newDist <= 2) reward += 200; // Big bonus for staying close
            if (newDist <= 1) reward += 1000; // MASSIVE bonus for being adjacent
            if (newDist === 0) reward += 5000; // ENORMOUS bonus for being on same cell (about to catch)
            
            // NEW: Special teleporter rewards for strategic usage
            if (this.pacmanUsedTeleporter) {
                if (newDist < prevDist) {
                    reward += 500; // BIG bonus for using teleporter to get closer
                    console.log(`🌟 TELEPORTER STRATEGY: Pac-Man used teleporter to get closer to ghost! Distance reduced from ${prevDist} to ${newDist}`);
                } else if (newDist <= 3) {
                    reward += 200; // Bonus for using teleporter to stay close
                    console.log(`🌟 TELEPORTER CHASE: Pac-Man used teleporter to maintain ghost chase! Distance: ${newDist}`);
                } else {
                    reward -= 100; // Penalty for poor teleporter usage
                    console.log(`❌ POOR TELEPORTER USE: Pac-Man used teleporter but didn't get closer to ghost`);
                }
            }
        } else {
            // when not powered, treat ghost as danger
            if (newDist <= 2) reward -= 10;
        }
        return reward;
    }

    step(action) {
        if (this.done) return { nextState: this.getState(), reward: 0, done: true };
        
        this.steps++;
        
        // NEW: capture objective before any state changes (used for success detection)
        const objectiveBefore = this.getCurrentObjective();
        
        // NEW: flag to indicate a power pellet was collected this step – prevents ghost from moving immediately
        let justCollectedPowerPellet = false;
        
        // Initialise reward accumulator before any checks
        let reward = 0;
        
        // Store last position for stationary detection
        this.lastPosition = { x: this.pacman.x, y: this.pacman.y };
        
        // Actions: 0=up, 1=down, 2=left, 3=right
        const moves = [[0,-1], [0,1], [-1,0], [1,0]];
        let [dx, dy] = moves[action];
        let nx = this.pacman.x + dx, ny = this.pacman.y + dy;
        
        // Calculate distance to ghost before move
        let prevDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
        
        // Track if Pac-Man uses teleporter this turn
        this.pacmanUsedTeleporter = false;
        let originalNx = nx, originalNy = ny;
        
        // Handle teleporters using helper
        let [tpx,tpy] = this.warpThroughTeleporter(nx,ny);
        
        // Check if teleporter was used
        if (tpx !== originalNx || tpy !== originalNy) {
            this.pacmanUsedTeleporter = true;
            console.log(`📍 Pac-Man used teleporter: (${originalNx},${originalNy}) → (${tpx},${tpy})`);
        }
        
        nx = tpx; ny = tpy;
        
        // Move if not hitting wall
        if (this.grid[ny][nx] !== 1) {
            this.pacman.x = nx;
            this.pacman.y = ny;
        }
        
        // Calculate distance to ghost after move
        let newDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
        
        // Debug: Log when very close for Model 3, and also track stationary behavior
        if (this.getCurrentObjective() === 2) {
            if (newDist <= 3) {
                console.log(`Model 3: Pac-Man at (${this.pacman.x},${this.pacman.y}), Ghost at (${this.ghost.x},${this.ghost.y}), distance: ${newDist}, powered: ${this.powerTimer > 0}`);
            }
            if (this.stationaryCount > 5) {
                console.log(`⚠️ Model 3: Agent stationary for ${this.stationaryCount} moves! Action was: ${action}, Pac-Man at (${this.pacman.x},${this.pacman.y})`);
            }
        }
        
        // SPECIAL: Attack move bonus - if Pac-Man was adjacent and moved to ghost position
        if (this.getCurrentObjective() === 2 && this.powerTimer > 0 && prevDist === 1 && newDist === 0) {
            reward += 10000; // HUGE bonus for making the killing move
            console.log(`Model 3: ATTACK MOVE! Pac-Man made killing move from adjacent position!`);
        }
        
        // NEW: Pac-Man gets strategic speed advantage when using teleporters in Model 3
        if (this.pacmanUsedTeleporter && this.getCurrentObjective() === 2 && this.powerTimer > 0) {
            const ghostX = this.ghost.x, ghostY = this.ghost.y;
            const currentDist = Math.abs(this.pacman.x - ghostX) + Math.abs(this.pacman.y - ghostY);
            
            // Only apply speed boost if we're reasonably close to the ghost (within 6 tiles)
            if (currentDist <= 6) {
                console.log(`⚡ STRATEGIC TELEPORTER USAGE: Pac-Man is ${currentDist} tiles from ghost, applying speed boost!`);
                
                let bestMove = null;
                let bestDist = currentDist;
                const speedMoves = [[0,-1], [0,1], [-1,0], [1,0]];
                
                for (const [dx, dy] of speedMoves) {
                    const testX = this.pacman.x + dx;
                    const testY = this.pacman.y + dy;
                    
                    // Check if move is valid
                    if (testX >= 0 && testX < this.gridSize && 
                        testY >= 0 && testY < this.gridSize && 
                        this.grid[testY][testX] !== 1) {
                        
                        const testDist = Math.abs(testX - ghostX) + Math.abs(testY - ghostY);
                        if (testDist < bestDist) {
                            bestDist = testDist;
                            bestMove = [testX, testY];
                        }
                    }
                }
                
                // Apply speed boost move if it significantly helps
                if (bestMove && bestDist < currentDist) {
                    this.pacman.x = bestMove[0];
                    this.pacman.y = bestMove[1];
                    console.log(`⚡ SPEED BOOST APPLIED: Pac-Man moved to (${this.pacman.x},${this.pacman.y}), distance to ghost: ${bestDist}`);
                    
                    // Update distance for reward calculation
                    newDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
                    
                    // Extra reward for effective speed boost
                    reward += 300; // Bonus for effective speed boost
                    console.log(`🎯 EFFECTIVE SPEED BOOST: Distance reduced from ${currentDist} to ${bestDist}`);
                } else {
                    console.log(`⚡ SPEED BOOST SKIPPED: No beneficial move found (current distance: ${currentDist})`);
                }
            } else {
                console.log(`⚡ SPEED BOOST SKIPPED: Ghost too far away (distance: ${currentDist})`);
            }
        }
        
        // ----------------------------------------------------
        // NEW: early collision check (Pac-Man stepped into ghost)
        // ----------------------------------------------------
        if (this.pacman.x === this.ghost.x && this.pacman.y === this.ghost.y) {
            if (this.powerPelletsEaten >= this.requiredPowerPellets && this.powerTimer > 0) {
                // Powered-up win
                reward += 15000;
                this.score += 15000;
                this.done = true;
                this.ghostCaught = true; // Flag for success detection
                console.log(`🎉 COLLISION DETECTED! SUCCESS! Agent ate ghost at (${this.pacman.x},${this.pacman.y}) before ghost moved, step ${this.steps}`);
            } else {
                // Pac-Man dies
                reward -= 500;
                this.done = true;
                console.log(`💀 COLLISION DETECTED! Agent died at (${this.pacman.x},${this.pacman.y}) before ghost moved, step ${this.steps}`);
            }
        }
        
        // Get objective-based reward (additive)
        reward += this.getObjectiveBasedReward(action, prevDist, newDist);
        
        // NEW: Strategic teleporter positioning rewards for Model 3
        if (this.getCurrentObjective() === 2 && this.powerTimer > 0) {
            const pacmanNearTeleporter = this.isNearTeleporter(this.pacman.x, this.pacman.y);
            const ghostNearTeleporter = this.isNearTeleporter(this.ghost.x, this.ghost.y);
            
            // Reward Pac-Man for positioning near teleporters when ghost is also near them
            if (pacmanNearTeleporter && ghostNearTeleporter && newDist <= 4) {
                reward += 150; // Bonus for strategic teleporter positioning
                console.log(`🎯 STRATEGIC POSITIONING: Both Pac-Man and ghost near teleporters, distance: ${newDist}`);
            }
            
            // Extra reward for using teleporter to "cut off" ghost escape routes
            if (this.pacmanUsedTeleporter && ghostNearTeleporter && newDist <= 2) {
                reward += 400; // Big bonus for teleporter interception
                console.log(`🚀 TELEPORTER INTERCEPTION: Pac-Man used teleporter to cut off ghost escape!`);
            }
        }
        
        // Track recent positions for loop penalty
        this.recentPositions.push(`${this.pacman.x},${this.pacman.y}`);
        if (this.recentPositions.length > this.loopWindow) {
            this.recentPositions.shift();
        }
        
        // Loop penalty (disabled for Model 3 - teleporter strategies are valid)
        if (this.getCurrentObjective() !== 2) {
            const count = this.recentPositions.filter(p => p === `${this.pacman.x},${this.pacman.y}`).length;
            if (count >= this.loopThreshold) {
                reward -= 10; // Only penalize loops for Models 1 and 2
            }
        }
        
        // Handle pellet eating based on objective
        const objective = this.getCurrentObjective();
        if (this.grid[this.pacman.y][this.pacman.x] === 2) {
            this.grid[this.pacman.y][this.pacman.x] = 0;
            
            if (objective === 0 || objective === 1) {
                // When objective is power pellets, PENALIZE eating regular pellets
                reward -= 20; // Big penalty for eating regular pellets when should seek power pellets
                this.score += 5; // Very small score increase
            } else {
                // Model 3 can eat regular pellets normally
                reward += 10;
                this.score += 10;
            }
        }
        
        // Handle power pellet eating
        if (this.grid[this.pacman.y][this.pacman.x] === 3) {
            // NEW: mark that a power pellet was collected so ghost skips its move this turn
            justCollectedPowerPellet = true;
            this.grid[this.pacman.y][this.pacman.x] = 0;
            
            // STRATEGIC THINKING: Check if ghost is too close before giving reward
            const ghostDist = Math.abs(this.pacman.x - this.ghost.x) + Math.abs(this.pacman.y - this.ghost.y);
            
            if (ghostDist <= 1) {
                // Very dangerous! Ghost will catch us immediately
                reward -= 2000; // Big penalty for poor timing
                console.log(`POOR STRATEGY: Collected power pellet with ghost only ${ghostDist} steps away!`);
            } else if (ghostDist <= 2) {
                // Risky but might be okay
                reward += 500; // Reduced reward for risky collection
                console.log(`RISKY STRATEGY: Collected power pellet with ghost ${ghostDist} steps away`);
            } else {
                // Good strategy! Safe collection
                reward += 1000; // Full reward for safe collection
                console.log(`GOOD STRATEGY: Safely collected power pellet with ghost ${ghostDist} steps away`);
            }
            
            this.score += 1000;
            this.powerPelletsEaten++;
            
            // NEW: use the objective we captured BEFORE the pellet was eaten to test for success
            if ((objectiveBefore === 0 && this.powerPelletsEaten === 1) || 
                (objectiveBefore === 1 && this.powerPelletsEaten === 2)) {
                if (ghostDist > 2) {
                    reward += 5000; // HUGE completion bonus only for safe collection
                    this.score += 5000;
                    console.log(`Objective ${objectiveBefore + 1} completed SAFELY! Total reward this step: ${reward}`);
                    // IMMEDIATELY END EPISODE ON SUCCESSFUL OBJECTIVE COMPLETION
                    this.done = true;
                    console.log(`Episode ended: Objective ${objectiveBefore + 1} completed successfully!`);
                } else {
                    reward += 1000; // Much smaller bonus for risky completion
                    console.log(`Objective ${objectiveBefore + 1} completed but risky! Ghost too close.`);
                    // Still end episode but with less reward
                    this.done = true;
                    console.log(`Episode ended: Objective ${objectiveBefore + 1} completed but risky!`);
                }
            }
            
            // Power up after collecting ALL required power pellets
            if (this.powerPelletsEaten >= this.requiredPowerPellets) {
                this.powerTimer = 25; // Long power time (will be overridden to 999 for Model 3)
                if (!this.collectedAllPowerPellets) {
                    reward += 2000; // Huge bonus for collecting all power pellets
                    this.score += 2000;
                    this.collectedAllPowerPellets = true;
                }
            }
        }
        
        // Powered up bonus
        if (this.powerTimer > 0) {
            reward += 5; // Good bonus for being powered up
            // Don't count down power timer for Model 3 (unlimited power)
            if (this.getCurrentObjective() !== 2) {
                this.powerTimer--;
            }
        }
        
        // Move ghost BEFORE collision check
        //   – Skip if Pac-Man just collected a power-pellet (safety grace)
        //   – Skip if episode already ended
        if (!justCollectedPowerPellet && !this.done) {
            this.moveGhost();
        }
        
        // ADDITIONAL collision check after ghost teleports (catch missed collisions)
        if (!this.done && this.pacman.x === this.ghost.x && this.pacman.y === this.ghost.y) {
            if (this.powerPelletsEaten >= this.requiredPowerPellets && this.powerTimer > 0) {
                reward += 15000; // Massive reward for winning (eating ghost)
                this.score += 15000;
                this.done = true;
                this.ghostCaught = true; // Flag for success detection
                console.log(`🎉 POST-TELEPORT COLLISION! SUCCESS! Agent ate ghost at (${this.pacman.x},${this.pacman.y}) after ghost movement/teleport, step ${this.steps}`);
            } else {
                reward -= 500; // Death penalty (scaled)
                this.done = true;
                console.log(`💀 POST-TELEPORT COLLISION! Agent caught by ghost at (${this.pacman.x},${this.pacman.y}) after ghost movement/teleport, step ${this.steps}`);
            }
        }
        
        // Timeout mechanism to prevent infinite episodes
        if (this.steps >= this.maxSteps) {
            reward -= 500;
            this.done = true;
            this.ghostCaught = false; // IMPORTANT: Mark as failure, not success
            console.log(`⏰ Episode ended: TIMEOUT after ${this.steps} steps - FAILURE`);
        }
        
        // Extra timeout for stationary agents (reduced to 10 for Model 3)
        const stationaryLimit = (this.getCurrentObjective() === 2) ? 10 : 20;
        if (this.stationaryCount > stationaryLimit) {
            reward -= 1000;
            this.done = true;
            this.ghostCaught = false; // IMPORTANT: Mark as failure, not success
            console.log(`❌ Episode ended: Agent stationary for ${this.stationaryCount} moves - FAILURE`);
        }
        
        // Check collision with ghost AFTER both have moved (if not already handled)
        if (!this.done && this.pacman.x === this.ghost.x && this.pacman.y === this.ghost.y) {
            if (this.powerPelletsEaten >= this.requiredPowerPellets && this.powerTimer > 0) {
                reward += 15000; // Massive reward for winning (eating ghost)
                this.score += 15000;
                this.done = true;
                this.ghostCaught = true; // Flag for success detection
                console.log(`🎉 FINAL COLLISION! SUCCESS! Agent ate ghost at (${this.pacman.x},${this.pacman.y}) after both moved, step ${this.steps}`);
            } else {
                reward -= 500; // Death penalty (scaled)
                this.done = true;
                console.log(`💀 FINAL COLLISION! Agent caught by ghost at (${this.pacman.x},${this.pacman.y}) after both moved, step ${this.steps}`);
            }
        }
        
        // NEW: Apply global scaling to stabilise learning
        // ONLY skip scaling for the actual ghost catching reward, scale everything else
        if (this.getCurrentObjective() === 2 && this.ghostCaught && reward > 10000) {
            // For Model 3 ghost catching SUCCESS only, don't scale the big reward
            console.log(`🎯 Model 3: Preserving large ghost-catching reward ${reward} (not scaled)`);
            reward = reward;
        } else {
            // Scale all other rewards normally
            reward *= this.rewardScale;
        }
        
        return { nextState: this.getState(), reward, done: this.done };
    }

    // ----------------------------------------------------
    // Simplified ghost movement: chase Pac-Man while avoiding walls
    // ----------------------------------------------------
    moveGhost() {
        const pacPowered = this.powerTimer > 0;
        const moves = [[0,-1],[0,1],[-1,0],[1,0]];
        
        console.log(`👻 GHOST MOVE: Power Timer: ${this.powerTimer}, Pac-Man Powered: ${pacPowered}, Ghost at (${this.ghost.x},${this.ghost.y}), Pac-Man at (${this.pacman.x},${this.pacman.y})`);

        // If Pac-Man is NOT powered -> chase with BFS (as before)
        // If Pac-Man IS powered -> FLEE by maximizing distance to Pac-Man
        if (pacPowered) {
            console.log(`👻 FLEE MODE: Ghost fleeing from powered Pac-Man at (${this.pacman.x},${this.pacman.y})`);
            
            // Slow down ghost in flee mode - only move every 3 steps (33% speed)
            this.ghostMoveCounter = (this.ghostMoveCounter + 1) % 3;
            if (this.ghostMoveCounter !== 0) {
                return; // Skip movement this turn
            }
            
            // Ghost uses teleporters aggressively when Pac-Man is close
            const manDist = Math.abs(this.ghost.x - this.pacman.x)+Math.abs(this.ghost.y - this.pacman.y);
            console.log(`👻 Ghost distance to Pac-Man: ${manDist}`);
            
            if(manDist<=2){  // Aggressive teleporter usage when close
                const teleports=[[Math.floor(this.gridSize/2),0],[Math.floor(this.gridSize/2),this.gridSize-1],[0,Math.floor(this.gridSize/2)],[this.gridSize-1,Math.floor(this.gridSize/2)]];
                for(const [tx,ty] of teleports){
                    if(Math.abs(tx-this.ghost.x)+Math.abs(ty-this.ghost.y)===1){
                        console.log(`👻 EMERGENCY TELEPORT: Ghost escaping via teleporter from (${this.ghost.x},${this.ghost.y}) to (${tx},${ty})`);
                        // move into teleporter and warp using consistent teleporter logic
                        this.ghost.x = tx;
                        this.ghost.y = ty;
                        [this.ghost.x, this.ghost.y] = this.getTeleporterExit(this.ghost.x, this.ghost.y);
                        console.log(`👻 Ghost teleported to (${this.ghost.x},${this.ghost.y})`);
                        return;
                    }
                }
            }

            // FIXED: Simple greedy flee - move to the position that maximizes distance from Pac-Man
            let bestMove = [0,0];
            let bestDist = manDist;
            
            for(const [dx,dy] of moves){
                const nx = this.ghost.x + dx;
                const ny = this.ghost.y + dy;
                
                // Check bounds and walls
                if(nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if(this.grid[ny][nx] === 1) continue;
                
                // Calculate distance after potential teleporter warp
                let finalX = nx, finalY = ny;
                if(this.isTeleporter(nx,ny)){
                    [finalX, finalY] = this.getTeleporterExit(nx,ny);
                }
                
                const newDist = Math.abs(finalX - this.pacman.x) + Math.abs(finalY - this.pacman.y);
                if(newDist > bestDist){
                    bestDist = newDist;
                    bestMove = [dx,dy];
                }
            }
            
            const newX = this.ghost.x + bestMove[0];
            const newY = this.ghost.y + bestMove[1];
            
            // Safety check: ensure new position is valid
            if (newX >= 0 && newX < this.gridSize && newY >= 0 && newY < this.gridSize && 
                this.grid[newY][newX] !== 1) {
                this.ghost.x = newX;
                this.ghost.y = newY;
                console.log(`👻 FLEE MOVE: Ghost moved to (${this.ghost.x},${this.ghost.y}), distance from Pac-Man: ${Math.abs(this.ghost.x-this.pacman.x)+Math.abs(this.ghost.y-this.pacman.y)}`);
            }
            
            // Teleporter warp for ghost after move
            const oldPos = [this.ghost.x, this.ghost.y];
            [this.ghost.x,this.ghost.y]=this.warpThroughTeleporter(this.ghost.x,this.ghost.y);
            
            if(oldPos[0] !== this.ghost.x || oldPos[1] !== this.ghost.y) {
                console.log(`👻 FLEE TELEPORT: Ghost warped from (${oldPos[0]},${oldPos[1]}) to (${this.ghost.x},${this.ghost.y})`);
            }
            
            return;
        }

        // ------------------ CHASE LOGIC (Pac-Man not powered) ------------------
        console.log(`👻 CHASE MODE: Ghost chasing Pac-Man at (${this.pacman.x},${this.pacman.y})`);
        
        // Reset move counter in chase mode (normal speed)
        this.ghostMoveCounter = 0;
        
        // Breadth-first search towards Pac-Man
        const queue = [{ x: this.ghost.x, y: this.ghost.y, path: [] }];
        const visited = new Set([`${this.ghost.x},${this.ghost.y}`]);

        let bestPath = null;

        while (queue.length > 0) {
            const current = queue.shift();
            const dist = Math.abs(current.x - this.pacman.x) + Math.abs(current.y - this.pacman.y);
            // Update bestPath according to powered flag
            if (!bestPath) bestPath = current;
            else {
                const bestDist = Math.abs(bestPath.x - this.pacman.x) + Math.abs(bestPath.y - this.pacman.y);
                if (dist < bestDist) {
                    bestPath = current;
                }
            }

            // Early exit when chasing and reached Pac-Man
            if (current.x === this.pacman.x && current.y === this.pacman.y) {
                bestPath = current;
                break;
            }

            for (const [dx, dy] of moves) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if (this.grid[ny][nx] === 1) continue;
                
                let tx = nx, ty = ny;
                // Handle teleporter
                if (this.isTeleporter(nx, ny)) {
                    [tx, ty] = this.getTeleporterExit(nx, ny);
                }
                
                const key = `${tx},${ty}`;
                if (visited.has(key)) continue;
                visited.add(key);
                queue.push({ x: tx, y: ty, path: [...current.path, [dx, dy]] });
            }
        }

        let nextStep;
        if (bestPath && bestPath.path.length > 0) {
            nextStep = bestPath.path[0];
        }

        // Fallback greedy selection maximising or minimising distance
        if (!nextStep) {
            let bestMove = [0,0];
            let bestScore = -Infinity;
            for (const [dx,dy] of moves) {
                const nx = this.ghost.x + dx;
                const ny = this.ghost.y + dy;
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if (this.grid[ny][nx] === 1) continue;
                // allow teleporter
                const d = Math.abs(nx - this.pacman.x) + Math.abs(ny - this.pacman.y);
                if (d > bestScore) {
                    bestScore = d;
                    bestMove = [dx,dy];
                }
            }
            nextStep = bestMove;
        }

        const newX = this.ghost.x + nextStep[0];
        const newY = this.ghost.y + nextStep[1];
        
        // Safety check: ensure new position is valid
        if (newX >= 0 && newX < this.gridSize && newY >= 0 && newY < this.gridSize && 
            this.grid[newY][newX] !== 1) {
            this.ghost.x = newX;
            this.ghost.y = newY;
            console.log(`👻 CHASE MOVE: Ghost moved to (${this.ghost.x},${this.ghost.y}), distance to Pac-Man: ${Math.abs(this.ghost.x-this.pacman.x)+Math.abs(this.ghost.y-this.pacman.y)}`);
        }
        // If invalid move, ghost stays in place
        
        // Teleporter warp for ghost after move
        const oldGhostPos = [this.ghost.x, this.ghost.y];
        [this.ghost.x,this.ghost.y]=this.warpThroughTeleporter(this.ghost.x,this.ghost.y);
        
        // Debug: Log when ghost teleports during chase
        if (oldGhostPos[0] !== this.ghost.x || oldGhostPos[1] !== this.ghost.y) {
            console.log(`👻 CHASE TELEPORT: Ghost warped from (${oldGhostPos[0]},${oldGhostPos[1]}) to (${this.ghost.x},${this.ghost.y}) while chasing`);
        }
        
        return;
    }

    // Helper: true if (x,y) is a teleporter hole
    isTeleporter(x, y) {
        const mid = Math.floor(this.gridSize / 2);
        return (
            (y === 0 || y === this.gridSize - 1) && x === mid ||
            (x === 0 || x === this.gridSize - 1) && y === mid
        );
    }
    
    // Helper: true if (x,y) is near a teleporter (within 2 steps)
    isNearTeleporter(x, y) {
        const mid = Math.floor(this.gridSize / 2);
        const teleporters = [
            [mid, 0], [mid, this.gridSize - 1], 
            [0, mid], [this.gridSize - 1, mid]
        ];
        
        for (const [tx, ty] of teleporters) {
            const distance = Math.abs(x - tx) + Math.abs(y - ty);
            if (distance <= 2) {
                return true;
            }
        }
        return false;
    }

    getTeleporterExit(x,y){
        const mid=Math.floor(this.gridSize/2);
        let exitX, exitY;
        
        if(y===0&&x===mid) {
            exitX = mid;
            exitY = this.gridSize-2;
        } else if(y===this.gridSize-1&&x===mid) {
            exitX = mid;
            exitY = 1;
        } else if(x===0&&y===mid) {
            exitX = this.gridSize-2;
            exitY = mid;
        } else if(x===this.gridSize-1&&y===mid) {
            exitX = 1;
            exitY = mid;
        } else {
            return [x,y];
        }
        
        // Safety check: if exit position is a wall, find nearest safe position
        if (this.grid[exitY][exitX] === 1) {
            console.warn(`Teleporter exit (${exitX},${exitY}) is a wall! Finding safe position...`);
            // Try adjacent positions
            const directions = [[0,1], [0,-1], [1,0], [-1,0]];
            for (const [dx, dy] of directions) {
                const safeX = exitX + dx;
                const safeY = exitY + dy;
                if (safeX >= 0 && safeX < this.gridSize && 
                    safeY >= 0 && safeY < this.gridSize && 
                    this.grid[safeY][safeX] !== 1) {
                    console.warn(`Using safe position (${safeX},${safeY}) instead`);
                    return [safeX, safeY];
                }
            }
        }
        
        return [exitX, exitY];
    }

    // Warp entity through teleporter if standing on mouth; returns [newX,newY]
    warpThroughTeleporter(x,y){
        if(this.isTeleporter(x,y)){
            return this.getTeleporterExit(x,y);
        }
        return [x,y];
    }

    // ----------------------------------------------------
    // Restore environment from a flattened state array
    // ----------------------------------------------------
    setFromState(stateArr) {
        // Expect same format as getState()
        if (!stateArr || stateArr.length !== 4 + this.gridSize*this.gridSize + 1) return;

        this.pacman.x = stateArr[0];
        this.pacman.y = stateArr[1];
        this.ghost.x  = stateArr[2];
        this.ghost.y  = stateArr[3];

        // Re-create pellet / power pellet map while preserving walls
        let k = 4;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++, k++) {
                if (this.grid[y][x] === 1) continue; // keep walls
                const v = stateArr[k];
                if (v === 1) this.grid[y][x] = 2;      // pellet
                else if (v === 2) this.grid[y][x] = 3; // power pellet
                else this.grid[y][x] = 0;
            }
        }

        this.powerPelletsEaten = stateArr[4 + this.gridSize*this.gridSize];
        
        // Restore complete game state based on power pellets eaten
        if (this.powerPelletsEaten >= this.requiredPowerPellets) {
            this.powerTimer = 25; // Default power time (will be overridden for Model 3)
            this.collectedAllPowerPellets = true;
        } else {
            this.powerTimer = 0;
            this.collectedAllPowerPellets = false;
        }
        
        // Reset episode state
        this.done = false;
        this.steps = 0;
        this.ghostCaught = false;
        this.stationaryCount = 0;
        this.recentPositions = [];
        this.ghostRecentPositions = [];
        this.ghostMoveCounter = 0;
        
        // Calculate score based on power pellets eaten (approximate restoration)
        this.score = this.powerPelletsEaten * 6000; // Base score for power pellets
        
        console.log(`🔄 State restored: Agent(${this.pacman.x},${this.pacman.y}), Ghost(${this.ghost.x},${this.ghost.y}), PowerPellets: ${this.powerPelletsEaten}, Score: ${this.score}`);
    }
}