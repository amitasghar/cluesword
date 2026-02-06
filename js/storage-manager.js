/**
 * CluesWord - Storage Manager Module
 * Abstracts localStorage for easy swap with Redis (Reddit/Devvit)
 */

const StorageManager = (function() {
  'use strict';

  const KEYS = Utils.STORAGE_KEYS;

  /**
   * Get item from storage, parse JSON
   */
  function get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('StorageManager.get error:', e);
      return null;
    }
  }

  /**
   * Set item in storage, stringify JSON
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('StorageManager.set error:', e);
      return false;
    }
  }

  /**
   * Remove item from storage
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('StorageManager.remove error:', e);
      return false;
    }
  }

  /**
   * Clear all game storage
   */
  function clearAll() {
    Object.values(KEYS).forEach(key => remove(key));
  }

  // Daily State Management

  function getDailyState() {
    return get(KEYS.DAILY_STATE);
  }

  function saveDailyState(state) {
    return set(KEYS.DAILY_STATE, state);
  }

  function clearDailyState() {
    return remove(KEYS.DAILY_STATE);
  }

  // Quick Play State Management

  function getQuickPlayState() {
    return get(KEYS.QUICKPLAY_STATE);
  }

  function saveQuickPlayState(state) {
    return set(KEYS.QUICKPLAY_STATE, state);
  }

  function clearQuickPlayState() {
    return remove(KEYS.QUICKPLAY_STATE);
  }

  // Statistics Management

  function getStats() {
    const defaultStats = {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      totalScore: 0,
      bestScore: 0,
      lastPlayedDate: null,
      clueDistribution: { 1: 0, 2: 0, 3: 0 },
      categoryStats: {}
    };

    const stats = get(KEYS.STATS);
    return stats ? { ...defaultStats, ...stats } : defaultStats;
  }

  function saveStats(stats) {
    return set(KEYS.STATS, stats);
  }

  function updateStats(cluesUsed, score, category, won = true) {
    const stats = getStats();
    const today = Utils.getDateString();

    stats.played += 1;

    if (won) {
      stats.won += 1;
      stats.totalScore += score;
      stats.bestScore = Math.max(stats.bestScore, score);

      // Update clue distribution
      if (stats.clueDistribution[cluesUsed] !== undefined) {
        stats.clueDistribution[cluesUsed] += 1;
      }

      // Update streak
      if (stats.lastPlayedDate) {
        if (Utils.isYesterday(stats.lastPlayedDate)) {
          stats.currentStreak += 1;
        } else if (!Utils.isToday(stats.lastPlayedDate)) {
          stats.currentStreak = 1;
        }
      } else {
        stats.currentStreak = 1;
      }
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

      // Update category stats
      if (!stats.categoryStats[category]) {
        stats.categoryStats[category] = { played: 0, totalScore: 0 };
      }
      stats.categoryStats[category].played += 1;
      stats.categoryStats[category].totalScore += score;
    }

    stats.lastPlayedDate = today;
    saveStats(stats);
    return stats;
  }

  // Played Puzzles Tracking (for Quick Play)

  function getPlayedPuzzles() {
    return get(KEYS.PLAYED_PUZZLES) || [];
  }

  function addPlayedPuzzle(puzzleId) {
    const played = getPlayedPuzzles();
    if (!played.includes(puzzleId)) {
      played.push(puzzleId);
      set(KEYS.PLAYED_PUZZLES, played);
    }
  }

  // Completed Dailies Tracking (unlocks for Quick Play)

  function getCompletedDailies() {
    return get(KEYS.COMPLETED_DAILIES) || [];
  }

  function addCompletedDaily(puzzleId) {
    const completed = getCompletedDailies();
    if (!completed.includes(puzzleId)) {
      completed.push(puzzleId);
      set(KEYS.COMPLETED_DAILIES, completed);
    }
  }

  // Settings Management

  function getSettings() {
    const defaultSettings = {
      soundEnabled: false
    };
    const settings = get(KEYS.SETTINGS);
    return settings ? { ...defaultSettings, ...settings } : defaultSettings;
  }

  function saveSettings(settings) {
    return set(KEYS.SETTINGS, settings);
  }

  // Public API
  return {
    get,
    set,
    remove,
    clearAll,
    getDailyState,
    saveDailyState,
    clearDailyState,
    getQuickPlayState,
    saveQuickPlayState,
    clearQuickPlayState,
    getStats,
    saveStats,
    updateStats,
    getPlayedPuzzles,
    addPlayedPuzzle,
    getCompletedDailies,
    addCompletedDaily,
    getSettings,
    saveSettings
  };
})();
