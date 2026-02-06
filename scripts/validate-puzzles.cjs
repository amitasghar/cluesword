#!/usr/bin/env node
/**
 * Puzzle Validation Script
 * Run: npm run validate-puzzles
 *
 * Reads split data files: data/daily.json + data/{category}.json
 *
 * Checks:
 * - JSON syntax
 * - Required fields (id, category, word, clues, factoid)
 * - Clue count (must have exactly 3)
 * - Duplicate words (across all files)
 * - Duplicate IDs (across all files)
 * - Provides counts per category
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DAILY_PATH = path.join(DATA_DIR, 'daily.json');
const REQUIRED_FIELDS = ['id', 'category', 'word', 'clues', 'factoid'];
const REQUIRED_CLUES = 3;

// Category files to validate (basename without .json)
const CATEGORY_FILES = {
  'Countries': 'countries',
  'Cities': 'cities',
  'Animals': 'animals',
  'Movies': 'movies',
  'Famous People': 'famous-people'
};

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(`\u274C ${msg}`);
}

function warn(msg) {
  warnings.push(`\u26A0\uFE0F  ${msg}`);
}

function success(msg) {
  console.log(`\u2705 ${msg}`);
}

function validatePuzzle(puzzle, source) {
  for (const field of REQUIRED_FIELDS) {
    if (!puzzle[field]) {
      error(`${source}: Missing required field '${field}' for puzzle ${puzzle.id || 'UNKNOWN'}`);
    }
  }

  if (puzzle.clues && puzzle.clues.length !== REQUIRED_CLUES) {
    error(`${source}: Puzzle '${puzzle.id}' has ${puzzle.clues.length} clues (expected ${REQUIRED_CLUES})`);
  }

  if (puzzle.word && puzzle.word.trim() === '') {
    error(`${source}: Puzzle '${puzzle.id}' has empty word`);
  }

  if (puzzle.factoid && puzzle.factoid.trim() === '') {
    warn(`${source}: Puzzle '${puzzle.id}' has empty factoid`);
  }

  if (puzzle.clues) {
    puzzle.clues.forEach((clue, i) => {
      if (!clue || clue.trim() === '') {
        error(`${source}: Puzzle '${puzzle.id}' has empty clue at position ${i + 1}`);
      }
    });
  }
}

function loadJsonArray(filePath, label) {
  if (!fs.existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      error(`${label}: Expected JSON array`);
      return null;
    }
    return data;
  } catch (e) {
    error(`${label}: JSON parse error: ${e.message}`);
    return null;
  }
}

function main() {
  console.log('\n\uD83D\uDD0D Validating puzzle data files...\n');

  const allWords = new Map();
  const allIds = new Map();

  // --- Daily puzzles ---
  const daily = loadJsonArray(DAILY_PATH, 'daily.json');
  if (!daily) {
    printResults();
    return;
  }
  success('daily.json syntax is valid');

  console.log('\n\uD83D\uDCC5 Daily Puzzles:');
  const dailyByCategory = {};

  daily.forEach((puzzle, i) => {
    validatePuzzle(puzzle, `daily.json[${i}]`);

    const word = puzzle.word?.toUpperCase();
    if (word) {
      if (!allWords.has(word)) allWords.set(word, []);
      allWords.get(word).push(`Daily: ${puzzle.id}`);
    }
    if (puzzle.id) {
      if (!allIds.has(puzzle.id)) allIds.set(puzzle.id, []);
      allIds.get(puzzle.id).push('daily.json');
    }

    const cat = puzzle.category || 'Unknown';
    dailyByCategory[cat] = (dailyByCategory[cat] || 0) + 1;
  });

  console.log(`   Total: ${daily.length}`);
  Object.entries(dailyByCategory).sort().forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count}`);
  });

  // --- Category files ---
  console.log('\n\uD83C\uDFAE Quick Play Puzzles:');
  let quickPlayTotal = 0;
  const categoryNames = Object.keys(CATEGORY_FILES).sort();

  for (const category of categoryNames) {
    const basename = CATEGORY_FILES[category];
    const filePath = path.join(DATA_DIR, `${basename}.json`);
    const puzzles = loadJsonArray(filePath, `${basename}.json`);

    if (!puzzles) continue;

    puzzles.forEach((puzzle, i) => {
      validatePuzzle(puzzle, `${basename}.json[${i}]`);

      const word = puzzle.word?.toUpperCase();
      if (word) {
        if (!allWords.has(word)) allWords.set(word, []);
        allWords.get(word).push(`${category}: ${puzzle.id}`);
      }
      if (puzzle.id) {
        if (!allIds.has(puzzle.id)) allIds.set(puzzle.id, []);
        allIds.get(puzzle.id).push(`${basename}.json`);
      }
    });

    console.log(`   - ${category}: ${puzzles.length}`);
    quickPlayTotal += puzzles.length;
  }

  console.log(`   Total: ${quickPlayTotal}`);

  // --- Duplicate checks ---
  console.log('\n\uD83D\uDD0E Checking for duplicates...');
  allWords.forEach((sources, word) => {
    if (sources.length > 1) {
      error(`Duplicate word '${word}' found in: ${sources.join(', ')}`);
    }
  });

  allIds.forEach((sources, id) => {
    if (sources.length > 1) {
      error(`Duplicate ID '${id}' found in: ${sources.join(', ')}`);
    }
  });

  if (errors.length === 0) {
    success('No duplicates found');
  }

  // --- Summary ---
  console.log('\n\uD83D\uDCCA Summary:');
  console.log(`   Daily puzzles:      ${daily.length}`);
  console.log(`   Quick Play puzzles: ${quickPlayTotal}`);
  console.log(`   Categories:         ${categoryNames.length}`);
  console.log(`   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  console.log(`   Grand Total:        ${daily.length + quickPlayTotal}`);

  // Coverage warnings
  const minPerCategory = 10;
  for (const category of categoryNames) {
    const basename = CATEGORY_FILES[category];
    const filePath = path.join(DATA_DIR, `${basename}.json`);
    if (fs.existsSync(filePath)) {
      const puzzles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (puzzles.length < minPerCategory) {
        warn(`${category} has only ${puzzles.length} puzzles (recommend at least ${minPerCategory})`);
      }
    }
  }

  if (daily.length < 30) {
    warn(`Only ${daily.length} daily puzzles (recommend at least 30 for a month)`);
  }

  printResults();
}

function printResults() {
  if (warnings.length > 0) {
    console.log('\n\u26A0\uFE0F  Warnings:');
    warnings.forEach(w => console.log(`   ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n\u274C Errors:');
    errors.forEach(e => console.log(`   ${e}`));
    console.log(`\n\uD83D\uDEAB Validation FAILED with ${errors.length} error(s)\n`);
    process.exit(1);
  } else {
    console.log('\n\u2705 Validation PASSED\n');
    process.exit(0);
  }
}

main();
