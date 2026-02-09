/**
 * CluesWord - Storage Bridge (Reddit/Devvit)
 * Same API as StorageManager but uses postMessage → Devvit → Redis.
 *
 * Reads are async (request/response via postMessage).
 * Writes are fire-and-forget.
 *
 * Since the web game logic calls StorageManager synchronously,
 * we use a local cache that syncs with Redis in the background.
 * The cache is pre-populated from Redis on init via initialData.
 */

const StorageManager = (function() {
  'use strict';

  const KEYS = Utils.STORAGE_KEYS;

  // Local cache mirrors Redis — synchronous reads, async writes
  const cache = {};

  // Pending read callbacks keyed by request key
  const pendingReads = {};

  /**
   * Send a message to Devvit backend
   */
  function sendMessage(msg) {
    parent.postMessage(msg, '*');
  }

  /**
   * Listen for responses from Devvit
   */
  function initListener() {
    addEventListener('message', (ev) => {
      if (ev.data.type !== 'devvit-message') return;
      const { message } = ev.data.data;

      if (message.type === 'gameStateResponse') {
        const { key, value } = message.data;
        if (value !== null) {
          cache[key] = JSON.parse(value);
        }
        // Resolve any pending reads
        if (pendingReads[key]) {
          pendingReads[key].forEach(cb => cb(cache[key] || null));
          delete pendingReads[key];
        }
      }
    });
  }

  initListener();

  // ─── Core get/set (cache-backed) ───

  function get(key) {
    return cache[key] || null;
  }

  function set(key, value) {
    cache[key] = value;
    sendMessage({
      type: 'setGameState',
      data: { key, value: JSON.stringify(value) }
    });
    return true;
  }

  function remove(key) {
    delete cache[key];
    sendMessage({ type: 'removeGameState', data: { key } });
    return true;
  }

  function clearAll() {
    Object.values(KEYS).forEach(key => remove(key));
  }

  /**
   * Request a value from Redis (async, updates cache when response arrives)
   */
  function requestFromRedis(key) {
    sendMessage({ type: 'getGameState', data: { key } });
  }

  /**
   * Pre-populate cache from Redis for all known keys
   */
  function prefetchAll() {
    Object.values(KEYS).forEach(key => requestFromRedis(key));
  }

  // ─── Domain methods (same API as web StorageManager) ───

  function getDailyState() { return get(KEYS.DAILY_STATE); }
  function saveDailyState(state) { return set(KEYS.DAILY_STATE, state); }
  function clearDailyState() { return remove(KEYS.DAILY_STATE); }

  function getQuickPlayState() { return get(KEYS.QUICKPLAY_STATE); }
  function saveQuickPlayState(state) { return set(KEYS.QUICKPLAY_STATE, state); }
  function clearQuickPlayState() { return remove(KEYS.QUICKPLAY_STATE); }

  function getStats() {
    const defaultStats = {
      played: 0, won: 0, currentStreak: 0, maxStreak: 0,
      totalScore: 0, bestScore: 0, lastPlayedDate: null,
      clueDistribution: { 1: 0, 2: 0, 3: 0 }, categoryStats: {}
    };
    const stats = get(KEYS.STATS);
    return stats ? { ...defaultStats, ...stats } : defaultStats;
  }

  function saveStats(stats) { return set(KEYS.STATS, stats); }

  /**
   * Set stats from Devvit global user stats (Redis → local cache)
   */
  function setStats(redisStats) {
    const stats = getStats();
    stats.played = redisStats.played || 0;
    stats.won = redisStats.won || 0;
    stats.totalScore = redisStats.totalScore || 0;
    stats.currentStreak = redisStats.currentStreak || 0;
    stats.maxStreak = redisStats.maxStreak || 0;
    stats.clueDistribution = {
      1: redisStats.clue1 || 0,
      2: redisStats.clue2 || 0,
      3: redisStats.clue3 || 0,
    };
    cache[KEYS.STATS] = stats;
  }

  function updateStats(cluesUsed, score, category, won = true) {
    const stats = getStats();
    const today = Utils.getDateString();

    stats.played += 1;
    if (won) {
      stats.won += 1;
      stats.totalScore += score;
      stats.bestScore = Math.max(stats.bestScore, score);
      if (stats.clueDistribution[cluesUsed] !== undefined) {
        stats.clueDistribution[cluesUsed] += 1;
      }
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

  function getPlayedPuzzles() { return get(KEYS.PLAYED_PUZZLES) || []; }
  function addPlayedPuzzle(puzzleId) {
    const played = getPlayedPuzzles();
    if (!played.includes(puzzleId)) {
      played.push(puzzleId);
      set(KEYS.PLAYED_PUZZLES, played);
    }
  }

  function getCompletedDailies() { return get(KEYS.COMPLETED_DAILIES) || []; }
  function addCompletedDaily(puzzleId) {
    const completed = getCompletedDailies();
    if (!completed.includes(puzzleId)) {
      completed.push(puzzleId);
      set(KEYS.COMPLETED_DAILIES, completed);
    }
  }

  function getSettings() {
    const defaultSettings = { soundEnabled: false };
    const settings = get(KEYS.SETTINGS);
    return settings ? { ...defaultSettings, ...settings } : defaultSettings;
  }
  function saveSettings(settings) { return set(KEYS.SETTINGS, settings); }

  return {
    get, set, remove, clearAll,
    prefetchAll,
    getDailyState, saveDailyState, clearDailyState,
    getQuickPlayState, saveQuickPlayState, clearQuickPlayState,
    getStats, saveStats, setStats, updateStats,
    getPlayedPuzzles, addPlayedPuzzle,
    getCompletedDailies, addCompletedDaily,
    getSettings, saveSettings
  };
})();
