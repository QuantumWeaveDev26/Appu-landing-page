const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeAsyncStorage, flush } = require('./helpers/load.cjs');
const sample = require('./fixtures/visualizer-photosynthesis.json');

function setup(initial) {
  const storage = fakeAsyncStorage(initial);
  const stubs = {
    '@react-native-async-storage/async-storage': storage,
    'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' } },
  };
  // Load the store; it shares one module graph with lessonApi so getLesson sees saved lessons.
  const store = load('stores/savedLessonsStore.ts', stubs);
  return { storage, store, s: () => store.useSavedLessonsStore.getState() };
}

function makeLesson(id) {
  const { api } = { api: load('lessons/lessonApi.ts', { 'expo-file-system/legacy': {} }) };
  return api.normalizeLesson(sample, { id, question: 'Q', answer: 'A', grade: '6', language: 'en' });
}

describe('My Learning (saved lessons)', () => {
  it('saves a lesson once and lists the newest first', async () => {
    const { s } = setup();
    s().save(makeLesson('a'));
    s().save(makeLesson('b'));
    s().save(makeLesson('a'));
    assert.deepEqual(s().items.map((i) => i.lesson.id), ['b', 'a']);
    assert.equal(s().isSaved('a'), true);
  });

  it('removes a lesson', () => {
    const { s } = setup();
    s().save(makeLesson('a'));
    s().remove('a');
    assert.equal(s().items.length, 0);
    assert.equal(s().isSaved('a'), false);
  });

  it('keeps saved lessons on the device and reopens them after a restart', async () => {
    const first = setup();
    first.s().save(makeLesson('keep'));
    await flush();
    const second = setup(Object.fromEntries(first.storage.data));
    await second.s().load();
    assert.equal(second.s().items[0].lesson.topic, 'Photosynthesis');
  });
});
