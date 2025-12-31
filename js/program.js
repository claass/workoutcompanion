/**
 * Min-Max Companion - Program Module
 * Handles workout program management and display
 */

let programData = null;

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
