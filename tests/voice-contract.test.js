const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeResponse,
  toAudioSource
} = require('../voice-contract.js');

test('normalizes n8n output with raw Base64 audio', () => {
  const result = normalizeResponse({
    output: 'Hello learner.',
    audio_base64: 'SUQzBAAAAAA='
  });

  assert.deepEqual(result, {
    text: 'Hello learner.',
    audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAA='
  });
});

test('normalizes alternate response keys and preserves playable URLs', () => {
  const result = normalizeResponse({
    message: 'Ready for a quiz?',
    audioUrl: 'https://cdn.example.test/appu.mp3'
  });

  assert.deepEqual(result, {
    text: 'Ready for a quiz?',
    audioSource: 'https://cdn.example.test/appu.mp3'
  });
});

test('normalizes one-item array responses', () => {
  const result = normalizeResponse([{
    text: 'Let us learn fractions.',
    audioBase64: 'QUJDRA=='
  }]);

  assert.equal(result.text, 'Let us learn fractions.');
  assert.equal(result.audioSource, 'data:audio/mpeg;base64,QUJDRA==');
});

test('returns an empty audio source when n8n returns text only', () => {
  assert.deepEqual(normalizeResponse({ response: 'Text still works.' }), {
    text: 'Text still works.',
    audioSource: null
  });
});

test('toAudioSource preserves data and blob URLs and rejects non-strings', () => {
  assert.equal(toAudioSource('data:audio/mpeg;base64,AA=='), 'data:audio/mpeg;base64,AA==');
  assert.equal(toAudioSource('blob:https://example.test/audio'), 'blob:https://example.test/audio');
  assert.equal(toAudioSource(undefined), null);
  assert.equal(toAudioSource({}), null);
});
