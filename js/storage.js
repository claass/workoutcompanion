/**
 * Min-Max Companion - Storage Module
 * Handles localStorage operations and data persistence
 */

const STORAGE_PREFIX = 'minmax_';
const HISTORY_KEY = `${STORAGE_PREFIX}workout_history`;

/**
 * Get all logged workout history from localStorage
 * @returns {Object} Object containing all workout history entries
 */
export function getWorkoutHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : {};
  } catch (error) {
    console.error('Error loading workout history:', error);
    return {};
  }
}

/**
 * Save a completed workout to localStorage
 * @param {number} weekNum - Week number
 * @param {string} dayType - Day type (e.g., "Full Body", "Upper", "Lower", "Arms/Delts")
 * @param {Object} data - Workout data containing exercises and sets
 */
export function saveWorkout(weekNum, dayType, data) {
  try {
    const history = getWorkoutHistory();
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0]; // YYYY-MM-DD format

    // Create unique key for this workout
    const workoutKey = `week-${weekNum}-${dayType.toLowerCase().replace(/\s+/g, '')}-${date}`;

    // Store workout data
    history[workoutKey] = {
      week: weekNum,
      dayType: dayType,
      completedAt: timestamp,
      exercises: data.exercises
    };

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return workoutKey;
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
}

/**
 * Get the most recent logged performance for a specific exercise
 * @param {string} exerciseName - Name of the exercise
 * @returns {Array|null} Array of sets from the most recent workout, or null if not found
 */
export function getLastPerformance(exerciseName) {
  try {
    const history = getWorkoutHistory();

    // Convert history object to array and sort by completedAt (most recent first)
    const workouts = Object.values(history).sort((a, b) =>
      new Date(b.completedAt) - new Date(a.completedAt)
    );

    // Find the most recent workout containing this exercise
    for (const workout of workouts) {
      const exercise = workout.exercises.find(ex => ex.name === exerciseName);
      if (exercise && exercise.sets) {
        return exercise.sets;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting last performance:', error);
    return null;
  }
}

/**
 * Export all data as a downloadable JSON file
 */
export function exportData() {
  try {
    const history = getWorkoutHistory();
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    // Create download link
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minmax-workout-data-${new Date().toISOString().split('T')[0]}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data. Please try again.');
  }
}

/**
 * Import data from a JSON string
 * @param {string} jsonString - JSON string containing workout history data
 * @returns {boolean} True if import was successful, false otherwise
 */
export function importData(jsonString) {
  try {
    // Parse and validate JSON
    const data = JSON.parse(jsonString);

    // Basic validation - check if it's an object
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid data format');
    }

    // Merge with existing data or replace
    const shouldReplace = confirm(
      'Import options:\n' +
      'OK - Replace all existing data\n' +
      'Cancel - Merge with existing data'
    );

    if (shouldReplace) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    } else {
      const existing = getWorkoutHistory();
      const merged = { ...existing, ...data };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
    }

    return true;
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Failed to import data. Please check the file format.');
    return false;
  }
}

/**
 * Clear all workout data from localStorage
 * Requires user confirmation
 * @returns {boolean} True if data was cleared, false if cancelled
 */
export function clearAllData() {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This will permanently delete all your workout history!\n\n' +
    'Consider exporting your data first.\n\n' +
    'Are you sure you want to continue?'
  );

  if (confirmed) {
    const doubleCheck = confirm(
      'Are you ABSOLUTELY sure?\n\n' +
      'This action cannot be undone!'
    );

    if (doubleCheck) {
      try {
        localStorage.removeItem(HISTORY_KEY);
        return true;
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Failed to clear data. Please try again.');
        return false;
      }
    }
  }

  return false;
}

/**
 * Get workout statistics
 * @returns {Object} Statistics about workout history
 */
export function getStats() {
  try {
    const history = getWorkoutHistory();
    const workouts = Object.values(history);

    return {
      totalWorkouts: workouts.length,
      firstWorkout: workouts.length > 0
        ? new Date(Math.min(...workouts.map(w => new Date(w.completedAt))))
        : null,
      lastWorkout: workouts.length > 0
        ? new Date(Math.max(...workouts.map(w => new Date(w.completedAt))))
        : null,
      workoutsByType: workouts.reduce((acc, w) => {
        acc[w.dayType] = (acc[w.dayType] || 0) + 1;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      totalWorkouts: 0,
      firstWorkout: null,
      lastWorkout: null,
      workoutsByType: {}
    };
  }
}
