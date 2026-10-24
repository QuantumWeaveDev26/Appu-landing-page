import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuestMentorContext } from '../src/domain/personalisation/guest-context.js';

test('guest context without a profile stays minimal', () => {
  assert.deepEqual(buildGuestMentorContext('en'), { mode: 'guest', primaryLanguage: 'en', personalizationEnabled: false });
});

test('landing-page guest profile adds only nickname, class and favourite subject', () => {
  assert.deepEqual(buildGuestMentorContext('kn', { nickname: 'Chinnu', grade: '6', favoriteSubject: 'Science' }), {
    mode: 'guest',
    primaryLanguage: 'kn',
    personalizationEnabled: false,
    learnerName: 'Chinnu',
    grade: 'Grade 6',
    favoriteSubjects: ['Science']
  });
});

test('partial guest profile adds only the fields given', () => {
  assert.deepEqual(buildGuestMentorContext('en', { grade: '9' }), { mode: 'guest', primaryLanguage: 'en', personalizationEnabled: false, grade: 'Grade 9' });
});
