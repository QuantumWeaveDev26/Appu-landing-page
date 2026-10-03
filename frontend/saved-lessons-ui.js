/**
 * SavedLessonsUI: Persistent Study Lessons & WhatsApp Sharing Controller (Appu 2.0)
 *
 * Scope v1 (Frontend-only, no backend needed):
 * 1) PERSIST: Saves generated study cards (lesson/mindmap/steps/keyPoints/quiz/flashcards)
 *    to localStorage as a "recent lessons" list (cap 20, newest first).
 *    Works seamlessly for guests and authenticated learners.
 * 2) REVISIT: Provides "My Learning" drawer sheet accessible from the ☰ nav drawer.
 *    Tapping any saved lesson re-renders that exact card on the stage via LessonCardRenderer
 *    with ZERO network re-fetch.
 * 3) SHARE: Generates clean, structured WhatsApp study summaries (Topic, 3-6 key points,
 *    steps, NCERT citation line) and opens wa.me links directly.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SavedLessonsUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'appu_saved_lessons_v1';
  const MAX_LESSONS = 20;
  const DEFAULT_SHARE_PHONE = '919740595677';

  let _initialized = false;

  /**
   * Safe localStorage helper with in-memory fallback for testing or disabled storage
   */
  let _memoryFallback = null;

  function getStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch (e) {
      // Storage restricted
    }
    if (!_memoryFallback) {
      const store = new Map();
      _memoryFallback = {
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        setItem(k, v) { store.set(k, String(v)); },
        removeItem(k) { store.delete(k); },
        clear() { store.clear(); }
      };
    }
    return _memoryFallback;
  }

  /**
   * Retrieves all saved lessons from storage (newest first).
   * @returns {Array<Object>}
   */
  function getSavedLessons() {
    try {
      const storage = getStorage();
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[SavedLessonsUI] Failed to read lessons from storage:', err);
      return [];
    }
  }

  /**
   * Extracts a short snippet preview from card content.
   */
  function extractShortSnippet(card) {
    if (!card) return '';
    if (card.studyGuide && Array.isArray(card.studyGuide.keyPoints) && card.studyGuide.keyPoints.length > 0) {
      return String(card.studyGuide.keyPoints[0]).trim();
    }
    if (card.blocks && Array.isArray(card.blocks)) {
      const hook = card.blocks.find(b => b.type === 'hook' && b.text);
      if (hook) return hook.text.trim();
      const steps = card.blocks.find(b => b.type === 'steps' && Array.isArray(b.items) && b.items[0]);
      if (steps) {
        const item = steps.items[0];
        return typeof item === 'string' ? item : (item.text || item.title || '');
      }
    }
    if (card.plainText) {
      const firstSentence = card.plainText.split(/(?<=[.!?])\s+/)[0] || '';
      return firstSentence.replace(/^[-*•]\s*/, '').trim().slice(0, 110);
    }
    return '';
  }

  /**
   * Saves a generated study card to localStorage.
   * Enforces 20-lesson cap and moves duplicate topics to top.
   *
   * @param {Object} lessonCard - Full study card JSON
   * @param {Object} [metadata={}] - Optional override grade, language, topic
   * @returns {Object|null} The saved entry object
   */
  function saveLesson(lessonCard, metadata = {}) {
    if (!lessonCard || typeof lessonCard !== 'object') return null;
    // Don't save loading states or empty cards
    if (lessonCard.isLoading || lessonCard.__isLoading) return null;

    const topic = (
      lessonCard.topic ||
      lessonCard.title ||
      (lessonCard.mindMap && lessonCard.mindMap.central) ||
      lessonCard.question ||
      metadata.topic ||
      ''
    ).trim();

    const plainText = (lessonCard.plainText || '').trim();
    if (!topic && !plainText && !lessonCard.blocks && !lessonCard.mindMap) {
      return null;
    }

    try {
      const list = getSavedLessons();
      const id = lessonCard.id || metadata.id || `sl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const knownGrade = (typeof window !== 'undefined' && window.getActiveChildGrade && typeof window.getActiveChildGrade === 'function')
        ? window.getActiveChildGrade()
        : ((typeof window !== 'undefined' && window.appuSession && typeof window.appuSession.getGrade === 'function')
            ? window.appuSession.getGrade()
            : null);
      const grade = metadata.grade || (knownGrade ? (lessonCard.grade || knownGrade) : (lessonCard.grade && lessonCard.grade !== '6' ? lessonCard.grade : null));
      const language = metadata.language || lessonCard.language || (typeof window !== 'undefined' && window.app && window.app.currentLang) || 'en';
      const timestamp = metadata.timestamp || Date.now();

      // Deep clone card to prevent external mutation
      let cardClone;
      try {
        cardClone = JSON.parse(JSON.stringify(lessonCard));
      } catch (cloneErr) {
        console.warn('[SavedLessonsUI] JSON.stringify clone failed, falling back to clean clone:', cloneErr);
        cardClone = Object.assign({}, lessonCard);
        if (cardClone.diagram) cardClone.diagram = Object.assign({}, cardClone.diagram);
        if (cardClone.mindMap) cardClone.mindMap = Object.assign({}, cardClone.mindMap);
      }

      // Defense-in-depth: Never persist heavy base64 image data URLs or runtime promises in localStorage (~1.2MB quota safety)
      if (cardClone.diagram) {
        delete cardClone.diagram.imageUrl;
        delete cardClone.diagram.illustrationUrl;
        delete cardClone.diagram.__diagramIllustrationUrl;
        delete cardClone.diagram.__diagramIllustrationPromise;
      }
      delete cardClone.imageUrl;
      delete cardClone.illustrationUrl;
      delete cardClone.__diagramIllustrationUrl;
      delete cardClone.__diagramIllustrationPromise;
      delete cardClone.__isFetchingPodcast;
      delete cardClone.__langVariants;

      // Deduplicate: same ID or same topic with matching text or recent turn (< 15 mins)
      const existingIdx = list.findIndex(item => {
        if (item.id === id) return true;
        if (item.topic && topic && item.topic.toLowerCase() === topic.toLowerCase()) {
          const itemText = item.card?.plainText || '';
          if (itemText === plainText || Math.abs(item.timestamp - timestamp) < 15 * 60 * 1000) {
            return true;
          }
        }
        return false;
      });

      const entry = {
        id,
        topic: topic || 'Study Lesson',
        timestamp,
        grade,
        language,
        card: cardClone,
        citation: lessonCard.citation || null,
        summaryPreview: extractShortSnippet(cardClone)
      };

      if (existingIdx >= 0) {
        list.splice(existingIdx, 1);
      }
      list.unshift(entry);

      if (list.length > MAX_LESSONS) {
        list.length = MAX_LESSONS;
      }

      const storage = getStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify(list));

      notifyUpdate();
      return entry;
    } catch (err) {
      console.warn('[SavedLessonsUI] Failed to save lesson:', err);
      return null;
    }
  }

  /**
   * Removes a saved lesson by ID.
   * @param {string} id
   * @returns {boolean}
   */
  function removeSavedLesson(id) {
    if (!id) return false;
    try {
      const list = getSavedLessons();
      const initialLen = list.length;
      const filtered = list.filter(item => item.id !== id);
      if (filtered.length !== initialLen) {
        const storage = getStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        notifyUpdate();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[SavedLessonsUI] Failed to remove lesson:', err);
      return false;
    }
  }

  /**
   * Finds a saved lesson matching a card or string ID.
   * @param {Object|string} cardOrId
   * @returns {Object|null}
   */
  function findSavedLesson(cardOrId) {
    if (!cardOrId) return null;
    const list = getSavedLessons();
    if (typeof cardOrId === 'string') {
      return list.find(item => item.id === cardOrId) || null;
    }
    const card = cardOrId;
    const id = card.id || card._id || '';
    const topic = (card.topic || card.title || (card.mindMap && card.mindMap.central) || card.question || '').trim().toLowerCase();
    const plainText = (card.plainText || '').trim();

    return list.find(item => {
      if (id && item.id === id) return true;
      if (topic && item.topic && item.topic.toLowerCase() === topic) {
        const itemText = (item.card && item.card.plainText) || '';
        if (!plainText || !itemText || itemText === plainText || itemText.slice(0, 40) === plainText.slice(0, 40)) {
          return true;
        }
      }
      return false;
    }) || null;
  }

  /**
   * Returns whether a lesson is currently saved.
   * @param {Object|string} cardOrId
   * @returns {boolean}
   */
  function isLessonSaved(cardOrId) {
    return Boolean(findSavedLesson(cardOrId));
  }

  /**
   * Toggles saved state for a card: saves if not present, removes if already present.
   * @param {Object} card
   * @param {Object} [meta={}]
   * @returns {{isSaved: boolean, entry: Object|null}}
   */
  function toggleSaveLesson(card, meta = {}) {
    if (!card) return { isSaved: false, entry: null };
    try {
      const existing = findSavedLesson(card);
      if (existing) {
        removeSavedLesson(existing.id);
        return { isSaved: false, entry: null };
      } else {
        const entry = saveLesson(card, meta);
        return { isSaved: Boolean(entry), entry };
      }
    } catch (err) {
      console.warn('[SavedLessonsUI] Error in toggleSaveLesson:', err);
      return { isSaved: false, entry: null };
    }
  }

  /**
   * Clears all saved lessons.
   * @returns {boolean}
   */
  function clearSavedLessons() {
    try {
      const storage = getStorage();
      storage.removeItem(STORAGE_KEY);
      notifyUpdate();
      return true;
    } catch (err) {
      console.warn('[SavedLessonsUI] Failed to clear lessons:', err);
      return false;
    }
  }

  /**
   * Constructs a clean text summary formatted for WhatsApp:
   * Topic, 3-6 key points, steps, and the NCERT citation line.
   *
   * @param {Object} card - Study card object
   * @param {string} [childName=''] - Learner's name
   * @returns {string} Clean WhatsApp markdown formatted message
   */
  function formatLessonWhatsAppSummary(card, childName = '') {
    if (!card) return '';
    const topic = (
      card.topic ||
      card.title ||
      (card.mindMap && card.mindMap.central) ||
      card.question ||
      'Study Concept'
    ).trim();

    // 1. Key Points extraction (3 to 6 concise bullets)
    let keyPoints = [];
    if (card.studyGuide && Array.isArray(card.studyGuide.keyPoints) && card.studyGuide.keyPoints.length > 0) {
      keyPoints = card.studyGuide.keyPoints.map(p => String(p).trim()).filter(Boolean);
    } else if (Array.isArray(card.keyPoints) && card.keyPoints.length > 0) {
      keyPoints = card.keyPoints.map(p => String(p).trim()).filter(Boolean);
    } else if (card.blocks && Array.isArray(card.blocks)) {
      card.blocks.forEach(b => {
        if (b.type === 'analogy' && b.analogy) {
          keyPoints.push(`Analogy: ${b.analogy.trim()}`);
        }
        if (b.type === 'hook' && b.text) {
          keyPoints.push(b.text.trim());
        }
      });
    }

    if (keyPoints.length === 0 && card.plainText) {
      const sentences = card.plainText
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim().replace(/^[-*•]\s*/, ''))
        .filter(s => s.length > 15 && s.length < 130 && !s.includes('http'));
      keyPoints = sentences.slice(0, 4);
    }
    keyPoints = keyPoints.slice(0, 5);

    // 2. Steps extraction
    let steps = [];
    if (card.blocks && Array.isArray(card.blocks)) {
      const stepBlock = card.blocks.find(b => b.type === 'steps' && Array.isArray(b.items));
      if (stepBlock && stepBlock.items.length > 0) {
        steps = stepBlock.items.map(st => {
          if (typeof st === 'string') return st.trim();
          return (st.title ? `${st.title}: ` : '') + (st.text || st.desc || '');
        }).filter(Boolean);
      }
    }
    if (steps.length === 0 && card.studyGuide && Array.isArray(card.studyGuide.steps)) {
      steps = card.studyGuide.steps.map(s => String(s).trim()).filter(Boolean);
    }
    steps = steps.slice(0, 4);

    // 3. Citation extraction
    let citationLine = '';
    if (card.citation) {
      if (typeof card.citation === 'string') {
        citationLine = card.citation.trim();
      } else if (typeof card.citation === 'object') {
        citationLine = card.citation.label || card.citation.text || '';
      }
    }

    // 4. Assemble message with standard educational format
    const resolvedChild = (typeof childName === 'string' && childName.trim())
      ? childName.trim()
      : ((typeof window !== 'undefined' && window.appuSession && typeof window.appuSession.getChildName === 'function' && window.appuSession.getChildName()) || '');

    const header = resolvedChild
      ? `*Study note from ${resolvedChild} (via APPU):*`
      : `*Study note from APPU:*`;

    const lines = [header, `📚 *Topic:* ${topic}`];

    if (keyPoints.length > 0) {
      lines.push('\n💡 *Key Points:*');
      keyPoints.forEach(kp => {
        // Strip markdown backticks, internal tags, and emojis
        const cleanKp = kp.replace(/<[^>]+>/g, '').replace(/[`*]/g, '').trim();
        lines.push(`• ${cleanKp}`);
      });
    }

    if (steps.length > 0) {
      lines.push('\n🎯 *Steps:*');
      steps.forEach((st, i) => {
        const cleanSt = st.replace(/<[^>]+>/g, '').replace(/[`*]/g, '').trim();
        lines.push(`${i + 1}. ${cleanSt}`);
      });
    }

    if (citationLine) {
      lines.push(`\n📖 *Source:* ${citationLine}`);
    }

    lines.push('\n_Shared via APPU Learning Companion_');

    let fullMessage = lines.join('\n');

    // Enforce URL param budget (< 500 characters) for instant reliable WhatsApp deep link
    if (fullMessage.length > 490) {
      const budgetLines = [header, `📚 *Topic:* ${topic}`];
      if (keyPoints.length > 0) {
        budgetLines.push('\n💡 *Key Points:*');
        keyPoints.slice(0, 3).forEach(kp => {
          budgetLines.push(`• ${kp.slice(0, 75).trim()}`);
        });
      }
      if (steps.length > 0) {
        budgetLines.push('\n🎯 *Steps:*');
        steps.slice(0, 2).forEach((st, i) => {
          budgetLines.push(`${i + 1}. ${st.slice(0, 65).trim()}`);
        });
      }
      if (citationLine) {
        budgetLines.push(`\n📖 *Source:* ${citationLine.slice(0, 45).trim()}`);
      }
      budgetLines.push('\n_Shared via APPU Learning Companion_');
      fullMessage = budgetLines.join('\n');
      if (fullMessage.length > 495) {
        fullMessage = fullMessage.slice(0, 492) + '...';
      }
    }

    return fullMessage;
  }

  /**
   * Constructs a wa.me sharing link.
   * @param {Object} card
   * @param {string} [targetPhone='919740595677']
   * @param {string} [childName='']
   * @returns {string|null}
   */
  function buildWhatsAppShareUrl(card, targetPhone = DEFAULT_SHARE_PHONE, childName = '') {
    const summary = formatLessonWhatsAppSummary(card, childName);
    if (!summary) return null;
    const raw = (typeof targetPhone === 'string' && targetPhone.trim()) ? targetPhone : DEFAULT_SHARE_PHONE;
    const cleanPhone = raw.replace(/\D/g, '') || DEFAULT_SHARE_PHONE;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(summary)}`;
  }

  /**
   * Opens WhatsApp with the lesson summary.
   * @param {Object} card
   * @param {string} [targetPhone]
   * @returns {boolean}
   */
  function shareLessonToWhatsApp(card, targetPhone = DEFAULT_SHARE_PHONE) {
    const url = buildWhatsAppShareUrl(card, targetPhone);
    if (!url) return false;
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  }

  /**
   * Reopens and renders an exact saved lesson card on the stage with ZERO network re-fetch.
   * @param {string|Object} savedLessonOrId
   * @returns {boolean}
   */
  function reopenLesson(savedLessonOrId) {
    let item = savedLessonOrId;
    if (typeof savedLessonOrId === 'string') {
      const list = getSavedLessons();
      item = list.find(l => l.id === savedLessonOrId);
    }
    if (!item || !item.card) return false;

    closePanel();

    if (typeof document !== 'undefined') {
      const navDrawer = document.getElementById('nav-drawer');
      const navScrim = document.getElementById('nav-drawer-scrim');
      if (navDrawer) navDrawer.classList.remove('is-open');
      if (navScrim) navScrim.classList.remove('is-open');
    }

    if (typeof window !== 'undefined' && window.app && typeof window.app.showVoicePopup === 'function') {
      window.app.showVoicePopup(item.card.plainText || '', item.card, 'lesson');
      return true;
    } else if (typeof window !== 'undefined' && typeof window.showVoicePopup === 'function') {
      window.showVoicePopup(item.card.plainText || '', item.card, 'lesson');
      return true;
    }
    return false;
  }

  /**
   * Dispatches updates and synchronizes badge counts across open UI views.
   */
  function notifyUpdate() {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('appu:saved-lessons-updated', { detail: { lessons: getSavedLessons() } }));
    }
    updateBadgeCounters();
    if (isPanelOpen()) {
      renderSavedList();
    }
  }

  /**
   * Synchronizes count pills in the UI.
   */
  function updateBadgeCounters() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const count = getSavedLessons().length;
    const navPill = document.getElementById('nav-drawer-saved-count');
    if (navPill) {
      navPill.textContent = String(count);
      navPill.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    const topbarPill = document.getElementById('topbar-saved-count');
    if (topbarPill) {
      topbarPill.textContent = String(count);
      topbarPill.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    const panelBadge = document.getElementById('saved-lessons-count-badge');
    if (panelBadge) {
      panelBadge.textContent = `${count} saved`;
    }
  }

  function isPanelOpen() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return false;
    const panel = document.getElementById('saved-lessons-panel');
    return Boolean(panel && panel.classList.contains('is-open'));
  }

  /**
   * Opens the "My Learning" drawer sheet.
   */
  function openPanel() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('saved-lessons-panel');
    const scrim = document.getElementById('saved-lessons-scrim');
    const navDrawer = document.getElementById('nav-drawer');
    const navScrim = document.getElementById('nav-drawer-scrim');

    // Close nav drawer if open
    if (navDrawer) navDrawer.classList.remove('is-open');
    if (navScrim) navScrim.classList.remove('is-open');

    if (scrim) {
      scrim.style.display = 'block';
      void scrim.offsetWidth;
      scrim.classList.add('is-open');
    }

    if (panel) {
      panel.style.display = 'flex';
      void panel.offsetWidth;
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
    }

    renderSavedList();
    updateBadgeCounters();
  }

  /**
   * Closes the "My Learning" drawer sheet.
   */
  function closePanel() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('saved-lessons-panel');
    const scrim = document.getElementById('saved-lessons-scrim');
    if (panel) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        if (panel && !panel.classList.contains('is-open')) {
          panel.style.display = 'none';
        }
      }, 350);
    }
    if (scrim) {
      scrim.classList.remove('is-open');
      setTimeout(() => {
        if (scrim && !scrim.classList.contains('is-open')) {
          scrim.style.display = 'none';
        }
      }, 300);
    }
  }

  /**
   * Formats relative date/time for kids.
   */
  function formatRelativeDate(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Today, ${timeStr}`;
      }
      return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${timeStr}`;
    } catch (e) {
      return '';
    }
  }

  /**
   * Renders the saved lesson cards into the panel list container.
   */
  function renderSavedCard(item) {
    if (typeof document === 'undefined') return null;
    const cardEl = document.createElement('article');
    cardEl.className = 'saved-lesson-card';
    cardEl.setAttribute('data-lesson-id', item.id);

    const dateStr = formatRelativeDate(item.timestamp);
    const snippet = item.summaryPreview || '';
    const citationStr = item.citation ? (typeof item.citation === 'string' ? item.citation : (item.citation.label || item.citation.text || '')) : '';

    // Determine available modes for feature chips
    const hasMindMap = Boolean(item.card?.mindMap);
    const hasDiagram = Boolean(item.card?.diagram && Array.isArray(item.card.diagram.parts) && item.card.diagram.parts.length > 0);
    const hasQuiz = Boolean(item.card?.quizItems && item.card.quizItems.length > 0);
    const hasFlashcards = Boolean(item.card?.flashcards && item.card.flashcards.length > 0);
    const hasGuide = Boolean(item.card?.studyGuide);
    const hasPodcast = Boolean(item.card?.podcastScript);

    let chipsHtml = '';
    if (hasMindMap) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-diagram-project"></i> Mind Map</span>`;
    if (hasDiagram) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-shapes"></i> Diagram</span>`;
    if (hasQuiz) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-flask-vial"></i> Quiz</span>`;
    if (hasFlashcards) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-layer-group"></i> Flashcards</span>`;
    if (hasGuide) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-book-open-reader"></i> Guide</span>`;
    if (hasPodcast) chipsHtml += `<span class="saved-mode-pill"><i class="fa-solid fa-headphones"></i> Podcast</span>`;

    const gradeLabel = item.grade ? `Class ${item.grade}` : 'Appu Lesson';
    cardEl.innerHTML = `
      <div class="saved-card-header">
        <div class="saved-card-title-group">
          <span class="saved-card-tag"><i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(gradeLabel)}</span>
          <h3 class="saved-card-title">${escapeHTML(item.topic || 'Study Lesson')}</h3>
        </div>
        <span class="saved-card-date">${dateStr}</span>
      </div>
      ${snippet ? `<p class="saved-card-snippet">${escapeHTML(snippet)}</p>` : ''}
      ${citationStr ? `<div class="saved-card-citation"><i class="fa-solid fa-bookmark text-cyan"></i> <span>${escapeHTML(citationStr)}</span></div>` : ''}
      ${chipsHtml ? `<div class="saved-card-chips">${chipsHtml}</div>` : ''}
      <div class="saved-card-actions">
        <button type="button" class="btn-saved-study" title="Open lesson on stage">
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          <span>Study Lesson</span>
        </button>
        <button type="button" class="btn-saved-share" title="Share lesson notes via WhatsApp">
          <i class="fa-brands fa-whatsapp text-whatsapp" aria-hidden="true"></i>
          <span>Send to WhatsApp</span>
        </button>
        <button type="button" class="btn-saved-delete" aria-label="Remove saved lesson" title="Remove">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    `;

    // Wire button actions
    const studyBtn = cardEl.querySelector('.btn-saved-study');
    if (studyBtn) {
      studyBtn.addEventListener('click', () => {
        reopenLesson(item);
      });
    }

    const shareBtn = cardEl.querySelector('.btn-saved-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        shareLessonToWhatsApp(item.card);
      });
    }

    const deleteBtn = cardEl.querySelector('.btn-saved-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        removeSavedLesson(item.id);
      });
    }

    return cardEl;
  }

  function renderSavedList() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('saved-lessons-list');
    if (!container) return;

    const lessons = getSavedLessons();
    container.innerHTML = '';

    if (lessons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'saved-lessons-empty';
      empty.innerHTML = `
        <div class="saved-empty-icon" aria-hidden="true"><i class="fa-solid fa-bookmark"></i></div>
        <h3>No saved lessons yet</h3>
        <p>Lessons and mind maps you explore with Appu will automatically save here so you can revisit them anytime.</p>
        <button type="button" class="btn-saved-empty-explore" id="btn-saved-empty-explore">
          <i class="fa-solid fa-compass" aria-hidden="true"></i>
          <span>Ask Appu a Topic</span>
        </button>
      `;
      container.appendChild(empty);

      const exploreBtn = empty.querySelector('#btn-saved-empty-explore');
      if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
          closePanel();
          const chatInput = document.getElementById('chat-input') || document.getElementById('dock-text-input');
          if (chatInput) {
            chatInput.focus();
          }
        });
      }
      return;
    }

    lessons.forEach(item => {
      const cardEl = renderSavedCard(item);
      if (cardEl) container.appendChild(cardEl);
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Initializes DOM bindings for Nav Drawer "My Learning" and Saved Lessons panel.
   */
  function init() {
    if (_initialized || typeof document === 'undefined') return;
    _initialized = true;

    // Ensure off-canvas and hidden initially
    const initPanel = document.getElementById('saved-lessons-panel');
    const initScrim = document.getElementById('saved-lessons-scrim');
    if (initPanel && !initPanel.classList.contains('is-open')) {
      initPanel.style.display = 'none';
      initPanel.setAttribute('aria-hidden', 'true');
    }
    if (initScrim && !initScrim.classList.contains('is-open')) {
      initScrim.style.display = 'none';
    }

    // 1) Bind Nav Drawer & Desktop Topbar trigger buttons
    const navTrigger = document.getElementById('btn-drawer-saved-lessons');
    if (navTrigger) {
      navTrigger.addEventListener('click', () => {
        openPanel();
      });
    }

    const topbarTrigger = document.getElementById('btn-topbar-saved-lessons');
    if (topbarTrigger) {
      topbarTrigger.addEventListener('click', () => {
        openPanel();
      });
    }

    // 2) Bind panel close buttons
    const closeBtn = document.getElementById('btn-close-saved-lessons');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closePanel();
      });
    }

    const scrim = document.getElementById('saved-lessons-scrim');
    if (scrim) {
      scrim.addEventListener('click', () => {
        closePanel();
      });
    }

    // 3) Keyboard Escape dismiss
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPanelOpen()) {
        closePanel();
      }
    });

    // 4) Initial counter update
    updateBadgeCounters();
  }

  // Auto-init on DOMContentLoaded if running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    STORAGE_KEY,
    MAX_LESSONS,
    DEFAULT_SHARE_PHONE,
    getSavedLessons,
    saveLesson,
    removeSavedLesson,
    findSavedLesson,
    isLessonSaved,
    toggleSaveLesson,
    clearSavedLessons,
    formatLessonWhatsAppSummary,
    buildWhatsAppShareUrl,
    shareLessonToWhatsApp,
    reopenLesson,
    openPanel,
    closePanel,
    renderSavedList,
    renderSavedCard,
    updateBadgeCounters,
    init
  };
});
