const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeAsyncStorage } = require('./helpers/load.cjs');
const sample = require('./fixtures/visualizer-photosynthesis.json');

// One module graph per "app launch"; the storage object plays the phone's disk.
function launch(storage) {
  const stubs = {
    '@react-native-async-storage/async-storage': storage,
    'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' } },
  };
  return { cache: load('lessons/lessonCache.ts', stubs), api: load('lessons/lessonApi.ts', stubs) };
}

const ANSWER = 'Hey Naveen! Imagine your leaf is a superhero kitchen powered by sunlight.';

describe('Pictures come back when a chat is reopened', () => {
  it('restores the lesson after the app restarts, under the new message id from history', async () => {
    const disk = fakeAsyncStorage();
    const first = launch(disk);
    const lesson = first.api.normalizeLesson(sample, { id: 'local_1', question: 'Q', answer: ANSWER, grade: '8', language: 'en' });
    await first.cache.rememberLesson(ANSWER, lesson);

    const second = launch(disk); // fresh memory, same disk
    // History may differ in spacing; the server gives the message a new id.
    const restored = await second.cache.restoreLessons([{ id: 'srv_42', text: `  ${ANSWER.replace(/ /g, '  ')}\n` }]);
    assert.deepEqual([...restored], ['srv_42']);
  });

  it('leaves answers it has no pictures for alone', async () => {
    const { cache } = launch(fakeAsyncStorage());
    const restored = await cache.restoreLessons([{ id: 'x', text: 'Something else' }]);
    assert.equal(restored.size, 0);
  });

  it('keeps a bounded number of lessons, newest first, without duplicates', async () => {
    const disk = fakeAsyncStorage();
    const { cache, api } = launch(disk);
    const lesson = api.normalizeLesson(sample, { id: 'l', question: 'Q', answer: 'A', grade: '8', language: 'en' });
    for (let i = 0; i < 90; i++) await cache.rememberLesson(`answer ${i}`, lesson);
    await cache.rememberLesson('answer 89', lesson);
    const saved = JSON.parse(disk.data.get('appu_answer_lessons_v1'));
    assert.equal(saved.length, 80);
    assert.equal(saved[0].key, cache.answerKey('answer 89'));
    assert.equal(new Set(saved.map((e) => e.key)).size, 80);
  });

  it('survives broken saved data', async () => {
    const { cache } = launch(fakeAsyncStorage({ appu_answer_lessons_v1: '{not json' }));
    assert.equal((await cache.restoreLessons([{ id: 'a', text: ANSWER }])).size, 0);
  });
});
