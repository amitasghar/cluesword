/**
 * Split puzzles.json into per-category files
 * One-time migration script
 *
 * Usage: node scripts/split-puzzles.cjs
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SOURCE = path.join(DATA_DIR, 'puzzles.json');

function categoryToFilename(category) {
  return category.toLowerCase().replace(/\s+/g, '-') + '.json';
}

function main() {
  const raw = fs.readFileSync(SOURCE, 'utf8');
  const data = JSON.parse(raw);

  const daily = data.dailyPuzzles || [];
  const quickPlay = data.quickPlayPuzzles || {};

  // Write daily.json
  const dailyPath = path.join(DATA_DIR, 'daily.json');
  fs.writeFileSync(dailyPath, JSON.stringify(daily, null, 2) + '\n');
  console.log(`daily.json: ${daily.length} puzzles`);

  // Write per-category files
  let totalQP = 0;
  for (const [category, puzzles] of Object.entries(quickPlay)) {
    const filename = categoryToFilename(category);
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(puzzles, null, 2) + '\n');
    console.log(`${filename}: ${puzzles.length} puzzles`);
    totalQP += puzzles.length;
  }

  const total = daily.length + totalQP;
  console.log(`\nTotal: ${total} puzzles (${daily.length} daily + ${totalQP} quick play)`);
  console.log('Split complete!');
}

main();
