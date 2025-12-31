/**
 * Min-Max Companion - Progress Module
 * Handles progress tracking and visualization
 */

import { getWorkoutHistory } from './storage.js';

let currentChart = null;
let exerciseData = null;

/**
 * Initialize the progress UI
 */
export async function initProgressUI() {
  exerciseData = aggregateExerciseData();
  renderProgressScreen();
}

/**
 * Aggregate workout data by exercise
 * @returns {Object} Exercise data grouped by exercise name
 */
function aggregateExerciseData() {
  const history = getWorkoutHistory();
  const exerciseMap = {};

  // Process all workouts
  Object.values(history).forEach(workout => {
    const workoutDate = new Date(workout.completedAt);

    workout.exercises.forEach(exercise => {
      if (!exercise.sets || exercise.sets.length === 0) return;

      const exerciseName = exercise.name;

      if (!exerciseMap[exerciseName]) {
        exerciseMap[exerciseName] = {
          name: exerciseName,
          sessions: []
        };
      }

      // Find max weight for this session
      const maxWeight = Math.max(...exercise.sets.map(s => s.weight || 0));
      const totalVolume = exercise.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

      exerciseMap[exerciseName].sessions.push({
        date: workoutDate,
        week: workout.week,
        dayType: workout.dayType,
        sets: exercise.sets,
        maxWeight,
        totalVolume
      });
    });
  });

  // Sort sessions by date for each exercise
  Object.values(exerciseMap).forEach(exercise => {
    exercise.sessions.sort((a, b) => a.date - b.date);
  });

  return exerciseMap;
}

/**
 * Render the progress screen
 */
function renderProgressScreen() {
  const screen = document.getElementById('progress-screen');
  if (!screen) return;

  const exercises = Object.keys(exerciseData || {});

  if (exercises.length === 0) {
    renderEmptyState();
    return;
  }

  // Default to first exercise
  const defaultExercise = exercises[0];

  screen.innerHTML = `
    <div class="screen-content progress-content">
      <div class="progress-header">
        <h2>Progress Tracking</h2>
        <p class="progress-subtitle">Track your strength gains over time</p>
      </div>

      <div class="exercise-selector-container">
        <label for="exercise-selector">Select Exercise:</label>
        <select id="exercise-selector" class="exercise-selector">
          ${exercises.map(ex => `<option value="${ex}">${ex}</option>`).join('')}
        </select>
      </div>

      <div class="chart-container">
        <canvas id="progress-chart"></canvas>
      </div>

      <div id="stats-summary" class="stats-summary">
        <!-- Stats will be populated here -->
      </div>
    </div>
  `;

  setupEventListeners();
  renderChart(defaultExercise);
  renderStats(defaultExercise);
}

/**
 * Render empty state
 */
function renderEmptyState() {
  const screen = document.getElementById('progress-screen');
  if (!screen) return;

  screen.innerHTML = `
    <div class="screen-content progress-empty">
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
      </div>
      <h2>No Progress Data Yet</h2>
      <p>Complete some workouts to see your strength gains!</p>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const selector = document.getElementById('exercise-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      const exerciseName = e.target.value;
      renderChart(exerciseName);
      renderStats(exerciseName);
    });
  }
}

/**
 * Render the progress chart
 * @param {string} exerciseName - Name of the exercise
 */
function renderChart(exerciseName) {
  const exercise = exerciseData[exerciseName];
  if (!exercise) return;

  const canvas = document.getElementById('progress-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
  }

  // Prepare data
  const labels = exercise.sessions.map(session =>
    formatChartDate(session.date)
  );

  const dataPoints = exercise.sessions.map(session => session.maxWeight);

  // Create chart
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Max Weight (lbs)',
        data: dataPoints,
        borderColor: '#d4af37',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#d4af37',
        pointBorderColor: '#1a1a1a',
        pointBorderWidth: 2,
        tension: 0.2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#252525',
          titleColor: '#d4af37',
          bodyColor: '#e8e8e8',
          borderColor: '#d4af37',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `Weight: ${context.parsed.y} lbs`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#333',
            borderColor: '#333'
          },
          ticks: {
            color: '#a0a0a0',
            font: {
              size: 11
            },
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: '#333',
            borderColor: '#333'
          },
          ticks: {
            color: '#a0a0a0',
            font: {
              size: 12
            },
            callback: function(value) {
              return value + ' lbs';
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

/**
 * Render stats summary
 * @param {string} exerciseName - Name of the exercise
 */
function renderStats(exerciseName) {
  const exercise = exerciseData[exerciseName];
  if (!exercise || exercise.sessions.length === 0) return;

  const container = document.getElementById('stats-summary');
  if (!container) return;

  const firstSession = exercise.sessions[0];
  const lastSession = exercise.sessions[exercise.sessions.length - 1];
  const allWeights = exercise.sessions.map(s => s.maxWeight);
  const personalRecord = Math.max(...allWeights);

  const startingWeight = firstSession.maxWeight;
  const currentWeight = lastSession.maxWeight;
  const weightGain = currentWeight - startingWeight;
  const percentGain = startingWeight > 0
    ? ((weightGain / startingWeight) * 100).toFixed(1)
    : 0;

  const isCurrentPR = currentWeight === personalRecord;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Starting Weight</div>
      <div class="stat-value">${startingWeight} lbs</div>
      <div class="stat-date">${formatStatDate(firstSession.date)}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Current Weight</div>
      <div class="stat-value">${currentWeight} lbs</div>
      <div class="stat-date">${formatStatDate(lastSession.date)}</div>
      ${isCurrentPR ? '<div class="pr-badge">Personal Record!</div>' : ''}
    </div>

    <div class="stat-card ${weightGain >= 0 ? 'positive' : 'negative'}">
      <div class="stat-label">Progress</div>
      <div class="stat-value">${weightGain >= 0 ? '+' : ''}${weightGain} lbs</div>
      <div class="stat-percent">${weightGain >= 0 ? '+' : ''}${percentGain}%</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Total Sessions</div>
      <div class="stat-value">${exercise.sessions.length}</div>
    </div>
  `;
}

/**
 * Format date for chart labels
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatChartDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format date for stats display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatStatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Export the init function
export { initProgressUI };
