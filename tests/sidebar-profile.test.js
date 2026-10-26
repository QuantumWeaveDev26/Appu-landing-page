const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.resolve(__dirname, '../frontend/parent-onboarding-shell.js'), 'utf8');
const badge = js.slice(js.indexOf('function updateHeaderSessionBadge() {'), js.indexOf('const hasActiveSession'));

test('signed-in learner sees a Claude-style profile row with name and class', () => {
  assert.match(badge, /renderSidebarProfile\(\{ name: childName, sub: gradeMatch \? `Class \$\{gradeMatch\[0\]\}` : 'Learner' \}\)/);
  assert.match(badge, /\.match\(\/\d\{1,2\}\/\)/, 'grade regex must keep its backslash');
});

test('signed-in parent without a learner still gets a profile row', () => {
  assert.match(badge, /renderSidebarProfile\(\{ name: displayName, sub: 'Parent' \}\)/);
});

test('signed out and restoring hide the profile row', () => {
  assert.equal((badge.match(/renderSidebarProfile\(null\)/g) || []).length, 2);
});

test('profile menu offers Parent Zone and Sign out', () => {
  const fn = js.slice(js.indexOf('function renderSidebarProfile(profile) {'), js.indexOf('function updateHeaderSessionBadge() {'));
  assert.match(fn, /data-profile-action="parent"/);
  assert.match(fn, /data-profile-action="signout"/);
  assert.match(fn, /signOut\(\)/);
});
