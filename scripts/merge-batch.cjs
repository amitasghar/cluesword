#!/usr/bin/env node
/**
 * Merge a batch JSON file into a category's data file.
 * Usage: node scripts/merge-batch.cjs <batch-file> <category>
 * Example: node scripts/merge-batch.cjs data/countries-batch2.json Countries
 *
 * Checks for duplicates across ALL data files (daily + all categories).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const CATEGORY_FILES = {
  'Countries': 'countries',
  'Cities': 'cities',
  'Animals': 'animals',
  'Movies': 'movies',
  'Famous People': 'famous-people'
};

const normalize = w => w.toUpperCase().replace(/[\s-]/g, '');

const [batchFile, category] = process.argv.slice(2);

if (!batchFile || !category) {
  console.log('Usage: node scripts/merge-batch.cjs <batch-file> <category>');
  console.log('Categories: ' + Object.keys(CATEGORY_FILES).join(', '));
  process.exit(1);
}

if (!CATEGORY_FILES[category]) {
  console.error(`Unknown category: "${category}"`);
  console.log('Valid: ' + Object.keys(CATEGORY_FILES).join(', '));
  process.exit(1);
}

// Collect all existing words across every data file
const existingWords = new Set();

// Daily
const dailyPath = path.join(DATA_DIR, 'daily.json');
if (fs.existsSync(dailyPath)) {
  JSON.parse(fs.readFileSync(dailyPath, 'utf-8')).forEach(p => existingWords.add(normalize(p.word)));
}

// All category files
for (const [, basename] of Object.entries(CATEGORY_FILES)) {
  const fp = path.join(DATA_DIR, `${basename}.json`);
  if (fs.existsSync(fp)) {
    JSON.parse(fs.readFileSync(fp, 'utf-8')).forEach(p => existingWords.add(normalize(p.word)));
  }
}

// Load target category file
const targetBasename = CATEGORY_FILES[category];
const targetPath = path.join(DATA_DIR, `${targetBasename}.json`);
let targetPuzzles = [];
if (fs.existsSync(targetPath)) {
  targetPuzzles = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
}

// Load batch
const batch = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));

let added = 0, skipped = 0;
for (const puzzle of batch) {
  if (existingWords.has(normalize(puzzle.word))) {
    console.log(`  Skipping duplicate: ${puzzle.word}`);
    skipped++;
  } else {
    targetPuzzles.push(puzzle);
    existingWords.add(normalize(puzzle.word));
    added++;
  }
}

fs.writeFileSync(targetPath, JSON.stringify(targetPuzzles, null, 2) + '\n', 'utf-8');
console.log(`\nMerged ${added} puzzles into ${category} (${skipped} duplicates skipped)`);
console.log(`${category} now has ${targetPuzzles.length} puzzles`);
