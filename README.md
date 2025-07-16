# Reinforcement Learning Escape Room Project

This project implements three different reinforcement learning algorithms to solve escape room scenarios. Each algorithm is applied to a different environment with unique challenges and optimal parameters.

credits: Alon Yamin , Haran Gidoni , Shahar Profeta

## Table of Contents
1. [Dynamic Programming](#dynamic-programming)
2. [SARSA](#sarsa)
3. [Q-Learning](#q-learning)
4. [Deep Q-Network (DQN)](#deep-q-network-dqn)

---

## Dynamic Programming

### Environment Overview
The Dynamic Programming environment is a **10x10 grid world** with slippery surfaces and lava obstacles. The agent must navigate from the top-left corner to the bottom-right corner while avoiding dangerous lava patches.

### State Structure
- **State Space**: 100 states (10×10 grid)
- **Actions**: 4 actions (up, right, down, left)
- **Terminal States**: Goal position (bottom-right) and lava positions

### Reward Structure
```
Goal (bottom-right):     +1000
Lava positions:          -200
Slippery cells:          -1 (step cost)
Normal cells:            -1 (step cost)
```

### Environment Features
- **Slippery Probability**: Random chance of slipping in unintended direction
- **Lava Positions**: 8 random dangerous positions
- **Slippery Cells**: 18 random cells 
- **Guaranteed Path**: BFS ensures a valid path exists from start to goal

### Optimal Parameters
```javascript
// Learning Parameters
alpha = 0.1;        // Learning rate
gamma = 0.9;        // Discount factor
epsilon = 0.1;      // Exploration rate

// Training Parameters
maxEpisodes = 1000;
maxSteps = 50;
```

### Algorithm Implementation
- **Value Iteration**: Finds optimal value function
- **Policy Iteration**: Alternates between policy evaluation and improvement
- **Q-Learning**: Online learning with epsilon-greedy exploration

### Key Challenges
1. **Slippery surfaces** require planning for uncertainty
2. **Lava avoidance** needs careful pathfinding
3. **Discount factor** balances immediate vs. future rewards

---

## SARSA

### Environment Overview
The SARSA environment is a **10x10 grid world** with a moving NPC (guard) that patrols the area. The agent must reach the goal while avoiding capture by the guard and utilizing freeze blocks strategically.

### State Structure
- **State Space**: 3916 states (89ncr2 grid)
- **Actions**: 4 actions (up, right, down, left)
- **Terminal States**: Goal position and NPC capture

### Reward Structure
```
Goal (bottom-right):           +250
NPC capture:                   -80
Freeze block activation:       +5.0
Step cost:                     0 (no step penalty)
Revisit penalty:               -5.0 (loop prevention)
```

### Environment Features
- **Moving NPC**: Moving torwards the agent
- **Freeze Blocks**: Strategic positions that can temporarily freeze the NPC
- **Slippery Cells**: Some cells have reduced control
- **Loop Prevention**: Penalty for revisiting the same cells

### Optimal Parameters
```javascript
// Learning Parameters
alpha = 0.15;           // Learning rate
gamma = 0.9;            // Discount factor
epsilon = 0.3;          // Initial exploration rate
minEpsilon = 0.05;      // Minimum exploration rate
epsilonDecay = 0.998;   // Exploration decay rate

// Training Parameters
maxEpisodes = 8000;
maxSteps = 200;
```

### Algorithm Implementation
- **SARSA (State-Action-Reward-State-Action)**: On-policy TD learning
- **Epsilon-greedy exploration**: Balances exploration and exploitation
- **Epsilon decay**: Gradually reduces exploration over time

### Key Challenges
1. **Dynamic opponent** requires adaptive strategies
2. **Strategic freeze blocks** need optimal timing
3. **Loop prevention** avoids getting stuck in cycles

---

## Q-Learning

### Environment Overview
The Q-Learning environment is a **10x10 grid world** with a multi-phase escape scenario. The agent must collect a key, open a vault, and reach the exit while avoiding a patrolling guard and quicksand.

### State Structure
- **State Space**: 2880 states (84 agent * 18 npc * 2 ( key, vault))
- **State Representation**:
  - `keyFlag`: Key collected (0 or 1)
  - `vaultFlag`: Vault opened (0 or 1)
- **Actions**: 4 actions (up, right, down, left)
- **Terminal States**: Exit reached, timeout, or guard capture

### Reward Structure
```
Exit reached:              +1000
Vault opened:              +300
Key collected:             +200
Move:                      -1
Wall collision:            -10
Guard collision:           -100
Quicksand:                 -5
Invalid action:            -10
Timeout:                   -200
Loop penalty:              -20
```

### Environment Features
- **Multi-phase objective**: Key → Vault → Exit
- **Patrolling guard**: Moves in rectangular pattern
- **Quicksand**: Slows down movement
- **Teleporters**: Strategic shortcuts
- **Loop detection**: Prevents infinite loops

### Optimal Parameters
```javascript
// Learning Parameters
alpha = 0.15;           // Learning rate
gamma = 0.95;           // Discount factor
epsilon = 0.3;          // Initial exploration rate
minEpsilon = 0.05;      // Minimum exploration rate
epsilonDecay = 0.998;   // Exploration decay rate

// Training Parameters
maxEpisodes = 8000;
maxSteps = 200;
```

### Algorithm Implementation
- **Q-Learning**: Off-policy TD learning with max Q-value
- **Epsilon-greedy exploration**: Balances exploration and exploitation
- **Policy freezing**: Saves learned policy for demonstration

### Key Challenges
1. **Multi-phase objectives** require sequential planning
2. **Dynamic guard** needs adaptive avoidance strategies
3. **Complex state space** with 2880 possible states
4. **Strategic resource management** (key, vault access)

---

## Deep Q-Network (DQN)

### Environment Overview
The DQN environment is a **Pac-Man style game** with hierarchical objectives. The agent must collect power pellets and hunt ghosts in a 10x10 grid world, demonstrating the power of deep neural networks in handling complex, high-dimensional state spaces.

### State Structure
- **State Space**: 3978-dimensional continuous state vector (52 ncr 2  *  3 flags)
- **State Representation**: 
  - Position data (4 values): x, y coordinates and relative distances
  - Grid map (52 values): 10×10 grid representation - block cell
  - Game state (1 value): Current objective phase
- **Actions**: 4 actions (up, right, down, left)
- **Terminal States**: All power pellets collected, ghost eaten, or timeout

### Reward Structure
```
Power pellet collected:     +100
Ghost eaten (powered):     +500
Regular pellet:            +10
Step cost:                 -1
Wall collision:            -10
Ghost collision (normal):  -100
Timeout:                   -50
```

### Environment Features
- **Hierarchical Objectives**: 3-phase learning system
  - Phase 1: Collect first power pellet
  - Phase 2: Collect second power pellet  
  - Phase 3: Hunt ghost while powered up
- **Moving Ghost**: Intelligent ghost with basic AI
- **Power Pellets**: Strategic items that enable ghost hunting
- **Experience Replay**: Stores transitions for stable learning
- **Target Networks**: Separate network for stable Q-value estimation

### Optimal Parameters
```javascript
// Network Parameters
learningRate = 0.0005;     // Neural network learning rate
hiddenUnits = 64;          // Hidden layer neurons
batchSize = 64;            // Experience replay batch size
bufferSize = 10000;        // Experience replay buffer size

// Learning Parameters
gamma = 0.99;              // Discount factor
epsilon = 1.0;             // Initial exploration rate
epsilonMin = 0.01;         // Minimum exploration rate
epsilonDecay = 0.99;       // Exploration decay rate
tau = 0.001;               // Target network update rate
updateEvery = 4;           // Target network update frequency

// Training Parameters
maxEpisodes = 5000;
maxSteps = 300;
```

### Algorithm Implementation
- **Deep Q-Network**: Neural network approximates Q-function
- **Experience Replay**: Random sampling from past experiences
- **Target Network**: Separate network for stable Q-value targets
- **Hierarchical Training**: 3 separate models for different objectives
- **Curriculum Learning**: Progressive difficulty increase

### Key Challenges
1. **High-dimensional state space** requires neural network approximation
2. **Hierarchical objectives** need specialized models for each phase
3. **Experience replay** prevents catastrophic forgetting
4. **Target network stability** ensures convergence
5. **Curriculum learning** manages complexity progression

### Neural Network Architecture
```
Input Layer (105 neurons)
    ↓
Hidden Layer (64 neurons, ReLU activation)
    ↓
Output Layer (4 neurons, linear activation)
```

### Training Process
1. **Model 1 Training**: Learn to collect first power pellet
2. **Model 2 Training**: Learn to collect second power pellet
3. **Model 3 Training**: Learn to hunt ghost while powered up
4. **Hierarchical Chain**: Combine all models for complete solution

### Advantages over Tabular Methods
- **Scalability**: Handles large state spaces efficiently
- **Generalization**: Learns patterns across similar states
- **Continuous State Support**: Works with real-valued inputs
- **Feature Learning**: Automatically discovers relevant features

---

## Comparison Summary

| Algorithm | Environment Type | State Space | Key Challenge | Optimal γ | Optimal α |
|-----------|------------------|-------------|---------------|-----------|-----------|
| Dynamic Programming | Static grid with uncertainty | 100 | Slippery surfaces | 0.9 | 0.1 |
| SARSA | Dynamic opponent | 100 | Moving NPC | 0.9 | 0.15 |
| Q-Learning | Multi-phase objectives | 1200 | Sequential tasks | 0.95 | 0.15 |
| DQN | Hierarchical objectives | 105 (continuous) | Neural approximation | 0.99 | 0.0005 |

### Common Patterns
1. **Epsilon decay**: All algorithms use exploration decay for better convergence
2. **Loop prevention**: Mechanisms to avoid infinite loops
3. **Strategic positioning**: All environments require careful pathfinding
4. **Risk management**: Balancing reward seeking with danger avoidance

### Performance Metrics
- **Success Rate**: Percentage of episodes reaching the goal
- **Average Reward**: Mean reward per episode
- **Convergence Speed**: Episodes needed for stable policy
- **Policy Quality**: Optimality of learned behavior

Each algorithm demonstrates different aspects of reinforcement learning, from theoretical optimality (Dynamic Programming) to practical online learning (SARSA, Q-Learning) in increasingly complex environments. 