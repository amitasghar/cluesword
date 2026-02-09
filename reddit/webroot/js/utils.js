/**
 * CluesWord - Utilities Module
 * Constants, date helpers, and shared utilities
 */

const Utils = (function() {
  'use strict';

  // Single version for cache busting and display
  const APP_VERSION = '1.3';

  // Game constants
  const LAUNCH_DATE = new Date('2026-02-04'); // Update to actual launch date
  const MAX_CLUES = 3;

  // Scoring
  const BASE_SCORES = {
    ONE_CLUE: 100,
    TWO_CLUES: 85,
    THREE_CLUES: 70,
    ALL_CLUES: 50
  };
  const PENALTY_PER_WRONG_GUESS = 5;

  // Storage keys
  const STORAGE_KEYS = {
    DAILY_STATE: 'cluesword_daily_state',
    QUICKPLAY_STATE: 'cluesword_quickplay_state',
    STATS: 'cluesword_stats',
    SETTINGS: 'cluesword_settings',
    PLAYED_PUZZLES: 'cluesword_played_puzzles',
    COMPLETED_DAILIES: 'cluesword_completed_dailies'
  };

  // Categories
  const CATEGORIES = [
    'Countries',
    'Cities',
    'Animals',
    'Movies',
    'Famous People'
  ];

  /**
   * Get today's date at midnight (local time)
   */
  function getTodayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Get formatted date string (YYYY-MM-DD)
   */
  function getDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate days between two dates
   */
  function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    return Math.floor(Math.abs((d2 - d1) / oneDay));
  }

  /**
   * Get today's puzzle index based on launch date
   */
  function getDailyPuzzleIndex(totalPuzzles) {
    const daysSinceLaunch = daysBetween(LAUNCH_DATE, getTodayMidnight());
    return daysSinceLaunch % totalPuzzles;
  }

  /**
   * Calculate score based on clues used and number of tries
   * Base score from clues, minus penalty for wrong guesses
   */
  function calculateScore(cluesUsed, totalTries = 1) {
    let baseScore;
    switch(cluesUsed) {
      case 1: baseScore = BASE_SCORES.ONE_CLUE; break;
      case 2: baseScore = BASE_SCORES.TWO_CLUES; break;
      case 3: baseScore = BASE_SCORES.THREE_CLUES; break;
      default: baseScore = BASE_SCORES.ALL_CLUES;
    }

    // Deduct points for wrong guesses (tries - 1 = wrong guesses)
    const wrongGuesses = Math.max(0, totalTries - 1);
    const penalty = wrongGuesses * PENALTY_PER_WRONG_GUESS;

    // Minimum score is 10 points
    return Math.max(10, baseScore - penalty);
  }

  /**
   * Filter input to letters only, uppercase
   */
  function sanitizeInput(value) {
    return value.replace(/[^a-zA-Z]/g, '').toUpperCase();
  }

  /**
   * Count occurrences of a character in a string
   */
  function countOccurrences(str, char) {
    return (str.match(new RegExp(char, 'g')) || []).length;
  }

  /**
   * Get word length (excluding spaces/hyphens for display)
   */
  function getLetterCount(word) {
    return word.replace(/[\s-]/g, '').length;
  }

  /**
   * Shuffle array using Fisher-Yates
   */
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Get random item from array
   */
  function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Check if yesterday's date matches (for streak calculation)
   */
  function isYesterday(dateString) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getDateString(yesterday) === dateString;
  }

  /**
   * Check if date is today
   */
  function isToday(dateString) {
    return getDateString() === dateString;
  }

  // Public API
  return {
    APP_VERSION,
    LAUNCH_DATE,
    MAX_CLUES,
    BASE_SCORES,
    PENALTY_PER_WRONG_GUESS,
    STORAGE_KEYS,
    CATEGORIES,
    getTodayMidnight,
    getDateString,
    daysBetween,
    getDailyPuzzleIndex,
    calculateScore,
    sanitizeInput,
    countOccurrences,
    getLetterCount,
    shuffleArray,
    getRandomItem,
    debounce,
    isYesterday,
    isToday
  };
})();
