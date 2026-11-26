/**
 * Homework photos and study notes (website: chat image attach + "Upload notes").
 * - Photos are shrunk to ≤1280 px JPEG and sent with the question (`imageBase64`).
 * - Notes (PDF, Word, text or pasted) become the learner's active document; questions then go
 *   to the n8n Notes Tutor, which teaches only from those notes.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import JSZip from 'jszip';
import { normalizeLesson, registerLesson, type StudyLesson } from './lessonApi';

const N8N_BASE = 'https://n8n.srv1871828.hstgr.cloud/webhook';
const MAX_DOC_CHARS = 16000;

export interface PendingImage {
  uri: string;
  dataUrl: string;
}

export interface NotesDocument {
  name: string;
  text: string;
}

export type PickedNotes = { kind: 'doc'; doc: NotesDocument } | { kind: 'image'; image: PendingImage };

async function shrink(uri: string): Promise<PendingImage> {
  const out = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.75,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: out.uri, dataUrl: `data:image/jpeg;base64,${out.base64}` };
}

/** Camera or gallery. Returns null if the learner cancelled; throws with a friendly message. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PendingImage | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera is blocked. Allow it in your phone settings to snap homework.'
        : 'Photos are blocked. Allow them in your phone settings to pick a picture.'
    );
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  return shrink(res.assets[0].uri);
}

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

async function docxText(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const zip = await JSZip.loadAsync(b64, { base64: true });
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return '';
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

async function pdfText(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  if (b64.length > 14000000) throw new Error('That PDF is too big. Please pick one under 10 MB.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${N8N_BASE}/appu-extract-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ fileBase64: b64 }),
      signal: controller.signal,
    });
    if (!res.ok) return '';
    const data = await res.json();
    return typeof data?.text === 'string' ? data.text : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/** PDF, Word (.docx), text/markdown, or a picture of notes. */
export async function pickNotesFile(): Promise<PickedNotes | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'image/*',
    ],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const file = res.assets[0];
  const name = file.name || 'My notes';
  const lower = name.toLowerCase();
  const mime = file.mimeType || '';

  if (mime.startsWith('image/')) return { kind: 'image', image: await shrink(file.uri) };

  let text = '';
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    text = await pdfText(file.uri);
    if (!text.trim()) {
      throw new Error("Appu couldn't read text in this PDF (it may be a scan). Take a photo of the page instead.");
    }
  } else if (lower.endsWith('.docx')) {
    text = await docxText(file.uri);
  } else {
    text = await FileSystem.readAsStringAsync(file.uri);
  }
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 20) throw new Error("This file doesn't have enough text for a lesson. Try another file.");
  return { kind: 'doc', doc: { name, text: Array.from(text).slice(0, MAX_DOC_CHARS).join('') } };
}

export interface NotesAnswer {
  answer: string;
  lesson: StudyLesson | null;
  audioUri: string | null;
  blocked: boolean;
}

/** Asks the Notes Tutor brain a question grounded only in the learner's notes. */
export async function askNotesTutor(params: {
  id: string;
  question: string;
  doc: NotesDocument;
  grade: string;
  language: string;
}): Promise<NotesAnswer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${N8N_BASE}/appu-notes-tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        question: params.question,
        documentText: params.doc.text,
        grade: params.grade,
        language: params.language,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obj = Array.isArray(data) ? data[0] : data?.data || data;
    if (!obj || typeof obj !== 'object') return null;
    const answer = typeof obj.answer === 'string' ? obj.answer.trim() : '';
    if (obj.blocked === true) return { answer, lesson: null, audioUri: null, blocked: true };

    const lesson = normalizeLesson(
      { ...obj, citation: { label: `Your notes: ${params.doc.name}` } },
      { id: params.id, question: params.question, answer, grade: params.grade, language: params.language }
    );
    if (lesson) registerLesson(lesson);

    let audioUri: string | null = null;
    const b64 = typeof obj.audio_base64 === 'string' ? obj.audio_base64.trim() : '';
    if (b64 && FileSystem.cacheDirectory) {
      audioUri = `${FileSystem.cacheDirectory}appu-notes-${params.id}.mp3`;
      try {
        await FileSystem.writeAsStringAsync(audioUri, b64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, ''), {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        audioUri = null;
      }
    }
    return { answer, lesson, audioUri, blocked: false };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
