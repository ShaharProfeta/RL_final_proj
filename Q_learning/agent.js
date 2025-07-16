class Agent {
    constructor(environment, epsilon = 0.2, alpha = 0.1, gamma = 0.9) {
        this.environment = environment;
        this.epsilon = epsilon;  // Exploration rate
        this.alpha = alpha;     // Learning rate
        this.gamma = gamma;     // Discount factor
        this.minEpsilon = 0.01;
        this.epsilonDecay = 0.995;
        this._qTable = {};      // Internal Q-table
        this.frozenQ = null;    // Frozen Q-table for play episodes
        this.isTraining = true;
    }

    getState() {
        return this.environment.getState();
    }

    initializeState(state) {
        if (!this._qTable[state]) {
            this._qTable[state] = new Array(4).fill(0);  // Initialize Q-values for [up, right, down, left]
        }
    }

    chooseAction(state, validActions) {
        this.initializeState(state);
        
        // Get current Q-table based on mode
        const currentQ = this.isTraining ? this._qTable : (this.frozenQ || this._qTable);
        
        // Extract valid action indices
        const validActionIndices = validActions.filter(a => a.valid).map(a => a.action);
        
        if (validActionIndices.length === 0) {
            console.error("No valid actions available!");
            return 0;
        }

        // Epsilon-greedy action selection during training, or best action during play
        if (Math.random() < this.epsilon && this.isTraining) {
            return validActionIndices[Math.floor(Math.random() * validActionIndices.length)];
        } else {
            // Get maximum Q-value among valid actions
            let maxQ = -Infinity;
            let bestActions = [];
            
            for (let action of validActionIndices) {
                if (currentQ[state][action] >= maxQ) {
                    if (currentQ[state][action] > maxQ) {
                        bestActions = [action];
                        maxQ = currentQ[state][action];
                    } else {
                        bestActions.push(action);
                    }
                }
            }
            
            // Randomly choose among actions with maximum Q-value
            return bestActions[Math.floor(Math.random() * bestActions.length)];
        }
    }

    learn(state, action, reward, nextState, validActions) {
        if (!this.isTraining) return;  // Don't learn if not in training mode

        this.initializeState(state);
        this.initializeState(nextState);

        // Get maximum Q-value for next state among valid actions
        const validActionIndices = validActions.filter(a => a.valid).map(a => a.action);
        let maxNextQ = 0; // Initialize to 0 instead of -Infinity for better convergence
        
        if (validActionIndices.length > 0) {
            maxNextQ = -Infinity;
            for (let nextAction of validActionIndices) {
                maxNextQ = Math.max(maxNextQ, this._qTable[nextState][nextAction]);
            }
        }

        // Q-learning update: Q(S,A) = Q(S,A) + α[R + γ max Q(S',a) - Q(S,A)]
        const oldQ = this._qTable[state][action];
        const targetQ = reward + this.gamma * maxNextQ;
        this._qTable[state][action] = oldQ + this.alpha * (targetQ - oldQ);
    }

    async runEpisode(renderCallback = null) {
        this.isTraining = true;
        const { state, validActions } = this.environment.reset();
        let currentState = state;
        let currentValidActions = validActions;
        let totalReward = 0;
        let done = false;

        while (!done && this.environment.steps < this.environment.maxSteps) {
            const action = this.chooseAction(currentState, currentValidActions);
            const { nextState, reward, done: episodeDone, validActions: nextValidActions } = this.environment.step(action);
            
            totalReward += reward;

            // Q-learning update
            this.learn(currentState, action, reward, nextState, nextValidActions);

            currentState = nextState;
            currentValidActions = nextValidActions;
            done = episodeDone;

            if (renderCallback) {
                await renderCallback();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Decay epsilon
        this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);

        return totalReward;
    }

    freezePolicy() {
        this.frozenQ = JSON.parse(JSON.stringify(this._qTable));
        console.log("Policy frozen - Q-values saved for playing episodes");
    }

    async playEpisode(renderCallback = null) {
        this.isTraining = false;  // Switch to play mode
        const { state, validActions } = this.environment.reset();
        let currentState = state;
        let currentValidActions = validActions;
        let totalReward = 0;
        let done = false;

        while (!done && this.environment.steps < this.environment.maxSteps) {
            const action = this.chooseAction(currentState, currentValidActions);
            const { nextState, reward, done: episodeDone, validActions: nextValidActions } = this.environment.step(action);
            
            currentState = nextState;
            currentValidActions = nextValidActions;
            totalReward += reward;
            done = episodeDone;

            if (renderCallback) {
                await renderCallback();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return totalReward;
    }

    // For visualization purposes
    get Q() {
        return this.isTraining ? this._qTable : (this.frozenQ || this._qTable);
    }
}