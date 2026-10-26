// QA 2026-10-24: F05 progress labels, F06 modal focus, F13 signup CTA, F14 prose headings, F16 podcast name.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.resolve(__dirname, '../frontend', f), 'utf8');
const Renderer = require('../frontend/lesson-card-renderer.js');

test('F13: sign-up CTAs open Create Account and sign-in CTAs open Sign In, every time', () => {
  const app = read('app.js');
  const after = (marker) => app.slice(app.indexOf(marker), app.indexOf(marker) + 400);
  assert.match(after('btnBetaBannerCta.addEventListener'), /openModal\(1, 'signup'\)/);
  assert.match(after('btnGuestRegister.addEventListener'), /openModal\(1, 'signup'\)/);
  assert.match(after('btnGuestSignin.addEventListener'), /openModal\(1, 'signin'\)/);
  assert.match(after('btnMainAuth.addEventListener'), /openModal\(1, 'signin'\)/);
  const setup = read('parent-setup-ui.js');
  assert.match(setup, /openModal: \(step, authMode\) => \{ if \(activeOpenModal\) activeOpenModal\(step, authMode\); \}/);
  assert.match(setup, /authMode === 'signup' \? document\.getElementById\('pos-tab-signup'\) : document\.getElementById\('pos-tab-login'\)/);
});

test('F06: the parent setup modal makes the rest of the page inert and restores it on close', () => {
  const setup = read('parent-setup-ui.js');
  const open = setup.slice(setup.indexOf('function openModal('), setup.indexOf('function closeModal()'));
  const close = setup.slice(setup.indexOf('function closeModal()'), setup.indexOf('function closeModal()') + 200);
  assert.match(open, /setBackgroundInert\(true\)/);
  assert.match(close, /setBackgroundInert\(false\)/);
  assert.match(setup, /inertedBackground\.forEach\(\(\{ el, was \}\) => \{ el\.inert = was; \}\)/);
});

test('F14: plain prose never becomes first-three-word headings; real sections still do', () => {
  const card = Renderer.buildVisualResponseCard('Why is the sunset red?',
    'That beautiful reddish glow happens because sunlight travels through more air at sunset. Imagine sunlight as a team of colours racing through the sky.\nInputs: sunlight and air.', '8', { language: 'en' });
  const branches = (card.mindMap && card.mindMap.branches) || card.blocks.find((b) => b.branches).branches;
  const labels = branches.map((b) => b.label);
  assert.ok(!labels.includes('That beautiful reddish'));
  assert.ok(!labels.includes('Imagine sunlight as'));
  assert.ok(labels.includes('That beautiful reddish glow happens because sunlight travels through more air at sunset.'));
  assert.deepEqual(branches.find((b) => b.label === 'Inputs').children, ['sunlight and air.']);
});

test('F16: the podcast button accessible name follows play/pause/resume and progress is exposed', () => {
  const js = read('lesson-card-renderer.js');
  assert.match(js, /setPlayButton\('fa-pause', 'Pause', 'Pause Appu Audio Lesson'\)/);
  assert.match(js, /setPlayButton\('fa-play', 'Resume', 'Resume Appu Audio Lesson'\)/);
  assert.match(js, /class="podcast-progress-bar" role="progressbar"/);
  assert.equal(js.split('playBtn.innerHTML = ').length - 1, 1, 'only setPlayButton writes the button');
});

test('F05: XP accessible name, level title, progress value and next level come from current progress', () => {
  const app = read('app.js');
  assert.match(app, /xpBtn\.setAttribute\('aria-label', `XP Stars: \$\{state\.xp\}`\)/);
  assert.match(app, /levelPill\.title = levelLabel/);
  assert.match(app, /levelBar\.setAttribute\('aria-valuenow', String\(realPct\)\)/);
  assert.match(app, /nextLevelEl\.textContent = isTopLevel \? 'Top level reached' : `Next: Level \$\{currentLvlInfo\.level \+ 1\}`/);
  assert.match(read('index.html'), /<span id="game-next-level">/);
});
