/**
 * Study lessons for a chat answer: the same n8n "Study Visualizer" and "Podcast" brains the
 * website uses (frontend/lesson-card-renderer.js fetchStudyVisualizer / fetchPodcast).
 */
import * as FileSystem from 'expo-file-system/legacy';

const N8N_BASE = 'https://n8n.srv1871828.hstgr.cloud/webhook';

export interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface MindMapBranch {
  label: string;
  children: string[];
}

export interface DiagramPart {
  id: string;
  label: string;
  explanation: string;
}

export interface StudyLesson {
  id: string;
  question: string;
  answer: string;
  grade: string;
  language: string;
  topic: string;
  citation: string;
  analogy: string;
  keyPoints: string[];
  steps: string[];
  mindMap: { central: string; branches: MindMapBranch[] };
  quiz: QuizItem[];
  flashcards: Flashcard[];
  diagram: { title: string; parts: DiagramPart[] } | null;
}

export interface PodcastEpisode {
  title: string;
  segments: { label: string; text: string }[];
  audioUri: string | null; // local file with APPU's ElevenLabs narration, when the brain returned it
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(typeof x === 'string' ? x : '')).filter(Boolean) : [];

/** Extracts the class number from a child's grade band ("class-6", "Grade 6", "6"). */
export function gradeFromBand(gradeBand?: string | null): string {
  const m = String(gradeBand || '').match(/\d{1,2}/);
  return m ? m[0] : '6';
}

async function postJson(path: string, body: object, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${N8N_BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obj = Array.isArray(data) ? data[0] : data?.data || data?.body || data;
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeLesson(
  raw: any,
  ctx: { id: string; question: string; answer: string; grade: string; language: string }
): StudyLesson | null {
  if (!raw || typeof raw !== 'object') return null;
  const topic = str(raw.topic) || 'Lesson';
  const branches: MindMapBranch[] = Array.isArray(raw.mindMap?.branches)
    ? raw.mindMap.branches
        .map((b: any) => ({ label: str(b?.label), children: strList(b?.children) }))
        .filter((b: MindMapBranch) => b.label)
    : [];
  const quiz: QuizItem[] = Array.isArray(raw.quiz)
    ? raw.quiz
        .map((q: any) => {
          const options = strList(q?.options);
          const idx = typeof q?.answerIndex === 'number' ? q.answerIndex : q?.correctIndex;
          return {
            question: str(q?.q) || str(q?.question),
            options,
            correctIndex: typeof idx === 'number' && idx >= 0 && idx < options.length ? idx : 0,
            explanation: str(q?.explain) || str(q?.explanation),
          };
        })
        .filter((q: QuizItem) => q.question && q.options.length >= 2)
    : [];
  const flashcards: Flashcard[] = Array.isArray(raw.flashcards)
    ? raw.flashcards
        .map((f: any) => ({ front: str(f?.front), back: str(f?.back) }))
        .filter((f: Flashcard) => f.front && f.back)
    : [];
  const parts: DiagramPart[] = Array.isArray(raw.diagram?.parts)
    ? raw.diagram.parts
        .map((p: any, i: number) => ({
          id: str(p?.id) || `p${i + 1}`,
          label: str(p?.label),
          explanation: str(p?.explanation),
        }))
        .filter((p: DiagramPart) => p.label)
    : [];

  const lesson: StudyLesson = {
    ...ctx,
    topic,
    citation: str(raw.citation?.label) || str(raw.citation),
    analogy: str(raw.analogy),
    keyPoints: strList(raw.keyPoints),
    steps: strList(raw.steps).map((s) => s.replace(/^\d+\.\s*/, '')),
    mindMap: { central: str(raw.mindMap?.central) || topic, branches },
    quiz,
    flashcards,
    diagram: parts.length ? { title: str(raw.diagram?.title) || topic, parts } : null,
  };
  const hasContent =
    lesson.keyPoints.length || lesson.steps.length || branches.length || quiz.length || flashcards.length;
  return hasContent ? lesson : null;
}

// Lessons are kept in memory for this app session so screens can open them by id.
const lessons = new Map<string, StudyLesson>();
export const getLesson = (id: string) => lessons.get(id) || null;
export const registerLesson = (lesson: StudyLesson) => {
  lessons.set(lesson.id, lesson);
};

/** Builds the study lesson for one chat answer. Returns null if the brain had nothing usable. */
export async function fetchStudyLesson(params: {
  id: string;
  question: string;
  answer: string;
  grade: string;
  language: string;
}): Promise<StudyLesson | null> {
  if (!params.question.trim()) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await postJson(
      'appu-study-visualizer',
      { question: params.question, answer: params.answer, grade: params.grade, language: params.language },
      30000
    );
    const lesson = normalizeLesson(raw, params);
    if (lesson) {
      lessons.set(lesson.id, lesson);
      return lesson;
    }
  }
  return null;
}

/** Asks the podcast brain for a short audio lesson narrated in APPU's voice. */
export async function fetchPodcast(lesson: StudyLesson): Promise<PodcastEpisode | null> {
  const raw = await postJson(
    'appu-podcast',
    {
      topic: lesson.topic,
      question: lesson.question,
      answer: lesson.answer,
      grade: lesson.grade,
      language: lesson.language,
    },
    60000
  );
  if (!raw) return null;
  const script = str(raw.script);
  let segments = Array.isArray(raw.segments)
    ? raw.segments
        .map((s: any) => ({ label: str(s?.label), text: str(s?.text) }))
        .filter((s: { label: string; text: string }) => s.text)
    : [];
  if (!segments.length && script) segments = [{ label: 'Lesson', text: script }];
  if (!segments.length) return null;

  let audioUri: string | null = null;
  const b64 = str(raw.audio_base64) || str(raw.audioBase64) || str(raw.audio);
  if (b64 && FileSystem.cacheDirectory) {
    const data = b64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
    audioUri = `${FileSystem.cacheDirectory}appu-podcast-${lesson.id}.mp3`;
    try {
      await FileSystem.writeAsStringAsync(audioUri, data, { encoding: FileSystem.EncodingType.Base64 });
    } catch {
      audioUri = null;
    }
  }
  return { title: str(raw.title) || `${lesson.topic} (Audio Lesson)`, segments, audioUri };
}
