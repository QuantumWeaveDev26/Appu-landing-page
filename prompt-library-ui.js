/**
 * PromptLibraryUI: Browsable Personalized Prompt Library Sheet
 * 
 * Provides a categorized prompt exploration drawer allowing learners to browse
 * personalized prompts (quick concepts, homework hints, curious mind, exam drills),
 * select prompts to populate #chat-input, and trigger immediate AI interactions.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PromptLibraryUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let _initialized = false;
  let _currentPrompts = [];
  let _activeCategory = 'all';
  let _isLoading = false;

  const CATEGORY_NAMES = {
    all: 'All',
    quick_concepts: 'Quick Concepts',
    homework_hints: 'Homework Hints',
    curious_mind: 'Curious Mind',
    exam_drills: 'Exam Drills'
  };

  function getPanelElement() {
    return document.getElementById('prompt-library-panel');
  }

  function getScrimElement() {
    return document.getElementById('prompt-library-scrim');
  }

  function getCardsContainer() {
    return document.getElementById('prompt-cards-container');
  }

  /**
   * Opens the prompt library panel and loads prompts if needed.
   */
  async function openPromptLibrary() {
    const panel = getPanelElement();
    const scrim = getScrimElement();
    if (!panel) return;

    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (scrim) scrim.classList.add('is-open');

    // If prompts not loaded yet, fetch them
    if (_currentPrompts.length === 0) {
      await loadPrompts();
    } else {
      renderPromptCards();
    }
  }

  /**
   * Closes the prompt library panel.
   */
  function closePromptLibrary() {
    const panel = getPanelElement();
    const scrim = getScrimElement();
    if (!panel) return;

    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (scrim) scrim.classList.remove('is-open');
  }

  /**
   * Fetches personalized prompts from backend client.
   */
  async function loadPrompts() {
    const container = getCardsContainer();
    if (container) {
      container.innerHTML = `
        <div class="prompt-library-empty" role="status">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px; color: var(--cyan-bright);" aria-hidden="true"></i>
          <p>Loading personalized prompts...</p>
        </div>
      `;
    }

    _isLoading = true;
    try {
      const client = (typeof globalThis !== 'undefined' && globalThis.AppuBackendClient) || null;
      if (!client || typeof client.fetchChildPrompts !== 'function') {
        throw new Error('Backend client unavailable');
      }

      const res = await client.fetchChildPrompts();
      if (res && Array.isArray(res.prompts)) {
        _currentPrompts = res.prompts;
      } else {
        _currentPrompts = [];
      }
    } catch (err) {
      console.warn('Could not load prompts:', err);
      _currentPrompts = [];
    } finally {
      _isLoading = false;
      renderPromptCards();
    }
  }

  /**
   * Regenerates fresh prompts via backend client.
   */
  async function handleRefresh() {
    const refreshBtn = document.getElementById('btn-refresh-prompts');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      const client = (typeof globalThis !== 'undefined' && globalThis.AppuBackendClient) || null;
      if (!client || typeof client.regenerateChildPrompts !== 'function') {
        throw new Error('Backend client unavailable');
      }

      const res = await client.regenerateChildPrompts();
      if (res && Array.isArray(res.prompts)) {
        _currentPrompts = res.prompts;
      }
    } catch (err) {
      console.warn('Could not regenerate prompts:', err);
    } finally {
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
      if (refreshBtn) refreshBtn.disabled = false;
      renderPromptCards();
    }
  }

  /**
   * Handles category filter tab changes.
   */
  function handleCategoryFilter(category) {
    _activeCategory = category;

    // Update active tab buttons
    const tabs = document.querySelectorAll('.prompt-cat-tab');
    tabs.forEach((tab) => {
      const tabCat = tab.getAttribute('data-category');
      const isSelected = tabCat === category;
      tab.classList.toggle('is-active', isSelected);
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    renderPromptCards();
  }

  /**
   * Selects a prompt: populates chat input, opens chat drawer, closes prompt panel, focuses input.
   */
  function handleSelectPrompt(promptText) {
    if (typeof globalThis !== 'undefined' && globalThis.app && typeof globalThis.app.ensureChatSessionReady === 'function') {
      if (!globalThis.app.ensureChatSessionReady(promptText)) {
        closePromptLibrary();
        return;
      }
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.value = promptText;

      if (typeof globalThis !== 'undefined' && globalThis.app && typeof globalThis.app.toggleChatDrawer === 'function') {
        globalThis.app.toggleChatDrawer(true);
      } else {
        const chatDrawer = document.getElementById('chat-drawer');
        if (chatDrawer) chatDrawer.classList.add('is-open');
      }

      closePromptLibrary();
      chatInput.focus();
    }
  }

  /**
   * Tapping inline "Ask Appu" triggers immediate AI conversation turn.
   */
  function handleDirectAsk(promptText) {
    closePromptLibrary();

    if (typeof globalThis !== 'undefined' && globalThis.app && typeof globalThis.app.handleUserInteraction === 'function') {
      globalThis.app.handleUserInteraction(promptText);
    } else {
      handleSelectPrompt(promptText);
    }
  }

  /**
   * Renders prompt cards into #prompt-cards-container.
   */
  function renderPromptCards() {
    const container = getCardsContainer();
    if (!container) return;

    const filtered = _activeCategory === 'all'
      ? _currentPrompts
      : _currentPrompts.filter((p) => p.category === _activeCategory);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="prompt-library-empty">
          <i class="fa-solid fa-lightbulb" style="font-size: 28px; margin-bottom: 12px; color: var(--muted);" aria-hidden="true"></i>
          <p>No prompt recommendations in this category yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    for (const prompt of filtered) {
      const card = document.createElement('article');
      card.className = 'prompt-card';
      card.setAttribute('data-prompt-id', prompt.id || '');
      card.setAttribute('data-category', prompt.category);

      const categoryLabel = CATEGORY_NAMES[prompt.category] || prompt.category;
      const iconClass = prompt.icon || 'fa-lightbulb';

      card.innerHTML = `
        <div class="prompt-card-top">
          <span class="prompt-card-badge badge-${prompt.category}">
            <i class="fa-solid ${iconClass}" aria-hidden="true"></i>
            <span>${categoryLabel}</span>
          </span>
        </div>
        <p class="prompt-card-text">${escapeHtml(prompt.promptText)}</p>
        <div class="prompt-card-footer">
          <button type="button" class="prompt-card-ask-btn">
            <span>Ask Appu</span>
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          </button>
        </div>
      `;

      // Entire card click -> fill chat input
      card.addEventListener('click', (e) => {
        // If clicking ask button, handle direct ask
        const askBtn = e.target.closest('.prompt-card-ask-btn');
        if (askBtn) {
          e.stopPropagation();
          handleDirectAsk(prompt.promptText);
        } else {
          handleSelectPrompt(prompt.promptText);
        }
      });

      container.appendChild(card);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Initializes event listeners and wires triggers.
   */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Trigger pill near mission deck
    const exploreBtn = document.getElementById('btn-explore-prompts');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', openPromptLibrary);
    }

    // Close button
    const closeBtn = document.getElementById('btn-close-prompt-library');
    if (closeBtn) {
      closeBtn.addEventListener('click', closePromptLibrary);
    }

    // Scrim backdrop
    const scrim = getScrimElement();
    if (scrim) {
      scrim.addEventListener('click', closePromptLibrary);
    }

    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-prompts');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleRefresh);
    }

    // Category filter tabs
    const catTabs = document.querySelectorAll('.prompt-cat-tab');
    catTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const cat = tab.getAttribute('data-category') || 'all';
        handleCategoryFilter(cat);
      });
    });

    // Escape key closes panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = getPanelElement();
        if (panel && panel.classList.contains('is-open')) {
          closePromptLibrary();
        }
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init,
    openPromptLibrary,
    closePromptLibrary,
    loadPrompts,
    handleRefresh,
    handleCategoryFilter,
    handleSelectPrompt,
    handleDirectAsk,
    renderPromptCards,
    getPrompts: () => _currentPrompts,
    setPrompts: (prompts) => {
      _currentPrompts = prompts || [];
      renderPromptCards();
    }
  };
});
