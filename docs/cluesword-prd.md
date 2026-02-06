# CluesWord - Product Requirements Document

## Overview

**CluesWord** is a category-based word guessing game where players deduce a word from progressively revealing text clues. Start with a vague hint, guess wrong, and more specific clues appear. Fewer clues used = higher score.

The game will ship to two platforms from a unified codebase:
- **Web (Netlify)** — standalone site at cluesword.com
- **Reddit (Devvit)** — experience post in r/CluesWord

## Core Concept

```
┌─────────────────────────────────────────────┐
│  Category: COUNTRIES                        │
├─────────────────────────────────────────────┤
│  Clue 1: "This Asian nation has over        │
│           1 billion people"                 │
│                                             │
│  [ _ _ _ _ _ ]     ← 5 letter word          │
│                                             │
│  [        Enter guess...        ] [SUBMIT]  │
└─────────────────────────────────────────────┘

Player guesses "CHINA" → Wrong!

┌─────────────────────────────────────────────┐
│  Clue 1: "This Asian nation has over        │
│           1 billion people"                 │
│  Clue 2: "The Taj Mahal is located here"    │  ← NEW
│                                             │
│  [ I ] [ _ ] [ _ ] [ _ ] [ A ]  ← Correct   │
│                                             │  letters
│  [        Enter guess...        ] [SUBMIT]  │  revealed
└─────────────────────────────────────────────┘

Player guesses "INDIA" → Correct! Score: 85 pts (2 clues used)
```

## Game Mechanics

### Clue Progression
- **3 clues maximum** per puzzle
- Clues progress from vague → specific
- Wrong guess reveals the next clue
- Correct letters from wrong guesses are revealed in the answer boxes (like SonarWord)
- Wrong position letters shown below (like SonarWord)

### Guessing
- **Unlimited guesses** — no guess limit
- Score is based purely on how many clues were needed
- Players can keep guessing until they get it right

### Scoring
| Clues Used | Points |
|------------|--------|
| 1 (first clue only) | 100 |
| 2 | 85 |
| 3 | 70 |
| Used all 3 + eventually solved | 50 |

### Game Modes

#### Daily Challenge
- Same puzzle for all players each day
- Resets at midnight (user's local time for web, UTC for Reddit)
- Streak tracking (consecutive days played)
- Shareable results

#### Quick Play
- Unlimited random puzzles from the pool
- Player can select category or play random mix
- Personal stats tracked (total solved, average score, best streak)
- Available after completing daily OR directly accessible

## Categories (Initial Launch)

Start with 5 balanced categories, ~20 puzzles each (100 total at launch):

1. **Countries** — Nations with geographic, cultural, and landmark clues
2. **Cities** — Major world cities with landmark, location, and cultural clues
3. **Animals** — Species with habitat, behavior, and physical description clues
4. **Movies** — Popular films with plot, cast, and quote clues
5. **Famous People** — Historical and contemporary figures with achievement, era, and attribute clues

### Puzzle Data Structure

```json
{
  "id": "countries-001",
  "category": "Countries",
  "word": "INDIA",
  "clues": [
    "This Asian nation has over 1 billion people",
    "The Taj Mahal is located here",
    "Its flag features a navy blue wheel with 24 spokes"
  ],
  "factoid": "India has 22 officially recognized languages"
}
```

### Clue Design Principles
1. **Clue 1** — Broad, could match multiple answers in category
2. **Clue 2** — Narrows significantly, maybe 2-3 possible answers
3. **Clue 3** — Nearly a giveaway for anyone with basic knowledge

## User Interface

### Visual Design
- Follow SonarWord's established UI patterns closely
- Clean, warm color palette
- Letter boxes with reveal animations
- Wrong position letters section below game board
- Mobile-first responsive design

### Key UI Elements

#### Header
- Game logo/title
- Category display (e.g., "COUNTRIES")
- Help button (?)
- Stats button (📊)
- Settings/mute (for sound effects, if any)

#### Game Board
- Clue display area (shows revealed clues, stacked)
- Letter boxes (word length, revealed letters shown)
- Wrong position letters section
- Typing progress dots (like SonarWord v1.5)

#### Input Area
- Text input (filtered to letters only, capped at word length)
- Submit button
- Error message area

#### Post-Game
- Results display (score, clues used)
- Factoid about the answer
- Share button (generates shareable text)
- "Quick Play" CTA (if came from daily)
- "Next Puzzle" button (in quick play mode)

### Share Format

```
CluesWord #47 🧩

🟢 Countries
📍 2/3 clues
⭐ 85 points
🔥 12 day streak

cluesword.com
```

## Platform-Specific Considerations

### Web (Netlify)
- Static site, no backend required
- localStorage for game state, stats, streaks
- Daily puzzle determined by date calculation (like SonarWord)
- All puzzles bundled in JSON file
- PWA-ready (offline support possible)

### Reddit (Devvit)
- Devvit Web (webview) implementation
- Redis for user state/stats (replaces localStorage)
- Daily puzzle post created manually or via scheduled job
- Quick play available within the experience post
- r/CluesWord as dedicated subreddit
- Leaderboard potential for community engagement

### Unified Codebase Strategy

```
cluesword/
├── src/
│   ├── core/           # Shared game logic
│   │   ├── game-state.js
│   │   ├── scoring.js
│   │   └── puzzle-manager.js
│   ├── ui/             # Shared UI components
│   │   ├── game-board.js
│   │   ├── clue-display.js
│   │   └── results-modal.js
│   ├── storage/        # Storage abstraction
│   │   ├── interface.js      # Common interface
│   │   ├── local-storage.js  # Web implementation
│   │   └── redis-storage.js  # Reddit implementation
│   └── platforms/
│       ├── web/        # Netlify entry point
│       └── reddit/     # Devvit entry point
├── data/
│   └── puzzles.json
├── build/
│   ├── web/           # Netlify build output
│   └── reddit/        # Devvit build output
└── scripts/
    └── build.js       # Unified build script
```

### Build Targets
- `npm run build:web` — Generates Netlify-ready static site
- `npm run build:reddit` — Generates Devvit app package
- `npm run dev` — Local development server (web mode)

## Data & Content

### Puzzle Content (MVP)
- 100 curated puzzles (20 per category)
- Manually authored clues for quality control
- Stored in static JSON, bundled with build
- No API calls required at runtime

### Content Expansion Path (Post-MVP)
- Add more categories (Landmarks, TV Shows, Sports, Music Artists, etc.)
- Increase puzzle count per category
- Consider Wikidata/API-based puzzle generation for scale
- Community submission system for Reddit

## Stats & Tracking

### Per-User Stats
- Total puzzles solved
- Average score
- Best score
- Current streak (daily challenge)
- Max streak
- Per-category breakdown

### Daily Challenge Stats
- Date
- Puzzle ID
- Guesses made
- Clues used
- Score
- Completion status

## Technical Requirements

### Performance
- First contentful paint < 1.5s
- Full interactive < 2s
- Works on 3G connections
- Minimal JS bundle size

### Accessibility
- Keyboard navigable
- Screen reader compatible
- Sufficient color contrast
- No audio required for core gameplay

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS Safari (Reddit app webview)
- Android Chrome (Reddit app webview)

## Success Metrics

### Web
- Daily active users
- Retention (D1, D7, D30)
- Average session length
- Share rate

### Reddit
- Daily Qualified Engagers (DQE) — primary metric for Developer Funds
- Post engagement (upvotes, comments)
- Subreddit growth
- Quick play rounds per session

## Launch Plan

### Phase 1: MVP Web Launch
- Core game mechanics
- Daily challenge + Quick play
- 5 categories, 100 puzzles
- Deploy to Netlify
- Soft launch, gather feedback

### Phase 2: Reddit Launch
- Port to Devvit Web
- Create r/CluesWord subreddit
- Daily challenge posts
- Apply for Developer Funds program

### Phase 3: Growth
- Add categories based on engagement data
- Increase puzzle pool
- Community features (leaderboards, challenges)
- Consider installable-by-subreddits model

## Open Questions

1. **Sound effects?** — Should correct/wrong guesses have audio feedback? (Optional, not core like SonarWord)
2. **Difficulty levels?** — Should clues vary in difficulty, or keep uniform?
3. **Hints system?** — Should players be able to "buy" a revealed letter (costs points)?
4. **Timer mode?** — Future mode where clues auto-reveal on timer for competitive play?

---

## Appendix: Sample Puzzles

### Countries

**INDIA**
1. "This Asian nation has over 1 billion people"
2. "The Taj Mahal is located here"
3. "Its flag features a navy blue wheel with 24 spokes"
Factoid: "India has 22 officially recognized languages"

**BRAZIL**
1. "This South American country spans multiple time zones"
2. "Home to the Amazon rainforest"
3. "Hosted the 2014 FIFA World Cup"
Factoid: "Brazil is the only Portuguese-speaking country in the Americas"

### Animals

**TIGER**
1. "This large cat is native to Asia"
2. "Known for its orange coat with black stripes"
3. "The largest living cat species"
Factoid: "No two tigers have the same stripe pattern"

**PENGUIN**
1. "This flightless bird is an excellent swimmer"
2. "Lives primarily in the Southern Hemisphere"
3. "Featured in the documentary 'March of the Penguins'"
Factoid: "Emperor penguins can dive to depths of 1,800 feet"

### Movies

**TITANIC**
1. "This 1997 film won 11 Academy Awards"
2. "Features a tragic love story aboard a doomed ship"
3. "Directed by James Cameron, stars Leonardo DiCaprio"
Factoid: "The movie's budget was more than the actual ship cost to build"

### Cities

**TOKYO**
1. "This Asian megacity has over 37 million people in its metro area"
2. "Hosted the Summer Olympics twice"
3. "Known for Shibuya Crossing and cherry blossoms"
Factoid: "Tokyo was originally called Edo until 1868"

### Famous People

**EINSTEIN**
1. "This German-born scientist revolutionized physics"
2. "Published the theory of relativity"
3. "Famous for the equation E=mc²"
Factoid: "Einstein's brain was preserved after his death for study"
