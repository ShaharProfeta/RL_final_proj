# Function Documentation for Each Room

This document provides an overview of all functions (methods) in `agent.js` and `environment.js` for each room. Each function includes a simple explanation.

---

## Dynamic Programming Room

### agent.js (class: `Agent`)
- constructor(environment): Initializes the agent and learning parameters.
- selectAction(state): Chooses an action using the current policy.
- update(state, action, reward, nextState): Updates Q-values based on experience.
- runEpisode(renderCallback): Runs a single episode in the environment.
- runAllEpisodes(numEpisodes = 1000, renderCallback): Runs multiple episodes for training.
- showBestRun(renderCallback): Displays the best episode found.
- runPolicyEpisode(renderCallback, maxSteps = 50, testing = false): Runs an episode using the current policy.
- getExpectedValue(pos, a, V): Calculates expected value for a state-action pair.
- getExpectedValueUniformSlippery(pos, V): Calculates expected value for slippery cells.
- runValueIteration(renderCallback, maxIterations = 50, theta = 1e-4): Runs value iteration algorithm.
- runPolicyIteration(renderCallback, maxIterations = 50, theta = 1e-4): Runs policy iteration algorithm.

### environment.js (class: `Environment`)
- constructor(): Sets up the grid environment.
- isValidEmptyCell(pos): Checks if a cell is empty and valid.
- getAdjacentCells(pos): Returns adjacent cells for a position.
- getRandomEmptyCell(): Picks a random empty cell.
- reset(): Resets the environment.
- getState(): Returns the current state.
- isTerminalState(pos): Checks if a state is terminal.
- getReward(pos): Returns the reward for a position.
- isSlipperyCell(pos): Checks if a cell is slippery.
- step(action): Applies an action and updates the environment.
- render(ctx, showProbabilities = false, showPolicy = false, policy = null, values = null): Draws the environment.

---

## SARSA Room

### agent.js (class: `SarsaAgent`)
- constructor(env): Initializes the SARSA agent.
- selectAction(state, useEpsilon = true, deterministic = false): Chooses an action using epsilon-greedy or deterministic policy.
- getBestAction(state, deterministic = false): Returns the best action for a state.
- update(state, action, reward, nextState, nextAction): Updates Q-values using the SARSA rule.
- runEpisode(renderCallback = null, maxSteps = 200): Runs a single training episode.
- runBestPolicy(renderCallback = null, maxSteps = 300): Runs an episode using the best policy.
- getStateValues(): Returns the value of each state.

### environment.js (class: `Environment`)
- constructor(): Sets up the SARSA environment.
- checkAllImagesLoaded(): Checks if all images are loaded for rendering.
- reset(): Resets the environment.
- getState(pos): Returns the state for a given position.
- getPosition(state): Returns the position for a given state.
- isOnFreezeBlock(pos): Checks if a position is a freeze block.
- deactivateFreezeBlock(pos): Deactivates a freeze block.
- step(action): Applies an action and updates the environment.
- moveNPC(): Moves the NPC in the environment.
- render(agent = null): Draws the environment.

---

## Q-Learning Room

### agent.js (class: `Agent`)
- constructor(environment, epsilon = 0.2, alpha = 0.1, gamma = 0.9): Initializes the Q-learning agent.
- getState(): Gets the current state from the environment.
- initializeState(state): Initializes Q-values for a new state.
- chooseAction(state, validActions): Chooses an action using epsilon-greedy policy.
- learn(state, action, reward, nextState, validActions): Updates Q-values using the Q-learning rule.
- runEpisode(renderCallback = null): Runs a single training episode.
- freezePolicy(): Saves the current policy for demonstration.
- playEpisode(renderCallback = null): Runs an episode using the learned policy.

### environment.js (class: `Environment`)
- constructor(): Sets up the escape room environment.
- buildMap(): Builds the map layout.
- getReward(baseReward): Calculates the reward for the agent.
- getState(): Returns the current state.
- getCurrentPos(): Returns the agent's current position.
- isValidMove(pos): Checks if a move is valid.
- getValidActions(): Returns valid actions from the current state.
- step(action): Applies an action and updates the environment.
- moveGuard(): Moves the guard in the environment.
- checkGuardCollision(prevGuardPos = null): Checks for collision with the guard.
- render(agent = null): Draws the environment.
- reset(): Resets the environment.
- isQuicksand(x, y): Checks if a cell is quicksand.

---

## DQN Room

### agent.js (class: `PacmanHierarchicalDQNAgent`)
- constructor(env, bufferSize = 10000, batchSize = 64, hiddenUnits = 64, replayFreq = 4): Initializes the DQN agent and its neural networks.
- createModel(): Builds a new neural network model for the agent.
- updateTargetModel(modelIndex): Copies weights from the main model to the target model.
- softUpdateTargetModel(modelIndex): Gradually updates the target model weights.
- getCurrentObjective(): Returns the agent's current sub-goal.
- remember(state, action, reward, nextState, done): Stores experience in the replay buffer.
- act(state): Chooses an action based on the current policy.
- replay(objective = null): Trains the model using experiences from the buffer.
- getLossHistory(objective): Retrieves the loss history for a model.
- saveModel(objective, name = null): Saves a model to disk.
- saveAllModels(): Saves all models.
- loadModel(objective, file): Loads a model from a file.
- loadModelFromFiles(objective, files): Loads a model from multiple files.
- play(renderGrid, renderBuffer, updateStats, resetEnv = true): Runs the agent in the environment for demonstration.

### environment.js (class: `PacmanGridEnvironment`)
- constructor(gridSize = 10): Sets up the Pac-Man grid environment.
- setDemoMode(enabled): Enables or disables demo mode.
- reset(): Resets the environment to its initial state.
- getState(): Returns the current state representation.
- getCurrentObjective(): Returns the current objective for the agent.
- getTargetPowerPelletDistance(objective): Calculates distance to a power pellet.
- getPreviousTargetPowerPelletDistance(action, objective): Gets previous distance to a power pellet.
- getClosestPowerPelletDistance(): Finds the nearest power pellet.
- getPreviousClosestPowerPelletDistance(action): Gets previous closest pellet distance.
- getObjectiveBasedReward(action, prevDist, newDist): Computes reward based on the current objective.
- getRewardForFirstPowerPellet(action, prevDist, newDist): Computes reward for the first pellet.
- getRewardForSecondPowerPellet(action, prevDist, newDist): Computes reward for the second pellet.
- getRewardForEatingGhost(action, prevDist, newDist): Computes reward for eating a ghost.
- step(action): Applies an action and updates the environment. 