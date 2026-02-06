# CluesWord Architecture

## Overview

CluesWord is a daily word puzzle game inspired by Wordle and SonarWord. Players guess words based on progressive clues, with letter feedback guiding them toward the answer.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla JavaScript (IIFE modules) |
| Build Tool | Vite 5.0 |
| Styling | CSS3 (variables, flexbox, animations) |
| Storage (Web) | localStorage |
| Storage (Reddit) | Devvit Redis (planned) |
| Deployment | Netlify (web), Devvit (Reddit - planned) |

## Project Structure

```
cluesword/
├── index.html              # Single HTML entry point (SPA)
├── package.json            # Dependencies (Vite only)
├── vite.config.js          # Vite build configuration
├── netlify.toml            # Netlify deployment config
├── _headers                # HTTP cache/security headers
│
├── js/                     # Game modules (IIFE pattern)
│   ├── utils.js            # Constants, date helpers, shared utilities
│   ├── storage-manager.js  # localStorage abstraction layer
│   ├── game-state.js       # Core game logic, guess evaluation
│   ├── ui-controller.js    # DOM rendering, event handling
│   └── app.js              # Entry point, puzzle loading, init
│
├── css/
│   ├── styles.css          # Base styles, CSS variables
│   ├── game-board.css      # Game component styles
│   ├── modals.css          # Modal dialogs
│   └── responsive.css      # Media queries
│
├── data/
│   ├── puzzles.json        # All game puzzles
│   └── categories/         # Word validation lists
│       ├── countries.json
│       ├── cities.json
│       ├── animals.json
│       ├── movies.json
│       └── people.json
│
└── docs/
    ├── cluesword-prd.md    # Product Requirements Document
    ├── architecture.md     # This file
    └── cluesword-sonarword-learnings.md
```

## Module Responsibilities

### js/utils.js
- Game constants (MAX_GUESSES, POINTS_PER_CLUE, etc.)
- Date formatting helpers
- Shared utility functions

### js/storage-manager.js
- Abstraction over localStorage
- Handles stats, streaks, game state persistence
- **Key for Reddit migration**: Swap this for Redis adapter

### js/game-state.js
- Core game logic
- Guess evaluation (correct position, wrong position, not in word)
- Score calculation
- Clue progression

### js/ui-controller.js
- DOM manipulation and rendering
- Event listeners (keyboard, buttons)
- Modal management (help, stats, settings)
- Share functionality

### js/app.js
- Application entry point
- Puzzle loading from JSON
- Daily puzzle selection (date-based)
- Game initialization

## Data Structures

### puzzles.json Structure
```json
{
  "version": 1,
  "dailyPuzzles": [...],       // Used for daily challenges
  "quickPlayPuzzles": {        // Organized by category
    "Countries": [...],
    "Cities": [...],
    "Animals": [...],
    "Movies": [...],
    "Famous People": [...]
  }
}
```

### Puzzle Format
```json
{
  "id": "daily-001",           // or "qp-countries-001" for quick play
  "category": "Countries",
  "word": "INDIA",
  "clues": [
    "This Asian nation has over 1 billion people",
    "The Taj Mahal is located here",
    "Its flag features a navy blue wheel with 24 spokes"
  ],
  "factoid": "India has 22 officially recognized languages."
}
```

### Puzzle Flow
- **Daily Mode**: Uses `dailyPuzzles` array, cycles based on launch date
- **Quick Play**: Uses `quickPlayPuzzles[category]` + completed dailies from that category
- Completed dailies are tracked and become available in Quick Play

### Game State (localStorage)
```json
{
  "puzzleId": "daily-001",
  "date": "2026-02-05",
  "guesses": ["CHINA", "JAPAN", "INDIA"],
  "cluesRevealed": 2,
  "correctPositions": [0, 2, 4],
  "wrongPositionLetters": ["A"],
  "status": "won",
  "score": 75
}
```
Note: Score = base(85 for 2 clues) - penalty(2 wrong guesses * 5) = 75

### Player Stats (localStorage)
```json
{
  "played": 10,
  "won": 8,
  "currentStreak": 3,
  "maxStreak": 5,
  "clueDistribution": { "1": 2, "2": 3, "3": 3 },
  "totalScore": 720,
  "bestScore": 100,
  "lastPlayedDate": "2026-02-05",
  "categoryStats": { "Countries": { "played": 3, "totalScore": 250 } }
}
```

### Storage Keys
- `cluesword_daily_state` - Current daily game state
- `cluesword_quickplay_state` - Current quick play state
- `cluesword_stats` - Player statistics
- `cluesword_played_puzzles` - Quick play puzzles already played
- `cluesword_completed_dailies` - Dailies completed (unlocked for quick play)
- `cluesword_settings` - User preferences

## Game Modes

1. **Daily Challenge**: Same puzzle for all players, streak tracking
2. **Quick Play**: Random puzzles, category selection, no streaks

## Scoring System

**Base Score (by clues used):**
| Clues Used | Base Points |
|------------|-------------|
| 1 clue | 100 |
| 2 clues | 85 |
| 3 clues | 70 |

**Penalty:** -5 points per wrong guess

**Minimum Score:** 10 points

Example: Solve with 2 clues on 4th try = 85 - (3 * 5) = 70 points

## Build & Deployment

### Development
```bash
npm run dev      # Start dev server on port 3000
```

### Production Build
```bash
npm run build    # Output to dist/
npm run preview  # Preview production build
```

### Netlify Deployment
- Publishes from root directory
- SPA routing (all routes → index.html)
- Aggressive caching for CSS/JS, no-cache for HTML

## Deployment Targets

### Web (Netlify) - ✅ Implemented
- Static site deployment
- Target URL: cluesword.com

### Reddit (Devvit) - 📋 Planned
- Devvit Web (webview) approach
- Redis replaces localStorage
- Dedicated subreddit: r/CluesWord

## Future: Dual Deployment Architecture

```
src/
├── core/           # Shared game logic (platform-agnostic)
├── ui/             # Shared UI components
├── storage/
│   ├── interface.js        # Storage interface definition
│   ├── local-storage.js    # Web implementation
│   └── redis-storage.js    # Reddit implementation
└── platforms/
    ├── web/        # Web-specific entry
    └── reddit/     # Reddit/Devvit entry
```

Build commands (planned):
- `npm run build` → Web/Netlify
- `npm run build:reddit` → Reddit/Devvit

## Categories (Launch)

- Countries (~20 puzzles)
- Cities (~20 puzzles)
- Animals (~20 puzzles)
- Movies (~20 puzzles)
- Famous People (~20 puzzles)

**Total: ~100 puzzles at launch**
