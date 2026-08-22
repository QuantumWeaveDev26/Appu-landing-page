const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');

console.log('Checking repository for frontend source duplicates...');

const frontendFiles = fs.readdirSync(frontendDir).filter(f => f !== 'assets');
console.log('Canonical frontend source files:', frontendFiles);

let duplicatesFound = 0;

// Check repository root
for (const file of frontendFiles) {
  const rootPath = path.join(rootDir, file);
  if (fs.existsSync(rootPath)) {
    console.error(`DUPLICATE FOUND at repository root: ${file}`);
    duplicatesFound++;
  }
}

// Check if assets folder exists at repository root
const rootAssets = path.join(rootDir, 'assets');
if (fs.existsSync(rootAssets)) {
  console.error(`DUPLICATE FOUND at repository root: assets/`);
  duplicatesFound++;
}

// Check if deploy folder exists with source files
const deployDir = path.join(rootDir, 'deploy');
if (fs.existsSync(deployDir)) {
  const deployFiles = fs.readdirSync(deployDir);
  if (deployFiles.length > 0) {
    console.error(`DUPLICATE FOUND in deploy/ folder: ${deployFiles.join(', ')}`);
    duplicatesFound++;
  }
}

console.log('----------------------------------------------------');
console.log(`DUPLICATION CHECK RESULT: ${duplicatesFound} duplicates found.`);
if (duplicatesFound === 0) {
  console.log('SUCCESS: Exactly ONE canonical copy of each frontend source file exists in frontend/.');
} else {
  process.exit(1);
}
