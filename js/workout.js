/**
 * Min-Max Companion - Workout Module
 * Handles active workout session management
 */

import { getDay } from './program.js';
import { saveWorkout, getLastPerformance } from './storage.js';

const ACTIVE_WORKOUT_KEY = 'minmax_active_workout_state';

let currentWorkout = null;
let workoutTimer = null;
let elapsedSeconds = 0;

/**
 * Initialize the workout UI
 */
export async function initWorkoutUI() {
  // Check for workout to resume or start
  const pendingWorkout = sessionStorage.getItem('minmax_active_workout');
  const savedState = loadWorkoutState();

  if (savedState) {
    // Resume in-progress workout
    currentWorkout = savedState;
    elapsedSeconds = savedState.elapsedSeconds || 0;
    renderActiveWorkout();
  } else if (pendingWorkout) {
    // Start new workout
    const { week, dayType } = JSON.parse(pendingWorkout);
    await startNewWorkout(week, dayType);
    sessionStorage.removeItem('minmax_active_workout');
  } else {
    // Show empty state
    renderEmptyState();
  }
}

/**
 * Start a new workout
 * @param {number} week - Week number
 * @param {string} dayType - Day type
 */
async function startNewWorkout(week, dayType) {
  const dayData = await getDay(week, dayType);
  if (!dayData) {
    console.error('Day data not found');
    renderEmptyState();
    return;
  }

  // Initialize workout state
  currentWorkout = {
    week,
    dayType,
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
    exercises: dayData.exercises.map(ex => {
      const lastPerf = getLastPerformance(ex.exercise);
      const targetSets = parseInt(ex.sets) || 2;

      return {
        name: ex.exercise,
        technique: ex.technique,
        sets: ex.sets,
        reps: ex.reps,
        rir: ex.rir,
        notes: ex.notes,
        substitutions: ex.substitutions,
        completed: false,
        expanded: false,
        loggedSets: Array(targetSets).fill(null).map((_, idx) => ({
          setNumber: idx + 1,
          weight: lastPerf && lastPerf[idx] ? lastPerf[idx].weight : '',
          reps: lastPerf && lastPerf[idx] ? lastPerf[idx].reps : '',
          logged: false
        }))
      };
    })
  };

  elapsedSeconds = 0;
  saveWorkoutState();
  renderActiveWorkout();
  startTimer();
}

/**
 * Render the active workout UI
 */
function renderActiveWorkout() {
  const screen = document.getElementById('workout-screen');
  if (!screen) return;

  const completedCount = currentWorkout.exercises.filter(ex => ex.completed).length;
  const totalCount = currentWorkout.exercises.length;

  screen.innerHTML = `
    <div class="screen-content workout-active">
      <div class="workout-header">
        <div class="workout-title">
          <h2>Week ${currentWorkout.week} - ${currentWorkout.dayType}</h2>
          <div class="workout-meta">
            <div class="workout-timer" id="workout-timer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${formatTime(elapsedSeconds)}</span>
            </div>
            <div class="workout-progress">
              ${completedCount}/${totalCount} exercises
            </div>
          </div>
        </div>
      </div>

      <div class="exercise-list" id="exercise-list">
        ${currentWorkout.exercises.map((ex, idx) => renderExerciseCard(ex, idx)).join('')}
      </div>

      <div class="workout-controls">
        <button class="btn-secondary" id="cancel-workout-btn">Cancel Workout</button>
        <button class="btn-primary" id="finish-workout-btn">Finish Workout</button>
      </div>
    </div>
  `;

  setupEventListeners();
  startTimer();
}

/**
 * Render an exercise card
 * @param {Object} exercise - Exercise data
 * @param {number} index - Exercise index
 * @returns {string} HTML string
 */
function renderExerciseCard(exercise, index) {
  const lastPerf = getLastPerformance(exercise.name);
  const lastTimeText = lastPerf && lastPerf[0]
    ? `${lastPerf[0].weight} lbs × ${lastPerf[0].reps}`
    : null;

  const allSetsLogged = exercise.loggedSets.every(set => set.logged);

  return `
    <div class="exercise-card ${exercise.expanded ? 'expanded' : ''} ${exercise.completed ? 'completed' : ''}" data-exercise-index="${index}">
      <div class="exercise-card-header" data-action="toggle">
        <div class="exercise-info">
          <div class="exercise-name-row">
            <h3 class="exercise-name">${exercise.name}</h3>
            ${allSetsLogged ? '<div class="exercise-checkmark">✓</div>' : ''}
          </div>
          <div class="exercise-badges">
            ${exercise.technique && exercise.technique !== 'N/A'
              ? `<span class="badge badge-technique">${exercise.technique}</span>`
              : ''}
            <span class="badge badge-target">${exercise.sets} × ${exercise.reps}</span>
            <span class="badge badge-rir">RIR ${exercise.rir}</span>
            ${lastTimeText
              ? `<span class="badge badge-last-time">Last: ${lastTimeText}</span>`
              : ''}
          </div>
        </div>
        <svg class="expand-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div class="exercise-card-body">
        ${exercise.notes && exercise.notes !== 'N/A'
          ? `<div class="exercise-notes">
              <strong>Notes:</strong> ${exercise.notes}
            </div>`
          : ''}

        ${exercise.substitutions && exercise.substitutions.length > 0
          ? `<div class="exercise-substitutions">
              <strong>Substitutions:</strong>
              <div class="substitution-pills">
                ${exercise.substitutions.map(sub => `<button class="pill-btn" data-action="substitute" data-substitution="${sub}">${sub}</button>`).join('')}
              </div>
            </div>`
          : ''}

        <div class="sets-logging">
          <div class="sets-header">
            <span>Set</span>
            <span>Weight (lbs)</span>
            <span>Reps</span>
            <span></span>
          </div>
          ${exercise.loggedSets.map((set, setIdx) => renderSetRow(set, setIdx, index)).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a set logging row
 * @param {Object} set - Set data
 * @param {number} setIndex - Set index
 * @param {number} exerciseIndex - Exercise index
 * @returns {string} HTML string
 */
function renderSetRow(set, setIndex, exerciseIndex) {
  if (set.logged) {
    return `
      <div class="set-row logged" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">
        <span class="set-number">${set.setNumber}</span>
        <span class="set-value">${set.weight}</span>
        <span class="set-value">${set.reps}</span>
        <button class="btn-edit" data-action="edit-set">Edit</button>
      </div>
    `;
  }

  return `
    <div class="set-row" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">
      <span class="set-number">${set.setNumber}</span>
      <div class="input-group">
        <button class="input-btn" data-action="decrement-weight">−</button>
        <input
          type="number"
          class="set-input weight-input"
          value="${set.weight}"
          placeholder="0"
          inputmode="decimal"
          step="5"
          data-field="weight"
        />
        <button class="input-btn" data-action="increment-weight">+</button>
      </div>
      <div class="input-group">
        <button class="input-btn" data-action="decrement-reps">−</button>
        <input
          type="number"
          class="set-input reps-input"
          value="${set.reps}"
          placeholder="0"
          inputmode="numeric"
          step="1"
          data-field="reps"
        />
        <button class="input-btn" data-action="increment-reps">+</button>
      </div>
      <button class="btn-log" data-action="log-set">Log</button>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const exerciseList = document.getElementById('exercise-list');
  const finishBtn = document.getElementById('finish-workout-btn');
  const cancelBtn = document.getElementById('cancel-workout-btn');

  // Exercise card interactions
  if (exerciseList) {
    exerciseList.addEventListener('click', handleExerciseListClick);
    exerciseList.addEventListener('input', handleInputChange);
  }

  // Workout controls
  if (finishBtn) {
    finishBtn.addEventListener('click', finishWorkout);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelWorkout);
  }
}

/**
 * Handle clicks in exercise list
 * @param {Event} e - Click event
 */
function handleExerciseListClick(e) {
  const action = e.target.dataset.action;
  if (!action) return;

  const setRow = e.target.closest('.set-row');
  const card = e.target.closest('.exercise-card');

  if (action === 'toggle' || e.target.closest('[data-action="toggle"]')) {
    const exerciseIndex = parseInt(card.dataset.exerciseIndex);
    toggleExercise(exerciseIndex);
  } else if (action === 'log-set' && setRow) {
    const exerciseIndex = parseInt(setRow.dataset.exerciseIndex);
    const setIndex = parseInt(setRow.dataset.setIndex);
    logSet(exerciseIndex, setIndex);
  } else if (action === 'edit-set' && setRow) {
    const exerciseIndex = parseInt(setRow.dataset.exerciseIndex);
    const setIndex = parseInt(setRow.dataset.setIndex);
    editSet(exerciseIndex, setIndex);
  } else if (action === 'increment-weight' && setRow) {
    adjustWeight(setRow, 5);
  } else if (action === 'decrement-weight' && setRow) {
    adjustWeight(setRow, -5);
  } else if (action === 'increment-reps' && setRow) {
    adjustReps(setRow, 1);
  } else if (action === 'decrement-reps' && setRow) {
    adjustReps(setRow, -1);
  } else if (action === 'substitute') {
    const substitution = e.target.dataset.substitution;
    alert(`Substitution: ${substitution}\n\nThis would replace the exercise with the selected substitution. (Feature not implemented in this version)`);
  }
}

/**
 * Handle input changes
 * @param {Event} e - Input event
 */
function handleInputChange(e) {
  if (!e.target.classList.contains('set-input')) return;

  const setRow = e.target.closest('.set-row');
  if (!setRow) return;

  const exerciseIndex = parseInt(setRow.dataset.exerciseIndex);
  const setIndex = parseInt(setRow.dataset.setIndex);
  const field = e.target.dataset.field;
  const value = e.target.value;

  if (currentWorkout.exercises[exerciseIndex]) {
    currentWorkout.exercises[exerciseIndex].loggedSets[setIndex][field] = value;
    saveWorkoutState();
  }
}

/**
 * Adjust weight value
 * @param {HTMLElement} setRow - Set row element
 * @param {number} delta - Amount to adjust
 */
function adjustWeight(setRow, delta) {
  const input = setRow.querySelector('.weight-input');
  const currentValue = parseFloat(input.value) || 0;
  const newValue = Math.max(0, currentValue + delta);
  input.value = newValue;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Adjust reps value
 * @param {HTMLElement} setRow - Set row element
 * @param {number} delta - Amount to adjust
 */
function adjustReps(setRow, delta) {
  const input = setRow.querySelector('.reps-input');
  const currentValue = parseInt(input.value) || 0;
  const newValue = Math.max(0, currentValue + delta);
  input.value = newValue;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Toggle exercise expansion
 * @param {number} index - Exercise index
 */
function toggleExercise(index) {
  currentWorkout.exercises[index].expanded = !currentWorkout.exercises[index].expanded;
  saveWorkoutState();
  renderActiveWorkout();
}

/**
 * Log a set
 * @param {number} exerciseIndex - Exercise index
 * @param {number} setIndex - Set index
 */
function logSet(exerciseIndex, setIndex) {
  const exercise = currentWorkout.exercises[exerciseIndex];
  const set = exercise.loggedSets[setIndex];

  // Validate inputs
  if (!set.weight || !set.reps) {
    alert('Please enter both weight and reps');
    return;
  }

  // Mark as logged
  set.logged = true;

  // Check if all sets are logged
  const allLogged = exercise.loggedSets.every(s => s.logged);
  if (allLogged) {
    exercise.completed = true;
  }

  saveWorkoutState();
  renderActiveWorkout();
}

/**
 * Edit a logged set
 * @param {number} exerciseIndex - Exercise index
 * @param {number} setIndex - Set index
 */
function editSet(exerciseIndex, setIndex) {
  const exercise = currentWorkout.exercises[exerciseIndex];
  const set = exercise.loggedSets[setIndex];

  set.logged = false;
  exercise.completed = false;

  saveWorkoutState();
  renderActiveWorkout();
}

/**
 * Finish the workout
 */
async function finishWorkout() {
  if (!currentWorkout) return;

  const completedCount = currentWorkout.exercises.filter(ex => ex.completed).length;
  const totalCount = currentWorkout.exercises.length;

  if (completedCount < totalCount) {
    const confirm = window.confirm(
      `You've only completed ${completedCount} of ${totalCount} exercises.\n\nAre you sure you want to finish?`
    );
    if (!confirm) return;
  }

  stopTimer();

  // Prepare workout data for storage
  const workoutData = {
    exercises: currentWorkout.exercises.map(ex => ({
      name: ex.name,
      sets: ex.loggedSets.filter(s => s.logged).map(s => ({
        weight: parseFloat(s.weight),
        reps: parseInt(s.reps)
      }))
    }))
  };

  try {
    // Save to storage
    await saveWorkout(currentWorkout.week, currentWorkout.dayType, workoutData);

    // Clear state
    clearWorkoutState();
    currentWorkout = null;
    elapsedSeconds = 0;

    // Show summary
    showWorkoutSummary(completedCount, totalCount);

    // Return to program tab after a delay
    setTimeout(() => {
      if (window.app) {
        window.app.activateTab('program');
      }
    }, 2000);
  } catch (error) {
    console.error('Failed to save workout:', error);
    alert('Failed to save workout. Please try again.');
  }
}

/**
 * Cancel the workout
 */
function cancelWorkout() {
  const confirm = window.confirm(
    'Are you sure you want to cancel this workout?\n\nAll progress will be lost.'
  );

  if (confirm) {
    stopTimer();
    clearWorkoutState();
    currentWorkout = null;
    elapsedSeconds = 0;
    renderEmptyState();
  }
}

/**
 * Show workout summary
 * @param {number} completed - Number of completed exercises
 * @param {number} total - Total number of exercises
 */
function showWorkoutSummary(completed, total) {
  const screen = document.getElementById('workout-screen');
  if (!screen) return;

  screen.innerHTML = `
    <div class="screen-content workout-summary">
      <div class="summary-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2>Workout Complete!</h2>
      <p class="summary-stats">
        ${completed} of ${total} exercises completed<br>
        Duration: ${formatTime(elapsedSeconds)}
      </p>
      <p class="summary-message">Great work! Your progress has been saved.</p>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState() {
  const screen = document.getElementById('workout-screen');
  if (!screen) return;

  screen.innerHTML = `
    <div class="screen-content workout-empty">
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6.5 6.5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
          <path d="M17.5 6.5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
          <path d="M6.5 6.5h4m3 0h4"></path>
          <path d="M12 6.5v11"></path>
          <path d="M6.5 17.5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
          <path d="M17.5 17.5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
          <path d="M6.5 17.5h4m3 0h4"></path>
        </svg>
      </div>
      <h2>No Active Workout</h2>
      <p>Go to the Program tab to start a workout</p>
    </div>
  `;
}

/**
 * Start the workout timer
 */
function startTimer() {
  stopTimer(); // Clear any existing timer

  workoutTimer = setInterval(() => {
    elapsedSeconds++;
    if (currentWorkout) {
      currentWorkout.elapsedSeconds = elapsedSeconds;
      saveWorkoutState();
    }
    updateTimerDisplay();
  }, 1000);
}

/**
 * Stop the workout timer
 */
function stopTimer() {
  if (workoutTimer) {
    clearInterval(workoutTimer);
    workoutTimer = null;
  }
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
  const timerElement = document.querySelector('#workout-timer span');
  if (timerElement) {
    timerElement.textContent = formatTime(elapsedSeconds);
  }
}

/**
 * Format time in HH:MM:SS or MM:SS
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Save workout state to localStorage
 */
function saveWorkoutState() {
  if (!currentWorkout) return;

  try {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(currentWorkout));
  } catch (error) {
    console.error('Failed to save workout state:', error);
  }
}

/**
 * Load workout state from localStorage
 * @returns {Object|null} Saved workout state or null
 */
function loadWorkoutState() {
  try {
    const saved = localStorage.getItem(ACTIVE_WORKOUT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load workout state:', error);
    return null;
  }
}

/**
 * Clear workout state from localStorage
 */
function clearWorkoutState() {
  try {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  } catch (error) {
    console.error('Failed to clear workout state:', error);
  }
}
