# Puzzle Template

Copy and paste these templates when adding new puzzles to `puzzles.json`.

---

## Daily Puzzle Template

Add to the `dailyPuzzles` array:

```json
{
  "id": "daily-XXX",
  "category": "Countries",
  "word": "ANSWER",
  "clues": [
    "First clue - easiest/most general hint",
    "Second clue - more specific hint",
    "Third clue - most revealing hint (but not a giveaway)"
  ],
  "factoid": "An interesting fact about the answer that players see after winning."
}
```

---

## Quick Play Puzzle Template

Add to the appropriate category in `quickPlayPuzzles`:

```json
{
  "id": "qp-CATEGORY-XXX",
  "category": "Countries",
  "word": "ANSWER",
  "clues": [
    "First clue - easiest/most general hint",
    "Second clue - more specific hint",
    "Third clue - most revealing hint (but not a giveaway)"
  ],
  "factoid": "An interesting fact about the answer that players see after winning."
}
```

---

## Categories

Valid categories (must match exactly, case-sensitive):
- `Countries`
- `Cities`
- `Animals`
- `Movies`
- `Pet Breeds`
- `Famous People`

To add a new category, add a new key to `quickPlayPuzzles` object.

---

## ID Naming Convention

- Daily: `daily-001`, `daily-002`, etc.
- Quick Play: `qp-{category}-001`, e.g., `qp-countries-001`, `qp-animals-005`

---

## Tips for Good Clues

1. **Clue 1 (Easy)**: Broad category or general fact
   - "This European country..."
   - "This large mammal..."

2. **Clue 2 (Medium)**: More specific characteristic
   - "Known for its Eiffel Tower..."
   - "Has black and white stripes..."

3. **Clue 3 (Hard/Specific)**: Very identifying detail
   - "Its capital is Paris"
   - "Native only to Africa"

**Avoid:**
- Clues that give away the answer directly
- Obscure facts only experts would know
- Clues that could apply to many answers

---

## Example: Adding a New Country

```json
{
  "id": "qp-countries-006",
  "category": "Countries",
  "word": "AUSTRALIA",
  "clues": [
    "This country is also a continent",
    "Home to kangaroos and koalas",
    "The Great Barrier Reef is located here"
  ],
  "factoid": "Australia has over 10,000 beaches - you could visit a new one every day for 27 years."
}
```

---

## Validation

After adding puzzles, run:

```bash
npm run validate-puzzles
```

This checks for:
- Missing required fields
- Duplicate words
- Duplicate IDs
- JSON syntax errors
- Puzzle counts per category
