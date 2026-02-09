/**
 * CluesWord - App Module (Reddit/Devvit)
 * Adapted entry point for Reddit webview.
 *
 * Differences from web:
 *  - No daily mode rotation — puzzle comes from Devvit via postMessage
 *  - Two modes: 'custom' (from Reddit post) and 'quickplay' (built-in data)
 *  - Sends webViewReady on load, receives initialData from Devvit
 *  - Sends saveScore to Devvit when puzzle is completed
 *  - Uses storage-bridge.js (postMessage → Redis) instead of localStorage
 */

const App = (function() {
  'use strict';

  let quickPlayPuzzles = {}; // { category: [puzzles] } — lazy loaded
  let currentMode = 'custom'; // 'custom', 'quickplay', or 'create'
  let selectedCategory = 'random';
  let redditUsername = 'anonymous';
  let postId = '';
  let customPuzzle = null; // stash custom puzzle so user can return to it

  // Map category names to data file basenames
  const CATEGORY_FILES = {
    'Countries': 'countries',
    'Cities': 'cities',
    'Animals': 'animals',
    'Movies': 'movies',
    'Famous People': 'famous-people'
  };

  /**
   * Initialize the application — wait for Devvit initialData
   */
  function initialize() {
    // Listen for messages from Devvit
    addEventListener('message', onDevvitMessage);

    // Tell Devvit we're ready
    parent.postMessage({ type: 'webViewReady' }, '*');
  }

  /**
   * Handle messages from Devvit backend
   */
  function onDevvitMessage(ev) {
    if (ev.data.type !== 'devvit-message') return;
    const { message } = ev.data.data;

    switch (message.type) {
      case 'initialData': {
        const { username, puzzle, mode, postId: pid, userStats } = message.data;
        redditUsername = username || 'anonymous';
        postId = pid || '';
        currentMode = mode || 'quickplay';
        customPuzzle = puzzle || null;

        // Apply global user stats from Redis
        if (userStats) {
          StorageManager.setStats(userStats);
        }

        // Initialize UI controller
        UIController.initialize({
          onGuessSubmit: handleGuessSubmit,
          onModeChange: handleModeChange,
          onCategorySelect: handleCategorySelect,
          onQuickPlayRequest: handleQuickPlayRequest
        });

        // Apply Reddit-specific UI tweaks
        setupRedditUI(mode, puzzle);

        // Hide loading, show game
        const loadingOverlay = document.getElementById('loading-overlay');
        const categoryDisplay = document.getElementById('category-display');
        const gameBoard = document.getElementById('game-board-main');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (categoryDisplay) categoryDisplay.style.display = '';
        if (gameBoard) gameBoard.style.display = '';

        if (mode === 'create') {
          showCreateForm();
        } else if (mode === 'custom' && puzzle) {
          startCustomPuzzle(puzzle);
        } else {
          // Quick play — hide game board until category is picked
          const gameBoard = document.getElementById('game-board-main');
          const categoryDisplay = document.getElementById('category-display');
          if (gameBoard) gameBoard.style.display = 'none';
          if (categoryDisplay) categoryDisplay.style.display = 'none';
          // Make category modal unclosable — must pick a category
          lockCategoryModal(true);
          UIController.showCategorySelector();
        }

        // Preload categories in background
        loadAllCategories();
        break;
      }
      case 'userStats': {
        if (message.data) {
          StorageManager.setStats(message.data);
        }
        break;
      }
      case 'puzzleCreated': {
        const { success, message: msg, postUrl } = message.data;
        const errEl = document.getElementById('create-error');
        const successEl = document.getElementById('create-success');
        const submitBtn = document.getElementById('create-submit-btn');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Puzzle'; }
        if (success) {
          if (errEl) errEl.style.display = 'none';
          if (successEl) {
            let html = msg;
            if (postUrl) {
              html += `<br><br><button id="copy-link-btn" style="padding:0.5rem 1.2rem; background:#6b5a4a; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:0.95rem; font-weight:600;">Copy Link to Share</button>`;
            }
            successEl.innerHTML = html;
            successEl.style.display = '';
            // Wire up copy button
            if (postUrl) {
              const copyBtn = document.getElementById('copy-link-btn');
              if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                  navigator.clipboard.writeText(postUrl).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy Link to Share'; }, 2000);
                  }).catch(() => {
                    copyBtn.textContent = 'Copy failed';
                    setTimeout(() => { copyBtn.textContent = 'Copy Link to Share'; }, 2000);
                  });
                });
              }
            }
          }
          // Clear form fields
          ['create-word','create-clue1','create-clue2','create-clue3','create-factoid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
        } else {
          if (successEl) successEl.style.display = 'none';
          if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
        }
        break;
      }
      default:
        // Other messages handled by storage-bridge listener
        break;
    }
  }

  /**
   * Apply Reddit-specific UI modifications after UIController init
   */
  function setupRedditUI(mode, puzzle) {
    // Hide the daily/quickplay mode selector — not applicable on Reddit
    const modeSelector = document.querySelector('.mode-selector');
    if (modeSelector) {
      modeSelector.style.display = 'none';
    }

    // Override share button to use Reddit-friendly share text
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      // Remove the old listener by replacing the element
      const newShareBtn = shareBtn.cloneNode(true);
      shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
      newShareBtn.addEventListener('click', handleRedditShare);
      // Update button text based on mode
      if (mode === 'custom') {
        newShareBtn.textContent = 'Post to Comments';
      } else {
        newShareBtn.textContent = 'Copy Results';
      }
    }
  }

  /**
   * Build share text from current game state
   */
  function buildShareText() {
    const puzzle = GameState.getPuzzle();
    const state = GameState.getState();
    if (!puzzle || !state) return null;

    const tries = state.guesses.length;
    const target = puzzle.word.toUpperCase().replace(/[\s-]/g, '');

    // Build emoji grid
    const guessGrid = state.guesses.map(guess => {
      const evaluation = GameState.evaluateGuess(guess, target);
      return evaluation.map(e => {
        switch (e.status) {
          case 'correct': return '🟩';
          case 'wrongPosition': return '🟨';
          default: return '⬜';
        }
      }).join('');
    }).join('\n\n');

    return `CluesWord 🧩\n\n📍${state.cluesRevealed}/3 🎯${tries} ⭐${state.score}\n\n${guessGrid}`;
  }

  /**
   * Reddit-specific share — post results as a comment on the puzzle post
   */
  function handleRedditShare() {
    const shareText = buildShareText();
    if (!shareText) return;

    const btn = document.getElementById('share-btn');
    if (!btn) return;

    if (currentMode === 'custom' && postId) {
      // Post as Reddit comment
      btn.textContent = 'Posting...';
      btn.disabled = true;

      parent.postMessage({
        type: 'shareAsComment',
        data: { text: shareText }
      }, '*');

      // Listen for response
      const onCommentPosted = (ev) => {
        if (ev.data.type !== 'devvit-message') return;
        const { message } = ev.data.data;
        if (message.type === 'commentPosted') {
          removeEventListener('message', onCommentPosted);
          btn.textContent = 'Posted!';
          btn.disabled = false;
          setTimeout(() => { btn.textContent = 'Post to Comments'; }, 2000);
        }
      };
      addEventListener('message', onCommentPosted);

      // Timeout fallback
      setTimeout(() => {
        removeEventListener('message', onCommentPosted);
        if (btn.textContent === 'Posting...') {
          btn.textContent = 'Post to Comments';
          btn.disabled = false;
        }
      }, 5000);
    } else {
      // Quick play — just copy to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Results'; }, 2000);
      }).catch(() => {
        btn.textContent = 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy Results'; }, 2000);
      });
    }
  }

  /**
   * Lazy-load a quick play category
   */
  async function loadCategory(category) {
    if (quickPlayPuzzles[category]) return quickPlayPuzzles[category];
    const basename = CATEGORY_FILES[category];
    if (!basename) return [];
    try {
      const response = await fetch(`data/${basename}.json`);
      const puzzles = await response.json();
      quickPlayPuzzles[category] = puzzles;
      return puzzles;
    } catch (error) {
      console.error(`Failed to load ${category}:`, error);
      return [];
    }
  }

  /**
   * Load all quick play categories
   */
  async function loadAllCategories() {
    await Promise.all(Object.keys(CATEGORY_FILES).map(loadCategory));
  }

  /**
   * Lock/unlock the category modal (prevent closing without picking)
   */
  function lockCategoryModal(lock) {
    const modal = document.getElementById('category-modal');
    if (!modal) return;
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    if (lock) {
      if (closeBtn) closeBtn.style.display = 'none';
      if (overlay) overlay.style.pointerEvents = 'none';
    } else {
      if (closeBtn) closeBtn.style.display = '';
      if (overlay) overlay.style.pointerEvents = '';
    }
  }

  /**
   * Show the in-webview puzzle creation form
   */
  function showCreateForm() {
    // Hide game UI, show create form
    const categoryDisplay = document.getElementById('category-display');
    const gameBoard = document.getElementById('game-board-main');
    const createForm = document.getElementById('create-puzzle-form');
    if (categoryDisplay) categoryDisplay.style.display = 'none';
    if (gameBoard) gameBoard.style.display = 'none';
    if (createForm) createForm.style.display = '';

    // Wire up submit button
    const submitBtn = document.getElementById('create-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleCreateSubmit);
    }
  }

  /**
   * Handle create puzzle form submission
   */
  function handleCreateSubmit() {
    const word = (document.getElementById('create-word').value || '').trim();
    const category = document.getElementById('create-category').value;
    const clue1 = (document.getElementById('create-clue1').value || '').trim();
    const clue2 = (document.getElementById('create-clue2').value || '').trim();
    const clue3 = (document.getElementById('create-clue3').value || '').trim();
    const factoid = (document.getElementById('create-factoid').value || '').trim();

    const errEl = document.getElementById('create-error');
    const successEl = document.getElementById('create-success');
    if (successEl) successEl.style.display = 'none';

    // Validate
    if (!word || !clue1 || !clue2 || !clue3) {
      if (errEl) { errEl.textContent = 'Please fill in the word and all 3 clues.'; errEl.style.display = ''; }
      return;
    }
    if (word.replace(/[\s-]/g, '').length < 2) {
      if (errEl) { errEl.textContent = 'Word must have at least 2 letters.'; errEl.style.display = ''; }
      return;
    }
    if (!/^[A-Za-z\s-]+$/.test(word)) {
      if (errEl) { errEl.textContent = 'Word can only contain letters, spaces, and hyphens.'; errEl.style.display = ''; }
      return;
    }

    if (errEl) errEl.style.display = 'none';

    // Disable button while submitting
    const submitBtn = document.getElementById('create-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }

    parent.postMessage({
      type: 'createPuzzle',
      data: { word, category, clue1, clue2, clue3, factoid }
    }, '*');
  }

  /**
   * Start a custom puzzle (from the Reddit post)
   */
  function startCustomPuzzle(puzzle) {
    currentMode = 'custom';

    // Check for saved state (uses daily state slot for custom puzzle persistence)
    const savedState = StorageManager.getDailyState();

    // Initialize game state
    const state = GameState.initialize(puzzle, savedState, true);

    // Render game
    UIController.renderGame(puzzle, state);

    // If already completed, show results
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
   * Start quick play mode
   */
  async function startQuickPlayMode(category) {
    category = category || 'random';
    currentMode = 'quickplay';
    selectedCategory = category;

    // Lazy-load the needed category (or all for random)
    if (category === 'random') {
      await loadAllCategories();
    } else {
      await loadCategory(category);
    }

    // Build puzzle pool
    let available = [];
    const playedIds = StorageManager.getPlayedPuzzles() || [];

    if (category === 'random') {
      Object.values(quickPlayPuzzles).forEach(categoryPuzzles => {
        if (Array.isArray(categoryPuzzles)) {
          available.push(...categoryPuzzles);
        }
      });
    } else {
      const categoryPuzzles = quickPlayPuzzles[category];
      if (Array.isArray(categoryPuzzles)) {
        available = [...categoryPuzzles];
      }
    }

    // Prefer unplayed puzzles
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

    // Initialize new game state
    const state = GameState.initialize(puzzle, null, false);

    // Render game
    UIController.renderGame(puzzle, state);
  }

  /**
   * Handle mode change
   */
  function handleModeChange(mode) {
    if (mode === 'quickplay') {
      UIController.showCategorySelector();
    }
    // No 'daily' mode on Reddit
  }

  /**
   * Handle category selection
   */
  async function handleCategorySelect(category) {
    lockCategoryModal(false);
    // Show game board now that a category is picked
    const gameBoard = document.getElementById('game-board-main');
    const categoryDisplay = document.getElementById('category-display');
    if (gameBoard) gameBoard.style.display = '';
    if (categoryDisplay) categoryDisplay.style.display = '';
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
      UIController.showError(result.error);
      return;
    }

    const puzzle = GameState.getPuzzle();

    UIController.updateAfterGuess(result, puzzle);

    // If solved, send score to Devvit for leaderboard
    if (result.isCorrect && postId) {
      parent.postMessage({
        type: 'saveScore',
        data: {
          postId: postId,
          score: result.score,
          cluesRevealed: result.cluesRevealed,
          guesses: GameState.getState().guesses
        }
      }, '*');
    }
  }

  // Start app when DOM is ready
  document.addEventListener('DOMContentLoaded', initialize);

  return {
    initialize,
    startQuickPlayMode
  };
})();
