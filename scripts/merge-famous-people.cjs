const fs = require('fs');
const path = require('path');

const existing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'famous-people.json'), 'utf8'));
const newEntries = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'famous-people-100.json'), 'utf8'));

// Remove OPRAH WINFREY duplicate (OPRAH exists in daily-puzzles.json)
const filtered = newEntries.filter(e => e.word !== 'OPRAH WINFREY');

// Merge, avoiding duplicate words
const existingWords = new Set(existing.map(e => e.word));
const toAdd = filtered.filter(e => !existingWords.has(e.word));

const merged = [...existing, ...toAdd];
console.log(`Existing: ${existing.length}, New: ${toAdd.length}, Total: ${merged.length}`);

fs.writeFileSync(
  path.join(__dirname, '..', 'data', 'famous-people.json'),
  JSON.stringify(merged, null, 2) + '\n'
);
console.log('Merged into data/famous-people.json');
