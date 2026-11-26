const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { load } = require('./helpers/load.cjs');

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function setup({ picked, files = {} } = {}) {
  const written = new Map();
  const fs = {
    cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64' },
    readAsStringAsync: async (uri) => files[uri],
    writeAsStringAsync: async (uri, data) => void written.set(uri, data),
  };
  const mod = load('lessons/attachments.ts', {
    'expo-file-system/legacy': fs,
    'expo-document-picker': { getDocumentAsync: async () => picked },
    'expo-image-picker': {},
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      manipulateAsync: async (uri) => ({ uri: `${uri}.small.jpg`, base64: 'SMALL' }),
    },
  });
  return { mod, written };
}

const asset = (name, mimeType, uri = `file:///${name}`) => ({ canceled: false, assets: [{ name, mimeType, uri }] });

async function docxBase64(paragraphs) {
  const zip = new JSZip();
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'base64' });
}

describe('Notes upload', () => {
  it('reads a Word (.docx) file', async () => {
    const b64 = await docxBase64(['Photosynthesis &amp; plants', 'Chlorophyll traps sunlight in leaves.']);
    const { mod } = setup({ picked: asset('science.docx', 'application/octet-stream'), files: { 'file:///science.docx': b64 } });
    const res = await mod.pickNotesFile();
    assert.equal(res.kind, 'doc');
    assert.equal(res.doc.name, 'science.docx');
    assert.match(res.doc.text, /Photosynthesis & plants\nChlorophyll traps sunlight/);
  });

  it('reads a PDF through the n8n text extractor', async () => {
    const calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ text: 'Newton\'s first law: an object stays at rest unless a force acts.' }) };
    };
    const { mod } = setup({ picked: asset('physics.pdf', 'application/pdf'), files: { 'file:///physics.pdf': 'UERGREFUQQ==' } });
    const res = await mod.pickNotesFile();
    assert.match(calls[0].url, /\/webhook\/appu-extract-document$/);
    assert.equal(calls[0].body.fileBase64, 'UERGREFUQQ==');
    assert.match(res.doc.text, /Newton/);
  });

  it('explains when a PDF has no readable text (a scan)', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ text: '' }) });
    const { mod } = setup({ picked: asset('scan.pdf', 'application/pdf'), files: { 'file:///scan.pdf': 'AAAA' } });
    await assert.rejects(mod.pickNotesFile(), /photo of the page/);
  });

  it('reads plain text notes and rejects files that are too short', async () => {
    const ok = setup({ picked: asset('notes.txt', 'text/plain'), files: { 'file:///notes.txt': 'The water cycle: evaporation, condensation, precipitation.' } });
    assert.match((await ok.mod.pickNotesFile()).doc.text, /water cycle/);
    const tiny = setup({ picked: asset('t.txt', 'text/plain'), files: { 'file:///t.txt': 'hi' } });
    await assert.rejects(tiny.mod.pickNotesFile(), /enough text/);
  });

  it('treats a picture of notes as a photo question', async () => {
    const { mod } = setup({ picked: asset('page.jpg', 'image/jpeg') });
    const res = await mod.pickNotesFile();
    assert.equal(res.kind, 'image');
    assert.equal(res.image.dataUrl, 'data:image/jpeg;base64,SMALL');
  });

  it('returns null when the learner cancels', async () => {
    const { mod } = setup({ picked: { canceled: true, assets: null } });
    assert.equal(await mod.pickNotesFile(), null);
  });
});

describe('Notes tutor', () => {
  const doc = { name: 'science.docx', text: 'Photosynthesis: plants make food with sunlight.' };

  it('asks the notes tutor and builds a lesson cited from the learner\'s notes, with APPU\'s audio', async () => {
    const calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => [{ answer: 'Plants cook food!', topic: 'Photosynthesis', keyPoints: ['Plants make food'], quiz: [{ q: 'Who makes food?', options: ['Plants', 'Rocks'], answerIndex: 0 }], audio_base64: 'QUJD' }],
      };
    };
    const { mod, written } = setup();
    const res = await mod.askNotesTutor({ id: 'n1', question: 'Teach me', doc, grade: '7', language: 'kn' });
    assert.match(calls[0].url, /\/webhook\/appu-notes-tutor$/);
    assert.deepEqual(calls[0].body, { question: 'Teach me', documentText: doc.text, grade: '7', language: 'kn' });
    assert.equal(res.answer, 'Plants cook food!');
    assert.equal(res.lesson.citation, 'Your notes: science.docx');
    assert.equal(res.lesson.quiz[0].correctIndex, 0);
    assert.equal(written.get(res.audioUri), 'QUJD');
  });

  it('shows only the safety message when the notes were refused', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ blocked: true, answer: 'I can only help with study notes.' }) });
    const { mod } = setup();
    const res = await mod.askNotesTutor({ id: 'n2', question: 'x', doc, grade: '7', language: 'en' });
    assert.equal(res.blocked, true);
    assert.equal(res.lesson, null);
  });

  it('returns null when the service is down', async () => {
    global.fetch = async () => ({ ok: false, json: async () => ({}) });
    const { mod } = setup();
    assert.equal(await mod.askNotesTutor({ id: 'n3', question: 'x', doc, grade: '7', language: 'en' }), null);
  });
});
