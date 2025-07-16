let env, agent, canvas, ctx;
let isTraining = false;

// Add global variables to track stats and values
let currentIterations = 0;
let currentImprovements = 0;
let lastKnownValues = null;

function init() {
    // Set up canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Read gamma and max steps from UI
    const gammaInput = document.getElementById('gammaInput');
    const maxStepsInput = document.getElementById('maxStepsInput');
    let gamma = parseFloat(gammaInput.value);
    let maxSteps = parseInt(maxStepsInput.value);
    
    // Create environment and agent
    env = new Environment();
    
    // Set the agent image path here - using relative path to pictures folder
    env.setAgentImage('../pictures/beni_bornfeld.png');
    
    agent = new Agent(env);
    agent.gamma = gamma;
    agent.maxSteps = maxSteps;
    
    // Update agent params on input change
    gammaInput.addEventListener('input', () => {
        agent.gamma = parseFloat(gammaInput.value);
    });
    maxStepsInput.addEventListener('input', () => {
        agent.maxSteps = parseInt(maxStepsInput.value);
    });
    
    // Reset counters and values
    currentIterations = 0;
    currentImprovements = 0;
    lastKnownValues = new Array(env.nS).fill(0);
    updateTrainingStats(0, 0);
    
    // Initial render
    render();
    
    // Set up control buttons
    setupControls();
}

function setupControls() {
    const startButton = document.getElementById('startTraining');
    const showValuesButton = document.getElementById('showValues');
    const showBestButton = document.getElementById('showBest');
    const showRandomFailedButton = document.getElementById('showRandomFailed');
    
    startButton.addEventListener('click', () => {
        if (!isTraining) {
            isTraining = true;
            startButton.textContent = 'Pause Training';
            policyIterationLoop();
        } else {
            isTraining = false;
            startButton.textContent = 'Start Training';
        }
    });

    showValuesButton.addEventListener('click', () => {
        env.showValues = !env.showValues;
        render();
    });

    showBestButton.textContent = 'Run the Agent';
    showBestButton.addEventListener('click', async () => {
        isTraining = false;
        startButton.textContent = 'Start Training';
        await agent.runPolicyEpisode(render, agent.maxSteps, true); // true = testing mode
        // After running, check if agent reached the goal and show popup
        const lastState = env.getState();
        const pos = {x: lastState % env.gridSize, y: Math.floor(lastState / env.gridSize)};
        if (pos.x === env.goalPos.x && pos.y === env.goalPos.y) {
            showCompletionPopup(agent.iterations, agent.policyImprovements);
        }
    });

    showRandomFailedButton.addEventListener('click', async () => {
        isTraining = false;
        startButton.textContent = 'Start Training';
        if (agent.failedEpisodes && agent.failedEpisodes.length > 0) {
            const idx = Math.floor(Math.random() * agent.failedEpisodes.length);
            await animateEpisode(agent.failedEpisodes[idx]);
        } else {
            alert('No failed runs recorded yet!');
        }
    });
}

async function runRandomFailedEpisode() {
    // Generate a random policy (do not overwrite the agent's main policy)
    const randomPolicy = new Array(agent.nS).fill(0).map(() => {
        const arr = new Array(agent.nA).fill(0);
        arr[Math.floor(Math.random() * agent.nA)] = 1;
        return arr;
    });
    let state = env.reset();
    let steps = 0;
    while (steps < agent.maxSteps) {
        const actionProbs = randomPolicy[state];
        let action = 0;
        if (actionProbs) {
            action = actionProbs.indexOf(Math.max(...actionProbs));
        }
        const {nextState, done} = env.step(action);
        renderRandomPolicy(randomPolicy);
        if (done) break;
        state = nextState;
        steps++;
        await new Promise(resolve => setTimeout(resolve, 120));
    }
}

function renderRandomPolicy(policy) {
    env.render(ctx, true, true, policy, env.showValues && agent.V ? agent.V : null);
}

// Update function to maintain current values
function updateTrainingStats(iterations, improvements, values = null) {
    currentIterations = iterations;
    currentImprovements = improvements;
    if (values) {
        lastKnownValues = [...values];
    }
    document.getElementById('iterations-count').textContent = iterations;
    document.getElementById('improvements-count').textContent = improvements;
}

// Policy Iteration loop for Start Training
async function policyIterationLoop() {
    // Reset stats at start of training
    currentIterations = 0;
    currentImprovements = 0;
    lastKnownValues = new Array(env.nS).fill(0);
    updateTrainingStats(0, 0);
    
    await agent.runPolicyIteration(
        (iterations, improvements, values) => {
            updateTrainingStats(iterations, improvements, values);
            render();
        }
    );
    
    isTraining = false;
    document.getElementById('startTraining').textContent = 'Start Training';
}

function render() {
    // Always use agent.policy and lastKnownValues for rendering
    env.render(ctx, true, true, agent.policy, env.showValues ? lastKnownValues : null);
    // Keep stats visible
    updateTrainingStats(currentIterations, currentImprovements);
}

// Initialize when page loads
window.addEventListener('load', init);

// 5. Animate an episode (helper)
async function animateEpisode(episode) {
    env.reset();
    render();
    for (let i = 0; i < episode.length - 1; i++) {
        const {state, action} = episode[i];
        if (action !== null) {
            env.step(action);
            render();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

// 6. Show pop-up after agent reaches goal in testing
function showCompletionPopup(iterations, improvements) {
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = 'white';
    popup.style.border = '2px solid #333';
    popup.style.padding = '30px 40px';
    popup.style.zIndex = 1000;
    popup.style.textAlign = 'center';
    popup.innerHTML = `<h2>Escape Room Solved!</h2><p>Iterations: <b>${iterations}</b><br>Policy Improvements: <b>${improvements}</b></p>`;
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next Escape Room';
    nextBtn.style.marginTop = '20px';
    nextBtn.style.padding = '10px 20px';
    nextBtn.style.fontSize = '16px';
    nextBtn.onclick = () => { popup.remove(); window.location.href = '../SARSA/index.html'; };
    popup.appendChild(nextBtn);
    document.body.appendChild(popup);
} 