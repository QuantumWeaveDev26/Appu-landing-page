/**
 * AppuLearning: sends a learner's graded lesson answers and the lesson modes they open to the
 * backend learner model (POST /api/appu/learning/events), and reads / changes the parent's
 * learning-tracking consent. The backend stores nothing unless a parent switched tracking on,
 * so events from children without consent are simply dropped there.
 *
 * Lesson UI reports events with:  window.dispatchEvent(new CustomEvent('appu:learning', { detail }))
 *   detail = { source: 'lesson_quiz' | 'flashcard' | 'mode_open', topic, isCorrect?, mode?, question? }
 */
(function (root) {
  'use strict';

  const FLUSH_MS = 1500;
  const MAX_BATCH = 20;
  let queue = [];
  let timer = null;

  function apiBase() {
    const cfg = root.APPU_CONFIG;
    return cfg && typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl.replace(/\/+$/, '') : '';
  }

  function session() {
    const s = root.AppuSession;
    if (s && typeof s.isAuthenticated === 'function' && s.isAuthenticated()) {
      return { accessToken: s.accessToken, childId: s.childId };
    }
    // Parent Zone before a learner session starts: the parent's own sign-in.
    const shell = root.ParentOnboardingShell;
    const token = shell && shell.state && shell.state.session && shell.state.session.access_token;
    return token ? { accessToken: token, childId: null } : null;
  }

  async function call(path, method, body) {
    const s = session();
    if (!s) return null;
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        method,
        headers: { Authorization: `Bearer ${s.accessToken}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      return res.ok ? await res.json().catch(() => ({})) : null;
    } catch {
      return null;
    }
  }

  function clean(detail) {
    if (!detail || typeof detail !== 'object') return null;
    const topic = String(detail.topic || '').trim().slice(0, 120);
    if (!topic || !['lesson_quiz', 'flashcard', 'mode_open'].includes(detail.source)) return null;
    const event = { source: detail.source, topic };
    if (typeof detail.isCorrect === 'boolean') event.isCorrect = detail.isCorrect;
    if (typeof detail.mode === 'string') event.mode = detail.mode;
    if (typeof detail.question === 'string' && detail.question.trim()) event.question = detail.question.trim().slice(0, 300);
    return event;
  }

  async function flush() {
    timer = null;
    const s = session();
    if (!s || !s.childId || !queue.length) {
      queue = [];
      return;
    }
    const events = queue.splice(0, MAX_BATCH);
    await call('/api/appu/learning/events', 'POST', { childId: s.childId, events });
    if (queue.length) timer = setTimeout(flush, 0);
  }

  function record(detail) {
    const event = clean(detail);
    if (!event || !(session() || {}).childId) return;
    queue.push(event);
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }

  const api = {
    record,
    flush,
    /** { consent: { granted }, model, topics } for the active child, or null. */
    getProfile(childId) {
      const s = session();
      const id = childId || (s && s.childId);
      return id ? call(`/api/children/${encodeURIComponent(id)}/learning`, 'GET') : Promise.resolve(null);
    },
    setConsent(granted, childId) {
      const s = session();
      const id = childId || (s && s.childId);
      return id
        ? call(`/api/children/${encodeURIComponent(id)}/learning-consent`, 'PUT', { granted: Boolean(granted) })
        : Promise.resolve(null);
    }
  };

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('appu:learning', (e) => record(e && e.detail));
  }
  root.AppuLearning = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
