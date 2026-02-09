#!/usr/bin/env node
/**
 * Build script for Reddit/Devvit version.
 * Copies shared CSS, data, and core JS files into reddit/webroot/.
 *
 * Usage: node scripts/build-reddit.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WEBROOT = path.join(ROOT, 'reddit', 'webroot');

// Shared CSS files to copy
const CSS_FILES = [
  'css/styles.css',
  'css/game-board.css',
  'css/modals.css',
  'css/responsive.css',
];

// Shared JS files to copy as-is (game logic, no platform-specific code)
const JS_FILES = [
  'js/utils.js',
  'js/game-state.js',
  'js/ui-controller.js',
];

// Data files to copy
const DATA_FILES = [
  'data/daily.json',
  'data/animals.json',
  'data/cities.json',
  'data/countries.json',
  'data/movies.json',
  'data/famous-people.json',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function main() {
  console.log('Building Reddit webroot...\n');

  let copied = 0;

  // Copy CSS
  for (const file of CSS_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(WEBROOT, file);
    copyFile(src, dest);
    console.log(`  ${file}`);
    copied++;
  }

  // Copy shared JS
  for (const file of JS_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(WEBROOT, file);
    copyFile(src, dest);
    console.log(`  ${file}`);
    copied++;
  }

  // Copy data files
  for (const file of DATA_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(WEBROOT, file);
    copyFile(src, dest);
    console.log(`  ${file}`);
    copied++;
  }

  console.log(`\n✅ Copied ${copied} files into reddit/webroot/`);
}

main();
