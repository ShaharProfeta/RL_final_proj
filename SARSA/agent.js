class SarsaAgent {
    constructor(env) {
        this.env = env;
        this.nStates = env.nS;
        this.nActions = env.nA;
        
        // Initialize Q-table with zeros
        this.Q = Array(this.nStates).fill().map(() => Array(this.nActions).fill(0));
        
        // Get parameters from UI
        this.alpha = parseFloat(document.getElementById('alphaInput').value);      // Learning rate
        this.gamma = parseFloat(document.getElementById('gammaInput').value);      // Discount factor
        this.epsilon = parseFloat(document.getElementById('epsilonInput').value);  // Exploration rate
        this.minEpsilon = parseFloat(document.getElementById('minEpsilonInput').value); // Minimum exploration rate
        this.epsilonDecay = parseFloat(document.getElementById('epsilonDecayInput').value); // Decay rate
        
        // Training tracking
        this.episodeRewards = [];
        this.bestEpisode = null;
        this.bestReward = -Infinity;
        this.currentEpisode = [];
        this.totalSteps = 0;
    }

    // Epsilon-greedy action selection
    selectAction(state, useEpsilon = true, deterministic = false) {
        if (useEpsilon && Math.random() < this.epsilon) {
            // Explore: random action
            return Math.floor(Math.random() * this.nActions);
        } else {
            // Exploit: best known action
            return this.getBestAction(state, deterministic);
        }
    }

    // Get action with highest Q-value for given state
    getBestAction(state, deterministic = false) {
        let maxValue = Math.max(...this.Q[state]);
        let bestActions = this.Q[state].reduce((acc, q, idx) => {
            if (q === maxValue) acc.push(idx);
            return acc;
        }, []);
        if (deterministic) {
            return bestActions[0]; // Always pick the first best action
        }
        // Randomly select from best actions (to break ties)
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    // Update Q-values using SARSA formula: R(t+1) + γQ(S(t+1), A(t+1))
    update(state, action, reward, nextState, nextAction) {
        const currentQ = this.Q[state][action];
        const nextQ = nextAction !== null ? this.Q[nextState][nextAction] : 0;
        const target = reward + this.gamma * nextQ;  // R(t+1) + γQ(S(t+1), A(t+1))
        
        this.Q[state][action] = currentQ + this.alpha * (target - currentQ);
    }

    // Run a single training episode
    async runEpisode(renderCallback = null, maxSteps = 200) {
        let state = this.env.reset();
        let totalReward = 0;
        let action = this.selectAction(state);
        let terminatedByMaxSteps = true;
        for (let step = 0; step < maxSteps; step++) {
            const {nextState, reward, done} = this.env.step(action);
            totalReward += reward;
            const nextAction = done ? null : this.selectAction(nextState);
            this.update(state, action, reward, nextState, nextAction);
            state = nextState;
            action = nextAction;
            if (renderCallback) {
                renderCallback();
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            if (done) {
                terminatedByMaxSteps = false;
                break;
            }
        }
        // If terminated by max steps, apply heavy timeout penalty
        if (terminatedByMaxSteps) {
            totalReward += this.env.npcCatchReward * 2; // Double penalty for timeout/loops
        }
        this.episodeRewards.push(totalReward);
        if (totalReward > this.bestReward) {
            this.bestReward = totalReward;
            this.bestEpisode = [...this.currentEpisode];
        }
        
        // Decay epsilon
        this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
        
        return totalReward;
    }

    // Run best policy (no exploration)
    async runBestPolicy(renderCallback = null, maxSteps = 300) {
        let state = this.env.reset();
        let totalReward = 0;
        let terminatedByMaxSteps = true;
        let reachedGoal = false;
        for (let step = 0; step < maxSteps; step++) {
            const action = this.selectAction(state, false, true);
            const {nextState, reward, done} = this.env.step(action);
            totalReward += reward;
            // Check if reached goal
            const pos = this.env.getPosition(nextState);
            if (pos.x === this.env.goalPos.x && pos.y === this.env.goalPos.y) {
                reachedGoal = true;
                console.log('Agent reached the goal at step', step);
            }
            state = nextState;
            if (renderCallback) {
                renderCallback();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (done) {
                terminatedByMaxSteps = false;
                console.log('Episode ended at step', step, 'done:', done, 'reachedGoal:', reachedGoal);
                break;
            }
        }
        // If terminated by max steps, apply penalty
        if (terminatedByMaxSteps) {
            totalReward += this.env.npcCatchReward;
        }
        console.log('runBestPolicy finished. reachedGoal:', reachedGoal, 'totalReward:', totalReward);
        return { totalReward, reachedGoal };
    }

    // Get state values for visualization
    getStateValues() {
        return this.Q.map(stateActions => Math.max(...stateActions));
    }
} 