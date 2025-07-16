class Agent {
    constructor(environment) {
        this.env = environment;
        this.nS = environment.nS;  // number of states
        this.nA = environment.nA;  // number of actions
        
        // Initialize Q-table with zeros
        this.Q = new Array(this.nS).fill(0).map(() => new Array(this.nA).fill(0));
        
        // Learning parameters
        this.alpha = 0.1;     // learning rate
        this.gamma = 0.9;    // discount factor
        this.epsilon = 0.1;   // exploration rate
        
        // Training tracking
        this.episodeRewards = [];
        this.bestEpisode = null;
        this.bestReward = -Infinity;
        this.currentEpisode = [];

        // For Value/Policy Iteration
        this.V = new Array(this.nS).fill(0);
        // Store initial random action for each state
        this.currentAction = new Array(this.nS);
        // Random initial policy: for each state, pick a random action
        this.policy = new Array(this.nS).fill(0).map((_, s) => {
            const arr = new Array(this.nA).fill(0);
            const randAction = Math.floor(Math.random() * this.nA);
            arr[randAction] = 1;
            this.currentAction[s] = randAction;
            return arr;
        });
        // Save the initial random policy as a deep copy
        this.initialPolicy = this.policy.map(row => row.slice());

        this.failedEpisodes = [];
        this.iterations = 0;
        this.policyImprovements = 0;
    }

    selectAction(state) {
        // Epsilon-greedy action selection
        if (Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.nA);
        } else {
            return this.Q[state].indexOf(Math.max(...this.Q[state]));
        }
    }

    update(state, action, reward, nextState) {
        // Q-learning update
        const maxNextQ = Math.max(...this.Q[nextState]);
        this.Q[state][action] += this.alpha * (reward + this.gamma * maxNextQ - this.Q[state][action]);
    }

    async runEpisode(renderCallback) {
        let state = this.env.reset();
        let totalReward = 0;
        this.currentEpisode = [{state, action: null}];
        
        while (true) {
            const action = this.selectAction(state);
            const {nextState, reward, done} = this.env.step(action);
            
            this.update(state, action, reward, nextState);
            totalReward += reward;
            
            // Store state-action pair for visualization
            this.currentEpisode.push({state: nextState, action});
            
            if (renderCallback) renderCallback();
            if (done) break;
            state = nextState;
            
            // Small delay to visualize training
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.episodeRewards.push(totalReward);
        
        // Update best episode if current is better
        if (totalReward > this.bestReward) {
            this.bestReward = totalReward;
            this.bestEpisode = [...this.currentEpisode];
        }
        
        return totalReward;
    }

    async runAllEpisodes(numEpisodes = 1000, renderCallback) {
        this.env.isRunningAllEpisodes = true;
        
        for (let i = 0; i < numEpisodes; i++) {
            await this.runEpisode();
            
            // Decay epsilon
            this.epsilon = Math.max(0.01, this.epsilon * 0.995);
            
            if (renderCallback && (i % 10 === 0)) renderCallback();
            // Every 100 episodes, add a small delay to prevent browser freezing
            if (i % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        this.env.isRunningAllEpisodes = false;
        if (renderCallback) renderCallback();
        return this.bestEpisode;
    }

    async showBestRun(renderCallback) {
        if (!this.bestEpisode) return;
        
        this.env.isRunningAllEpisodes = false;
        this.env.showingBestRun = true;
        
        // Reset environment
        this.env.reset();
        if (renderCallback) renderCallback();
        
        // Replay best episode
        for (let i = 0; i < this.bestEpisode.length - 1; i++) {
            const {state, action} = this.bestEpisode[i];
            if (action !== null) {
                this.env.step(action);
                if (renderCallback) renderCallback();
                await new Promise(resolve => setTimeout(resolve, 200)); // Slower replay for visibility
            }
        }
        
        this.env.showingBestRun = false;
        if (renderCallback) renderCallback();
    }

    // Run an episode following the current policy (greedy)
    async runPolicyEpisode(renderCallback, maxSteps = 50, testing = false) {
        let state = this.env.reset();
        let totalReward = 0;
        let steps = 0;
        let episode = [{state, action: null}];
        let failed = false;
        while (steps < maxSteps) {
            // Pick greedy action from current policy
            const actionProbs = this.policy[state];
            let action = 0;
            if (actionProbs) {
                action = actionProbs.indexOf(Math.max(...actionProbs));
            }
            const {nextState, reward, done} = this.env.step(action);
            totalReward += reward;
            episode.push({state: nextState, action});
            if (renderCallback) renderCallback();
            if (done) {
                // Check if failed (lava)
                const pos = {x: nextState % this.env.gridSize, y: Math.floor(nextState / this.env.gridSize)};
                if (this.env.lavaPositions.some(lava => lava.x === pos.x && lava.y === pos.y)) {
                    failed = true;
                }
                break;
            }
            state = nextState;
            steps++;
            await new Promise(resolve => setTimeout(resolve, testing ? 200 : 120));
        }
        if (failed) {
            this.failedEpisodes.push(episode);
        }
        return totalReward;
    }

    // Helper for value iteration and policy evaluation: get expected value for a transition
    getExpectedValue(pos, a, V) {
        const nextPos = this.getNextPos(pos, a);
        const nextState = nextPos.y * this.env.gridSize + nextPos.x;
        const reward = this.env.getReward(nextPos);
        if (this.env.isTerminalState(nextPos)) {
            return reward; // No future value from terminal
        } else {
            return reward + this.gamma * V[nextState];
        }
    }

    // Helper for value iteration and policy evaluation: get expected value for a transition
    getExpectedValueUniformSlippery(pos, V) {
        // Get all valid directions
        const directions = [
            {dx: 0, dy: -1}, // up
            {dx: 1, dy: 0},  // right
            {dx: 0, dy: 1},  // down
            {dx: -1, dy: 0}  // left
        ];
        const validActions = [];
        for (let a = 0; a < 4; a++) {
            const nx = pos.x + directions[a].dx;
            const ny = pos.y + directions[a].dy;
            if (nx >= 0 && nx < this.env.gridSize && ny >= 0 && ny < this.env.gridSize) {
                validActions.push(a);
            }
        }
        let expected = 0;
        for (let i = 0; i < validActions.length; i++) {
            expected += (1 / validActions.length) * this.getExpectedValue(pos, validActions[i], V);
        }
        return expected;
    }

    // Update all uses in value iteration and policy evaluation to use getExpectedValueUniformSlippery for slippery cells
    async runValueIteration(renderCallback, maxIterations = 50, theta = 1e-4) {
        for (let iter = 0; iter < maxIterations; iter++) {
            let delta = 0;
            for (let s = 0; s < this.nS; s++) {
                const pos = {x: s % this.env.gridSize, y: Math.floor(s / this.env.gridSize)};
                if (this.env.isTerminalState(pos)) continue;
                let bestAction = 0;
                let bestValue = -Infinity;
                for (let a = 0; a < this.nA; a++) {
                    let expected = 0;
                    if (this.env.isSlipperyCell(pos)) {
                        expected = this.getExpectedValueUniformSlippery(pos, this.V);
                    } else {
                        expected = this.getExpectedValue(pos, a, this.V);
                    }
                    if (expected > bestValue) {
                        bestValue = expected;
                        bestAction = a;
                    }
                }
                delta = Math.max(delta, Math.abs(this.V[s] - bestValue));
                this.V[s] = bestValue;
                this.policy[s] = new Array(this.nA).fill(0);
                this.policy[s][bestAction] = 1;
            }
            if (renderCallback) renderCallback();
            if (delta < theta) break;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    async runPolicyIteration(renderCallback, maxIterations = 50, theta = 1e-4) {
        let policyStable = false;
        this.iterations = 0;
        this.policyImprovements = 0;
        
        // Keep track of last known values
        let lastV = [...this.V];
        
        // Initial render to show starting state
        if (renderCallback) renderCallback(this.iterations, this.policyImprovements, lastV);
        
        for (let iter = 0; iter < maxIterations && !policyStable; iter++) {
            this.iterations++;
            // 1. Policy Evaluation: update V for current policy
            let delta;
            do {
                delta = 0;
                // Create a copy of current values
                const newV = [...this.V];
                
                for (let s = 0; s < this.nS; s++) {
                    const pos = {x: s % this.env.gridSize, y: Math.floor(s / this.env.gridSize)};
                    if (this.env.isTerminalState(pos)) continue;
                    let v = 0;
                    for (let a = 0; a < this.nA; a++) {
                        const prob = this.policy[s][a];
                        if (prob > 0) {
                            if (this.env.isSlipperyCell(pos)) {
                                v += prob * this.getExpectedValueUniformSlippery(pos, this.V);
                            } else {
                                v += prob * this.getExpectedValue(pos, a, this.V);
                            }
                        }
                    }
                    delta = Math.max(delta, Math.abs(this.V[s] - v));
                    newV[s] = v;
                }
                
                // Update values after computing all new values
                this.V = newV;
                lastV = [...newV];
                
                // Render periodically during policy evaluation
                if (renderCallback && Math.random() < 0.1) { // 10% chance to render each iteration
                    renderCallback(this.iterations, this.policyImprovements, lastV);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } while (delta > theta);
            
            // Call renderCallback with current stats after policy evaluation
            if (renderCallback) {
                renderCallback(this.iterations, this.policyImprovements, lastV);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Animate agent running on the current policy
            await this.runPolicyEpisode(
                () => renderCallback(this.iterations, this.policyImprovements, lastV),
                50
            );

            // 2. Policy Improvement
            policyStable = true;
            let changesThisIteration = 0; // Count changes in this iteration
            
            for (let s = 0; s < this.nS; s++) {
                const pos = {x: s % this.env.gridSize, y: Math.floor(s / this.env.gridSize)};
                if (this.env.isTerminalState(pos)) continue;
                let oldAction = this.currentAction[s];
                let actionValues = [];
                let bestValue = -Infinity;
                
                for (let a = 0; a < this.nA; a++) {
                    let expected = 0;
                    if (this.env.isSlipperyCell(pos)) {
                        expected = this.getExpectedValueUniformSlippery(pos, this.V);
                    } else {
                        expected = this.getExpectedValue(pos, a, this.V);
                    }
                    actionValues[a] = expected;
                    if (expected > bestValue) {
                        bestValue = expected;
                    }
                }
                
                // Find all actions with the best value (within epsilon)
                const EPSILON = 1e-5;
                const bestActions = [];
                for (let a = 0; a < this.nA; a++) {
                    if (Math.abs(actionValues[a] - bestValue) < EPSILON) {
                        bestActions.push(a);
                    }
                }
                
                const initialAction = this.initialPolicy[s].indexOf(1);
                let newAction = oldAction;
                if (!bestActions.includes(oldAction)) {
                    // Only change if the old action is NOT among the best
                    if (bestActions.includes(initialAction)) {
                        newAction = initialAction;
                    } else {
                        newAction = bestActions[0];
                    }
                    policyStable = false;
                    changesThisIteration++; // Count this change
                }
                
                // Update policy
                const newPolicy = new Array(this.nA).fill(0);
                newPolicy[newAction] = 1;
                this.policy[s] = newPolicy;
                this.currentAction[s] = newAction;
            }
            
            // Add all changes from this iteration to the total
            this.policyImprovements += changesThisIteration;
            
            // Call renderCallback after policy improvement
            if (renderCallback) {
                renderCallback(this.iterations, this.policyImprovements, lastV);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    getNextPos(pos, action) {
        let nextPos = {x: pos.x, y: pos.y};
        switch(action) {
            case 0: nextPos.y = Math.max(0, nextPos.y - 1); break; // up
            case 1: nextPos.x = Math.min(this.env.gridSize - 1, nextPos.x + 1); break; // right
            case 2: nextPos.y = Math.min(this.env.gridSize - 1, nextPos.y + 1); break; // down
            case 3: nextPos.x = Math.max(0, nextPos.x - 1); break; // left
        }
        return nextPos;
    }

    getPolicy() {
        // If value iteration has been run, use that policy
        if (this.policy) return this.policy;
        // Otherwise, fallback to Q-table greedy policy
        return this.Q.map(stateActions => {
            const maxQ = Math.max(...stateActions);
            return stateActions.map(q => q === maxQ ? 1 : 0);
        });
    }
} 