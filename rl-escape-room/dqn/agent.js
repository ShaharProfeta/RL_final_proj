class PacmanHierarchicalDQNAgent {
    constructor(env, bufferSize = 10000, batchSize = 64, hiddenUnits = 64, replayFreq = 4) {
        this.env = env;
        this.stateSize = 4 + env.gridSize * env.gridSize + 1; // pacman x, y, ghost x, y, pellet map, powerPelletsEaten
        this.actionSize = 4; // up, down, left, right
        this.bufferSize = bufferSize;
        this.batchSize = batchSize;
        this.hiddenUnits = hiddenUnits;
        this.replayFreq = replayFreq;
        
        // DQN Parameters
        this.epsilon = 1.0;
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.999;
        this.gamma = 0.99;
        this.learningRate = 0.0005;
        this.tau = 0.001; // for soft update
        this.updateEvery = 4; // update frequency
        
        // Three models for three objectives
        this.models = [
            this.createModel(), // Model 1: Eat first power pellet
            this.createModel(), // Model 2: Eat second power pellet
            this.createModel()  // Model 3: Eat the ghost
        ];
        
        // Target networks for each model
        this.targetModels = [
            this.createModel(),
            this.createModel(),
            this.createModel()
        ];
        
        // Replay buffers for each model
        this.replayBuffers = [[], [], []];
        
        // Loss histories for each model
        this.lossHistories = [[], [], []];
        
        // Update counters for each model
        this.updateCounters = [0, 0, 0];
        
        // Initialize target networks
        this.updateTargetModel(0);
        this.updateTargetModel(1);
        this.updateTargetModel(2);
        
        // Current objective (0: first power pellet, 1: second power pellet, 2: eat ghost)
        this.currentObjective = 0;
    }
    
    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ 
            units: this.hiddenUnits, 
            inputShape: [this.stateSize], 
            activation: 'relu' 
        }));
        model.add(tf.layers.dense({ 
            units: this.hiddenUnits, 
            activation: 'relu' 
        }));
        model.add(tf.layers.dense({ 
            units: this.actionSize, 
            activation: 'linear' 
        }));
        model.compile({ 
            optimizer: tf.train.adam(this.learningRate), 
            loss: tf.losses.huberLoss 
        });
        return model;
    }
    
    updateTargetModel(modelIndex) {
        this.targetModels[modelIndex].setWeights(this.models[modelIndex].getWeights());
    }
    
    softUpdateTargetModel(modelIndex) {
        const localWeights = this.models[modelIndex].getWeights();
        const targetWeights = this.targetModels[modelIndex].getWeights();
        
        const updatedWeights = [];
        for (let i = 0; i < localWeights.length; i++) {
            const localWeight = localWeights[i];
            const targetWeight = targetWeights[i];
            
            // Soft update: θ_target = τ*θ_local + (1 - τ)*θ_target
            const updatedWeight = tf.tidy(() => {
                const tauLocal = tf.mul(localWeight, this.tau);
                const oneMinusTauTarget = tf.mul(targetWeight, 1.0 - this.tau);
                return tf.add(tauLocal, oneMinusTauTarget);
            });
            
            updatedWeights.push(updatedWeight);
        }
        
        this.targetModels[modelIndex].setWeights(updatedWeights);
        
        // Clean up temporary tensors
        updatedWeights.forEach(tensor => tensor.dispose());
    }
    
    getCurrentObjective() {
        const powerPelletsEaten = this.env.powerPelletsEaten;
        const powerTimer = this.env.powerTimer;
        
        if (powerPelletsEaten === 0) {
            return 0; // Objective 1: Eat first power pellet
        } else if (powerPelletsEaten === 1 && powerTimer === 0) {
            return 1; // Objective 2: Eat second power pellet
        } else {
            return 2; // Objective 3: Eat the ghost
        }
    }
    
    remember(state, action, reward, nextState, done) {
        const objective = this.getCurrentObjective();
        
        // Store experience in the appropriate buffer
        this.replayBuffers[objective].push([state, action, reward, nextState, done]);
        
        // Keep buffer size manageable
        if (this.replayBuffers[objective].length > this.bufferSize) {
            this.replayBuffers[objective].shift();
        }
    }
    
    act(state) {
        const objective = this.getCurrentObjective();
        
        // Epsilon-greedy action selection
        if (Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionSize);
        }
        
        return tf.tidy(() => {
            const stateTensor = tf.tensor2d([state]);
            const q = this.models[objective].predict(stateTensor);
            return q.argMax(1).dataSync()[0];
        });
    }
    
    async replay(objective = null) {
        if (objective === null) {
            objective = this.getCurrentObjective();
        }
        
        if (this.replayBuffers[objective].length < this.batchSize) {
            return null;
        }
        
        // Sample random batch from replay buffer
        const batch = [];
        const indices = new Set();
        while (indices.size < this.batchSize) {
            indices.add(Math.floor(Math.random() * this.replayBuffers[objective].length));
        }
        
        for (const i of indices) {
            batch.push(this.replayBuffers[objective][i]);
        }
        
        // Prepare batch data
        const states = batch.map(e => e[0]);
        const actions = batch.map(e => e[1]);
        const rewards = batch.map(e => e[2]);
        const nextStates = batch.map(e => e[3]);
        const dones = batch.map(e => e[4]);
        
        const statesTensor = tf.tensor2d(states);
        const nextStatesTensor = tf.tensor2d(nextStates);
        
        // Get current Q values
        const currentQ = this.models[objective].predict(statesTensor);
        
        // Get next Q values from target network
        const nextQ = this.targetModels[objective].predict(nextStatesTensor);
        
        const qArray = currentQ.arraySync();
        const nextQArray = nextQ.arraySync();
        
        // Update Q values using Bellman equation
        for (let i = 0; i < this.batchSize; i++) {
            if (dones[i]) {
                qArray[i][actions[i]] = rewards[i];
            } else {
                qArray[i][actions[i]] = rewards[i] + this.gamma * Math.max(...nextQArray[i]);
            }
        }
        
        // Train the model
        const targetTensor = tf.tensor2d(qArray);
        const history = await this.models[objective].fit(statesTensor, targetTensor, {
            epochs: 1,
            verbose: 0
        });
        
        const loss = history.history.loss[0];
        this.lossHistories[objective].push(loss);
        
        // Clean up tensors
        currentQ.dispose();
        nextQ.dispose();
        statesTensor.dispose();
        nextStatesTensor.dispose();
        targetTensor.dispose();
        
        // Update target network with soft update
        this.updateCounters[objective]++;
        if (this.updateCounters[objective] % this.updateEvery === 0) {
            this.softUpdateTargetModel(objective);
        }
        
        // Decay epsilon
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
        
        return loss;
    }
    
    getLossHistory(objective) {
        return this.lossHistories[objective];
    }
    
    async saveModel(objective, name = null) {
        if (name === null) {
            name = `pacman_model_${objective + 1}`;
        }
        
        try {
            await this.models[objective].save(`downloads://${name}`);
            console.log(`Model ${objective + 1} saved as ${name}`);
        } catch (error) {
            console.error(`Error saving model ${objective + 1}:`, error);
        }
    }
    
    async saveAllModels() {
        for (let i = 0; i < 3; i++) {
            await this.saveModel(i);
        }
    }
    
    async loadModel(objective, file) {
        try {
            this.models[objective] = await tf.loadLayersModel(file);
            this.models[objective].compile({
                optimizer: tf.train.adam(this.learningRate),
                loss: tf.losses.huberLoss
            });
            
            // Update target network
            this.updateTargetModel(objective);
            console.log(`Model ${objective + 1} loaded successfully`);
        } catch (error) {
            console.error(`Error loading model ${objective + 1}:`, error);
        }
    }
    
    async loadModelFromFiles(objective, files) {
        // Ensure JSON descriptor is first element (required by tf.io.browserFiles)
        files.sort((a,b)=> (a.name.endsWith('.json') ? -1 : 1));
        const handler = tf.io.browserFiles(files);
        this.models[objective] = await tf.loadLayersModel(handler);
        this.models[objective].compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: tf.losses.huberLoss
        });
        // Sync target net
        this.updateTargetModel(objective);
    }
    
    async play(renderGrid, renderBuffer, updateStats, resetEnv = true) {
        const oldEpsilon = this.epsilon;
        this.epsilon = 0; // No exploration during play
        
        // Only reset environment if requested (for normal play)
        if (resetEnv) {
            this.env.reset();
        }
        
        if (renderGrid) renderGrid();
        if (renderBuffer) renderBuffer();
        if (updateStats) updateStats();
        
        let done = false;
        let state = this.env.getState();
        
        while (!done) {
            await new Promise(r => setTimeout(r, 300)); // Slower for demonstration
            
            const action = this.act(state);
            const { nextState, reward, done: isDone } = this.env.step(action);
            
            state = nextState;
            done = isDone;
            
            if (renderGrid) renderGrid();
            if (renderBuffer) renderBuffer();
            if (updateStats) updateStats();
        }
        
        this.epsilon = oldEpsilon;
    }
} 