// QA 2026-10-24 F12: at 390x844 the study toolbar was flex-shrunk to 16px, clipping its
// 44px tabs, and a mouse wheel could not move it sideways.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, '../frontend/lesson-card-renderer.js'), 'utf8');

test('the mobile study toolbar never shrinks below a full touch-target row', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 768px) {\n  /* QA F12'));
  const rule = mobile.slice(0, mobile.indexOf('}'));
  assert.match(rule, /flex: 0 0 auto;/);
  assert.match(rule, /min-height: 60px;/);
  assert.match(rule, /overflow-y: hidden;/);
  assert.match(mobile, /\.study-tab-btn \{[^}]*min-height: 44px;/);
});

test('sideways tab scrolling is discoverable and works with a mouse wheel', () => {
  const fn = js.slice(js.indexOf('function renderStudyToolbar('), js.indexOf('return toolbar;'));
  assert.match(fn, /addEventListener\('wheel'[\s\S]*toolbar\.scrollLeft \+= e\.deltaY/);
  assert.match(fn, /classList\.toggle\('has-more-tabs'/);
  assert.match(css, /\.study-modes-toolbar\.has-more-tabs \{[^}]*mask-image/);
});
