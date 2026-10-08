const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '../frontend');

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listJs(p);
    return /\.(js|html)$/.test(e.name) ? [p] : [];
  });
}

describe('AppuSession global', () => {
  test('nothing in frontend/ references the nonexistent lowercase appuSession', () => {
    const offenders = listJs(FRONTEND).filter((f) => /\bappuSession\b/.test(fs.readFileSync(f, 'utf8')));
    assert.deepEqual(offenders.map((f) => path.relative(FRONTEND, f)), [],
      'the global is window.AppuSession; lowercase lookups are always undefined and silently fall back to defaults');
  });

  test('getGrade/getChildName read the active child from the session context', () => {
    const AppuSession = require('../frontend/appu-session.js');
    assert.equal(AppuSession.getGrade(), null);
    AppuSession.setSession({ accessToken: 't', childId: 'c', parentContext: { gradeBand: 'Grade 9', childName: 'Asha' } });
    assert.equal(AppuSession.getGrade(), '9');
    assert.equal(AppuSession.getChildName(), 'Asha');
    AppuSession.clear();
    assert.equal(AppuSession.getGrade(), null);
    assert.equal(AppuSession.getChildName(), null);
  });

  test('podcast request uses the active child grade, not a hardcoded default', () => {
    const app = fs.readFileSync(path.join(FRONTEND, 'app.js'), 'utf8');
    assert.match(app, /const childGrade = getActiveChildGrade\(\) \|\| activePopupLessonCard\.grade \|\| '6';/);
    assert.doesNotMatch(app, /window\.parentSetupUI/, 'parentSetupUI does not exist; getActiveChildGrade must read AppuSession');
  });
});
