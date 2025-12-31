/**
 * Min-Max Companion - Program Module
 * Handles workout program management and display
 */

import { getWorkoutHistory } from './storage.js';

let programData = null;
const CURRENT_WEEK_KEY = 'minmax_current_week';
const START_DATE_KEY = 'minmax_start_date';

/**
 * Load the program data from JSON file
 * @returns {Promise<Object>} The loaded program data
 */
async function loadProgramData() {
  if (programData) {
    return programData;
  }

  try {
    const response = await fetch('data/program.json');
    if (!response.ok) {
      throw new Error(`Failed to load program data: ${response.status}`);
    }
    programData = await response.json();
    return programData;
  } catch (error) {
    console.error('Error loading program data:', error);
    throw error;
  }
}

/**
 * Get data for a specific week
 * @param {number} weekNum - Week number (1-12)
 * @returns {Promise<Object|null>} Week data object or null if not found
 */
export async function getWeek(weekNum) {
  const data = await loadProgramData();
  return data.weeks.find(week => week.week === weekNum) || null;
}

/**
 * Get data for a specific day in a week
 * @param {number} weekNum - Week number (1-12)
 * @param {string} dayType - Day type (e.g., "Full Body", "Upper", "Lower", "Arms/Delts")
 * @returns {Promise<Object|null>} Day data object or null if not found
 */
export async function getDay(weekNum, dayType) {
  const week = await getWeek(weekNum);
  if (!week) {
    return null;
  }

  return week.days.find(day => day.day_type === dayType) || null;
}

/**
 * Get all weeks with summary information
 * @returns {Promise<Array>} Array of week summary objects
 */
export async function getAllWeeks() {
  const data = await loadProgramData();

  return data.weeks.map(week => {
    const dayTypes = week.days.map(day => day.day_type);

    return {
      week: week.week,
      label: week.label || `Week ${week.week}`,
      dayTypes: dayTypes,
      totalDays: week.days.length
    };
  });
}

/**
 * Get a formatted label for a week
 * @param {number} weekNum - Week number (1-12)
 * @returns {Promise<string>} Week label (e.g., "Intro Week" or "Week 3")
 */
export async function getWeekLabel(weekNum) {
  const week = await getWeek(weekNum);
  if (!week) {
    return `Week ${weekNum}`;
  }
  return week.label || `Week ${weekNum}`;
}

/**
 * Get program metadata
 * @returns {Promise<Object>} Program name and description
 */
export async function getProgramInfo() {
  const data = await loadProgramData();
  return {
    name: data.program_name,
    description: data.program_description
  };
}

/**
 * Get all available day types across the entire program
 * @returns {Promise<Array>} Unique array of day types
 */
export async function getAllDayTypes() {
  const data = await loadProgramData();
  const dayTypes = new Set();

  data.weeks.forEach(week => {
    week.days.forEach(day => {
      dayTypes.add(day.day_type);
    });
  });

  return Array.from(dayTypes);
}

/**
 * Search for exercises across the entire program
 * @param {string} searchTerm - Search term to match against exercise names
 * @returns {Promise<Array>} Array of exercises matching the search term
 */
export async function searchExercises(searchTerm) {
  const data = await loadProgramData();
  const results = [];
  const lowerSearch = searchTerm.toLowerCase();

  data.weeks.forEach(week => {
    week.days.forEach(day => {
      day.exercises.forEach(exercise => {
        if (exercise.exercise.toLowerCase().includes(lowerSearch)) {
          results.push({
            week: week.week,
            weekLabel: week.label || `Week ${week.week}`,
            dayType: day.day_type,
            exercise: exercise
          });
        }
      });
    });
  });

  return results;
}

/**
 * Get total number of weeks in the program
 * @returns {Promise<number>} Total number of weeks
 */
export async function getTotalWeeks() {
  const data = await loadProgramData();
  return data.weeks.length;
}

/**
 * Get or set the current week
 * @param {number} weekNum - Optional week number to set as current
 * @returns {number} Current week number
 */
export function getCurrentWeek(weekNum = null) {
  if (weekNum !== null) {
    localStorage.setItem(CURRENT_WEEK_KEY, weekNum.toString());
    return weekNum;
  }

  const stored = localStorage.getItem(CURRENT_WEEK_KEY);
  return stored ? parseInt(stored, 10) : 1;
}

/**
 * Check if a specific workout has been completed
 * @param {number} weekNum - Week number
 * @param {string} dayType - Day type
 * @returns {Object|null} Completion info or null if not completed
 */
export function getWorkoutCompletion(weekNum, dayType) {
  const history = getWorkoutHistory();

  // Find any workout matching this week and day type
  for (const [key, workout] of Object.entries(history)) {
    if (workout.week === weekNum && workout.dayType === dayType) {
      return {
        completed: true,
        date: workout.completedAt,
        key: key
      };
    }
  }

  return null;
}

/**
 * Get completion statistics for a week
 * @param {number} weekNum - Week number
 * @returns {Promise<Object>} Completion stats
 */
export async function getWeekCompletionStats(weekNum) {
  const week = await getWeek(weekNum);
  if (!week) {
    return { total: 0, completed: 0, percentage: 0 };
  }

  const total = week.days.length;
  let completed = 0;

  week.days.forEach(day => {
    if (getWorkoutCompletion(weekNum, day.day_type)) {
      completed++;
    }
  });

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Initialize the Program UI
 */
export async function initProgramUI() {
  try {
    await renderWeekTimeline();
    setupModalHandlers();
  } catch (error) {
    console.error('Failed to initialize Program UI:', error);
  }
}

/**
 * Render the week timeline
 */
async function renderWeekTimeline() {
  const timeline = document.getElementById('week-timeline');
  if (!timeline) return;

  const data = await loadProgramData();
  const currentWeek = getCurrentWeek();

  timeline.innerHTML = '';

  for (const week of data.weeks) {
    const weekCard = await createWeekCard(week, currentWeek);
    timeline.appendChild(weekCard);
  }
}

/**
 * Create a week card element
 * @param {Object} week - Week data
 * @param {number} currentWeek - Current week number
 * @returns {HTMLElement} Week card element
 */
async function createWeekCard(week, currentWeek) {
  const card = document.createElement('div');
  card.className = 'week-card';

  // Determine week status
  const stats = await getWeekCompletionStats(week.week);
  const isComplete = stats.completed === stats.total && stats.total > 0;
  const isCurrent = week.week === currentWeek;
  const isFuture = week.week > currentWeek;

  if (isCurrent) card.classList.add('current-week');
  if (isComplete) card.classList.add('completed-week');
  if (isFuture) card.classList.add('future-week');

  // Create week header
  const header = document.createElement('div');
  header.className = 'week-card-header';

  const titleDiv = document.createElement('div');
  const weekNumber = document.createElement('div');
  weekNumber.className = 'week-number';
  weekNumber.textContent = `Week ${week.week}`;
  titleDiv.appendChild(weekNumber);

  if (week.label) {
    const weekLabel = document.createElement('div');
    weekLabel.className = 'week-label';
    weekLabel.textContent = week.label;
    titleDiv.appendChild(weekLabel);
  }

  header.appendChild(titleDiv);

  // Add checkmark for completed weeks
  if (isComplete) {
    const status = document.createElement('div');
    status.className = 'week-status';
    status.innerHTML = `
      <svg class="checkmark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    header.appendChild(status);
  }

  card.appendChild(header);

  // Create day indicators
  const indicators = document.createElement('div');
  indicators.className = 'day-indicators';

  week.days.forEach(day => {
    const indicator = document.createElement('div');
    indicator.className = 'day-indicator';

    const completion = getWorkoutCompletion(week.week, day.day_type);
    if (completion) {
      indicator.classList.add('completed');
    }

    const circle = document.createElement('div');
    circle.className = 'day-indicator-circle';

    const label = document.createElement('div');
    label.className = 'day-indicator-label';
    label.textContent = getDayTypeShortName(day.day_type);

    indicator.appendChild(circle);
    indicator.appendChild(label);
    indicators.appendChild(indicator);
  });

  card.appendChild(indicators);

  // Add completion summary
  const summary = document.createElement('div');
  summary.className = 'completion-summary';
  if (isComplete) {
    summary.classList.add('complete');
    summary.textContent = `${stats.completed}/${stats.total} Complete`;
  } else {
    summary.textContent = `${stats.completed}/${stats.total} Complete`;
  }
  card.appendChild(summary);

  // Add click handler
  card.addEventListener('click', () => openWeekModal(week.week));

  return card;
}

/**
 * Get short name for day type
 * @param {string} dayType - Full day type name
 * @returns {string} Short name
 */
function getDayTypeShortName(dayType) {
  const shortNames = {
    'Full Body': 'Full',
    'Upper': 'Upper',
    'Lower': 'Lower',
    'Arms/Delts': 'Arms'
  };
  return shortNames[dayType] || dayType;
}

/**
 * Open the week detail modal
 * @param {number} weekNum - Week number
 */
async function openWeekModal(weekNum) {
  const modal = document.getElementById('week-detail-modal');
  const title = document.getElementById('modal-week-title');
  const daysContainer = document.getElementById('modal-week-days');

  if (!modal || !title || !daysContainer) return;

  const week = await getWeek(weekNum);
  if (!week) return;

  // Set title
  const label = week.label ? `Week ${weekNum}: ${week.label}` : `Week ${weekNum}`;
  title.textContent = label;

  // Clear and populate days
  daysContainer.innerHTML = '';

  week.days.forEach(day => {
    const dayCard = createDayCard(weekNum, day);
    daysContainer.appendChild(dayCard);
  });

  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close the week detail modal
 */
function closeWeekModal() {
  const modal = document.getElementById('week-detail-modal');
  if (!modal) return;

  modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Create a day card element
 * @param {number} weekNum - Week number
 * @param {Object} day - Day data
 * @returns {HTMLElement} Day card element
 */
function createDayCard(weekNum, day) {
  const card = document.createElement('div');
  card.className = 'day-card';

  const completion = getWorkoutCompletion(weekNum, day.day_type);
  if (completion) {
    card.classList.add('completed');
  }

  // Header
  const header = document.createElement('div');
  header.className = 'day-card-header';

  const dayType = document.createElement('div');
  dayType.className = 'day-type';
  dayType.textContent = day.day_type;

  const status = document.createElement('div');
  status.className = 'day-status';

  const badge = document.createElement('div');
  badge.className = 'status-badge';

  if (completion) {
    badge.classList.add('completed');
    badge.textContent = 'Completed';

    const date = document.createElement('div');
    date.className = 'completion-date';
    date.textContent = formatCompletionDate(completion.date);
    status.appendChild(badge);
    status.appendChild(date);
  } else {
    badge.classList.add('not-started');
    badge.textContent = 'Not Started';
    status.appendChild(badge);
  }

  header.appendChild(dayType);
  header.appendChild(status);
  card.appendChild(header);

  // Day info
  const info = document.createElement('div');
  info.className = 'day-info';

  const exerciseCount = document.createElement('div');
  exerciseCount.className = 'day-info-item';
  exerciseCount.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6"></path>
    </svg>
    <span>${day.exercises.length} exercises</span>
  `;

  info.appendChild(exerciseCount);
  card.appendChild(info);

  // Start workout button
  const button = document.createElement('button');
  button.className = 'start-workout-btn';
  button.textContent = completion ? 'View Workout' : 'Start Workout';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    startWorkout(weekNum, day.day_type);
  });

  card.appendChild(button);

  return card;
}

/**
 * Format completion date
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date
 */
function formatCompletionDate(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Start a workout
 * @param {number} weekNum - Week number
 * @param {string} dayType - Day type
 */
function startWorkout(weekNum, dayType) {
  // Close modal
  closeWeekModal();

  // Store the workout to start
  sessionStorage.setItem('minmax_active_workout', JSON.stringify({
    week: weekNum,
    dayType: dayType
  }));

  // Switch to workout tab
  if (window.app) {
    window.app.activateTab('workout');
  }
}

/**
 * Setup modal event handlers
 */
function setupModalHandlers() {
  const modal = document.getElementById('week-detail-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');
  const closeBtn = modal?.querySelector('.modal-close');

  if (backdrop) {
    backdrop.addEventListener('click', closeWeekModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWeekModal);
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeWeekModal();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProgramUI);
} else {
  initProgramUI();
}
