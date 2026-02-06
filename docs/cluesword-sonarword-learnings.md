# SonarWord Learnings for CluesWord

Technical patterns, architectural decisions, and lessons learned from building SonarWord that should inform CluesWord development.

---

## Architecture That Worked Well

### Module Structure
SonarWord uses vanilla JS with IIFE modules (no build step for web). Each module is a self-contained singleton:

```
js/
├── utils.js            # Constants, date helpers, shared utilities
├── storage-manager.js  # localStorage abstraction
├── game-state.js       # Core game logic, guess evaluation
├── ui-controller.js    # DOM rendering, event handling
├── app.js              # Entry point, puzzle loading, initialization
```

**For CluesWord:** Keep this pattern for the web build. The storage-manager abstraction is key — it can be swapped for Redis on Reddit without touching game logic.

### Game State Pattern
State is a plain object stored/retrieved via StorageManager:

```javascript
{
  date: "2026-01-25",           // Puzzle identifier
  guesses: ["GUESS1", ...],    // All submitted guesses
  correctPositions: [0, 2],    // Revealed letter indices
  status: "in-progress",       // or "won"
  evaluation: [[{letter, status, position}, ...], ...],
  score: 0
}
```

**For CluesWord:** Add `cluesRevealed: 1` (1-3) to track progression. The evaluation array pattern works well for letter feedback.

### Daily Puzzle Rotation
Uses a launch date + day offset calculation:

```javascript
function getTodaysPuzzle() {
  const daysSinceLaunch = daysBetween(LAUNCH_DATE, getTodayMidnight());
  const puzzleIndex = daysSinceLaunch % puzzles.length;
  return puzzles[puzzleIndex];
}
```

**For CluesWord:** Same pattern works. For Quick Play, just pick random index excluding recently played.

---

## UI Patterns to Reuse

### Letter Box Rendering
Dynamic sizing based on word length:
- Default: 3rem boxes
- 7-8 letters: `size-medium` (2.5rem)
- 9+ letters: `size-small` (2.1rem)

Handles multi-word answers (spaces become spacers, hyphens become special boxes).

### Typing Progress Dots
Added in v1.5 — dots below each letter box fill left-to-right as user types:

```javascript
function updateTypingDots(typedCount) {
  const dots = container.querySelectorAll('.letter-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('dot-filled', index < typedCount);
  });
}
```

Hidden on puzzle completion via `.puzzle-complete .letter-dot { display: none; }`.

### Input Handling
- Filter to letters only: `value.replace(/[^a-zA-Z]/g, '').toUpperCase()`
- Cap at word length: `.slice(0, maxLen)`
- Enter key submits
- Clear input + reset dots on submission

### Letter Reveal Animation
```css
.letter-box-revealed {
  background-color: var(--accent-correct);
  animation: revealPop 0.4s ease;
}

@keyframes revealPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

### Wrong Position Letters
Displayed below game board, filtered to exclude already-revealed letters:

```javascript
const toShow = Array.from(wrongPositionLetters).filter(letter => {
  const revealedCount = countOccurrences(revealedLetters, letter);
  const totalCount = countOccurrences(targetWord, letter);
  return revealedCount < totalCount;
});
```

---

## Versioning & Cache Busting

**Critical:** Update three places together when changing CSS/JS:

1. `index.html` — version display: `<p class="version-info">Version 1.5</p>`
2. `index.html` — query strings: `<script src="js/app.js?v=6"></script>`
3. `js/utils.js` — constant: `const CONTENT_VERSION = 6;`

Use `_headers` file to prevent HTML caching so users always get fresh index.html.

---

## Guess Evaluation Logic

The `evaluateGuess()` function handles duplicate letters correctly:

```javascript
function evaluateGuess(guess, target) {
  const result = [];
  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  // First pass: mark correct positions
  guessLetters.forEach((letter, i) => {
    if (letter === targetLetters[i]) {
      result[i] = { letter, status: 'correct', position: i };
      targetLetters[i] = null; // Consume the letter
    }
  });

  // Second pass: mark wrong positions
  guessLetters.forEach((letter, i) => {
    if (result[i]) return; // Already marked correct
    const targetIndex = targetLetters.indexOf(letter);
    if (targetIndex !== -1) {
      result[i] = { letter, status: 'wrongPosition', position: i };
      targetLetters[targetIndex] = null; // Consume
    } else {
      result[i] = { letter, status: 'wrong', position: i };
    }
  });

  return result;
}
```

**For CluesWord:** Reuse this exactly.

---

## Modal System

Simple show/hide with accessibility:

```javascript
function showModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  const focusable = modal.querySelector('button');
  if (focusable) setTimeout(() => focusable.focus(), 100);
}

function hideModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}
```

ESC key closes all modals. Overlay click closes modal.

---

## Statistics Tracking

```javascript
{
  played: 47,
  won: 45,
  currentStreak: 12,
  maxStreak: 23,
  totalScore: 3850,
  bestScore: 100,
  distribution: { 1: 5, 2: 12, 3: 15, 4: 8, 5: 3, 6: 2 },
  categoryStats: {
    "Countries": { played: 10, totalScore: 820 },
    ...
  }
}
```

**For CluesWord:** Add `clueDistribution: { 1: x, 2: y, 3: z }` instead of guess distribution.

---

## Share Text Generation

```javascript
function getShareText() {
  const state = getState();
  const guessCount = state.guesses.length;

  return `SonarWord #${puzzleNumber} 🎵

🎯 ${category}
🎹 ${guessCount} guesses
⭐ ${state.score} points
🔥 ${stats.currentStreak} day streak

sonarword.com`;
}
```

Uses emojis that render well cross-platform. Keep it short for Twitter/Reddit.

---

## What Didn't Work / Lessons

### Audio as Core Mechanic
Audio (MIDI synthesis + MP3 playback) was SonarWord's unique hook but created friction:
- Browser autoplay policies required user interaction first
- Mobile users often have sound off
- Reddit consumption is sound-off by default

**For CluesWord:** No audio dependency. Sound effects optional/enhancement only.

### Daily-Only Model Limits Engagement
One puzzle per day caps session length. Users play once and leave.

**For CluesWord:** Quick Play mode solves this — unlimited engagement after daily.

### Content Curation Burden
Each puzzle needed: word, category, melody segments, completion melody file, factoid, melody fact. Very labor intensive.

**For CluesWord:** Text clues are much easier to create and can be automated later via Wikidata.

### Category Word Validation
SonarWord validates guesses against category word lists (Countries.json, etc.). This prevents random guessing but requires maintaining word lists.

**For CluesWord:** Keep this pattern — it improves UX by catching typos and invalid guesses early.

---

## CSS Variables (Reuse This Palette)

```css
:root {
  --bg-primary: #faf8f5;
  --bg-secondary: #f5f0e8;
  --text-primary: #3d2c1e;
  --text-secondary: #6b5a4a;
  --border-color: #d4c4b0;
  --accent-correct: #6aaa64;    /* Green - correct */
  --accent-wrong-pos: #c9b458;  /* Yellow - wrong position */
  --accent-wrong: #787c7e;      /* Gray - wrong */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --border-radius: 8px;
  --transition: all 0.2s ease;
}
```

Warm, paper-like aesthetic. Accessible contrast ratios.

---

## Responsive Breakpoints

```css
/* Tablet */
@media (max-width: 768px) { ... }

/* Mobile */
@media (max-width: 480px) {
  .letter-box { width: 2.5rem; height: 2.5rem; }
}

/* Small mobile */
@media (max-width: 375px) {
  .letter-box { width: 2rem; height: 2rem; }
}
```

---

## Debug Commands (Keep for Development)

```javascript
window.debug = {
  current: () => console.log(currentPuzzle),
  jumpTo: (index) => loadPuzzle(puzzles[index]),
  list: () => puzzles.forEach((p, i) => console.log(i, p.word)),
  reset: () => { StorageManager.clearState(); location.reload(); },
  reveal: () => console.log(currentPuzzle.word)
};
```

Invaluable for testing. Remove or gate behind flag for production.

---

## File Organization Best Practice

```
project/
├── index.html          # Single HTML entry point
├── css/
│   ├── styles.css      # Base styles, variables
│   ├── game-board.css  # Game-specific components
│   ├── modals.css      # Modal styles
│   └── responsive.css  # Media queries
├── js/
│   ├── utils.js        # Load first - constants, helpers
│   ├── storage-manager.js
│   ├── game-state.js
│   ├── ui-controller.js
│   └── app.js          # Load last - initialization
├── data/
│   ├── puzzles.json
│   └── categories/     # Word lists for validation
└── _headers            # Netlify cache headers
```

Script load order matters — dependencies must load before dependents.

---

## Reddit/Devvit Considerations (Not Yet Implemented)

Based on research, not hands-on experience:

- **Storage:** Replace localStorage with Devvit Redis. Abstract behind interface.
- **Entry point:** Devvit apps need a different bootstrap (Devvit.configure, etc.)
- **User identity:** Devvit provides user context; localStorage is anonymous
- **Webview constraints:** Standard web APIs work, but test audio carefully
- **Build output:** Devvit expects specific structure — separate build target needed

---

## Quick Wins That Improved UX

1. **Typing dots** — Visual feedback while typing, satisfying to fill up
2. **Input length cap** — Can't type more letters than the answer
3. **Shake animation** — Invalid guess shakes the input field
4. **Letter reveal pop** — Slight scale animation when correct letters appear
5. **Progressive hints** — More help after each wrong guess (melody in SonarWord, clues in CluesWord)
6. **Factoid on win** — Educational payoff, gives players something to share/discuss

---

## Git Workflow

- Feature branches: `feature/typing-dots-feedback`
- Semantic commit messages
- Tag releases: `v1.3`, `v1.4`, `v1.5`
- Push tags with code: `git push origin main --tags`

---

## Summary: What to Carry Forward

✅ **Keep:**
- Module structure (utils → storage → game-state → ui → app)
- Storage abstraction pattern
- Letter box rendering with dynamic sizing
- Guess evaluation with duplicate handling
- Typing dots feedback
- Input filtering and length capping
- Modal system
- CSS variable palette
- Share text format
- Debug commands
- Versioning discipline

🔄 **Adapt:**
- Replace melody segments with text clues
- Replace audio playback with clue reveal animation
- Add Quick Play mode alongside Daily
- Simplify content format (no audio files)

❌ **Drop:**
- Audio system (melody-player.js, audio-manager.js)
- MP3/MIDI infrastructure
- Segment timing logic
