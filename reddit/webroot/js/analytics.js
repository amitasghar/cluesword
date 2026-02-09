/**
 * CluesWord - Analytics (Reddit stub)
 * No-op on Reddit — GA4 is not used in Devvit webviews.
 */
const Analytics = (function() {
  'use strict';
  const noop = () => {};
  return {
    trackEvent: noop,
    trackGuess: noop,
    trackInvalidGuess: noop,
    trackPuzzleCompleted: noop,
    trackCategorySelect: noop,
    trackShare: noop,
    trackModeChange: noop,
  };
})();
