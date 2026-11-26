const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.cjs');
const sample = require('./fixtures/visualizer-photosynthesis.json');

function fakeFileSystem() {
  const files = new Map();
  return {
    files,
    cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64' },
    writeAsStringAsync: async (uri, data) => void files.set(uri, data),
    readAsStringAsync: async (uri) => files.get(uri),
  };
}

const lessonApi = (fs = fakeFileSystem()) => ({ fs, api: load('lessons/lessonApi.ts', { 'expo-file-system/legacy': fs }) });
const ctx = { id: 'm1', question: 'What is photosynthesis?', answer: 'Plants make food.', grade: '6', language: 'en' };

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(responses) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next.ok !== false, json: async () => next.body };
  };
  return calls;
}

describe('Study lesson from the live visualizer response', () => {
  const { api } = lessonApi();
  const lesson = api.normalizeLesson(sample, ctx);

  it('keeps topic, citation and analogy', () => {
    assert.equal(lesson.topic, 'Photosynthesis');
    assert.match(lesson.citation, /NCERT Class 6/);
    assert.ok(lesson.analogy.length > 10);
  });

  it('builds the mind map, steps and key points', () => {
    assert.equal(lesson.mindMap.central, 'Photosynthesis');
    assert.ok(lesson.mindMap.branches.length >= 3);
    assert.ok(lesson.mindMap.branches.every((b) => b.label && Array.isArray(b.children)));
    assert.ok(lesson.steps.length >= 3);
    assert.ok(lesson.steps.every((s) => !/^\d+\./.test(s)), 'step numbers are stripped');
    assert.ok(lesson.keyPoints.length >= 3);
  });

  it('builds a playable quiz with a valid correct answer', () => {
    assert.ok(lesson.quiz.length >= 3);
    for (const q of lesson.quiz) {
      assert.ok(q.question);
      assert.ok(q.options.length >= 2);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length);
    }
  });

  it('builds flashcards and the diagram parts', () => {
    assert.ok(lesson.flashcards.every((f) => f.front && f.back));
    assert.ok(lesson.diagram.parts.length >= 3);
    assert.ok(lesson.diagram.parts.every((p) => p.id && p.label));
  });

  it('accepts the question / correctIndex spelling too and fixes out-of-range answers', () => {
    const l = api.normalizeLesson(
      { topic: 'X', keyPoints: ['a'], quiz: [{ question: 'Q?', options: ['a', 'b'], correctIndex: 9 }] },
      ctx
    );
    assert.equal(l.quiz[0].question, 'Q?');
    assert.equal(l.quiz[0].correctIndex, 0);
  });

  it('returns null when the brain sent nothing usable', () => {
    assert.equal(api.normalizeLesson({ topic: 'Empty' }, ctx), null);
    assert.equal(api.normalizeLesson(null, ctx), null);
  });

  it('reads the class from the learner profile', () => {
    assert.equal(api.gradeFromBand('class-7'), '7');
    assert.equal(api.gradeFromBand('Grade 10'), '10');
    assert.equal(api.gradeFromBand(undefined), '6');
  });
});

describe('Fetching lessons and podcasts', () => {
  it('asks the study visualizer with question, answer, class and language, retrying once', async () => {
    const { api } = lessonApi();
    const calls = mockFetch([{ ok: false }, { body: [sample] }]);
    const lesson = await api.fetchStudyLesson({ ...ctx, language: 'hi' });
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/webhook\/appu-study-visualizer$/);
    assert.deepEqual(calls[0].body, { question: ctx.question, answer: ctx.answer, grade: '6', language: 'hi' });
    assert.equal(lesson.topic, 'Photosynthesis');
    assert.equal(api.getLesson('m1').topic, 'Photosynthesis', 'lesson can be opened again by id');
  });

  it('gives up quietly after two failed tries', async () => {
    const { api } = lessonApi();
    mockFetch([new Error('offline'), new Error('offline')]);
    assert.equal(await api.fetchStudyLesson(ctx), null);
  });

  it('saves the podcast narration (ElevenLabs audio) to a local file', async () => {
    const { api, fs } = lessonApi();
    const lesson = api.normalizeLesson(sample, ctx);
    mockFetch([{ body: { title: 'Plants cook!', script: 'Hello', segments: [{ label: 'Intro', text: 'Hello' }], audio_base64: 'data:audio/mpeg;base64,QUJD' } }]);
    const ep = await api.fetchPodcast(lesson);
    assert.equal(ep.title, 'Plants cook!');
    assert.equal(ep.segments.length, 1);
    assert.equal(ep.audioUri, 'file:///cache/appu-podcast-m1.mp3');
    assert.equal(fs.files.get(ep.audioUri), 'QUJD', 'data URL prefix is removed');
  });

  it('shows the script without audio when the brain returned no narration (never device voice)', async () => {
    const { api } = lessonApi();
    const lesson = api.normalizeLesson(sample, ctx);
    mockFetch([{ body: { script: 'Only words here.' } }]);
    const ep = await api.fetchPodcast(lesson);
    assert.equal(ep.audioUri, null);
    assert.deepEqual(ep.segments, [{ label: 'Lesson', text: 'Only words here.' }]);
  });

  it('returns null for an empty podcast', async () => {
    const { api } = lessonApi();
    const lesson = api.normalizeLesson(sample, ctx);
    mockFetch([{ body: {} }]);
    assert.equal(await api.fetchPodcast(lesson), null);
  });
});
