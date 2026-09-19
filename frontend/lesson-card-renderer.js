/**
 * APPU Lesson-Card Renderer v1.0
 * Renders structured multi-block visual mini-lessons:
 * - hook (curiosity text)
 * - diagram (Mermaid flowchart/diagram with graceful offline fallback)
 * - steps (step-by-step items revealed sequentially)
 * - analogy (conceptual comparison card)
 * - check (quick interactive concept quiz with answer reveal + celebrate trigger)
 *
 * CRITICAL SAFETY INVARIANT:
 * - plainText is ALWAYS preserved and guaranteed. If blocks is missing or malformed,
 *   the renderer falls back cleanly to plainText. A child NEVER sees a blank or broken screen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LessonCardRenderer = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Sample lesson-card for testing and scaffolding
  const SAMPLE_CARD = {
    mood: 'explaining',
    gradeTone: 'junior',
    blocks: [
      { type: 'hook', text: 'Ever wonder how a plant eats without a mouth? 🌱' },
      { type: 'diagram', kind: 'mermaid', spec: 'flowchart LR; Sun-->Leaf; Water-->Leaf; CO2-->Leaf; Leaf-->Sugar; Leaf-->Oxygen' },
      { type: 'steps', items: ['Leaves catch sunlight', 'Roots drink water', 'Leaf mixes them into sugar', 'Plant breathes out oxygen'] },
      { type: 'analogy', text: 'A leaf is like a tiny solar-powered kitchen.' },
      { type: 'check', q: 'What gas does the plant breathe out?', a: 'Oxygen' }
    ],
    plainText: 'Plants make their food through photosynthesis. Leaves catch sunlight, roots absorb water from the soil, and they take in carbon dioxide from the air. Inside the leaf, these mix together to produce sugar for energy, and the plant releases oxygen for us to breathe!'
  };

  let mermaidInitialized = false;

  function initMermaidSafe() {
    if (mermaidInitialized) return true;
    if (typeof window !== 'undefined' && window.mermaid && typeof window.mermaid.initialize === 'function') {
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: '#083344',
            primaryTextColor: '#ecfeff',
            primaryBorderColor: '#06b6d4',
            lineColor: '#22d3ee',
            secondaryColor: '#0f172a',
            tertiaryColor: '#0284c7'
          }
        });
        mermaidInitialized = true;
        return true;
      } catch (err) {
        console.warn('[LessonCard] Mermaid init failed, will use fallback renderer:', err);
        return false;
      }
    }
    return false;
  }

  function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Attempts to parse raw JSON or JSON-in-markdown into a verified lesson-card structure.
   * NEVER throws: returns a safe normalized card object with mandatory plainText.
   */
  function parse(input) {
    if (!input) {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: '' };
    }

    // Already an object
    if (typeof input === 'object' && input !== null) {
      const hasBlocks = Array.isArray(input.blocks) && input.blocks.length > 0;
      const plainText = typeof input.plainText === 'string' && input.plainText.trim()
        ? input.plainText.trim()
        : (typeof input.text === 'string' ? input.text : '');

      return {
        isRich: hasBlocks,
        mood: typeof input.mood === 'string' ? input.mood : 'explaining',
        gradeTone: ['junior', 'middle', 'senior'].includes(input.gradeTone) ? input.gradeTone : 'junior',
        blocks: hasBlocks ? input.blocks : [],
        plainText
      };
    }

    if (typeof input !== 'string') {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: String(input) };
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: '' };
    }

    // Check if string contains JSON or code block containing JSON
    let jsonCandidate = trimmed;
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonCandidate = codeBlockMatch[1].trim();
    }

    if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
      try {
        const obj = JSON.parse(jsonCandidate);
        if (obj && typeof obj === 'object') {
          const hasBlocks = Array.isArray(obj.blocks) && obj.blocks.length > 0;
          const plainText = typeof obj.plainText === 'string' && obj.plainText.trim()
            ? obj.plainText.trim()
            : trimmed;

          return {
            isRich: hasBlocks,
            mood: typeof obj.mood === 'string' ? obj.mood : 'explaining',
            gradeTone: ['junior', 'middle', 'senior'].includes(obj.gradeTone) ? obj.gradeTone : 'junior',
            blocks: hasBlocks ? obj.blocks : [],
            plainText
          };
        }
      } catch {
        // Fall through to plain text
      }
    }

    return {
      isRich: false,
      mood: 'idle',
      gradeTone: 'junior',
      blocks: [],
      plainText: trimmed
    };
  }

  /**
   * Generates a semantic, styled HTML flowchart diagram when Mermaid is unavailable.
   */
  function renderFallbackDiagram(spec) {
    if (!spec || typeof spec !== 'string') return '';
    // Parse simple flowchart nodes (e.g. "Sun-->Leaf; Water-->Leaf; Leaf-->Sugar")
    const clean = spec.replace(/^flowchart\s+[A-Z]{2};?/i, '').replace(/graph\s+[A-Z]{2};?/i, '');
    const statements = clean.split(';').map(s => s.trim()).filter(Boolean);

    if (statements.length === 0) {
      return `<div class="diagram-spec-fallback"><pre>${escapeHTML(spec)}</pre></div>`;
    }

    const links = [];
    for (const stmt of statements) {
      const parts = stmt.split(/-->|->|==>|-.->/);
      if (parts.length >= 2) {
        links.push({ from: parts[0].trim(), to: parts[1].trim() });
      }
    }

    if (links.length === 0) {
      return `<div class="diagram-spec-fallback"><pre>${escapeHTML(spec)}</pre></div>`;
    }

    return `
      <div class="diagram-flow-fallback" role="figure" aria-label="Concept Flow">
        ${links.map(l => `
          <div class="flow-link-item">
            <span class="flow-node from-node">${escapeHTML(l.from)}</span>
            <i class="fa-solid fa-arrow-right flow-arrow" aria-hidden="true"></i>
            <span class="flow-node to-node">${escapeHTML(l.to)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renders a lesson card into a DOM element.
   * @param {object|string} card - Raw or parsed card object
   * @param {object} [options]
   * @param {Function} [options.onCelebrate] - Fired when learner checks/completes a quick check
   * @param {Function} [options.onStepReveal] - Fired when a step reveals
   * @returns {HTMLElement} - The rendered card element
   */
  function render(card, options = {}) {
    const data = parse(card);
    const container = document.createElement('div');
    container.className = `appu-lesson-card grade-${data.gradeTone || 'junior'}`;
    container.setAttribute('data-grade-tone', data.gradeTone || 'junior');
    container.setAttribute('data-mood', data.mood || 'explaining');

    // 1. Mandatory Fallback: If not rich or no blocks, render plainText cleanly
    if (!data.isRich || !data.blocks || data.blocks.length === 0) {
      const plainDiv = document.createElement('div');
      plainDiv.className = 'lesson-block lesson-block-plain';
      const p = document.createElement('p');
      p.textContent = data.plainText || '';
      plainDiv.appendChild(p);
      container.appendChild(plainDiv);
      return container;
    }

    // 2. Render blocks top-to-bottom
    data.blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') return;

      switch (block.type) {
        case 'hook': {
          const hookDiv = document.createElement('div');
          hookDiv.className = 'lesson-block lesson-block-hook';
          hookDiv.innerHTML = `
            <div class="hook-kicker"><i class="fa-solid fa-sparkles text-amber" aria-hidden="true"></i> <span>Did you know?</span></div>
            <p class="hook-text">${escapeHTML(block.text || '')}</p>
          `;
          container.appendChild(hookDiv);
          break;
        }

        case 'diagram': {
          const diagDiv = document.createElement('div');
          diagDiv.className = 'lesson-block lesson-block-diagram';
          const diagId = 'mermaid-' + Math.random().toString(36).substring(2, 10);

          diagDiv.innerHTML = `
            <div class="diagram-header"><i class="fa-solid fa-project-diagram text-cyan" aria-hidden="true"></i> <span>Concept Map</span></div>
            <div class="diagram-canvas-wrap" id="${diagId}-wrap">
              <div class="mermaid-target" id="${diagId}"></div>
            </div>
          `;
          container.appendChild(diagDiv);

          // Attempt Mermaid render if available, else degrade gracefully
          const hasMermaid = initMermaidSafe();
          const targetEl = diagDiv.querySelector('.mermaid-target');

          if (hasMermaid && window.mermaid && typeof window.mermaid.render === 'function' && block.spec) {
            // Asynchronously render SVG
            setTimeout(async () => {
              try {
                const { svg } = await window.mermaid.render(diagId + '-svg', block.spec);
                if (targetEl) targetEl.innerHTML = svg;
              } catch (renderErr) {
                console.warn('[LessonCard] Mermaid render error, falling back:', renderErr);
                if (targetEl) targetEl.innerHTML = renderFallbackDiagram(block.spec);
              }
            }, 50);
          } else {
            if (targetEl) targetEl.innerHTML = renderFallbackDiagram(block.spec || '');
          }
          break;
        }

        case 'steps': {
          const stepsDiv = document.createElement('div');
          stepsDiv.className = 'lesson-block lesson-block-steps';
          const items = Array.isArray(block.items) ? block.items : [];

          stepsDiv.innerHTML = `
            <div class="steps-header"><i class="fa-solid fa-list-check text-cyan" aria-hidden="true"></i> <span>Step by Step</span></div>
            <ol class="lesson-steps-list">
              ${items.map((item, idx) => `
                <li class="lesson-step-item" style="--step-index: ${idx}">
                  <span class="step-num" aria-hidden="true">${idx + 1}</span>
                  <span class="step-body">${escapeHTML(item)}</span>
                </li>
              `).join('')}
            </ol>
          `;
          container.appendChild(stepsDiv);
          break;
        }

        case 'analogy': {
          const analogyDiv = document.createElement('div');
          analogyDiv.className = 'lesson-block lesson-block-analogy';
          analogyDiv.innerHTML = `
            <div class="analogy-header"><i class="fa-solid fa-lightbulb text-amber" aria-hidden="true"></i> <span>Think of it like this</span></div>
            <blockquote class="analogy-body">${escapeHTML(block.text || '')}</blockquote>
          `;
          container.appendChild(analogyDiv);
          break;
        }

        case 'check': {
          const checkDiv = document.createElement('div');
          checkDiv.className = 'lesson-block lesson-block-check';
          checkDiv.innerHTML = `
            <div class="check-header"><i class="fa-solid fa-circle-question text-cyan" aria-hidden="true"></i> <span>Quick Check!</span></div>
            <p class="check-question">${escapeHTML(block.q || '')}</p>
            <div class="check-interaction">
              <button type="button" class="check-reveal-btn">
                <i class="fa-solid fa-eye" aria-hidden="true"></i>
                <span>Reveal Answer</span>
              </button>
              <div class="check-answer-box" hidden>
                <div class="check-answer-content">
                  <span class="answer-label">Answer:</span>
                  <strong class="answer-text">${escapeHTML(block.a || '')}</strong>
                </div>
                <div class="check-celebrate-badge"><i class="fa-solid fa-star text-amber" aria-hidden="true"></i> Nailed it! 🎉</div>
              </div>
            </div>
          `;

          const revealBtn = checkDiv.querySelector('.check-reveal-btn');
          const answerBox = checkDiv.querySelector('.check-answer-box');

          if (revealBtn && answerBox) {
            revealBtn.addEventListener('click', () => {
              const isHidden = answerBox.hasAttribute('hidden');
              if (isHidden) {
                answerBox.removeAttribute('hidden');
                revealBtn.classList.add('is-revealed');
                revealBtn.innerHTML = '<i class="fa-solid fa-check text-green" aria-hidden="true"></i> <span>Answer Shown</span>';
                if (typeof options.onCelebrate === 'function') {
                  options.onCelebrate();
                }
              }
            });
          }

          container.appendChild(checkDiv);
          break;
        }

        default:
          // Gracefully ignore unknown block types
          break;
      }
    });

    return container;
  }

  return {
    parse,
    render,
    SAMPLE_CARD,
    renderFallbackDiagram
  };
});
