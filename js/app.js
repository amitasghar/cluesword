/**
 * CluesWord - App Module
 * Entry point, puzzle loading, initialization
 */

const App = (function() {
  'use strict';

  let dailyPuzzles = [];
  let quickPlayPuzzles = {}; // { category: [puzzles] } — lazy loaded
  let currentMode = 'daily'; // 'daily' or 'quickplay'
  let selectedCategory = 'random';

  // Map category names to data file basenames
  const CATEGORY_FILES = {
    'Countries': 'countries',
    'Cities': 'cities',
    'Animals': 'animals',
    'Movies': 'movies',
    'Famous People': 'famous-people'
  };

  /**
   * Initialize the application
   */
  async function initialize() {
    // Load puzzles
    await loadPuzzles();

    // Initialize UI controller
    UIController.initialize({
      onGuessSubmit: handleGuessSubmit,
      onModeChange: handleModeChange,
      onCategorySelect: handleCategorySelect,
      onQuickPlayRequest: handleQuickPlayRequest
    });

    // Start with daily mode
    startDailyMode();

    // Preload all categories in background so switching is instant
    loadAllCategories();

    // Set up debug commands
    setupDebug();
  }

  /**
   * Load daily puzzles at startup
   */
  async function loadPuzzles() {
    try {
      const response = await fetch(`data/daily.json?v=${Utils.APP_VERSION}`);
      dailyPuzzles = await response.json();
      console.log(`Loaded ${dailyPuzzles.length} daily puzzles`);
    } catch (error) {
      console.error('Failed to load daily puzzles:', error);
      const defaults = getDefaultPuzzles();
      dailyPuzzles = defaults.dailyPuzzles;
      quickPlayPuzzles = defaults.quickPlayPuzzles;
    }
  }

  /**
   * Lazy-load a quick play category (fetches once, caches in memory)
   */
  async function loadCategory(category) {
    if (quickPlayPuzzles[category]) return quickPlayPuzzles[category];
    const basename = CATEGORY_FILES[category];
    if (!basename) return [];
    try {
      const response = await fetch(`data/${basename}.json?v=${Utils.APP_VERSION}`);
      const puzzles = await response.json();
      quickPlayPuzzles[category] = puzzles;
      console.log(`Loaded ${puzzles.length} ${category} puzzles`);
      return puzzles;
    } catch (error) {
      console.error(`Failed to load ${category}:`, error);
      return [];
    }
  }

  /**
   * Load all quick play categories (for random mode)
   */
  async function loadAllCategories() {
    await Promise.all(Object.keys(CATEGORY_FILES).map(loadCategory));
  }

  /**
   * Default puzzles (fallback)
   */
  function getDefaultPuzzles() {
    return {
      dailyPuzzles: [
        {
          id: 'daily-001',
          category: 'Countries',
          word: 'INDIA',
          clues: [
            'This Asian nation has over 1 billion people',
            'The Taj Mahal is located here',
            'Its flag features a navy blue wheel with 24 spokes'
          ],
          factoid: 'India has 22 officially recognized languages.'
        }
      ],
      quickPlayPuzzles: {
        'Countries': [
          {
            id: 'qp-countries-001',
            category: 'Countries',
            word: 'BRAZIL',
            clues: [
              'This South American country spans multiple time zones',
              'Home to the Amazon rainforest',
              'Hosted the 2014 FIFA World Cup'
            ],
            factoid: 'Brazil is the only Portuguese-speaking country in the Americas.'
          }
        ],
        'Animals': [
          {
            id: 'qp-animals-001',
            category: 'Animals',
            word: 'TIGER',
            clues: [
              'This large cat is native to Asia',
              'Known for its orange coat with black stripes',
              'The largest living cat species'
            ],
            factoid: 'No two tigers have the same stripe pattern.'
          }
        ]
      }
    };
  }

  /**
   * Start daily mode
   */
  function startDailyMode() {
    currentMode = 'daily';
    UIController.setActiveMode('daily');

    // Get today's puzzle from daily pool
    const puzzleIndex = Utils.getDailyPuzzleIndex(dailyPuzzles.length);
    const puzzle = dailyPuzzles[puzzleIndex];

    // Check for saved state
    const savedState = StorageManager.getDailyState();
    const isValidState = savedState && savedState.date === Utils.getDateString();

    // Initialize game state
    const state = GameState.initialize(puzzle, isValidState ? savedState : null, true);

    // Render game
    UIController.renderGame(puzzle, state);

    // If already completed today, show results
    if (state.status === 'won') {
      setTimeout(() => {
        UIController.showResultsModal(puzzle, {
          cluesRevealed: state.cluesRevealed,
          score: state.score
        });
      }, 500);
    }
  }

  /**
   * Get past daily puzzles (days that have already passed)
   * These are unlocked for quick play
   */
  function getPastDailyPuzzles() {
    const todayIndex = Utils.getDailyPuzzleIndex(dailyPuzzles.length);
    // All puzzles before today's index are past dailies
    // Handle wrap-around: if we've cycled, all puzzles are available
    const daysSinceLaunch = Utils.daysBetween(Utils.LAUNCH_DATE, Utils.getTodayMidnight());

    if (daysSinceLaunch >= dailyPuzzles.length) {
      // We've gone through all puzzles at least once, all past ones available
      return dailyPuzzles.filter((_, index) => index !== todayIndex);
    } else {
      // Only puzzles before today's index
      return dailyPuzzles.slice(0, todayIndex);
    }
  }

  /**
   * Start quick play mode
   */
  async function startQuickPlayMode(category = 'random') {
    currentMode = 'quickplay';
    selectedCategory = category;
    UIController.setActiveMode('quickplay');

    // Lazy-load the needed category (or all for random)
    if (category === 'random') {
      await loadAllCategories();
    } else {
      await loadCategory(category);
    }

    // Build puzzle pool: quick play puzzles + past dailies (unlocked after their day passed)
    let available = [];
    const playedIds = StorageManager.getPlayedPuzzles() || [];
    const pastDailies = getPastDailyPuzzles();

    if (category === 'random') {
      // All quick play puzzles from all categories
      Object.values(quickPlayPuzzles).forEach(categoryPuzzles => {
        if (Array.isArray(categoryPuzzles)) {
          available.push(...categoryPuzzles);
        }
      });
      // Add past dailies (unlocked after their day)
      available.push(...pastDailies);
    } else {
      // Quick play puzzles from selected category
      const categoryPuzzles = quickPlayPuzzles[category];
      if (Array.isArray(categoryPuzzles)) {
        available = [...categoryPuzzles];
      }
      // Add past dailies from this category
      const pastDailiesInCategory = pastDailies.filter(p => p.category === category);
      available.push(...pastDailiesInCategory);
    }

    // Exclude already played puzzles (prefer unplayed)
    const unplayed = available.filter(p => !playedIds.includes(p.id));
    const puzzlePool = unplayed.length > 0 ? unplayed : available;

    if (!puzzlePool || puzzlePool.length === 0) {
      UIController.showError('No puzzles available in this category');
      return;
    }

    // Pick a random puzzle
    const puzzle = Utils.getRandomItem(puzzlePool);

    if (!puzzle) {
      UIController.showError('Failed to load puzzle');
      return;
    }

    // Initialize new game state (no saved state for quick play)
    const state = GameState.initialize(puzzle, null, false);

    // Render game
    UIController.renderGame(puzzle, state);
  }

  /**
   * Handle mode change
   */
  function handleModeChange(mode) {
    Analytics.trackModeChange(mode);
    if (mode === 'daily') {
      startDailyMode();
    } else if (mode === 'quickplay') {
      UIController.showCategorySelector();
    }
  }

  /**
   * Handle category selection
   */
  async function handleCategorySelect(category) {
    Analytics.trackCategorySelect(category);
    await startQuickPlayMode(category);
  }

  /**
   * Handle quick play request (from results modal)
   */
  function handleQuickPlayRequest() {
    UIController.showCategorySelector();
  }

  /**
   * Handle guess submission
   */
  function handleGuessSubmit(guess) {
    const result = GameState.submitGuess(guess);

    if (!result.success) {
      Analytics.trackInvalidGuess(result.error);
      UIController.showError(result.error);
      return;
    }

    const puzzle = GameState.getPuzzle();
    const isDaily = currentMode === 'daily';

    // Track the guess
    Analytics.trackGuess(result.guessNumber || GameState.getState().guesses.length, puzzle.category, isDaily);

    // Track completion
    if (result.correct) {
      Analytics.trackPuzzleCompleted(result.cluesRevealed, result.score, puzzle.category, isDaily);
    }

    UIController.updateAfterGuess(result, puzzle);
  }

  /**
   * Set up debug commands
   */
  function setupDebug() {
    window.debug = {
      // Show current puzzle and state
      current: () => {
        console.log('Puzzle:', GameState.getPuzzle());
        console.log('State:', GameState.getState());
      },

      // List all daily puzzles
      listDaily: () => {
        console.log('--- Daily Puzzles ---');
        dailyPuzzles.forEach((p, i) => console.log(i, p.id, p.word, p.category));
      },

      // List quick play puzzles (optionally by category)
      listQuickPlay: (category) => {
        if (category) {
          console.log(`--- ${category} ---`);
          (quickPlayPuzzles[category] || []).forEach((p, i) => console.log(i, p.id, p.word));
        } else {
          Object.keys(quickPlayPuzzles).forEach(cat => {
            console.log(`--- ${cat} ---`);
            quickPlayPuzzles[cat].forEach((p, i) => console.log(i, p.id, p.word));
          });
        }
      },

      // Jump to a specific daily puzzle
      jumpDaily: (index) => {
        const puzzle = dailyPuzzles[index];
        if (puzzle) {
          currentMode = 'daily';
          UIController.setActiveMode('daily');
          GameState.initialize(puzzle, null, true);
          UIController.renderGame(puzzle, GameState.getState());
          console.log('Jumped to daily:', puzzle.word);
        } else {
          console.log('Invalid index. Use debug.listDaily() to see options.');
        }
      },

      // Jump to a specific quick play puzzle
      jumpQuickPlay: (category, index = 0) => {
        const puzzles = quickPlayPuzzles[category];
        if (puzzles && puzzles[index]) {
          currentMode = 'quickplay';
          UIController.setActiveMode('quickplay');
          GameState.initialize(puzzles[index], null, false);
          UIController.renderGame(puzzles[index], GameState.getState());
          console.log('Jumped to:', puzzles[index].word);
        } else {
          console.log('Invalid. Use debug.listQuickPlay() to see options.');
        }
      },

      // Reveal current answer
      reveal: () => {
        const puzzle = GameState.getPuzzle();
        if (puzzle) console.log('Answer:', puzzle.word);
      },

      // Auto-solve current puzzle (for testing)
      solve: () => {
        const puzzle = GameState.getPuzzle();
        if (puzzle && GameState.getState().status !== 'won') {
          const result = GameState.submitGuess(puzzle.word);
          UIController.updateAfterGuess(result, puzzle);
          console.log('Solved! Score:', result.score);
        } else {
          console.log('No active puzzle or already solved.');
        }
      },

      // Add a wrong guess (for testing clue progression)
      wrongGuess: () => {
        const puzzle = GameState.getPuzzle();
        if (puzzle) {
          const fakeGuess = 'X'.repeat(puzzle.word.replace(/[\s-]/g, '').length);
          const result = GameState.submitGuess(fakeGuess);
          if (result.success) {
            UIController.updateAfterGuess(result, puzzle);
            console.log('Wrong guess added. Clues revealed:', result.cluesRevealed);
          } else {
            console.log('Error:', result.error);
          }
        }
      },

      // Show all stats
      stats: () => {
        console.log('Stats:', StorageManager.getStats());
        console.log('Past Dailies (unlocked for quick play):', getPastDailyPuzzles().map(p => p.id));
        console.log('Played Quick Play:', StorageManager.getPlayedPuzzles());
      },

      // Clear all data and reload
      reset: () => {
        StorageManager.clearAll();
        location.reload();
      },

      // Show available commands
      help: () => {
        console.log(`
Debug Commands:
  debug.current()              - Show current puzzle & state
  debug.listDaily()            - List all daily puzzles
  debug.listQuickPlay(cat?)    - List quick play puzzles
  debug.jumpDaily(index)       - Jump to daily puzzle
  debug.jumpQuickPlay(cat, i)  - Jump to quick play puzzle
  debug.reveal()               - Show current answer
  debug.solve()                - Auto-solve current puzzle
  debug.wrongGuess()           - Submit a wrong guess
  debug.stats()                - Show all statistics
  debug.reset()                - Clear data & reload
        `);
      }
    };

    console.log('Debug available. Type debug.help() for commands.');
  }

  // Start app when DOM is ready
  document.addEventListener('DOMContentLoaded', initialize);

  // Public API
  return {
    initialize,
    startDailyMode,
    startQuickPlayMode
  };
})();
