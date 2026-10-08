const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const landing = fs.readFileSync(path.join(__dirname, '../frontend/landing-page.js'), 'utf8');
const session = fs.readFileSync(path.join(__dirname, '../frontend/appu-session.js'), 'utf8');

describe('Landing -> app sign-in gate', () => {
  test('the session global the landing checks is the one appu-session.js actually defines', () => {
    assert.match(session, /root\.AppuSession\s*=/, 'appu-session.js must define window.AppuSession');
    assert.match(landing, /win\.AppuSession\.isAuthenticated\(\)/, 'isAuthed() must check window.AppuSession');
    assert.doesNotMatch(landing, /win\.appuSession\b/, 'lowercase appuSession does not exist; checking it made sign-in never reveal the app');
  });

  test('a signed-in parent still finishing setup counts as signed in', () => {
    assert.match(landing, /ParentOnboardingShell\.isParentAuthenticated\(\)/);
  });

  test('sign-in watcher has no hard time cap while the setup modal is open', () => {
    assert.match(landing, /this\.watchForAuth\(null\)/, 'openSignIn must watch while the modal is open');
    assert.doesNotMatch(landing, /120000/, 'the old 2-minute cutoff stranded parents mid-setup');
  });

  test('returning users whose session restores after load are moved into the app', () => {
    assert.match(landing, /this\.showLanding\(\);\s*\n\s*this\.watchForAuth\(\d+\)/);
  });
});
