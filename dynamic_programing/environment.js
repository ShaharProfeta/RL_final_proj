class Environment {
    constructor() {
        this.gridSize = 10;
        this.nS = this.gridSize * this.gridSize; // number of states
        this.nA = 4; // number of actions (up, right, down, left)
        this.slipperyProb = 0.21; // 21% chance of slipping (7% for each other direction)
        
        // Create agent image
        this.agentImage = new Image();
        this.agentImage.src = ''; // This will be set by setAgentImage method
        
        // Create basketball image for lava cells
        this.basketballImage = new Image();
        this.basketballImage.onerror = () => {
            console.error('Failed to load basketball image:', this.basketballImage.src);
        };
        this.basketballImage.onload = () => {
            console.log('Basketball image loaded successfully');
        };
        this.basketballImage.src = '../pictures/basketball.png';

        // Create background image with error handling
        this.backgroundImage = new Image();
        this.backgroundImage.onerror = () => {
            console.error('Failed to load background image:', this.backgroundImage.src);
        };
        this.backgroundImage.onload = () => {
            console.log('Background image loaded successfully');
        };
        this.backgroundImage.src = '../pictures/Basketball-scaled.jpg';
        
        // Initialize grid elements
        this.grid = new Array(this.gridSize).fill(0).map(() => new Array(this.gridSize).fill(0));
        
        // Initialize agent position at top-left
        this.agentPos = {x: 0, y: 0};
        this.startPos = {x: 0, y: 0};
        
        // Set goal position (reward: 1000)
        this.goalPos = {x: this.gridSize - 1, y: this.gridSize - 1};
        this.grid[this.goalPos.y][this.goalPos.x] = 2;
        
        // Set lava positions (reward: -200)
        this.lavaPositions = [
            {x: 3, y: 3}, {x: 6, y: 6}, {x: 2, y: 7},
            {x: 4, y: 4}, {x: 5, y: 7}, {x: 7, y: 3},
            {x: 1, y: 8}, {x: 8, y: 1}
        ];

        // Place lava
        this.lavaPositions.forEach(pos => {
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                this.grid[pos.y][pos.x] = 1;
            }
        });
        
        // Initialize slippery cells array
        this.slipperyCells = [];
        
        // Get valid adjacent cells to lava
        let validAdjacentCells = [];
        this.lavaPositions.forEach(lava => {
            if (lava && typeof lava.x === 'number' && typeof lava.y === 'number') {
                const adjacentCells = this.getAdjacentCells(lava);
                adjacentCells.forEach(cell => {
                    if (this.isValidEmptyCell(cell)) {
                        validAdjacentCells.push(cell);
                    }
                });
            }
        });

        // Remove duplicates from adjacent cells
        validAdjacentCells = Array.from(new Set(validAdjacentCells.map(cell => `${cell.x},${cell.y}`)))
            .map(coord => {
                const [x, y] = coord.split(',').map(Number);
                return {x, y};
            });

        // Place slippery cells
        const numSlipperyCells = 18;
        let attempts = 0;
        while (this.slipperyCells.length < numSlipperyCells && attempts < 1000) {
            attempts++;
            if (validAdjacentCells.length > 0 && Math.random() < 0.97) { // 97% chance to pick from adjacent spots
                const idx = Math.floor(Math.random() * validAdjacentCells.length);
                const spot = validAdjacentCells.splice(idx, 1)[0];
                if (this.isValidEmptyCell(spot)) {
                    this.slipperyCells.push(spot);
                    this.grid[spot.y][spot.x] = 3;
                }
            } else {
                // Otherwise pick a random empty spot
                const spot = this.getRandomEmptyCell();
                if (spot) {
                    this.slipperyCells.push(spot);
                    this.grid[spot.y][spot.x] = 3;
                }
            }
        }
        
        // Ensure there is a clear path from start to goal (BFS)
        const bfs = () => {
            const queue = [{x: this.startPos.x, y: this.startPos.y}];
            const visited = Array.from({length: this.gridSize}, () => Array(this.gridSize).fill(false));
            visited[this.startPos.y][this.startPos.x] = true;
            while (queue.length > 0) {
                const {x, y} = queue.shift();
                if (x === this.goalPos.x && y === this.goalPos.y) return true;
                const dirs = [
                    {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}
                ];
                for (const {dx, dy} of dirs) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                        if (!visited[ny][nx] && this.grid[ny][nx] !== 1 && this.grid[ny][nx] !== 3) {
                            visited[ny][nx] = true;
                            queue.push({x: nx, y: ny});
                        }
                    }
                }
            }
            return false;
        };
        // Remove slippery cells blocking the path until a path exists
        while (!bfs() && this.slipperyCells.length > 0) {
            // Remove a random slippery cell
            const cell = this.slipperyCells.pop();
            this.grid[cell.y][cell.x] = 0;
        }
        
        // Add training status indicators
        this.isRunning = false;
        this.isRunningAllEpisodes = false;
        this.showingBestRun = false;
        this.showValues = false; // NEW: show cell values
        this.prevAgentPos = null;
        this.prevAgentAction = null;
    }

    isValidEmptyCell(pos) {
        return pos && 
               typeof pos.x === 'number' && 
               typeof pos.y === 'number' &&
               pos.x >= 0 && pos.x < this.gridSize &&
               pos.y >= 0 && pos.y < this.gridSize &&
               this.grid[pos.y][pos.x] === 0 &&
               !(pos.x === this.startPos.x && pos.y === this.startPos.y) &&
               !(pos.x === this.goalPos.x && pos.y === this.goalPos.y);
    }

    getAdjacentCells(pos) {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
            return [];
        }

        const adjacent = [];
        const directions = [
            {dx: 0, dy: -1},  // up
            {dx: 1, dy: 0},   // right
            {dx: 0, dy: 1},   // down
            {dx: -1, dy: 0}   // left
        ];

        directions.forEach(dir => {
            const newX = pos.x + dir.dx;
            const newY = pos.y + dir.dy;
            if (newX >= 0 && newX < this.gridSize && 
                newY >= 0 && newY < this.gridSize) {
                adjacent.push({x: newX, y: newY});
            }
        });

        return adjacent;
    }

    getRandomEmptyCell() {
        const emptyCells = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const pos = {x, y};
                if (this.isValidEmptyCell(pos)) {
                    emptyCells.push(pos);
                }
            }
        }
        if (emptyCells.length === 0) return null;
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    reset() {
        // Always start from top-left corner
        this.agentPos = {...this.startPos};
        this.prevAgentPos = null;
        this.prevAgentAction = null;
        return this.getState();
    }

    getState() {
        return this.agentPos.y * this.gridSize + this.agentPos.x;
    }

    isTerminalState(pos) {
        // Check if position is goal or lava
        if (pos.x === this.goalPos.x && pos.y === this.goalPos.y) return true;
        return this.lavaPositions.some(lava => lava.x === pos.x && lava.y === pos.y);
    }

    getReward(pos) {
        if (pos.x === this.goalPos.x && pos.y === this.goalPos.y) return 1000;
        if (this.lavaPositions.some(lava => lava.x === pos.x && lava.y === pos.y)) return -500;
        return 0; // step reward is 0 for all non-terminal moves
    }

    isSlipperyCell(pos) {
        return this.slipperyCells.some(cell => cell.x === pos.x && cell.y === pos.y);
    }

    step(action) {
        // Actions: 0: up, 1: right, 2: down, 3: left
        let nextPos = {...this.agentPos};
        let actualAction = action;

        // Track previous position and action
        this.prevAgentPos = {...this.agentPos};
        this.prevAgentAction = null; // Will set below

        // Handle slippery cells
        if (this.isSlipperyCell(this.agentPos)) {
            // Get all valid directions
            const directions = [
                {dx: 0, dy: -1}, // up
                {dx: 1, dy: 0},  // right
                {dx: 0, dy: 1},  // down
                {dx: -1, dy: 0}  // left
            ];
            const validActions = [];
            const lavaActions = [];
            for (let a = 0; a < 4; a++) {
                const nx = this.agentPos.x + directions[a].dx;
                const ny = this.agentPos.y + directions[a].dy;
                if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                    validActions.push(a);
                    if (this.grid[ny][nx] === 1) {
                        lavaActions.push(a);
                    }
                }
            }
            let probs = [];
            if (lavaActions.length > 0) {
                // Prefer lava: 60% split among lava, 40% among safe
                const safeActions = validActions.filter(a => !lavaActions.includes(a));
                const lavaProb = 0.6 / lavaActions.length;
                const safeProb = safeActions.length > 0 ? 0.4 / safeActions.length : 0;
                for (let a of validActions) {
                    if (lavaActions.includes(a)) {
                        probs[a] = lavaProb;
                    } else {
                        probs[a] = safeProb;
                    }
                }
            } else {
                // Uniform if no lava
                for (let a of validActions) {
                    probs[a] = 1 / validActions.length;
                }
            }
            // Pick a direction based on these probabilities
            let r = Math.random();
            let sum = 0;
            for (let a = 0; a < 4; a++) {
                if (probs[a]) {
                    sum += probs[a];
                    if (r < sum) {
                        actualAction = a;
                        break;
                    }
                }
            }
        }
        this.prevAgentAction = actualAction;

        // Calculate next position
        switch(actualAction) {
            case 0: // up
                nextPos.y = Math.max(0, nextPos.y - 1);
                break;
            case 1: // right
                nextPos.x = Math.min(this.gridSize - 1, nextPos.x + 1);
                break;
            case 2: // down
                nextPos.y = Math.min(this.gridSize - 1, nextPos.y + 1);
                break;
            case 3: // left
                nextPos.x = Math.max(0, nextPos.x - 1);
                break;
        }

        // Update agent position
        this.agentPos = nextPos;
        
        // Get reward and check if terminal
        const reward = this.getReward(nextPos);
        const done = this.isTerminalState(nextPos);
        
        return {
            nextState: this.getState(),
            reward: reward,
            done: done
        };
    }

    render(ctx, showProbabilities = false, showPolicy = false, policy = null, values = null) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const cellSize = Math.min(canvasWidth, canvasHeight) / this.gridSize;

        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw background image with transparency if loaded
        if (this.backgroundImage.complete && this.backgroundImage.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6; // Set background image to 30% opacity
            ctx.drawImage(this.backgroundImage, 0, 0, canvasWidth, canvasHeight);
            ctx.restore();
        }

        // Draw status indicators at the top
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        let statusText = '';
        if (this.isRunningAllEpisodes) {
            statusText = '⚡ Running All Episodes...';
            ctx.fillStyle = '#FF6B00';  // Orange color for running all episodes
        } else if (this.showingBestRun) {
            statusText = '🏆 Showing Best Run';
            ctx.fillStyle = '#32CD32';  // Green color for best run
        } else if (this.isRunning) {
            statusText = '▶️ Training...';
            ctx.fillStyle = '#4169E1';  // Blue color for normal training
        }
        
        if (statusText) {
            ctx.fillText(statusText, 10, 10);
        }

        // Draw grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const pos = {x, y};
                const state = y * this.gridSize + x;
                
                // Draw cell border
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);

                // Draw cell contents
                switch(this.grid[y][x]) {
                    case 1: // Lava (now basketball)
                        const lavaGrad = ctx.createRadialGradient(
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, 0,
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, cellSize/2
                        );
                        lavaGrad.addColorStop(0, '#ff6b6b');
                        lavaGrad.addColorStop(1, '#ff0000');
                        ctx.fillStyle = lavaGrad;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        
                        // Draw basketball icon for lava cells
                        if (this.basketballImage.complete && this.basketballImage.naturalWidth > 0) {
                            const padding = cellSize * 0.1;
                            ctx.drawImage(
                                this.basketballImage,
                                x * cellSize + padding,
                                y * cellSize + padding,
                                cellSize - 2 * padding,
                                cellSize - 2 * padding
                            );
                        } else {
                            // Fallback text if image fails to load
                            ctx.font = `${cellSize/2}px serif`;
                            ctx.fillStyle = 'white';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('🏀', x * cellSize + cellSize/2, y * cellSize + cellSize/2);
                        }
                        break;
                    case 2: // Goal
                        const goalGrad = ctx.createRadialGradient(
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, 0,
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, cellSize/2
                        );
                        goalGrad.addColorStop(0, '#90EE90');
                        goalGrad.addColorStop(1, '#32CD32');
                        ctx.fillStyle = goalGrad;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        break;
                    case 3: // Slippery
                        const iceGrad = ctx.createRadialGradient(
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, 0,
                            x * cellSize + cellSize/2, y * cellSize + cellSize/2, cellSize/2
                        );
                        iceGrad.addColorStop(0, '#ADD8E6');
                        iceGrad.addColorStop(1, '#87CEEB');
                        ctx.fillStyle = iceGrad;
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                        // Draw ice emoji
                        ctx.font = `${cellSize/2}px serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('🧊', x * cellSize + cellSize/2, y * cellSize + cellSize/2);
                        
                        // Show slip probabilities if requested
                        if (showProbabilities) {
                            // Calculate valid directions and prefer lava
                            const directions = [
                                {dx: 0, dy: -1}, // up
                                {dx: 1, dy: 0},  // right
                                {dx: 0, dy: 1},  // down
                                {dx: -1, dy: 0}  // left
                            ];
                            const valid = [false, false, false, false];
                            let count = 0;
                            let lavaDirs = [];
                            for (let a = 0; a < 4; a++) {
                                const nx = x + directions[a].dx;
                                const ny = y + directions[a].dy;
                                if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                                    valid[a] = true;
                                    count++;
                                    if (this.grid[ny][nx] === 1) lavaDirs.push(a);
                                }
                            }
                            let probs = [0,0,0,0];
                            if (lavaDirs.length > 0) {
                                const safeDirs = [];
                                for (let a = 0; a < 4; a++) if (valid[a] && !lavaDirs.includes(a)) safeDirs.push(a);
                                const lavaProb = 0.6 / lavaDirs.length;
                                const safeProb = safeDirs.length > 0 ? 0.4 / safeDirs.length : 0;
                                for (let a = 0; a < 4; a++) {
                                    if (lavaDirs.includes(a)) probs[a] = lavaProb;
                                    else if (safeDirs.includes(a)) probs[a] = safeProb;
                                }
                            } else {
                                for (let a = 0; a < 4; a++) if (valid[a]) probs[a] = 1/count;
                            }
                            ctx.fillStyle = 'rgba(0,0,0,0.8)';
                            ctx.font = `${cellSize/6}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            if (valid[0]) ctx.fillText(`${Math.round(probs[0]*100)}%`, x * cellSize + cellSize/2, y * cellSize + cellSize/5); // Up
                            if (valid[1]) ctx.fillText(`${Math.round(probs[1]*100)}%`, x * cellSize + cellSize * 4/5, y * cellSize + cellSize/2); // Right
                            if (valid[2]) ctx.fillText(`${Math.round(probs[2]*100)}%`, x * cellSize + cellSize/2, y * cellSize + cellSize * 4/5); // Down
                            if (valid[3]) ctx.fillText(`${Math.round(probs[3]*100)}%`, x * cellSize + cellSize/5, y * cellSize + cellSize/2); // Left
                        }
                        break;
                }

                // Draw policy arrows if requested and not a terminal state
                if (showPolicy && policy && !this.isTerminalState(pos)) {
                    const actionProbs = policy[state];
                    
                    // Find the action with highest probability
                    if (actionProbs) {
                        const maxProb = Math.max(...actionProbs);
                        if (maxProb > 0) {
                            const bestAction = actionProbs.indexOf(maxProb);
                            this.drawSingleArrow(ctx, x, y, cellSize, bestAction);
                        }
                    }
                }

                // Draw value if enabled (for all cells, including terminal)
                if (this.showValues && values && typeof values[state] === 'number') {
                    ctx.save();
                    ctx.font = `${cellSize/5}px Arial`;
                    ctx.fillStyle = '#222';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(values[state].toFixed(1), x * cellSize + cellSize/2, y * cellSize + cellSize - 2);
                    ctx.restore();
                }
            }
        }

        // Draw policy arrows for all cells (including agent's cell)
        if (showPolicy && policy) {
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    const pos = {x, y};
                    if (!this.isTerminalState(pos)) {
                        const state = y * this.gridSize + x;
                        const actionProbs = policy[state];
                        // Find the action with highest probability
                        if (actionProbs) {
                            const maxProb = Math.max(...actionProbs);
                            if (maxProb > 0) {
                                const bestAction = actionProbs.indexOf(maxProb);
                                this.drawSingleArrow(ctx, x, y, cellSize, bestAction);
                            }
                        }
                    }
                }
            }
        }

        // Draw arrow behind the agent (from previous position)
        if (
            this.prevAgentPos &&
            (this.prevAgentPos.x !== this.agentPos.x || this.prevAgentPos.y !== this.agentPos.y) &&
            this.prevAgentAction !== null
        ) {
            this.drawSingleArrow(ctx, this.prevAgentPos.x, this.prevAgentPos.y, cellSize, this.prevAgentAction);
        }

        // Draw agent
        if (this.agentImage.complete && this.agentImage.naturalWidth > 0) {
            // Draw image if loaded
            console.log('Drawing agent image');
            const size = cellSize * 0.8; // Make it slightly smaller than cell
            const x = this.agentPos.x * cellSize + (cellSize - size) / 2;
            const y = this.agentPos.y * cellSize + (cellSize - size) / 2;
            try {
                ctx.drawImage(this.agentImage, x, y, size, size);
                console.log('Successfully drew agent image');
            } catch (error) {
                console.error('Error drawing agent image:', error);
                // Fallback to circle
                this.drawAgentCircle(ctx, cellSize);
            }
        } else {
            console.log('Image not ready, using fallback circle');
            this.drawAgentCircle(ctx, cellSize);
        }
    }

    drawSingleArrow(ctx, x, y, cellSize, action) {
        const center = {
            x: x * cellSize + cellSize/2,
            y: y * cellSize + cellSize/2
        };
        
        const arrowSize = cellSize * 0.4;  // Larger arrow
        const headSize = arrowSize * 0.3;  // Larger arrow head
        
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        
        ctx.save();
        ctx.translate(center.x, center.y);
        
        // Rotate based on action
        switch(action) {
            case 0: ctx.rotate(-Math.PI/2); break; // up
            case 1: ctx.rotate(0); break;          // right
            case 2: ctx.rotate(Math.PI/2); break;  // down
            case 3: ctx.rotate(Math.PI); break;    // left
        }
        
        // Draw arrow shaft
        ctx.beginPath();
        ctx.moveTo(-arrowSize/2, 0);
        ctx.lineTo(arrowSize/2, 0);
        ctx.stroke();
        
        // Draw arrow head as filled triangle
        ctx.beginPath();
        ctx.moveTo(arrowSize/2, 0);
        ctx.lineTo(arrowSize/2 - headSize, -headSize/2);
        ctx.lineTo(arrowSize/2 - headSize, headSize/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    // Helper method to draw the agent circle (fallback)
    drawAgentCircle(ctx, cellSize) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        const agentGrad = ctx.createRadialGradient(
            this.agentPos.x * cellSize + cellSize/2, this.agentPos.y * cellSize + cellSize/2, 0,
            this.agentPos.x * cellSize + cellSize/2, this.agentPos.y * cellSize + cellSize/2, cellSize/3
        );
        agentGrad.addColorStop(0, this.isRunning ? '#6495ED' : '#4169E1');
        agentGrad.addColorStop(1, this.isRunning ? '#0000CD' : '#0000FF');
        ctx.fillStyle = agentGrad;
        ctx.beginPath();
        ctx.arc(
            (this.agentPos.x + 0.5) * cellSize,
            (this.agentPos.y + 0.5) * cellSize,
            cellSize * (this.isRunning ? 0.28 : 0.32),
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }

    // Method to set agent image
    setAgentImage(imagePath) {
        console.log('Setting agent image path to:', imagePath);
        this.agentImage = new Image();
        
        this.agentImage.onerror = (e) => {
            console.error('Failed to load agent image:', imagePath);
            console.error('Error details:', e);
        };
        
        this.agentImage.onload = () => {
            console.log('Successfully loaded agent image:', imagePath);
            console.log('Image dimensions:', this.agentImage.width, 'x', this.agentImage.height);
        };
        
        // Add crossOrigin attribute to handle potential CORS issues
        this.agentImage.crossOrigin = 'anonymous';
        this.agentImage.src = imagePath;
        
        // Force a render after image loads
        this.agentImage.onload = () => {
            console.log('Image loaded, forcing render');
            if (typeof render === 'function') {
                render();
            }
        };
    }
} 