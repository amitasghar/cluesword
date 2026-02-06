#!/usr/bin/env node
/**
 * Add Puzzles Script
 *
 * Reads a structured input file and adds puzzles to split data files.
 * Validates for duplicates before adding.
 *
 * Usage: node scripts/add-puzzles.cjs <input-file> [--dry-run]
 *
 * Input file format (toadd.txt):
 * ─────────────────────────────
 * famous people:
 * TAYLOR SWIFT
 * OPRAH
 *
 * movies:
 * THE MATRIX
 * STAR WARS
 * ─────────────────────────────
 *
 * Category headers map to puzzle categories:
 *   "famous people:" → "Famous People"
 *   "movies:"        → "Movies"
 *   "countries:"     → "Countries"
 *   "cities:"        → "Cities"
 *   "animals:"       → "Animals"
 *
 * After running, you still need to manually add clues and factoids
 * to the generated entries in the data files.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DAILY_PATH = path.join(DATA_DIR, 'daily.json');

const CATEGORY_MAP = {
  'famous people': 'Famous People',
  'movies': 'Movies',
  'countries': 'Countries',
  'cities': 'Cities',
  'animals': 'Animals'
};

const CATEGORY_FILES = {
  'Famous People': 'famous-people',
  'Movies': 'movies',
  'Countries': 'countries',
  'Cities': 'cities',
  'Animals': 'animals'
};

const QP_PREFIX_MAP = {
  'Famous People': 'qp-people',
  'Movies': 'qp-movies',
  'Countries': 'qp-countries',
  'Cities': 'qp-cities',
  'Animals': 'qp-animals'
};

const normalize = w => w.toUpperCase().replace(/[\s-]/g, '');

function loadJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function parseInputFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  const entries = [];
  let currentCategory = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(.+):$/);
    if (headerMatch) {
      const key = headerMatch[1].toLowerCase().trim();
      if (CATEGORY_MAP[key]) {
        currentCategory = CATEGORY_MAP[key];
      } else {
        console.warn(`⚠️  Unknown category: "${headerMatch[1]}" — skipping`);
        currentCategory = null;
      }
      continue;
    }

    if (currentCategory && line.length > 0) {
      entries.push({
        word: line.toUpperCase(),
        category: currentCategory
      });
    }
  }

  return entries;
}

function getAllExistingWords() {
  const words = new Set();

  // Daily
  loadJsonArray(DAILY_PATH).forEach(p => words.add(normalize(p.word)));

  // All categories
  for (const [, basename] of Object.entries(CATEGORY_FILES)) {
    const fp = path.join(DATA_DIR, `${basename}.json`);
    loadJsonArray(fp).forEach(p => words.add(normalize(p.word)));
  }

  return words;
}

function getNextDailyId() {
  const daily = loadJsonArray(DAILY_PATH);
  let max = 0;
  daily.forEach(p => {
    const num = parseInt(p.id.replace('daily-', ''), 10);
    if (num > max) max = num;
  });
  return max + 1;
}

function getNextQpId(category) {
  const prefix = QP_PREFIX_MAP[category];
  if (!prefix) return 1;
  const basename = CATEGORY_FILES[category];
  const puzzles = loadJsonArray(path.join(DATA_DIR, `${basename}.json`));
  let max = 0;
  puzzles.forEach(p => {
    const num = parseInt(p.id.replace(`${prefix}-`, ''), 10);
    if (num > max) max = num;
  });
  return max + 1;
}

function padId(num) {
  return String(num).padStart(3, '0');
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inputFile = args.find(a => !a.startsWith('--'));

  if (!inputFile) {
    console.log('Usage: node scripts/add-puzzles.cjs <input-file> [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run    Show what would be added without modifying data files');
    console.log('');
    console.log('The input file should have category headers followed by words:');
    console.log('  famous people:');
    console.log('  TAYLOR SWIFT');
    console.log('  OPRAH');
    console.log('');
    console.log('  movies:');
    console.log('  THE MATRIX');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  const existingWords = getAllExistingWords();
  const entries = parseInputFile(inputFile);
  console.log(`\n📄 Found ${entries.length} entries in ${path.basename(inputFile)}\n`);

  if (entries.length === 0) {
    console.log('No entries found. Check file format.');
    process.exit(0);
  }

  // Check for duplicates
  const duplicates = [];
  const newEntries = [];

  for (const entry of entries) {
    if (existingWords.has(normalize(entry.word))) {
      duplicates.push(entry);
    } else {
      newEntries.push(entry);
      existingWords.add(normalize(entry.word));
    }
  }

  if (duplicates.length > 0) {
    console.log('⚠️  Skipping duplicates (already exist):');
    duplicates.forEach(d => console.log(`   - ${d.word} (${d.category})`));
    console.log('');
  }

  if (newEntries.length === 0) {
    console.log('No new entries to add.');
    process.exit(0);
  }

  // Split: first half → daily, second half → quick play
  const halfPoint = Math.ceil(newEntries.length / 2);
  const dailyEntries = newEntries.slice(0, halfPoint);
  const qpEntries = newEntries.slice(halfPoint);

  // Build daily puzzles
  let dailyId = getNextDailyId();
  const newDaily = dailyEntries.map(entry => ({
    id: `daily-${padId(dailyId++)}`,
    category: entry.category,
    word: entry.word,
    clues: [
      "TODO: First clue - easiest/most general hint",
      "TODO: Second clue - more specific hint",
      "TODO: Third clue - most revealing hint"
    ],
    factoid: "TODO: Add an interesting fact"
  }));

  // Build quick play puzzles
  const qpCounters = {};
  const newQp = qpEntries.map(entry => {
    if (!qpCounters[entry.category]) {
      qpCounters[entry.category] = getNextQpId(entry.category);
    }
    const prefix = QP_PREFIX_MAP[entry.category];
    return {
      id: `${prefix}-${padId(qpCounters[entry.category]++)}`,
      category: entry.category,
      word: entry.word,
      clues: [
        "TODO: First clue - easiest/most general hint",
        "TODO: Second clue - more specific hint",
        "TODO: Third clue - most revealing hint"
      ],
      factoid: "TODO: Add an interesting fact"
    };
  });

  // Print summary
  console.log('📅 New Daily Puzzles:');
  newDaily.forEach(p => console.log(`   ${p.id} | ${p.category} | ${p.word}`));

  console.log('\n🎮 New Quick Play Puzzles:');
  newQp.forEach(p => console.log(`   ${p.id} | ${p.category} | ${p.word}`));

  console.log(`\n📊 Total: ${newDaily.length} daily + ${newQp.length} quick play = ${newDaily.length + newQp.length} new puzzles`);

  if (dryRun) {
    console.log('\n🔍 Dry run — no changes made. Remove --dry-run to add puzzles.\n');
    process.exit(0);
  }

  // Add daily entries
  const daily = loadJsonArray(DAILY_PATH);
  daily.push(...newDaily);
  fs.writeFileSync(DAILY_PATH, JSON.stringify(daily, null, 2) + '\n', 'utf-8');

  // Add quick play entries per category
  const qpByCategory = {};
  for (const puzzle of newQp) {
    if (!qpByCategory[puzzle.category]) qpByCategory[puzzle.category] = [];
    qpByCategory[puzzle.category].push(puzzle);
  }

  for (const [category, puzzles] of Object.entries(qpByCategory)) {
    const basename = CATEGORY_FILES[category];
    const fp = path.join(DATA_DIR, `${basename}.json`);
    const existing = loadJsonArray(fp);
    existing.push(...puzzles);
    fs.writeFileSync(fp, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  }

  console.log('\n✅ Puzzles added to data files');
  console.log('⚠️  Remember to fill in clues and factoids (search for "TODO" in data files)');
  console.log('   Then run: npm run validate-puzzles\n');
}

main();
