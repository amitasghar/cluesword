/**
 * CluesWord - Analytics
 * GA4 event tracking for user interactions
 */

const Analytics = (function() {
  'use strict';

  /**
   * Send a GA4 event (safe if gtag is blocked/missing)
   */
  function trackEvent(eventName, params) {
    if (typeof gtag === 'function') {
      gtag('event', eventName, params);
    }
  }

  /**
   * Track a guess submission
   */
  function trackGuess(guessNumber, category, isDaily) {
    trackEvent('guess_submitted', {
      guess_number: guessNumber,
      category: category,
      mode: isDaily ? 'daily' : 'quickplay'
    });
  }

  /**
   * Track an invalid guess attempt
   */
  function trackInvalidGuess(error) {
    trackEvent('invalid_guess', { error: error });
  }

  /**
   * Track puzzle completion (win)
   */
  function trackPuzzleCompleted(cluesRevealed, score, category, isDaily) {
    trackEvent('puzzle_completed', {
      clues_revealed: cluesRevealed,
      score: score,
      category: category,
      mode: isDaily ? 'daily' : 'quickplay'
    });
  }

  /**
   * Track category selection in quick play
   */
  function trackCategorySelect(category) {
    trackEvent('category_selected', {
      category: category
    });
  }

  /**
   * Track share button click
   */
  function trackShare(cluesRevealed, score) {
    trackEvent('results_shared', {
      clues_revealed: cluesRevealed,
      score: score
    });
  }

  /**
   * Track mode switch (daily/quickplay)
   */
  function trackModeChange(mode) {
    trackEvent('mode_changed', {
      mode: mode
    });
  }

  return {
    trackEvent,
    trackGuess,
    trackInvalidGuess,
    trackPuzzleCompleted,
    trackCategorySelect,
    trackShare,
    trackModeChange
  };
})();
