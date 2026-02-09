/**
 * CluesWord - UI Controller Module
 * DOM rendering, event handling, animations
 */

const UIController = (function() {
  'use strict';

  // DOM element references
  const elements = {
    // Header
    helpBtn: null,
    statsBtn: null,

    // Mode selector
    dailyModeBtn: null,
    quickplayModeBtn: null,

    // Category
    categoryName: null,

    // Game board
    cluesContainer: null,
    letterBoxes: null,
    typingDots: null,
    wrongPositionSection: null,
    wrongPositionLetters: null,

    // Input
    guessInput: null,
    submitBtn: null,
    errorMessage: null,

    // Modals
    helpModal: null,
    statsModal: null,
    resultsModal: null,
    categoryModal: null,

    // Results
    resultsTitle: null,
    resultsAnswer: null,
    resultsClues: null,
    resultsTries: null,
    resultsScore: null,
    resultsStreak: null,
    resultsFactoid: null,
    shareBtn: null,
    quickplayBtn: null,

    // Stats
    statPlayed: null,
    statWon: null,
    statStreak: null,
    statMaxStreak: null,
    statAvgScore: null
  };

  let currentWordLength = 0; // letters only (no spaces/hyphens)
  let currentWordTemplate = ''; // original word with spaces/hyphens
  let onGuessSubmit = null;
  let onModeChange = null;
  let onCategorySelect = null;
  let onQuickPlayRequest = null;

  /**
   * Initialize UI controller, cache DOM elements
   */
  function initialize(callbacks = {}) {
    cacheElements();
    setupEventListeners();

    onGuessSubmit = callbacks.onGuessSubmit;
    onModeChange = callbacks.onModeChange;
    onCategorySelect = callbacks.onCategorySelect;
    onQuickPlayRequest = callbacks.onQuickPlayRequest;

    // Set version in help modal
    if (elements.versionDisplay) {
      elements.versionDisplay.textContent = `Version ${Utils.APP_VERSION}`;
    }
  }

  /**
   * Cache DOM element references
   */
  function cacheElements() {
    elements.helpBtn = document.getElementById('help-btn');
    elements.statsBtn = document.getElementById('stats-btn');
    elements.dailyModeBtn = document.getElementById('daily-mode-btn');
    elements.quickplayModeBtn = document.getElementById('quickplay-mode-btn');
    elements.categoryName = document.getElementById('category-name');
    elements.cluesContainer = document.getElementById('clues-container');
    elements.letterBoxes = document.getElementById('letter-boxes');
    elements.typingDots = document.getElementById('typing-dots');
    elements.wrongPositionSection = document.getElementById('wrong-position-section');
    elements.wrongPositionLetters = document.getElementById('wrong-position-letters');
    elements.guessInput = document.getElementById('guess-input');
    elements.submitBtn = document.getElementById('submit-btn');
    elements.errorMessage = document.getElementById('error-message');
    elements.helpModal = document.getElementById('help-modal');
    elements.versionDisplay = document.getElementById('version-display');
    elements.statsModal = document.getElementById('stats-modal');
    elements.resultsModal = document.getElementById('results-modal');
    elements.categoryModal = document.getElementById('category-modal');
    elements.resultsTitle = document.getElementById('results-title');
    elements.resultsAnswer = document.getElementById('results-answer');
    elements.resultsClues = document.getElementById('results-clues');
    elements.resultsTries = document.getElementById('results-tries');
    elements.resultsScore = document.getElementById('results-score');
    elements.resultsStreak = document.getElementById('results-streak');
    elements.resultsFactoid = document.getElementById('results-factoid');
    elements.shareBtn = document.getElementById('share-btn');
    elements.quickplayBtn = document.getElementById('quickplay-btn');
    elements.statPlayed = document.getElementById('stat-played');
    elements.statWon = document.getElementById('stat-won');
    elements.statStreak = document.getElementById('stat-streak');
    elements.statMaxStreak = document.getElementById('stat-max-streak');
    elements.statAvgScore = document.getElementById('stat-avg-score');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Input handling — use keyup so value is committed before we reformat
    elements.guessInput.addEventListener('input', handleInputChange);
    elements.guessInput.addEventListener('keydown', handleInputKeydown);
    elements.guessInput.addEventListener('keyup', handleInputReformat);
    elements.submitBtn.addEventListener('click', handleSubmit);

    // Mode buttons
    elements.dailyModeBtn.addEventListener('click', () => {
      if (onModeChange) onModeChange('daily');
    });
    elements.quickplayModeBtn.addEventListener('click', () => {
      if (onModeChange) onModeChange('quickplay');
    });

    // Modal buttons
    elements.helpBtn.addEventListener('click', () => showModal(elements.helpModal));
    elements.statsBtn.addEventListener('click', () => {
      updateStatsDisplay();
      showModal(elements.statsModal);
    });

    // Share button
    elements.shareBtn.addEventListener('click', handleShare);

    // Quick play button in results
    elements.quickplayBtn.addEventListener('click', () => {
      hideModal(elements.resultsModal);
      if (onQuickPlayRequest) onQuickPlayRequest();
    });

    // Category selection
    document.getElementById('category-grid').addEventListener('click', (e) => {
      const option = e.target.closest('.category-option');
      if (option && onCategorySelect) {
        const category = option.dataset.category;
        hideModal(elements.categoryModal);
        onCategorySelect(category);
      }
    });

    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        hideModal(modal);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        const modal = overlay.closest('.modal');
        hideModal(modal);
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(hideModal);
      }
    });
  }

  /**
   * Handle input changes (filter, typing dots)
   */
  /**
   * Format a pure-letter string by inserting spaces/hyphens from the word template
   */
  function formatWithTemplate(letters) {
    if (!/[\s-]/.test(currentWordTemplate)) return letters;
    let formatted = '';
    let letterIdx = 0;
    for (let i = 0; i < currentWordTemplate.length && letterIdx < letters.length; i++) {
      const ch = currentWordTemplate[i];
      if (ch === ' ' || ch === '-') {
        formatted += ch;
      } else {
        formatted += letters[letterIdx++];
      }
    }
    return formatted;
  }

  /**
   * Count only letter characters in a string
   */
  function countLetters(str) {
    return str.replace(/[^a-zA-Z]/g, '').length;
  }

  function handleInputChange(e) {
    const letters = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, currentWordLength);
    const formatted = formatWithTemplate(letters);
    e.target.value = formatted;
    updateTypingDots(letters.length);
    clearError();
  }

  /**
   * Backup reformat on keyup in case input event didn't stick
   */
  function handleInputReformat(e) {
    if (e.key === 'Enter') return;
    const letters = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, currentWordLength);
    const formatted = formatWithTemplate(letters);
    if (e.target.value !== formatted) {
      e.target.value = formatted;
      const len = formatted.length;
      e.target.setSelectionRange(len, len);
    }
    updateTypingDots(letters.length);
  }

  /**
   * Handle Enter key submission
   */
  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  /**
   * Handle guess submission
   */
  function handleSubmit() {
    const guess = elements.guessInput.value.replace(/[\s-]/g, '').trim();
    if (!guess) return;

    if (onGuessSubmit) {
      onGuessSubmit(guess);
    }
  }

  /**
   * Render the game board for a puzzle
   */
  function renderGame(puzzle, state) {
    // Set category
    elements.categoryName.textContent = puzzle.category.toUpperCase();

    // Render clues
    renderClues(puzzle.clues, state.cluesRevealed);

    // Render letter boxes
    const wordWithoutSpecial = puzzle.word.replace(/[\s-]/g, '');
    currentWordLength = wordWithoutSpecial.length;
    currentWordTemplate = puzzle.word.toUpperCase();
    renderLetterBoxes(puzzle.word, state.correctPositions);

    // Render typing dots
    renderTypingDots(puzzle.word);

    // Render wrong position letters
    const wrongPositionToShow = GameState.getWrongPositionLettersToShow();
    renderWrongPositionLetters(wrongPositionToShow);

    // Update input
    elements.guessInput.value = '';
    elements.guessInput.maxLength = currentWordTemplate.length;
    elements.guessInput.placeholder = 'Type your guess...';
    updateTypingDots(0);

    // Handle completed state
    if (state.status === 'won') {
      document.body.classList.add('puzzle-complete');
      disableInput();
    } else {
      document.body.classList.remove('puzzle-complete');
      enableInput();
      elements.guessInput.focus();
    }
  }

  /**
   * Render clues
   */
  function renderClues(clues, revealedCount) {
    for (let i = 1; i <= Utils.MAX_CLUES; i++) {
      const card = document.getElementById(`clue-${i}`);
      const text = document.getElementById(`clue-text-${i}`);

      if (i <= revealedCount) {
        card.classList.remove('hidden');
        card.classList.add('active');
        if (i < revealedCount) {
          card.classList.add('revealed');
        } else {
          card.classList.remove('revealed');
        }
        text.textContent = `"${clues[i - 1]}"`;
      } else {
        card.classList.add('hidden');
        card.classList.remove('active', 'revealed');
        text.textContent = '';
      }
    }
  }

  /**
   * Render letter boxes with dynamic sizing
   */
  function renderLetterBoxes(word, correctPositions = []) {
    const container = elements.letterBoxes;
    container.innerHTML = '';

    const letters = word.toUpperCase().split('');
    const pureLength = word.replace(/[\s-]/g, '').length;

    // Determine size class
    let sizeClass = '';
    if (pureLength >= 9) sizeClass = 'size-small';
    else if (pureLength >= 7) sizeClass = 'size-medium';

    // Group letters into words so they wrap at word boundaries
    let wordGroup = document.createElement('div');
    wordGroup.className = 'letter-word-group';

    let letterIndex = 0;
    letters.forEach((char) => {
      if (char === ' ' || char === '-') {
        // End current word group, add spacer, start new group
        container.appendChild(wordGroup);
        const spacer = document.createElement('div');
        spacer.className = char === ' ' ? 'letter-box spacer' : 'letter-box hyphen';
        container.appendChild(spacer);
        wordGroup = document.createElement('div');
        wordGroup.className = 'letter-word-group';
      } else {
        const box = document.createElement('div');
        box.className = `letter-box ${sizeClass}`;

        if (correctPositions.includes(letterIndex)) {
          box.classList.add('revealed');
          box.textContent = char;
        }

        letterIndex++;
        wordGroup.appendChild(box);
      }
    });
    // Append last word group
    container.appendChild(wordGroup);
  }

  /**
   * Render typing progress dots
   */
  function renderTypingDots(word) {
    const container = elements.typingDots;
    container.innerHTML = '';

    let dotGroup = document.createElement('div');
    dotGroup.className = 'dot-word-group';

    word.split('').forEach((char) => {
      if (char === ' ' || char === '-') {
        container.appendChild(dotGroup);
        const spacer = document.createElement('div');
        spacer.className = 'letter-dot dot-spacer';
        container.appendChild(spacer);
        dotGroup = document.createElement('div');
        dotGroup.className = 'dot-word-group';
      } else {
        const dot = document.createElement('div');
        dot.className = 'letter-dot';
        dotGroup.appendChild(dot);
      }
    });
    container.appendChild(dotGroup);
  }

  /**
   * Update typing dots based on input length
   */
  function updateTypingDots(typedCount) {
    const dots = elements.typingDots.querySelectorAll('.letter-dot:not(.dot-spacer)');
    dots.forEach((dot, index) => {
      dot.classList.toggle('dot-filled', index < typedCount);
    });
  }

  /**
   * Render wrong position letters
   */
  function renderWrongPositionLetters(letters) {
    const container = elements.wrongPositionLetters;
    container.innerHTML = '';

    letters.sort().forEach(letter => {
      const span = document.createElement('span');
      span.className = 'wrong-letter';
      span.textContent = letter;
      container.appendChild(span);
    });

    // Show/hide section
    elements.wrongPositionSection.style.display = letters.length > 0 ? 'block' : 'none';
  }

  /**
   * Update display after a guess
   */
  function updateAfterGuess(result, puzzle) {
    // Clear input
    elements.guessInput.value = '';
    updateTypingDots(0);

    if (result.isCorrect) {
      // Victory!
      showCorrectAnimation();
      setTimeout(() => {
        showResultsModal(puzzle, result);
      }, 800);
    } else {
      // Wrong guess
      showWrongAnimation();

      // Update letter boxes with new reveals
      renderLetterBoxes(puzzle.word, result.correctPositions);

      // Reveal new clue if applicable
      renderClues(puzzle.clues, result.cluesRevealed);

      // Update wrong position letters
      renderWrongPositionLetters(result.wrongPositionLetters);

      // Re-focus input
      elements.guessInput.focus();
    }
  }

  /**
   * Show correct guess animation
   */
  function showCorrectAnimation() {
    elements.letterBoxes.classList.add('correct-flash');
    document.body.classList.add('puzzle-complete');
    disableInput();

    // Reveal all letters with staggered animation
    const boxes = elements.letterBoxes.querySelectorAll('.letter-box:not(.spacer):not(.hyphen)');
    const puzzle = GameState.getPuzzle();
    const letters = puzzle.word.toUpperCase().replace(/[\s-]/g, '').split('');

    boxes.forEach((box, i) => {
      setTimeout(() => {
        box.classList.add('revealed');
        box.textContent = letters[i];
      }, i * 100);
    });

    setTimeout(() => {
      elements.letterBoxes.classList.remove('correct-flash');
    }, 500);
  }

  /**
   * Show wrong guess animation
   */
  function showWrongAnimation() {
    elements.guessInput.classList.add('shake');
    elements.letterBoxes.classList.add('wrong-flash');

    setTimeout(() => {
      elements.guessInput.classList.remove('shake');
      elements.letterBoxes.classList.remove('wrong-flash');
    }, 400);
  }

  /**
   * Show results modal
   */
  function showResultsModal(puzzle, result) {
    const stats = StorageManager.getStats();
    const state = GameState.getState();
    const tries = state ? state.guesses.length : 1;

    elements.resultsTitle.textContent = 'Congratulations!';
    elements.resultsAnswer.textContent = puzzle.word.toUpperCase();
    elements.resultsClues.textContent = `${result.cluesRevealed}/3 clues`;
    elements.resultsTries.textContent = `${tries} ${tries === 1 ? 'try' : 'tries'}`;
    elements.resultsScore.textContent = `${result.score} points`;
    elements.resultsStreak.textContent = `${stats.currentStreak} day streak`;
    elements.resultsFactoid.innerHTML = `<p>${puzzle.factoid}</p>`;

    showModal(elements.resultsModal);
  }

  /**
   * Show error message
   */
  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.guessInput.classList.add('shake');
    setTimeout(() => {
      elements.guessInput.classList.remove('shake');
    }, 400);
  }

  /**
   * Clear error message
   */
  function clearError() {
    elements.errorMessage.textContent = '';
  }

  /**
   * Enable input
   */
  function enableInput() {
    elements.guessInput.disabled = false;
    elements.submitBtn.disabled = false;
  }

  /**
   * Disable input
   */
  function disableInput() {
    elements.guessInput.disabled = true;
    elements.submitBtn.disabled = true;
  }

  /**
   * Update mode button states
   */
  function setActiveMode(mode) {
    elements.dailyModeBtn.classList.toggle('active', mode === 'daily');
    elements.quickplayModeBtn.classList.toggle('active', mode === 'quickplay');
  }

  /**
   * Show category selector modal
   */
  function showCategorySelector() {
    showModal(elements.categoryModal);
  }

  /**
   * Update statistics display
   */
  function updateStatsDisplay() {
    const stats = StorageManager.getStats();

    elements.statPlayed.textContent = stats.played;
    elements.statWon.textContent = stats.won;
    elements.statStreak.textContent = stats.currentStreak;
    elements.statMaxStreak.textContent = stats.maxStreak;

    const avgScore = stats.won > 0 ? Math.round(stats.totalScore / stats.won) : 0;
    elements.statAvgScore.textContent = avgScore;

    // Update distribution bars
    const total = stats.clueDistribution[1] + stats.clueDistribution[2] + stats.clueDistribution[3];
    const maxCount = Math.max(stats.clueDistribution[1], stats.clueDistribution[2], stats.clueDistribution[3], 1);

    for (let i = 1; i <= 3; i++) {
      const bar = document.querySelector(`.dist-bar[data-clues="${i}"]`);
      const count = document.getElementById(`dist-${i}`);
      const value = stats.clueDistribution[i] || 0;
      const percentage = (value / maxCount) * 100;

      bar.style.width = `${percentage}%`;
      count.textContent = value;
    }
  }

  /**
   * Get the game URL based on environment
   */
  function getGameUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `localhost:${window.location.port}`;
    }
    return 'cluesword.com';
  }

  /**
   * Generate emoji grid for a guess evaluation
   */
  function getGuessEmojis(guess, target) {
    const evaluation = GameState.evaluateGuess(guess, target);
    return evaluation.map(e => {
      switch (e.status) {
        case 'correct': return '🟩';
        case 'wrongPosition': return '🟨';
        default: return '⬜';
      }
    }).join('');
  }

  /**
   * Handle share button click
   */
  function handleShare() {
    const puzzle = GameState.getPuzzle();
    const state = GameState.getState();
    Analytics.trackShare(state.cluesRevealed, state.score);
    const stats = StorageManager.getStats();
    const tries = state.guesses.length;
    const target = puzzle.word.toUpperCase().replace(/[\s-]/g, '');

    // Build emoji grid for all guesses
    const guessGrid = state.guesses.map(guess => getGuessEmojis(guess, target)).join('\n');

    // Get puzzle number from ID
    const puzzleNumber = puzzle.id.split('-')[1] || '1';

    // Compact format like Wordle
    const shareText = `CluesWord #${puzzleNumber} 🧩
📍${state.cluesRevealed}/3 🎯${tries} ⭐${state.score}
${guessGrid}
${getGameUrl()}`;

    if (navigator.share) {
      navigator.share({
        text: shareText
      }).catch(() => {
        copyToClipboard(shareText);
      });
    } else {
      copyToClipboard(shareText);
    }
  }

  /**
   * Copy text to clipboard
   */
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      elements.shareBtn.textContent = 'Copied!';
      setTimeout(() => {
        elements.shareBtn.textContent = 'Share Results';
      }, 2000);
    }).catch(() => {
      showError('Failed to copy');
    });
  }

  /**
   * Show modal
   */
  function showModal(modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    const focusable = modal.querySelector('button');
    if (focusable) setTimeout(() => focusable.focus(), 100);
  }

  /**
   * Hide modal
   */
  function hideModal(modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Public API
  return {
    initialize,
    renderGame,
    updateAfterGuess,
    showError,
    clearError,
    setActiveMode,
    showCategorySelector,
    showResultsModal,
    updateStatsDisplay
  };
})();
