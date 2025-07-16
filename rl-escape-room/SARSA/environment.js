class Environment {
    constructor() {
        this.gridSize = 10;
        this.nS = this.gridSize * this.gridSize;  // number of states
        this.nA = 4;  // number of actions (up, right, down, left)
        
        // Define rewards optimized for γ = 0.9 and ~20 step episodes
        this.goalReward = 250;      // Very high goal reward to overcome discounting
        this.npcCatchReward = -80;  // Higher penalty to discourage risky behavior
        this.freezeReward = 5.0;    // Good strategic bonus
        this.stepCost = 0;          // Remove step cost - let discount factor handle efficiency
        this.revisitPenalty = -5.0; // Strong loop prevention
        
        // Define fixed positions
        this.startPos = { x: 0, y: 0 };
        this.goalPos = { x: this.gridSize - 1, y: this.gridSize - 1 };
        this.currentPos = { ...this.startPos };
        this.npcPos = { x: this.gridSize - 1, y: 0 };

        // Initialize freeze blocks array
        this.freezeBlocks = [];

        // Initialize visit tracking for loop prevention
        this.visitedCells = new Map(); // key: 'x,y', value: visit count
        this.currentEpisodeVisits = new Map(); // Reset each episode

        // Generate random map
        // this.generateRandomMap();
        
        // NPC freeze mechanic
        this.npcFrozenTurns = 0;
        this.npcSpeed = 0.7; // NPC only moves 70% of the time when not frozen
        
        // Canvas and rendering properties
        this.cellSize = 60;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Arrow properties for visualization
        this.arrowSize = 20;

        // Image loading tracking
        this.imagesLoaded = 0;
        this.totalImages = 3;
        this.allImagesLoaded = false;

        // Load agent image
        this.agentImage = new Image();
        this.agentImage.onload = () => {
            console.log('Agent image loaded');
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.agentImage.onerror = () => {
            console.error('Failed to load agent image');
            this.agentImage = null;
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.agentImage.src = '../pictures/beni_bornfeld.png';
        
        // Load NPC image (haran.jpg as requested)
        this.npcImage = new Image();
        this.npcImage.onload = () => {
            console.log('NPC image loaded');
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.npcImage.onerror = () => {
            console.error('Failed to load NPC image');
            this.npcImage = null;
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.npcImage.src = '../pictures/haran.jpg';

        // Load classroom background image
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => {
            console.log('Background image loaded');
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.backgroundImage.onerror = () => {
            console.error('Failed to load background image');
            this.backgroundImage = null;
            this.imagesLoaded++;
            this.checkAllImagesLoaded();
        };
        this.backgroundImage.src = '../pictures/school-classroom-top-view_152789-53.jpg';

        // --- Static map definition ---
        // 0: normal, 1: block, 2: slippery
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.slipperyProbs = {}; // key: 'x,y', value: [pr, pd, pu, pl]
        this.buildStaticMap();
    }
    
    checkAllImagesLoaded() {
        if (this.imagesLoaded >= this.totalImages) {
            this.allImagesLoaded = true;
            console.log('All images loaded, rendering...');
            // Trigger initial render once all images are loaded
            if (window.env && window.agent) {
                this.render(window.agent);
            }
        }
    }
    
    reset() {
        this.currentPos = { ...this.startPos };
        this.npcPos = { x: this.gridSize - 1, y: 0 };
        this.npcFrozenTurns = 0;
        // Reset all freeze blocks to active
        this.freezeBlocks.forEach(block => block.active = true);
        // Reset visit tracking for new episode
        this.currentEpisodeVisits.clear();
        // Mark starting position as visited
        const startKey = `${this.startPos.x},${this.startPos.y}`;
        this.currentEpisodeVisits.set(startKey, 1);
        return this.getState(this.currentPos);
    }
    
    getState(pos) {
        // Calculate state based on agent position only
        return pos.y * this.gridSize + pos.x;
    }
    
    getPosition(state) {
        return {
            x: state % this.gridSize,
            y: Math.floor(state / this.gridSize)
        };
    }
    
    isOnFreezeBlock(pos) {
        const block = this.freezeBlocks.find(block => 
            block.x === pos.x && block.y === pos.y
        );
        return block && block.active;
    }
    
    deactivateFreezeBlock(pos) {
        const block = this.freezeBlocks.find(block => 
            block.x === pos.x && block.y === pos.y
        );
        if (block) {
            block.active = false;
        }
    }
    
    step(action) {
        const moves = [
            { dx: 0, dy: -1 },  // up
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: 1 },   // down
            { dx: -1, dy: 0 }   // left
        ];
        
        let newPos = {
            x: this.currentPos.x + moves[action].dx,
            y: this.currentPos.y + moves[action].dy
        };
        
        // If move is into a block, stay in place
        if (newPos.x < 0 || newPos.x >= this.gridSize || newPos.y < 0 || newPos.y >= this.gridSize || this.grid[newPos.y][newPos.x] === 1) {
            newPos = { ...this.currentPos };
        }
        
        // If new cell is slippery, pick direction by probability
        if (this.grid[newPos.y][newPos.x] === 2) {
            const probs = this.slipperyProbs[`${newPos.x},${newPos.y}`];
            let r = Math.random();
            let sum = 0;
            let slipDir = 0;
            for (let d = 0; d < 4; d++) {
                sum += probs[d];
                if (r < sum) {
                    slipDir = d;
                    break;
                }
            }
            let slipPos = {
                x: newPos.x + moves[slipDir].dx,
                y: newPos.y + moves[slipDir].dy
            };
            // If slip is into a block or out of bounds, stay in place
            if (slipPos.x < 0 || slipPos.x >= this.gridSize || slipPos.y < 0 || slipPos.y >= this.gridSize || this.grid[slipPos.y][slipPos.x] === 1) {
                slipPos = { ...newPos };
            }
            newPos = slipPos;
        }
        
        // Store old position
        const oldPos = {...this.currentPos};
        
        // IMPORTANT: Move NPC first, before agent moves!
        this.moveNPC();
        
        // Check if NPC moved to agent's current position (immediate capture)
        if (this.currentPos.x === this.npcPos.x && this.currentPos.y === this.npcPos.y) {
            const state = this.getState(this.currentPos);
            return {
                nextState: state,
                reward: this.npcCatchReward,
                done: true
            };
        }
        
        // Now update agent position
        this.currentPos = newPos;
        
        let reward = this.stepCost; // Basic step cost
        
        // Add progress reward - small bonus for moving toward goal
        const oldDistanceToGoal = Math.abs(oldPos.x - this.goalPos.x) + Math.abs(oldPos.y - this.goalPos.y);
        const newDistanceToGoal = Math.abs(this.currentPos.x - this.goalPos.x) + Math.abs(this.currentPos.y - this.goalPos.y);
        
        if (newDistanceToGoal < oldDistanceToGoal) {
            reward += 0.3; // Very small progress bonus - less greedy
        } else if (newDistanceToGoal > oldDistanceToGoal) {
            reward -= 0.2; // Smaller penalty for moving away from goal
        }
        
        // Check for revisit penalty
        const currentPosKey = `${this.currentPos.x},${this.currentPos.y}`;
        const visitCount = this.currentEpisodeVisits.get(currentPosKey) || 0;
        
        if (visitCount > 0) {
            // Apply revisit penalty, increasing with each additional visit
            reward += this.revisitPenalty * visitCount;
        }
        
        // Update visit count
        this.currentEpisodeVisits.set(currentPosKey, visitCount + 1);
        
        // Handle freeze block bonus
        if (this.isOnFreezeBlock(this.currentPos)) {
            this.npcFrozenTurns = 4;
            reward += this.freezeReward;
            this.deactivateFreezeBlock(this.currentPos);
        }
        
        const state = this.getState(this.currentPos);
        
        // Check for NPC catch after both moved
        if (this.currentPos.x === this.npcPos.x && this.currentPos.y === this.npcPos.y) {
            return {
                nextState: state,
                reward: this.npcCatchReward,
                done: true
            };
        }
        
        // Check for goal reach
        if (this.currentPos.x === this.goalPos.x && this.currentPos.y === this.goalPos.y) {
            return {
                nextState: state,
                reward: this.goalReward,
                done: true
            };
        }
        
        return {
            nextState: state,
            reward: reward,
            done: false
        };
    }
    
    render(agent = null) {
        try {
            const ctx = this.ctx;
            const cellSize = this.cellSize;
            // Define moves array for Q-value display
            const moves = [
                { dx: 0, dy: -1 },  // up
                { dx: 1, dy: 0 },   // right
                { dx: 0, dy: 1 },   // down
                { dx: -1, dy: 0 }   // left
            ];
            
            // Clear canvas
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw classroom background if available
            if (this.backgroundImage && this.backgroundImage.complete) {
                ctx.globalAlpha = 0.4; // Make background semi-transparent
                ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
                ctx.globalAlpha = 1.0;
            }
            
            // Draw grid
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    // Draw cell background for wall
                    if (this.grid[y][x] === 1) {
                        ctx.fillStyle = '#444'; // Wall color
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        ctx.strokeStyle = '#ccc';
                        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        continue; // Skip Q-value drawing for walls
                    }
                    // Draw cell background
                    if (this.grid[y][x] === 2) {
                        ctx.fillStyle = '#b3e0ff'; // Slippery
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        // Draw probabilities
                        ctx.fillStyle = '#1976d2';
                        ctx.font = '10px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const probs = this.slipperyProbs[`${x},${y}`];
                        if (probs) {
                            if (probs[0] > 0) ctx.fillText(Math.round(probs[0]*100)+'%', x*cellSize+cellSize/2, y*cellSize+cellSize/5); // up
                            if (probs[1] > 0) ctx.fillText(Math.round(probs[1]*100)+'%', x*cellSize+cellSize*4/5, y*cellSize+cellSize/2); // right
                            if (probs[2] > 0) ctx.fillText(Math.round(probs[2]*100)+'%', x*cellSize+cellSize/2, y*cellSize+cellSize*4/5); // down
                            if (probs[3] > 0) ctx.fillText(Math.round(probs[3]*100)+'%', x*cellSize+cellSize/5, y*cellSize+cellSize/2); // left
                        }
                    }
                    ctx.strokeStyle = '#ccc';
                    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    
                    // Draw visited cells indication
                    const posKey = `${x},${y}`;
                    const visitCount = this.currentEpisodeVisits.get(posKey) || 0;
                    if (visitCount > 0) {
                        // Show visited cells with increasing red tint based on visit count
                        const alpha = Math.min(0.1 + (visitCount - 1) * 0.1, 0.4);
                        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        
                        // Show visit count for cells visited more than once
                        if (visitCount > 1) {
                            ctx.fillStyle = 'darkred';
                            ctx.font = 'bold 12px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(visitCount.toString(), 
                                x * cellSize + cellSize/2, 
                                y * cellSize + cellSize/2);
                        }
                    }

                    // Draw freeze blocks
                    const block = this.freezeBlocks.find(b => b.x === x && b.y === y);
                    if (block) {
                        ctx.fillStyle = block.active ? 
                            'rgba(0, 191, 255, 0.3)' :  // Light blue for active
                            'rgba(200, 200, 200, 0.3)'; // Gray for inactive
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                    
                    // Draw Q-values if agent is provided
                    if (agent && window.showingQValues) {
                        const state = this.getState({x, y});
                        const qValues = agent.Q[state];
                        if (qValues) {
                            // Draw background color based on max Q-value
                            const maxQ = Math.max(...qValues);
                            const minQ = Math.min(...qValues);
                            
                            if (maxQ !== 0) {
                                const normalizedValue = maxQ / Math.max(Math.abs(minQ), Math.abs(maxQ));
                                const color = normalizedValue >= 0 ? 
                                    `rgba(0, 255, 0, ${Math.min(Math.abs(normalizedValue), 0.3)})` :
                                    `rgba(255, 0, 0, ${Math.min(Math.abs(normalizedValue), 0.3)})`;
                                ctx.fillStyle = color;
                                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                            }

                            // Draw directional Q-values
                            ctx.font = '10px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            // For each direction, check if it's a valid move and if it leads to goal
                            for (let i = 0; i < 4; i++) {
                                const nextPos = {
                                    x: x + moves[i].dx,
                                    y: y + moves[i].dy
                                };
                                
                                // Check if move is valid
                                const isValid = nextPos.x >= 0 && nextPos.x < this.gridSize && 
                                              nextPos.y >= 0 && nextPos.y < this.gridSize;
                                
                                // Determine display value
                                let displayValue;
                                if (!isValid) {
                                    displayValue = "0.00";
                                } else {
                                    displayValue = qValues[i].toFixed(2);
                                }

                                // Position for each direction
                                let textX = x * cellSize + cellSize/2;
                                let textY = y * cellSize + cellSize/2;
                                
                                switch(i) {
                                    case 0: // Up
                                        textY = y * cellSize + cellSize/4;
                                        break;
                                    case 1: // Right
                                        textX = x * cellSize + 3*cellSize/4;
                                        break;
                                    case 2: // Down
                                        textY = y * cellSize + 3*cellSize/4;
                                        break;
                                    case 3: // Left
                                        textX = x * cellSize + cellSize/4;
                                        break;
                                }

                                ctx.fillStyle = parseFloat(displayValue) > 0 ? 'green' : 
                                              (parseFloat(displayValue) < 0 ? 'red' : 'black');
                                ctx.fillText(displayValue, textX, textY);
                            }
                        }
                    }
                }
            }
            
            // Draw goal
            ctx.fillStyle = 'green';
            ctx.fillRect(this.goalPos.x * cellSize, this.goalPos.y * cellSize, cellSize, cellSize);
            
            // Draw NPC with frozen effect
            if (this.npcImage && this.npcImage.complete) {
                if (this.npcFrozenTurns > 0) {
                    ctx.globalAlpha = 0.5;
                }
                ctx.drawImage(this.npcImage, 
                    this.npcPos.x * cellSize, this.npcPos.y * cellSize, 
                    cellSize, cellSize);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = this.npcFrozenTurns > 0 ? 'rgba(255, 0, 0, 0.5)' : 'red';
                ctx.beginPath();
                ctx.arc(
                    this.npcPos.x * cellSize + cellSize/2,
                    this.npcPos.y * cellSize + cellSize/2,
                    cellSize/3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
            
            // Draw agent
            if (this.agentImage && this.agentImage.complete) {
                ctx.drawImage(this.agentImage, 
                    this.currentPos.x * cellSize, this.currentPos.y * cellSize, 
                    cellSize, cellSize);
            } else {
                ctx.fillStyle = 'blue';
                ctx.beginPath();
                ctx.arc(
                    this.currentPos.x * cellSize + cellSize/2,
                    this.currentPos.y * cellSize + cellSize/2,
                    cellSize/3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        } catch (error) {
            console.error('Error in render:', error);
        }
    }
    
    drawArrow(x, y, direction, intensity = 1) {
        const ctx = this.ctx;
        const cellSize = this.cellSize;
        const centerX = x * cellSize + cellSize/2;
        const centerY = y * cellSize + cellSize/2;
        const arrowSize = this.arrowSize * intensity; // Scale arrow size with Q-value
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(direction * Math.PI/2);
        
        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(0, -arrowSize/2);
        ctx.lineTo(arrowSize/3, arrowSize/2);
        ctx.lineTo(-arrowSize/3, arrowSize/2);
        ctx.closePath();
        
        // Use black arrows with opacity based on Q-value intensity
        ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
        ctx.fill();
        ctx.restore();
    }

    moveNPC() {
        if (this.npcFrozenTurns > 0) {
            this.npcFrozenTurns--;
            return;
        }
        
        // Get NPC possible moves (cannot move onto blocks)
        const npcPossibleMoves = [
            { x: this.npcPos.x, y: this.npcPos.y - 1 },     // up
            { x: this.npcPos.x + 1, y: this.npcPos.y },     // right
            { x: this.npcPos.x, y: this.npcPos.y + 1 },     // down
            { x: this.npcPos.x - 1, y: this.npcPos.y }      // left
        ].filter(pos => 
            pos.x >= 0 && pos.x < this.gridSize && 
            pos.y >= 0 && pos.y < this.gridSize &&
            !this.isOnFreezeBlock(pos) &&
            this.grid[pos.y][pos.x] !== 1
        );
        
        if (npcPossibleMoves.length === 0) return;
        
        // Get agent's possible moves to predict behavior
        const agentPossibleMoves = [
            { x: this.currentPos.x, y: this.currentPos.y - 1 },     // up
            { x: this.currentPos.x + 1, y: this.currentPos.y },     // right
            { x: this.currentPos.x, y: this.currentPos.y + 1 },     // down
            { x: this.currentPos.x - 1, y: this.currentPos.y }      // left
        ].filter(pos => 
            pos.x >= 0 && pos.x < this.gridSize && 
            pos.y >= 0 && pos.y < this.gridSize &&
            this.grid[pos.y][pos.x] !== 1
        );
        
        // Predictive NPC strategy
        let bestMove = npcPossibleMoves[0];
        let bestScore = -Infinity;
        
        for (const npcMove of npcPossibleMoves) {
            let score = 0;
            
            // Strategy 1: Direct interception - move to agent's current position if possible  
            const directDistance = Math.abs(npcMove.x - this.currentPos.x) + 
                                 Math.abs(npcMove.y - this.currentPos.y);
            score += (10 - directDistance) * 5; // Reduced score for closer moves
            
            // Strategy 2: Block escape routes - reduce agent's mobility (less aggressive)
            let blockedEscapes = 0;
            for (const agentMove of agentPossibleMoves) {
                const distanceToAgentMove = Math.abs(npcMove.x - agentMove.x) + 
                                          Math.abs(npcMove.y - agentMove.y);
                if (distanceToAgentMove <= 1) {
                    blockedEscapes++;
                }
            }
            score += blockedEscapes * 5; // Reduced bonus for blocking escape routes
            
            // Strategy 3: Corner the agent - prefer moves that reduce agent's options (less aggressive)
            const agentEscapeRoutes = agentPossibleMoves.filter(agentMove => {
                const futureDistance = Math.abs(npcMove.x - agentMove.x) + 
                                     Math.abs(npcMove.y - agentMove.y);
                return futureDistance > 1; // Agent can escape to this position
            }).length;
            score += (4 - agentEscapeRoutes) * 3; // Reduced bonus for reducing escape options
            
            // Strategy 4: Predict agent's likely move toward goal
            const goalDirection = {
                x: this.goalPos.x - this.currentPos.x,
                y: this.goalPos.y - this.currentPos.y
            };
            
            // Find agent's most likely move (toward goal)
            let mostLikelyAgentMove = this.currentPos;
            let bestGoalDistance = Infinity;
            for (const agentMove of agentPossibleMoves) {
                const goalDistance = Math.abs(agentMove.x - this.goalPos.x) + 
                                   Math.abs(agentMove.y - this.goalPos.y);
                if (goalDistance < bestGoalDistance) {
                    bestGoalDistance = goalDistance;
                    mostLikelyAgentMove = agentMove;
                }
            }
            
            // Bonus for intercepting agent's goal-directed movement (reduced)
            const interceptDistance = Math.abs(npcMove.x - mostLikelyAgentMove.x) + 
                                     Math.abs(npcMove.y - mostLikelyAgentMove.y);
            score += (3 - interceptDistance) * 6; // Moderate bonus for interception
            
            // Strategy 5: Immediate capture check
            if (npcMove.x === this.currentPos.x && npcMove.y === this.currentPos.y) {
                score += 1000; // Massive bonus for immediate capture
            }
            
            // Update best move if this one is better
            if (score > bestScore) {
                bestScore = score;
                bestMove = npcMove;
            }
        }
        
        this.npcPos = bestMove;
    }

    isPositionValid(pos) {
        // Check if position is within grid
        if (pos.x < 0 || pos.x >= this.gridSize || pos.y < 0 || pos.y >= this.gridSize) {
            return false;
        }

        // Check if position is a fixed position (start, goal, NPC)
        if ((pos.x === this.startPos.x && pos.y === this.startPos.y) ||
            (pos.x === this.goalPos.x && pos.y === this.goalPos.y) ||
            (pos.x === this.npcPos.x && pos.y === this.npcPos.y)) {
            return false;
        }

        // Check if position overlaps with existing freeze blocks
        if (this.freezeBlocks.some(block => block.x === pos.x && block.y === pos.y)) {
            return false;
        }

        return true;
    }

    generateRandomMap() {
        // Clear existing freeze blocks
        this.freezeBlocks = [];
        // Place 6 freeze blocks starting from (2,2)
        const middlePositions = [
            { x: 2, y: 2 },
            { x: 4, y: 2 },
            { x: 6, y: 2 },
            { x: 2, y: 4 },
            { x: 4, y: 4 },
            { x: 6, y: 4 }
        ];

        for (let pos of middlePositions) {
            this.freezeBlocks.push({ x: pos.x, y: pos.y, active: true });
        }
    }

    // Add helper method to check if a move leads to goal
    isNextToGoal(pos, action) {
        const moves = [
            { dx: 0, dy: -1 },  // up
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: 1 },   // down
            { dx: -1, dy: 0 }   // left
        ];
        
        const nextPos = {
            x: pos.x + moves[action].dx,
            y: pos.y + moves[action].dy
        };
        
        return nextPos.x === this.goalPos.x && nextPos.y === this.goalPos.y;
    }

    buildStaticMap() {
        // Clear grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                this.grid[y][x] = 0;
            }
        }
        this.freezeBlocks = [];
        // Walls (grey)
        const walls = [
            [3,4],[4,4],[5,2],[6,2],[6,3],[6,8],[8,1],[8,2],[8,3],[8,4],[5,9]
        ];
        for (const [y, x] of walls) this.grid[y][x] = 1;
        // Freeze (green)
        const freeze = [
            [2,2],[6,4],[9,1],[9,2],[9,3],[9,4]
        ];
        for (const [y, x] of freeze) this.addFreezeBlock(x, y);
        // Slippery (purple) with random probabilities
        const slippery = [
            [2,1],[1,2],[5,4],[7,5],[6,6]
        ];
        for (const [y, x] of slippery) {
            // Generate random probabilities for each direction
            const randomProbs = this.generateRandomProbabilities();
            this.addSlipperyCell(x, y, randomProbs);
        }
    }

    generateRandomProbabilities() {
        // Generate 4 random numbers
        let probs = [Math.random(), Math.random(), Math.random(), Math.random()];
        
        // Normalize so they sum to 1
        const sum = probs.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            probs = probs.map(p => p / sum);
        } else {
            // Fallback to equal probabilities if all are 0
            probs = [0.25, 0.25, 0.25, 0.25];
        }
        
        return probs;
    }

    addFreezeBlock(x, y) {
        this.freezeBlocks.push({ x, y, active: true });
    }

    addSlipperyCell(x, y, probs) {
        this.grid[y][x] = 2;
        // Remove invalid directions
        const moves = [
            { dx: 0, dy: -1 },  // up
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: 1 },   // down
            { dx: -1, dy: 0 }   // left
        ];
        let total = 0;
        let validProbs = probs.slice();
        for (let d = 0; d < 4; d++) {
            let nx = x + moves[d].dx;
            let ny = y + moves[d].dy;
            if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize || this.grid[ny][nx] === 1) {
                validProbs[d] = 0;
            } else {
                total += validProbs[d];
            }
        }
        // Normalize
        if (total > 0) {
            for (let d = 0; d < 4; d++) validProbs[d] /= total;
        } else {
            this.grid[y][x] = 0;
        }
        this.slipperyProbs[`${x},${y}`] = validProbs;
    }
} 