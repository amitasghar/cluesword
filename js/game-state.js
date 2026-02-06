/**
 * CluesWord - Game State Module
 * Core game logic, guess evaluation, state management
 */

const GameState = (function() {
  'use strict';

  let currentPuzzle = null;
  let currentState = null;
  let isDaily = true;

  /**
   * Create initial game state for a puzzle
   */
  function createInitialState(puzzle, date = null) {
    return {
      puzzleId: puzzle.id,
      date: date || Utils.getDateString(),
      guesses: [],
      cluesRevealed: 1,
      correctPositions: [],
      wrongPositionLetters: new Set(),
      status: 'in-progress',
      score: 0
    };
  }

  /**
   * Initialize game with a puzzle
   */
  function initialize(puzzle, savedState = null, daily = true) {
    currentPuzzle = puzzle;
    isDaily = daily;

    if (savedState && savedState.puzzleId === puzzle.id) {
      // Restore saved state
      currentState = {
        ...savedState,
        wrongPositionLetters: new Set(savedState.wrongPositionLetters || [])
      };
    } else {
      // New game
      currentState = createInitialState(puzzle, daily ? Utils.getDateString() : null);
      saveState();
    }

    return currentState;
  }

  /**
   * Get current state
   */
  function getState() {
    return currentState;
  }

  /**
   * Get current puzzle
   */
  function getPuzzle() {
    return currentPuzzle;
  }

  /**
   * Save current state to storage
   */
  function saveState() {
    if (!currentState) return;

    // Convert Set to Array for storage
    const stateToSave = {
      ...currentState,
      wrongPositionLetters: Array.from(currentState.wrongPositionLetters)
    };

    if (isDaily) {
      StorageManager.saveDailyState(stateToSave);
    } else {
      StorageManager.saveQuickPlayState(stateToSave);
    }
  }

  /**
   * Evaluate a guess against the target word
   * Returns array of { letter, status, position }
   */
  function evaluateGuess(guess, target) {
    const result = [];
    const targetLetters = target.toUpperCase().replace(/[\s-]/g, '').split('');
    const guessLetters = guess.toUpperCase().split('');
    const targetCopy = [...targetLetters];

    // First pass: mark correct positions (exact matches)
    guessLetters.forEach((letter, i) => {
      if (letter === targetCopy[i]) {
        result[i] = { letter, status: 'correct', position: i };
        targetCopy[i] = null; // Consume the letter
      }
    });

    // Second pass: mark wrong positions (letter exists but different position)
    guessLetters.forEach((letter, i) => {
      if (result[i]) return; // Already marked correct

      const targetIndex = targetCopy.indexOf(letter);
      if (targetIndex !== -1) {
        result[i] = { letter, status: 'wrongPosition', position: i };
        targetCopy[targetIndex] = null; // Consume
      } else {
        result[i] = { letter, status: 'wrong', position: i };
      }
    });

    return result;
  }

  /**
   * Submit a guess and update game state
   */
  function submitGuess(guess) {
    if (!currentPuzzle || !currentState) {
      return { success: false, error: 'Game not initialized' };
    }

    if (currentState.status === 'won') {
      return { success: false, error: 'Game already completed' };
    }

    const normalizedGuess = guess.toUpperCase().trim();
    const targetWord = currentPuzzle.word.toUpperCase().replace(/[\s-]/g, '');

    // Validate guess length
    if (normalizedGuess.length !== targetWord.length) {
      return {
        success: false,
        error: `Guess must be ${targetWord.length} letters`
      };
    }

    // Check for duplicate guess
    if (currentState.guesses.includes(normalizedGuess)) {
      return { success: false, error: 'Already guessed' };
    }

    // Evaluate the guess
    const evaluation = evaluateGuess(normalizedGuess, targetWord);
    currentState.guesses.push(normalizedGuess);

    // Check for correct guess
    const isCorrect = normalizedGuess === targetWord;

    if (isCorrect) {
      // Player won!
      currentState.status = 'won';
      currentState.score = Utils.calculateScore(currentState.cluesRevealed, currentState.guesses.length);

      // Update all positions as correct
      currentState.correctPositions = targetWord.split('').map((_, i) => i);

      // Update statistics
      StorageManager.updateStats(
        currentState.cluesRevealed,
        currentState.score,
        currentPuzzle.category,
        true
      );

      // Track completed/played puzzles
      if (isDaily) {
        // Daily completed - unlock for quick play
        StorageManager.addCompletedDaily(currentPuzzle.id);
      } else {
        // Quick play - track as played
        StorageManager.addPlayedPuzzle(currentPuzzle.id);
      }
    } else {
      // Wrong guess - update state
      evaluation.forEach((item, index) => {
        if (item.status === 'correct' && !currentState.correctPositions.includes(index)) {
          currentState.correctPositions.push(index);
        }
        if (item.status === 'wrongPosition') {
          currentState.wrongPositionLetters.add(item.letter);
        }
      });

      // Reveal next clue if available
      if (currentState.cluesRevealed < Utils.MAX_CLUES) {
        currentState.cluesRevealed += 1;
      }
    }

    saveState();

    return {
      success: true,
      isCorrect,
      evaluation,
      cluesRevealed: currentState.cluesRevealed,
      correctPositions: currentState.correctPositions,
      wrongPositionLetters: Array.from(currentState.wrongPositionLetters),
      score: currentState.score,
      status: currentState.status
    };
  }

  /**
   * Get letters that should be shown as revealed in boxes
   */
  function getRevealedLetters() {
    if (!currentPuzzle || !currentState) return {};

    const targetWord = currentPuzzle.word.toUpperCase().replace(/[\s-]/g, '');
    const revealed = {};

    currentState.correctPositions.forEach(pos => {
      revealed[pos] = targetWord[pos];
    });

    return revealed;
  }

  /**
   * Get wrong position letters to display, excluding those already revealed
   */
  function getWrongPositionLettersToShow() {
    if (!currentPuzzle || !currentState) return [];

    const targetWord = currentPuzzle.word.toUpperCase().replace(/[\s-]/g, '');
    const revealedLetters = Object.values(getRevealedLetters());

    return Array.from(currentState.wrongPositionLetters).filter(letter => {
      const revealedCount = Utils.countOccurrences(revealedLetters.join(''), letter);
      const totalCount = Utils.countOccurrences(targetWord, letter);
      return revealedCount < totalCount;
    });
  }

  /**
   * Reset game state (for quick play next puzzle)
   */
  function reset() {
    currentPuzzle = null;
    currentState = null;
    if (!isDaily) {
      StorageManager.clearQuickPlayState();
    }
  }

  /**
   * Check if daily puzzle is already completed
   */
  function isDailyCompleted() {
    const state = StorageManager.getDailyState();
    if (!state) return false;
    return state.date === Utils.getDateString() && state.status === 'won';
  }

  // Public API
  return {
    initialize,
    getState,
    getPuzzle,
    saveState,
    evaluateGuess,
    submitGuess,
    getRevealedLetters,
    getWrongPositionLettersToShow,
    reset,
    isDailyCompleted
  };
})();
