# RL Escape Room: Code Highlights by Room

This document summarizes the most important lines and sections in the code for each of the four rooms. For each room, we highlight:
- **Reward Setting**
- **Algorithm Implementation**
- **State Management**
- **Special Features**

---

## 1. Dynamic Programming Room
**Directory:** `rl-escape-room/dynamic_programing/`

### Reward Setting
- `environment.js`:
  - Rewards: goal (+1000), lava (-500), all other moves (0). See `getReward(pos)` (lines ~207–213).
  - Reward logic used in `step(action)` (lines ~217–311).

### Algorithm Implementation
- `agent.js`:
  - Value Iteration: `runValueIteration` (lines ~205–239).
  - Policy Iteration: `runPolicyIteration` (lines ~239–362).
  - Q-learning update for comparison: `update(state, action, reward, nextState)` (lines ~61–66).

### State Management
- `environment.js`:
  - State is agent position as a single integer: `getState()` (lines ~189–197).
  - State reset in `reset()` (lines ~189–197).
  - Terminal state check: `isTerminalState(pos)` (lines ~201–213).

### Special Features
- **Slippery cells**: probabilistic transitions, especially near lava (lines ~82–139, 217–311).
- **Automatic path validation**: ensures a path from start to goal exists (lines ~124–139).
- **Policy/value visualization**: UI can show value function and best run.

---

## 2. SARSA Room
**Directory:** `rl-escape-room/SARSA/`

### Reward Setting
- `environment.js`:
  - Rewards are defined in the constructor (lines ~7–15): `goalReward`, `npcCatchReward`, `freezeReward`, `stepCost`, `revisitPenalty`.
  - Reward logic is in `step(action)` (lines ~150–269): combines progress, penalties, bonuses, and terminal rewards.

### Algorithm Implementation
- `agent.js`:
  - SARSA update: `update(state, action, reward, nextState, nextAction)` (lines ~34–47).
  - Training loop: `runEpisode` (lines ~49–90).
  - Epsilon-greedy action selection: `selectAction` (lines ~23–33).

### State Management
- `environment.js`:
  - State is calculated by `getState(pos)` (lines ~122–127), based on agent position.
  - State reset in `reset()` (lines ~108–122).

### Special Features
- Predictive NPC with multiple strategies (`moveNPC`, lines ~494–596).
- Freeze blocks and slippery cells for added complexity.
- Q-value visualization in the UI (`render`, lines ~271–398).

---

## 3. Q-Learning Room
**Directory:** `rl-escape-room/Q_learning/`

### Reward Setting
- `environment.js`:
  - Rewards are constants in the constructor (lines ~24–40): `MOVE_REWARD`, `WALL_COLLISION_REWARD`, `GUARD_COLLISION_REWARD`, etc.
  - Reward logic is in `step(action)` (lines ~162–387): includes progress rewards, penalties, and special tile handling.

### Algorithm Implementation
- `agent.js`:
  - Q-learning update: `learn(state, action, reward, nextState, validActions)` (lines ~41–61).
  - Training loop: `runEpisode` (lines ~63–116).
  - Epsilon-greedy action selection: `chooseAction` (lines ~18–40).

### State Management
- `environment.js`:
  - State is a combination of position, key, and vault status: `getState()` (lines ~142–152).
  - State reset in `reset()` (lines ~387–391).

### Special Features
- Multi-phase objectives: collect key, open vault, reach exit.
- Teleporters, quicksand, and loop detection for richer environment.
- Q-value heatmap visualization in the UI (`render`, lines ~471–640).

---

## 4. DQN Room
**Directory:** `rl-escape-room/dqn/`

### Reward Setting
- `environment.js`:
  - Reward shaping and scaling in `getObjectiveBasedReward`, `getRewardForFirstPowerPellet`, etc. (lines ~206–234, 235–297).
  - Main reward logic in `step(action)` (lines ~297–615): includes dense shaping, penalties, and large terminal rewards.

### Algorithm Implementation
- `agent.js`:
  - Hierarchical DQN: three models for three objectives, initialized in constructor (lines ~1–50).
  - Experience replay and Bellman update: `replay` (lines ~141–220).
  - Action selection: `act(state)` (lines ~114–141).

### State Management
- `environment.js`:
  - State is a flattened array: Pac-Man/ghost positions, grid, power pellets eaten (`getState()`, lines ~15–111).
  - State reset in `reset()` (lines ~15–111).
  - State restoration for curriculum transfer: `setFromState` (lines ~872–922).

### Special Features
- **Hierarchical DQN**: Three separate models for sequential objectives (eat first power pellet, second, then ghost).
- **Curriculum transfer**: End states from one model are used as start states for the next.
- **Strategic teleporter and power pellet logic**.
- **Replay buffer and target networks for each model**.
- **Rich reward shaping and penalties for advanced agent behavior**.

---

*For more details, see the referenced files and line numbers in each section.* 