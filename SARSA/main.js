// Initialize environment and agent
const env = new Environment();
const agent = new Agent(env);

// UI elements
const startTrainingBtn = document.getElementById('startTraining');
const stopTrainingBtn = document.getElementById('stopTraining');
const fastTrainBtn = document.getElementById('fastTrain');
const playButton = document.getElementById('playButton');
const showQValuesBtn = document.getElementById('showQValues');
const nextRoomButton = document.getElementById('nextRoomButton');

// Parameter inputs
const alphaInput = document.getElementById('alphaInput');
const gammaInput = document.getElementById('gammaInput');
const epsilonInput = document.getElementById('epsilonInput');
const epsilonDecayInput = document.getElementById('epsilonDecayInput');
const minEpsilonInput = document.getElementById('minEpsilonInput');
const maxStepsInput = document.getElementById('maxStepsInput');
const numEpisodesInput = document.getElementById('numEpisodesInput');

// Display elements
const currentEpsilonSpan = document.getElementById('currentEpsilon');
const episodeCountSpan = document.getElementById('episodeCount');
const totalEpisodesSpan = document.getElementById('totalEpisodes');
const averageRewardSpan = document.getElementById('averageReward');
const lastEpisodeRewardSpan = document.getElementById('lastEpisodeReward');
const progressFill = document.getElementById('progressFill');

// Training state
let isTraining = false;
let episodeCount = 0;
let totalReward = 0;
let showingQValues = false;
let maxSteps = parseInt(maxStepsInput.value);
let numEpisodes = parseInt(numEpisodesInput.value);
let recentRewards = [];
const recentRewardsMaxSize = 100; // For calculating moving average

// Make showingQValues global for environment.js to access
window.showingQValues = showingQValues;

// Initial render
env.render();

// Update UI parameters when changed
alphaInput.addEventListener('change', () => {
    agent.alpha = parseFloat(alphaInput.value);
});

gammaInput.addEventListener('change', () => {
    agent.gamma = parseFloat(gammaInput.value);
});

epsilonInput.addEventListener('change', () => {
    agent.epsilon = parseFloat(epsilonInput.value);
    currentEpsilonSpan.textContent = agent.epsilon.toFixed(3);
});

epsilonDecayInput.addEventListener('change', () => {
    agent.epsilonDecay = parseFloat(epsilonDecayInput.value);
});

minEpsilonInput.addEventListener('change', () => {
    agent.epsilonMin = parseFloat(minEpsilonInput.value);
});

maxStepsInput.addEventListener('change', () => {
    maxSteps = parseInt(maxStepsInput.value);
});

numEpisodesInput.addEventListener('change', () => {
    numEpisodes = parseInt(numEpisodesInput.value);
    totalEpisodesSpan.textContent = numEpisodes;
    updateProgress();
});

function updateProgress() {
    // Update progress bar
    const progress = (episodeCount / numEpisodes) * 100;
    progressFill.style.width = `${progress}%`;
    
    // Update episode count
    episodeCountSpan.textContent = episodeCount;
    
    // Update average reward
    if (recentRewards.length > 0) {
        const avgReward = recentRewards.reduce((a, b) => a + b) / recentRewards.length;
        averageRewardSpan.textContent = avgReward.toFixed(1);
    }
}

// Training function
async function train() {
    if (!isTraining) return;
    
    const reward = await agent.runEpisode(() => {
        env.render(showingQValues ? agent : null);
    }, maxSteps);
    
    // Update reward tracking
    totalReward += reward;
    recentRewards.push(reward);
    if (recentRewards.length > recentRewardsMaxSize) {
        recentRewards.shift();
    }
    
    // Update UI
    episodeCount++;
    lastEpisodeRewardSpan.textContent = reward.toFixed(1);
    currentEpsilonSpan.textContent = agent.epsilon.toFixed(3);
    updateProgress();
    
    // Continue training if not done
    if (isTraining && episodeCount < numEpisodes) {
        requestAnimationFrame(train);
    } else {
        isTraining = false;
        startTrainingBtn.disabled = false;
        stopTrainingBtn.disabled = true;
    }
}

// Fast training function (no visualization)
async function fastTrain() {
    // Disable all training buttons during fast training
    startTrainingBtn.disabled = true;
    stopTrainingBtn.disabled = true;
    fastTrainBtn.disabled = true;
    
    // Reset episode count and rewards
    episodeCount = 0;
    totalReward = 0;
    recentRewards = [];
    
    // Run all episodes without visualization
    for (let i = 0; i < numEpisodes && !isTraining; i++) {
        const reward = await agent.runEpisode(null, maxSteps);
        
        // Update reward tracking
        totalReward += reward;
        recentRewards.push(reward);
        if (recentRewards.length > recentRewardsMaxSize) {
            recentRewards.shift();
        }
        
        // Update UI less frequently (every 10 episodes)
        episodeCount++;
        if (episodeCount % 10 === 0) {
            lastEpisodeRewardSpan.textContent = reward.toFixed(1);
            currentEpsilonSpan.textContent = agent.epsilon.toFixed(3);
            updateProgress();
            // Allow UI to update by yielding to the event loop
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Final UI update
    updateProgress();
    
    // Re-enable buttons
    startTrainingBtn.disabled = false;
    stopTrainingBtn.disabled = true;
    fastTrainBtn.disabled = false;
    
    // Render final state
    env.render(showingQValues ? agent : null);
}

// Button event handlers
startTrainingBtn.addEventListener('click', () => {
    if (!isTraining) {
        isTraining = true;
        startTrainingBtn.disabled = true;
        stopTrainingBtn.disabled = false;
        fastTrainBtn.disabled = true;
        train();
    }
});

stopTrainingBtn.addEventListener('click', () => {
    isTraining = false;
    startTrainingBtn.disabled = false;
    stopTrainingBtn.disabled = true;
    fastTrainBtn.disabled = false;
});

fastTrainBtn.addEventListener('click', () => {
    isTraining = false;  // Make sure regular training is stopped
    fastTrain();
});

playButton.addEventListener('click', async () => {
    if (!isTraining) {
        const result = await agent.runBestPolicy(() => {
            env.render(showingQValues ? agent : null);
        }, maxSteps);
        // Enable the next room button if agent reached the goal
        if (result.reachedGoal) {
            nextRoomButton.disabled = false;
        } else {
            nextRoomButton.disabled = true;
        }
    }
});

function showCompletionPopup(reward, reachedGoal) {
    console.log('showCompletionPopup called with reward:', reward, 'reachedGoal:', reachedGoal);
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
    popup.innerHTML = reachedGoal
        ? `<h2>Escape Room Solved!</h2><p>Reward: <b>${reward.toFixed(1)}</b></p>`
        : `<h2>Try Again!</h2><p>Reward: <b>${reward.toFixed(1)}</b></p>`;
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next Escape Room';
    nextBtn.style.marginTop = '20px';
    nextBtn.style.padding = '10px 20px';
    nextBtn.style.fontSize = '16px';
    nextBtn.onclick = () => { popup.remove(); window.location.href = '../Q-learning/index.html'; };
    popup.appendChild(nextBtn);
    document.body.appendChild(popup);
}

showQValuesBtn.addEventListener('click', () => {
    showingQValues = !showingQValues;
    window.showingQValues = showingQValues;
    showQValuesBtn.textContent = showingQValues ? 'Hide Q-Values' : 'Show Q-Values';
    env.render(showingQValues ? agent : null);
});

// Initialize button states
stopTrainingBtn.disabled = true;
nextRoomButton.disabled = false;
nextRoomButton.onclick = () => {
    window.location.href = '../Q_learning/index.html';
}; 