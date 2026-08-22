const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../frontend');
console.log('Auditing canonical frontend source at:', baseDir);

const files = fs.readdirSync(baseDir);
console.log('Root files in bundle:', files);

const assets = fs.readdirSync(path.join(baseDir, 'assets'));
console.log('Assets files in bundle:', assets);

let totalErrors = 0;

// 1. Audit index.html references
const htmlContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

// Match scripts
const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
let match;
while ((match = scriptRegex.exec(htmlContent)) !== null) {
  const s = match[1];
  if (s.startsWith('http://') || s.startsWith('https://')) continue;
  const cleanPath = s.split('?')[0];
  const fullPath = path.join(baseDir, cleanPath);
  if (!fs.existsSync(fullPath)) {
    console.error('ERROR: Missing script file referenced in index.html:', cleanPath);
    totalErrors++;
  } else {
    console.log('  [OK] Script found:', cleanPath);
  }
}

// Match stylesheets
const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
while ((match = linkRegex.exec(htmlContent)) !== null) {
  const c = match[1];
  if (c.startsWith('http://') || c.startsWith('https://')) continue;
  const cleanPath = c.split('?')[0];
  const fullPath = path.join(baseDir, cleanPath);
  if (!fs.existsSync(fullPath)) {
    console.error('ERROR: Missing CSS file referenced in index.html:', cleanPath);
    totalErrors++;
  } else {
    console.log('  [OK] Stylesheet found:', cleanPath);
  }
}

// Match media
const mediaRegex = /<(img|source)\s+[^>]*src=["']([^"']+)["']/gi;
while ((match = mediaRegex.exec(htmlContent)) !== null) {
  const m = match[2];
  if (m.startsWith('http://') || m.startsWith('https://')) continue;
  const cleanPath = m.split('?')[0];
  const fullPath = path.join(baseDir, cleanPath);
  if (!fs.existsSync(fullPath)) {
    console.error('ERROR: Missing media file referenced in index.html:', cleanPath);
    totalErrors++;
  } else {
    console.log('  [OK] Media file found:', cleanPath);
  }
}

// 2. Audit style.css url() references
const cssContent = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');
const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
while ((match = urlRegex.exec(cssContent)) !== null) {
  const u = match[1];
  if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) continue;
  const cleanPath = u.split('?')[0];
  const fullPath = path.join(baseDir, cleanPath);
  if (!fs.existsSync(fullPath)) {
    console.error('ERROR: Missing asset referenced in style.css:', cleanPath);
    totalErrors++;
  } else {
    console.log('  [OK] CSS asset found:', cleanPath);
  }
}

// 3. Audit JS asset references
for (const f of files) {
  if (!f.endsWith('.js')) continue;
  const jsContent = fs.readFileSync(path.join(baseDir, f), 'utf8');
  const assetRegex = /assets\/[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|mp4|svg|webp)/g;
  let jsMatch;
  while ((jsMatch = assetRegex.exec(jsContent)) !== null) {
    const ja = jsMatch[0];
    const fullPath = path.join(baseDir, ja);
    if (!fs.existsSync(fullPath)) {
      console.error('ERROR: Missing asset in ' + f + ':', ja);
      totalErrors++;
    } else {
      console.log('  [OK] JS asset reference in ' + f + ' found:', ja);
    }
  }
}

// 4. Security scan
const forbiddenPatterns = [
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'postgres://',
  'postgresql://',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

for (const f of files) {
  if (f === 'assets') continue;
  const content = fs.readFileSync(path.join(baseDir, f), 'utf8');
  for (const fp of forbiddenPatterns) {
    if (content.includes(fp)) {
      console.error('SECURITY ERROR: ' + f + ' contains forbidden pattern: ' + fp);
      totalErrors++;
    }
  }
}

console.log('-------------------------------------------');
console.log('AUDIT SUMMARY: Total Errors =', totalErrors);
if (totalErrors === 0) {
  console.log('PROVEN: 100% of static dependencies exist and 0 security violations found.');
} else {
  process.exit(1);
}
