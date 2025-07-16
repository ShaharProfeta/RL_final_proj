class Environment {
    constructor() {
        // Get canvas and context
        this.canvas = document.getElementById('gameCanvas');
        console.log('Canvas element:', this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        console.log('Canvas context:', this.ctx);
        
        // Grid properties
        this.gridSize = 10;
        this.cellSize = this.canvas.width / this.gridSize;
        console.log('Grid properties:', {
            gridSize: this.gridSize,
            cellSize: this.cellSize,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        });
        
        // Game state
        this.currentPos = { x: 0, y: 0 };
        this.guardPos = { x: 4, y: 2 };
        this.keyCollected = false;
        this.vaultOpened = false;
        this.steps = 0;
        this.maxSteps = 300;
        this.stuckInQuicksand = 0;
        this.exitReached = false;
        
        // Loop detection
        this.recentPositions = [];
        this.maxRecentPositions = 8; // Track last 8 positions
        this.loopPenalty = -20;
        
        // Constants for rewards
        this.MOVE_REWARD = -1;
        this.WALL_COLLISION_REWARD = -10;
        this.GUARD_COLLISION_REWARD = -100;
        this.QUICKSAND_REWARD = -5;
        this.KEY_REWARD = 200;      // Higher reward for collecting key
        this.VAULT_REWARD = 300;    // Good reward for opening vault
        this.EXIT_REWARD = 1000;    // Very high reward for reaching exit
        this.INVALID_ACTION_REWARD = -10;
        this.TIMEOUT_PENALTY = -200; // Strong penalty for timeout

        // Load images
        this.guardImage = new Image();
        this.agentImage = new Image();
        this.backgroundImage = new Image();
        
        this.guardImage.src = '../pictures/haran.jpg';
        this.agentImage.src = '../pictures/beni_bornfeld.png';
        this.backgroundImage.src = '../pictures/school-classroom-top-view_152789-53.jpg';
        
        this.imagesLoaded = false;
        
        // Wait for all images to load
        Promise.all([
            new Promise(resolve => this.guardImage.onload = resolve),
            new Promise(resolve => this.agentImage.onload = resolve),
            new Promise(resolve => this.backgroundImage.onload = resolve)
        ]).then(() => {
            console.log('Images loaded successfully');
            this.imagesLoaded = true;
            this.render(); // Initial render once images are loaded
        }).catch(error => {
            console.error('Error loading images:', error);
            // Set fallback emoji characters
            this.guardEmoji = '👮';
            this.agentEmoji = '🤖';
        });

        // Guard patrol path - patrols in a rectangle
        this.guardPatrolPoints = [
            { x: 2, y: 2 },  // Top left
            { x: 6, y: 2 },  // Top right
            { x: 6, y: 7 },  // Bottom right
            { x: 2, y: 7 }   // Bottom left
        ];
        this.currentPatrolIndex = 0;
        this.guardWaitSteps = 0;

        // Build initial map
        this.buildMap();
    }

    buildMap() {
        // Initialize empty grid
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        
        // Place walls (1)
        const walls = [
            // Top section
            {x: 1, y: 1}, {x: 1, y: 2}, {x: 2, y: 1},
            {x: 7, y: 1}, {x: 8, y: 1}, {x: 8, y: 2},
            
            // Bottom section
            {x: 1, y: 7}, {x: 1, y: 8}, {x: 2, y: 8},
            {x: 7, y: 8}, {x: 8, y: 7}, {x: 8, y: 8},
            
            // Middle sections
            {x: 3, y: 3}, {x: 3, y: 4}, {x: 3, y: 5}, {x: 3, y: 6},
            {x: 5, y: 3}, {x: 5, y: 4}, {x: 5, y: 5}, {x: 5, y: 6}
        ];
        
        walls.forEach(wall => {
            this.grid[wall.y][wall.x] = 1;
        });
        
        // Place quicksand (2)
        const quicksand = [
            {x: 4, y: 2},
            {x: 2, y: 5},
            {x: 5, y: 7},
            {x: 7, y: 4}
        ];
        
        quicksand.forEach(qs => {
            this.grid[qs.y][qs.x] = 2;
        });
        
        // Place teleporters (3, 4)
        this.grid[2][2] = 3;  // Teleporter 1
        this.grid[7][7] = 4;  // Teleporter 2
        
        // Place key (5)
        this.grid[4][8] = 5;
        
        // Place vault (6)
        this.grid[4][4] = 6;
        
        // Place exit (7) - initially hidden, will be shown when vault is opened
        this.exitPos = { x: 9, y: 9 };
        this.grid[9][9] = 0;  // Will be set to 7 when vault is opened
        
        // Initialize visit counts
        this.visitCounts = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
    }

    getReward(baseReward) {
        return baseReward * (this.vaultOpened ? 2.0 : 1.0);
    }

    getState() {
        // Enhanced state representation: position + key status + vault status
        const baseState = this.currentPos.x + this.currentPos.y * this.gridSize;
        const keyFlag = this.keyCollected ? 1 : 0;
        const vaultFlag = this.vaultOpened ? 1 : 0;
        
        // Combine: base state + key(100s) + vault(1000s)
        return baseState + keyFlag * 100 + vaultFlag * 1000;
    }

    getCurrentPos() {
        return this.currentPos;
    }

    isValidMove(pos) {
        return pos.x >= 0 && pos.x < this.gridSize &&
               pos.y >= 0 && pos.y < this.gridSize &&
               this.grid[pos.y][pos.x] !== 1;  // Not a wall
    }

    getValidActions() {
        const validActions = [];
        const pos = this.currentPos;
        
        // Check each direction [up, right, down, left]
        const directions = [
            { dx: 0, dy: -1 }, // up
            { dx: 1, dy: 0 },  // right
            { dx: 0, dy: 1 },  // down
            { dx: -1, dy: 0 }  // left
        ];

        directions.forEach((dir, index) => {
            const newX = pos.x + dir.dx;
            const newY = pos.y + dir.dy;
            
            // Check if the move would be within grid bounds and not into a wall
            const isValid = newX >= 0 && newX < this.gridSize &&
                          newY >= 0 && newY < this.gridSize &&
                          this.grid[newY][newX] !== 1;
            
            validActions.push({ action: index, valid: isValid });
        });

        return validActions;
    }

    step(action) {
        this.steps++;
        const validActions = this.getValidActions();

        // Terminal state: max steps
        if (this.steps >= this.maxSteps) {
            return {
                nextState: this.getState(),
                reward: this.TIMEOUT_PENALTY, // Strong penalty for timing out
                done: true,
                doneType: 'maxSteps',
                validActions: validActions
            };
        }

        // If agent is stuck in quicksand, skip movement and decrement stuck counter
        if (this.stuckInQuicksand > 0) {
            this.stuckInQuicksand--;
            // Only the guard moves
            this.moveGuard();
            return {
                nextState: this.getState(),
                reward: this.MOVE_REWARD, // Only move penalty while stuck
                done: false,
                doneType: null,
                validActions: validActions
            };
        }

        // If action is invalid, return negative reward without moving
        if (!validActions[action].valid) {
            return {
                nextState: this.getState(),
                reward: this.INVALID_ACTION_REWARD,
                done: false,
                doneType: null,
                validActions: validActions
            };
        }

        // Get new position based on action
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const [dx, dy] = directions[action];
        const newX = this.currentPos.x + dx;
        const newY = this.currentPos.y + dy;
        
        // Store previous position
        const prevPos = { ...this.currentPos };
        
        // Update position
        this.currentPos = { x: newX, y: newY };
        
        // Track position for loop detection
        const posKey = `${newX},${newY}`;
        this.recentPositions.push(posKey);
        if (this.recentPositions.length > this.maxRecentPositions) {
            this.recentPositions.shift();
        }
        
        // Terminal state: guard catches agent
        if (this.checkGuardCollision()) {
            this.currentPos = { x: 0, y: 0 }; // Reset position
            return {
                nextState: this.getState(),
                reward: this.GUARD_COLLISION_REWARD,
                done: true,
                doneType: 'guard',
                validActions: this.getValidActions()
            };
        }

        // Calculate reward and check for special tiles
        let reward = this.MOVE_REWARD;
        let done = false;
        let doneType = null;
        
        // Check for loops (visiting same position too frequently)
        const currentPosCount = this.recentPositions.filter(pos => pos === posKey).length;
        if (currentPosCount >= 3) { // Visited same position 3+ times recently
            reward += this.loopPenalty;
        }
        
        // Add progress-based reward to encourage reaching objectives
        if (!this.keyCollected) {
            // Phase 1: Encourage moving towards key at (8, 4)
            const distToKey = Math.abs(newX - 8) + Math.abs(newY - 4);
            const prevDistToKey = Math.abs(prevPos.x - 8) + Math.abs(prevPos.y - 4);
            if (distToKey < prevDistToKey) {
                reward += 0.5; // Small progress reward
            }
        } else if (!this.vaultOpened) {
            // Phase 2: Encourage moving towards vault at (4, 4)
            const distToVault = Math.abs(newX - 4) + Math.abs(newY - 4);
            const prevDistToVault = Math.abs(prevPos.x - 4) + Math.abs(prevPos.y - 4);
            if (distToVault < prevDistToVault) {
                reward += 0.5; // Small progress reward
            }
        } else {
            // Phase 3: Encourage moving towards exit at (9, 9)
            const distToExit = Math.abs(newX - 9) + Math.abs(newY - 9);
            const prevDistToExit = Math.abs(prevPos.x - 9) + Math.abs(prevPos.y - 9);
            if (distToExit < prevDistToExit) {
                reward += 1.0; // Larger progress reward for final phase
            }
        }

        const currentTile = this.grid[newY][newX];
        
        // Handle quicksand
        if (currentTile === 2) {
            reward += this.QUICKSAND_REWARD;
            this.stuckInQuicksand = 3; // Stuck for 3 turns
        }
        
        // Handle teleporters
        if (currentTile === 3 || currentTile === 4) {
            const otherTeleporter = currentTile === 3 ? 4 : 3;
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.grid[y][x] === otherTeleporter) {
                        this.currentPos = { x, y };
                        break;
                    }
                }
            }
        }
        
        // Handle key collection
        if (currentTile === 5 && !this.keyCollected) {
            this.keyCollected = true;
            reward += this.KEY_REWARD;
            this.grid[newY][newX] = 0; // Remove the key from the grid
        }
        
        // Handle vault
        if (currentTile === 6 && this.keyCollected && !this.vaultOpened) {
            this.vaultOpened = true;
            reward += this.VAULT_REWARD;
            // Show the exit when vault is opened
            this.grid[this.exitPos.y][this.exitPos.x] = 7;
        }
        
        // Terminal state: agent finishes (exit)
        if (currentTile === 7 && this.vaultOpened) {
            reward += this.EXIT_REWARD;
            done = true;
            doneType = 'finish';
            this.exitReached = true;
        }

        // Move guard
        this.moveGuard();

        // Get next state and valid actions
        const nextState = this.getState();
        const nextValidActions = this.getValidActions();

        return {
            nextState: nextState,
            reward: reward,
            done: done,
            doneType: doneType,
            validActions: nextValidActions
        };
    }

    reset() {
        // Reset agent position
        this.currentPos = { x: 0, y: 0 };
        
        // Reset guard position
        this.guardPos = { ...this.guardPatrolPoints[0] };
        this.currentPatrolIndex = 0;
        this.guardWaitSteps = 0;
        
        // Reset game state
        this.keyCollected = false;
        this.vaultOpened = false;
        this.steps = 0;
        this.stuckInQuicksand = 0;
        this.exitReached = false;
        
        // Reset loop detection
        this.recentPositions = [];
        
        // Reset visit counts
        this.visitCounts = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        
        // Rebuild map (this will reset the exit to hidden state)  
        this.buildMap();
        
        // Get initial state and valid actions
        const state = this.getState();
        const validActions = this.getValidActions();
        
        return { state, validActions };
    }

    isQuicksand(x, y) {
        return this.grid[y][x] === 2;
    }

    moveGuard() {
        // If guard is waiting at a point, continue waiting
        if (this.guardWaitSteps > 0) {
            this.guardWaitSteps--;
            return this.checkGuardCollision();
        }

        const prevGuardPos = { ...this.guardPos };
        const nextPoint = this.guardPatrolPoints[(this.currentPatrolIndex + 1) % this.guardPatrolPoints.length];
        
        // Try to move one step towards next point, checking for walls
        let moved = false;
        if (this.guardPos.x < nextPoint.x) {
            const nextPos = { x: this.guardPos.x + 1, y: this.guardPos.y };
            if (this.isValidMove(nextPos)) {
                this.guardPos.x++;
                moved = true;
            }
        } else if (this.guardPos.x > nextPoint.x) {
            const nextPos = { x: this.guardPos.x - 1, y: this.guardPos.y };
            if (this.isValidMove(nextPos)) {
                this.guardPos.x--;
                moved = true;
            }
        } else if (this.guardPos.y < nextPoint.y) {
            const nextPos = { x: this.guardPos.x, y: this.guardPos.y + 1 };
            if (this.isValidMove(nextPos)) {
                this.guardPos.y++;
                moved = true;
            }
        } else if (this.guardPos.y > nextPoint.y) {
            const nextPos = { x: this.guardPos.x, y: this.guardPos.y - 1 };
            if (this.isValidMove(nextPos)) {
                this.guardPos.y--;
                moved = true;
            }
        }
        
        // If reached next point or couldn't move, update patrol index and wait
        if ((this.guardPos.x === nextPoint.x && this.guardPos.y === nextPoint.y) || !moved) {
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.guardPatrolPoints.length;
            this.guardWaitSteps = 2; // Wait for 2 steps at each point
        }

        return this.checkGuardCollision(prevGuardPos);
    }

    checkGuardCollision(prevGuardPos = null) {
        // Direct collision
        if (this.currentPos.x === this.guardPos.x && this.currentPos.y === this.guardPos.y) {
            return true;
        }

        // Check path collision if guard moved
        if (prevGuardPos) {
            const didMove = prevGuardPos.x !== this.guardPos.x || prevGuardPos.y !== this.guardPos.y;
            if (didMove) {
                if (prevGuardPos.y === this.guardPos.y) { // Horizontal movement
                    const minX = Math.min(prevGuardPos.x, this.guardPos.x);
                    const maxX = Math.max(prevGuardPos.x, this.guardPos.x);
                    if (this.currentPos.y === this.guardPos.y && 
                        this.currentPos.x >= minX && this.currentPos.x <= maxX) {
                        return true;
                    }
                } else { // Vertical movement
                    const minY = Math.min(prevGuardPos.y, this.guardPos.y);
                    const maxY = Math.max(prevGuardPos.y, this.guardPos.y);
                    if (this.currentPos.x === this.guardPos.x && 
                        this.currentPos.y >= minY && this.currentPos.y <= maxY) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    render(agent = null) {
        const ctx = this.ctx;
        if (!ctx) {
            console.error('No canvas context available');
            return;
        }

        console.log('Rendering with agent:', agent);
        console.log('Current state:', {
            currentPos: this.currentPos,
            guardPos: this.guardPos,
            keyCollected: this.keyCollected,
            vaultOpened: this.vaultOpened,
            steps: this.steps,
            showingQValues: window.showingQValues
        });

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw classroom background
        if (this.imagesLoaded && this.backgroundImage) {
            ctx.globalAlpha = 0.3; // Make background semi-transparent
            ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            ctx.globalAlpha = 1.0; // Reset transparency
        }

        // Draw grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                // Draw cell border
                ctx.strokeStyle = '#ccc';
                ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

                // Draw cell contents based on type
                switch(this.grid[y][x]) {
                    case 1: // Wall
                        ctx.fillStyle = 'rgba(68, 68, 68, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        break;
                    case 2: // Quicksand
                        ctx.fillStyle = 'rgba(210, 180, 140, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.font = '30px Arial';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.fillText('🏖️', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        break;
                    case 3: // Teleporter 1
                        ctx.fillStyle = 'rgba(147, 112, 219, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.font = '30px Arial';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.fillText('🌀', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        break;
                    case 4: // Teleporter 2
                        ctx.fillStyle = 'rgba(147, 112, 219, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.font = '30px Arial';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.fillText('🌀', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        break;
                    case 5: // Key
                        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.font = '30px Arial';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.fillText('🔑', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        break;
                    case 6: // Vault
                        if (this.vaultOpened) {
                            ctx.fillStyle = 'rgba(50, 205, 50, 0.5)'; // Green
                            ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                            ctx.font = '30px Arial';
                            ctx.fillStyle = 'black';
                            ctx.textAlign = 'center';
                            ctx.fillText('🔓', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        } else {
                            ctx.fillStyle = 'rgba(139, 69, 19, 0.5)'; // Brown
                            ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                            ctx.font = '30px Arial';
                            ctx.fillStyle = 'black';
                            ctx.textAlign = 'center';
                            ctx.fillText('🔒', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        }
                        break;
                    case 7: // Exit
                        ctx.fillStyle = 'rgba(50, 205, 50, 0.5)';
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.font = '30px Arial';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.fillText('🚪', x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/1.5);
                        break;
                }

                // Draw Q-value heatmap if agent is provided and showingQValues is true
                if (agent && window.showingQValues) {
                    // Create state matching the enhanced state representation
                    const baseState = x + y * this.gridSize;
                    const keyFlag = this.keyCollected ? 1 : 0;
                    const vaultFlag = this.vaultOpened ? 1 : 0;
                    const state = baseState + keyFlag * 100 + vaultFlag * 1000;
                    const qValues = agent.Q[state];
                    
                    if (qValues && qValues.length > 0) {
                        // Find the maximum Q-value for this state
                        const maxQ = Math.max(...qValues);
                        const minQ = Math.min(...qValues);
                        
                        // Only show heatmap for states with meaningful Q-values
                        if (maxQ > -50) { // Threshold to avoid showing very negative values
                            // Normalize the max Q-value to determine color intensity
                            let normalizedValue = 0;
                            if (maxQ > 0) {
                                normalizedValue = Math.min(maxQ / 100, 1); // Scale positive values
                            } else {
                                normalizedValue = Math.max(maxQ / 50, -1); // Scale negative values
                            }
                            
                            // Color scheme based on game phase
                            let heatmapColor;
                            if (!this.keyCollected) {
                                // Phase 1: Blue to yellow gradient (path to key)
                                if (normalizedValue >= 0) {
                                    const intensity = Math.floor(normalizedValue * 255);
                                    heatmapColor = `rgba(${255-intensity}, ${255-intensity}, 255, 0.6)`;
                                } else {
                                    const intensity = Math.floor(Math.abs(normalizedValue) * 100);
                                    heatmapColor = `rgba(${100+intensity}, ${100+intensity}, ${200+intensity}, 0.3)`;
                                }
                            } else if (!this.vaultOpened) {
                                // Phase 2: Green gradient (path to vault)
                                if (normalizedValue >= 0) {
                                    const intensity = Math.floor(normalizedValue * 255);
                                    heatmapColor = `rgba(${255-intensity}, 255, ${255-intensity}, 0.6)`;
                                } else {
                                    const intensity = Math.floor(Math.abs(normalizedValue) * 100);
                                    heatmapColor = `rgba(${150+intensity}, ${200+intensity}, ${150+intensity}, 0.3)`;
                                }
                            } else {
                                // Phase 3: Red gradient (path to exit)
                                if (normalizedValue >= 0) {
                                    const intensity = Math.floor(normalizedValue * 255);
                                    heatmapColor = `rgba(255, ${255-intensity}, ${255-intensity}, 0.6)`;
                                } else {
                                    const intensity = Math.floor(Math.abs(normalizedValue) * 100);
                                    heatmapColor = `rgba(${200+intensity}, ${150+intensity}, ${150+intensity}, 0.3)`;
                                }
                            }
                            
                            // Draw heatmap overlay
                            ctx.fillStyle = heatmapColor;
                            ctx.fillRect(x * this.cellSize + 1, y * this.cellSize + 1, 
                                       this.cellSize - 2, this.cellSize - 2);
                            
                            // Draw the maximum Q-value as text
                            ctx.font = 'bold 10px Arial';
                            ctx.fillStyle = 'black';
                            ctx.textAlign = 'center';
                            ctx.fillText(maxQ.toFixed(1), 
                                       x * this.cellSize + this.cellSize/2, 
                                       y * this.cellSize + this.cellSize/2 - 5);
                            
                            // Draw arrow indicating best action
                            const bestAction = qValues.indexOf(maxQ);
                            const arrows = ['↑', '→', '↓', '←'];
                            if (bestAction >= 0 && bestAction < arrows.length) {
                                ctx.font = '16px Arial';
                                ctx.fillStyle = 'darkblue';
                                ctx.fillText(arrows[bestAction], 
                                           x * this.cellSize + this.cellSize/2, 
                                           y * this.cellSize + this.cellSize/2 + 10);
                            }
                        }
                    }
                }
            }
        }

        // Draw agent
        if (this.imagesLoaded) {
            ctx.drawImage(this.agentImage, 
                this.currentPos.x * this.cellSize + 5, 
                this.currentPos.y * this.cellSize + 5,
                this.cellSize - 10, 
                this.cellSize - 10);
        } else {
            ctx.font = '30px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText('🤖', this.currentPos.x * this.cellSize + this.cellSize/2, this.currentPos.y * this.cellSize + this.cellSize/1.5);
        }

        // Draw guard
        if (this.imagesLoaded) {
            ctx.drawImage(this.guardImage,
                this.guardPos.x * this.cellSize + 5,
                this.guardPos.y * this.cellSize + 5,
                this.cellSize - 10,
                this.cellSize - 10);
        } else {
            ctx.font = '30px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText('👮', this.guardPos.x * this.cellSize + this.cellSize/2, this.guardPos.y * this.cellSize + this.cellSize/1.5);
        }

        // Draw status
        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.fillText(`Key Collected: ${this.keyCollected ? '✅' : '❌'}`, 10, this.canvas.height - 60);
        ctx.fillText(`Vault Opened: ${this.vaultOpened ? '✅' : '❌'}`, 10, this.canvas.height - 40);
        ctx.fillText(`Exit the room: ${this.exitReached ? '✅' : '❌'}`, 10, this.canvas.height - 20);
        if (this.stuckInQuicksand > 0) {
            ctx.fillText(`Stuck in Quicksand! (${this.stuckInQuicksand} turns)`, 250, this.canvas.height - 20);
        }
    }
} 