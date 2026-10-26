// QA 2026-10-24 F01: opening My Learning / a saved lesson / reports from the ☰ menu left the
// drawer's scrim visible (blurring the lesson), aria-hidden="false" off-screen and the app inert.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.resolve(__dirname, '../frontend', f), 'utf8');

test('the app exposes one drawer-close path that resets scrim, ARIA and inert state', () => {
  const app = read('app.js');
  assert.match(app, /window\.app\.closeNavDrawer = \(\) => \{\s*if \(navDrawer && navDrawer\.classList\.contains\('is-open'\)\) closeNavDrawer\(\);/);
  const close = app.slice(app.indexOf('function closeNavDrawer()'), app.indexOf('function closeNavDrawer()') + 400);
  assert.match(close, /navDrawerScrim\.classList\.remove\('is-visible'\)/);
  assert.match(close, /deactivateDialog\(navDrawer\)/);
});

test('My Learning and Study Lesson close the drawer through the app, never by hand', () => {
  const saved = read('saved-lessons-ui.js');
  assert.doesNotMatch(saved, /getElementById\('nav-drawer'\)/);
  assert.doesNotMatch(saved, /getElementById\('nav-drawer-scrim'\)/);
  assert.match(saved, /window\.app\.closeNavDrawer\(\)/);
  const reopen = saved.slice(saved.indexOf('function reopenLesson('), saved.indexOf('function notifyUpdate('));
  assert.match(reopen, /closePanel\(\);\s*closeNavDrawer\(\);/);
});

test('Child Progress Report closes the drawer properly instead of only flipping aria-hidden', () => {
  const reports = read('parent-reports-ui.js');
  const open = reports.slice(reports.indexOf('function open()'), reports.indexOf('function close()'));
  assert.match(open, /window\.app\.closeNavDrawer\(\)/);
  assert.doesNotMatch(open, /setAttribute\('aria-hidden', 'true'\)/);
});
