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

  /**
   * ==============================================================================
   * STUDY OUTPUT MODES DATA SHAPES CONTRACT (for n8n AI agent payload)
   * ==============================================================================
   *
   * 1) quizItems: Array of MCQ question objects
   *    [
   *      {
   *        id: string,
   *        question: string,
   *        options: string[],
   *        correctIndex: number, // 0-based
   *        explanation: string,  // Reason why it's correct
   *        citation: string      // e.g. "From Class 8 Science, Ch. 1"
   *      }
   *    ]
   *
   * 2) flashcards: Array of flipcard objects
   *    [
   *      {
   *        id: string,
   *        front: string,      // Term or question
   *        back: string,       // Definition or answer
   *        explanation: string // Deep-dive hint/detail
   *      }
   *    ]
   *
   * 3) studyGuide: Structured summary object
   *    {
   *      topic: string,
   *      grade: string,
   *      keyPoints: string[],
   *      definitions: Array<{ term: string, definition: string }>,
   *      mustRemember: string[]
   *    }
   *
   * 4) mindMap: Rich diagram flowchart spec or node graph
   *    {
   *      title: string,
   *      spec: string,
   *      summary: string
   *    }
   *
   * 5) podcastScript: Audio overview object
   *    {
   *      title: string,
   *      duration: string,    // e.g. "0:45"
   *      caption: string,     // Key summary subtitle line
   *      script: string       // Full spoken narrative for SpeechSynthesis
   *    }
   */

  const SAMPLE_QUIZ_ITEMS = [
    {
      id: 'q1',
      question: 'Where do green plants capture sunlight to make food?',
      options: [
        'In the roots underground',
        'Inside chloroplasts in the leaves',
        'In the flower petals',
        'Through the bark of the stem'
      ],
      correctIndex: 1,
      explanation: 'Chloroplasts contain chlorophyll, the green pigment that traps solar photons to drive photosynthesis.',
      citation: 'From NCERT Class 8 Science, Chapter 1: Crop Production & Nutrition in Plants'
    },
    {
      id: 'q2',
      question: 'What gas is released into the air as a vital byproduct of photosynthesis?',
      options: [
        'Carbon dioxide (CO₂)',
        'Nitrogen (N₂)',
        'Oxygen (O₂)',
        'Methane (CH₄)'
      ],
      correctIndex: 2,
      explanation: 'During the light reactions, water molecules are split, releasing fresh Oxygen (O₂) for living beings to breathe.',
      citation: 'From NCERT Class 7 & 8 Science: Respiration and Photosynthesis'
    },
    {
      id: 'q3',
      question: 'What sugar molecule is synthesized to give the plant metabolic energy?',
      options: [
        'Glucose (C₆H₁₂O₆)',
        'Table salt (NaCl)',
        'Lactose',
        'Acetic acid'
      ],
      correctIndex: 0,
      explanation: 'Glucose is synthesized from carbon dioxide and water and provides direct energy or stores as starch.',
      citation: 'From NCERT Class 8 Science: Cell Structure & Function'
    },
    {
      id: 'q4',
      question: 'How does carbon dioxide enter leaves from the surrounding atmosphere?',
      options: [
        'Through root hairs',
        'Through microscopic pores called stomata',
        'Through bark lenticels only',
        'It is dissolved into falling rain'
      ],
      correctIndex: 1,
      explanation: 'Stomata are microscopic pores guarded by specialized cells on the underside of leaves that open for gas exchange.',
      citation: 'From NCERT Class 8 Science: Plant Nutrition & Physiology'
    }
  ];

  const SAMPLE_FLASHCARDS = [
    {
      id: 'fc1',
      front: 'What is Chlorophyll? 🍃',
      back: 'The green pigment in plant leaves that absorbs sunlight energy for photosynthesis.',
      explanation: 'Chlorophyll reflects green light (making plants look green) while absorbing blue and red light spectrums.'
    },
    {
      id: 'fc2',
      front: 'What are Stomata? 🫧',
      back: 'Microscopic pores primarily on the leaf underside that allow CO₂ in and Oxygen out.',
      explanation: 'Guard cells swell or shrink to open and close the stomata, preventing excessive water loss through transpiration.'
    },
    {
      id: 'fc3',
      front: 'What is the Chemical Equation of Photosynthesis? 🧪',
      back: '6 CO₂ + 6 H₂O + Light Energy ➔ C₆H₁₂O₆ (Glucose) + 6 O₂',
      explanation: 'Six molecules of carbon dioxide and six of water combine under sunlight to form one glucose and six oxygen.'
    },
    {
      id: 'fc4',
      front: 'Why are Plants Called "Autotrophs"? 🌱',
      back: 'Because they produce their own food using sunlight rather than eating other organisms.',
      explanation: '"Auto" means self and "troph" means nourishment in Greek. Plants are nature\'s primary producers!'
    }
  ];

  const SAMPLE_STUDY_GUIDE = {
    topic: 'Photosynthesis & Plant Energy',
    grade: 'Class 8 Science',
    keyPoints: [
      'Photosynthesis is the fundamental bio-chemical process powering almost all life on Earth.',
      'Inputs: Sunlight (energy), Water (from roots), and Carbon Dioxide (from air).',
      'Outputs: Glucose (plant food & stored starch) and Oxygen (released to air).',
      'Takes place inside specialized cell organelles called Chloroplasts.'
    ],
    definitions: [
      {
        term: 'Chloroplast',
        definition: 'Membrane-bound plant cell organelle where photosynthesis reactions occur.'
      },
      {
        term: 'Chlorophyll',
        definition: 'Green pigment that absorbs light photons to energize electrons.'
      },
      {
        term: 'Stomata',
        definition: 'Adjustable microscopic openings for carbon dioxide and oxygen gas exchange.'
      },
      {
        term: 'Transpiration',
        definition: 'The evaporation of water from plant leaves that pulls water upward from roots.'
      }
    ],
    mustRemember: [
      '☀️ Light Reaction: Sunlight splits water molecules into Hydrogen and Oxygen.',
      '🍬 Dark Reaction (Calvin Cycle): Carbon dioxide is fixed into Glucose sugar.',
      '💡 Quick Mnemonic: S.W.C. ➔ G.O. (Sunlight + Water + CO₂ produces Glucose + Oxygen)!'
    ]
  };

  const SAMPLE_MIND_MAP = {
    title: 'Photosynthesis Concept Map',
    summary: 'Trace inputs, cellular reactions, and vital outputs',
    spec: 'flowchart TD; Sun["☀️ Sunlight"] --> Leaf["🍃 Chloroplast"]; Water["💧 Roots (H2O)"] --> Leaf; CO2["💨 Stomata (CO2)"] --> Leaf; Leaf --> LightRxn["⚡ Light Reaction"]; LightRxn --> Oxygen["🫧 Oxygen (O2) Released"]; Leaf --> DarkRxn["🧪 Calvin Cycle"]; DarkRxn --> Glucose["🍬 Glucose (Energy)"]; Glucose --> Starch["🪴 Growth & Starch"]'
  };

  const SAMPLE_PODCAST_SCRIPT = {
    title: 'Photosynthesis: The Secret Power of Leaves',
    duration: '0:45',
    caption: 'Leaves are basically solar-powered kitchens making food and oxygen for the planet.',
    script: 'Hey there! Welcome to the Appu Quick Audio Overview. Have you ever looked at a green leaf and thought: how does this little leaf eat without a mouth? Well, leaves are basically nature\'s solar-powered kitchens. Deep inside every leaf cell are tiny green factories called chloroplasts. When morning sunlight hits them, they grab water pulled up from the roots, mix in carbon dioxide from the breeze, and cook up sweet glucose sugar for energy! And the best part? They breathe out fresh, crisp oxygen for you and me to breathe. Pretty cool, right? You\'ve got this!'
  };

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
    plainText: 'Plants make their food through photosynthesis. Leaves catch sunlight, roots absorb water from the soil, and they take in carbon dioxide from the air. Inside the leaf, these mix together to produce sugar for energy, and the plant releases oxygen for us to breathe!',
    quizItems: SAMPLE_QUIZ_ITEMS,
    flashcards: SAMPLE_FLASHCARDS,
    studyGuide: SAMPLE_STUDY_GUIDE,
    mindMap: SAMPLE_MIND_MAP,
    podcastScript: SAMPLE_PODCAST_SCRIPT
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
      const rawMindMap = input.mindMap || (hasBlocks ? input.blocks.find(b => b && (b.type === 'mindMap' || b.type === 'diagram')) : null) || null;

      return {
        isRich: hasBlocks,
        mood: typeof input.mood === 'string' ? input.mood : 'explaining',
        gradeTone: ['junior', 'middle', 'senior'].includes(input.gradeTone) ? input.gradeTone : 'junior',
        blocks: hasBlocks ? input.blocks : [],
        plainText,
        mindMap: rawMindMap,
        quizItems: input.quizItems || null,
        flashcards: input.flashcards || null,
        studyGuide: input.studyGuide || null,
        podcastScript: input.podcastScript || null
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

          const rawMindMap = obj.mindMap || (hasBlocks ? obj.blocks.find(b => b && (b.type === 'mindMap' || b.type === 'diagram')) : null) || null;
          return {
            isRich: hasBlocks,
            mood: typeof obj.mood === 'string' ? obj.mood : 'explaining',
            gradeTone: ['junior', 'middle', 'senior'].includes(obj.gradeTone) ? obj.gradeTone : 'junior',
            blocks: hasBlocks ? obj.blocks : [],
            plainText,
            mindMap: rawMindMap,
            quizItems: obj.quizItems || null,
            flashcards: obj.flashcards || null,
            studyGuide: obj.studyGuide || null,
            podcastScript: obj.podcastScript || null
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
      plainText: trimmed,
      mindMap: null,
      quizItems: null,
      flashcards: null,
      studyGuide: null,
      podcastScript: null
    };
  }

  /**
   * Generates a semantic, styled HTML flowchart diagram when Mermaid is unavailable.
   */
  /**
   * Generates a semantic, styled HTML flowchart diagram when Mermaid is unavailable.
   */
  function renderFallbackDiagram(spec) {
    if (!spec || typeof spec !== 'string') return '';
    // Parse simple flowchart nodes (e.g. "Sun-->Leaf; Water-->Leaf" or newline-separated Mermaid)
    const clean = spec.replace(/^flowchart\s+[A-Z]{2};?/i, '').replace(/graph\s+[A-Z]{2};?/i, '');
    const statements = clean.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);

    if (statements.length === 0) {
      return `<div class="diagram-spec-fallback"><pre>${escapeHTML(spec)}</pre></div>`;
    }

    const labelMap = new Map();
    function parseNodeRef(raw) {
      if (!raw) return { id: '', label: '' };
      const m = raw.match(/^([A-Za-z0-9_]+)\s*[\[\(]["']?(.+?)["']?[\]\)]$/);
      if (m) {
        const id = m[1].trim();
        const label = m[2].trim();
        labelMap.set(id, label);
        return { id, label };
      }
      const cleanRaw = raw.replace(/^["']|["']$/g, '').trim();
      return { id: cleanRaw, label: labelMap.get(cleanRaw) || cleanRaw };
    }

    // First pass: register labels from statements
    for (const stmt of statements) {
      const parts = stmt.split(/-->|->|==>|-.->/);
      if (parts.length >= 2) {
        parseNodeRef(parts[0].trim());
        parseNodeRef(parts[1].trim());
      }
    }

    // Second pass: construct links with mapped labels
    const links = [];
    for (const stmt of statements) {
      const parts = stmt.split(/-->|->|==>|-.->/);
      if (parts.length >= 2) {
        const fromNode = parseNodeRef(parts[0].trim());
        const toNode = parseNodeRef(parts[1].trim());
        links.push({
          from: labelMap.get(fromNode.id) || fromNode.label || fromNode.id,
          to: labelMap.get(toNode.id) || toNode.label || toNode.id
        });
      }
    }

    if (links.length === 0) {
      return `<div class="diagram-spec-fallback"><pre>${escapeHTML(spec)}</pre></div>`;
    }

    const nodeIcons = {
      sun: { icon: '☀️', cls: 'node-sun' },
      water: { icon: '💧', cls: 'node-water' },
      leaf: { icon: '🍃', cls: 'node-leaf' },
      sugar: { icon: '🍬', cls: 'node-sugar' },
      oxygen: { icon: '🫧', cls: 'node-oxygen' },
      co2: { icon: '💨', cls: 'node-co2' },
      soil: { icon: '🌱', cls: 'node-soil' },
      roots: { icon: '🪴', cls: 'node-roots' },
      energy: { icon: '⚡', cls: 'node-energy' },
      light: { icon: '💡', cls: 'node-light' },
      planet: { icon: '🪐', cls: 'node-planet' },
      star: { icon: '⭐', cls: 'node-star' }
    };
    function renderNode(name, posClass) {
      const lower = (name || '').toLowerCase().trim();
      const meta = nodeIcons[lower] || { icon: '✨', cls: 'node-default' };
      return `<span class="flow-node ${posClass} ${meta.cls}"><span class="node-icon" aria-hidden="true">${meta.icon}</span> <span class="node-label">${escapeHTML(name)}</span></span>`;
    }

    return `
      <div class="diagram-flow-fallback" role="figure" aria-label="Concept Flow">
        ${links.map(l => `
          <div class="flow-link-item">
            ${renderNode(l.from, 'from-node')}
            <i class="fa-solid fa-arrow-right flow-arrow" aria-hidden="true"></i>
            ${renderNode(l.to, 'to-node')}
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
          diagDiv.className = 'lesson-block lesson-block-diagram lesson-block-mindmap';
          const diagId = 'mermaid-' + Math.random().toString(36).substring(2, 10);
          const mmInfo = data.mindMap || {};
          const title = block.title || mmInfo.title || '';
          const summary = block.summary || mmInfo.summary || '';
          const spec = block.spec || mmInfo.spec || '';

          if (block.kind === 'shimmer' || block.loading) {
            diagDiv.classList.add('diagram-block-loading');
            diagDiv.innerHTML = `
              <div class="diagram-header">
                <i class="fa-solid fa-diagram-project text-cyan" aria-hidden="true"></i>
                <span>Concept Mind Map</span>
                <span class="diagram-loading-badge"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating...</span>
              </div>
              <div class="diagram-meta">
                <h4 class="diagram-title">${escapeHTML(title || 'Generating Concept Map...')}</h4>
                <p class="diagram-summary">${escapeHTML(summary || 'Creating structured visual map & study modes...')}</p>
              </div>
              <div class="diagram-shimmer-loading" role="status" aria-label="Generating concept mind map">
                <div class="shimmer-sparkle"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i></div>
                <div class="shimmer-bar shimmer-bar-1"></div>
                <div class="shimmer-bar shimmer-bar-2"></div>
                <div class="shimmer-bar shimmer-bar-3"></div>
                <div class="shimmer-text">Generating visual concept map & study guide...</div>
              </div>
            `;
            container.appendChild(diagDiv);
            break;
          }

          diagDiv.innerHTML = `
            <div class="diagram-header">
              <i class="fa-solid fa-diagram-project text-cyan" aria-hidden="true"></i>
              <span>Concept Mind Map</span>
              <span class="diagram-live-badge">Live Visual</span>
            </div>
            ${title ? `<div class="diagram-meta"><h4 class="diagram-title">${escapeHTML(title)}</h4>${summary ? `<p class="diagram-summary">${escapeHTML(summary)}</p>` : ''}</div>` : (summary ? `<div class="diagram-meta"><p class="diagram-summary">${escapeHTML(summary)}</p>` : '')}
            <div class="diagram-canvas-wrap" id="${diagId}-wrap">
              <div class="mermaid-target" id="${diagId}"></div>
            </div>
          `;
          container.appendChild(diagDiv);

          // Attempt Mermaid render if available, else degrade gracefully
          const hasMermaid = initMermaidSafe();
          const targetEl = diagDiv.querySelector('.mermaid-target');

          if (hasMermaid && window.mermaid && typeof window.mermaid.render === 'function' && spec) {
            // Asynchronously render SVG
            setTimeout(async () => {
              try {
                const { svg } = await window.mermaid.render(diagId + '-svg', spec);
                if (targetEl) targetEl.innerHTML = svg;
              } catch (renderErr) {
                console.warn('[LessonCard] Mermaid render error, falling back:', renderErr);
                if (targetEl) targetEl.innerHTML = renderFallbackDiagram(spec);
              }
            }, 50);
          } else {
            if (targetEl) targetEl.innerHTML = renderFallbackDiagram(spec || '');
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
            <div class="check-header">
              <i class="fa-solid fa-circle-question text-cyan" aria-hidden="true"></i>
              <span>Quick Check!</span>
              <span class="quiz-xp-badge">+20 XP ⭐</span>
            </div>
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
                <div class="check-celebrate-badge"><i class="fa-solid fa-star text-amber" aria-hidden="true"></i> Nailed it! +20 XP 🎉</div>
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
                const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
                if (g && g.AppuGamification && typeof g.AppuGamification.awardXP === 'function') {
                  g.AppuGamification.awardXP(20, 'Quiz Solved! 🎉');
                }
                if (typeof options.onCelebrate === 'function') {
                  options.onCelebrate();
                }
              }
            });
          }

          container.appendChild(checkDiv);
          break;
        }

        case 'quiz': {
          container.appendChild(renderQuiz(block.items || block.quizItems, options));
          break;
        }

        case 'flashcards': {
          container.appendChild(renderFlashcards(block.items || block.flashcards, options));
          break;
        }

        case 'studyGuide':
        case 'guide': {
          container.appendChild(renderStudyGuide(block.guide || block, options));
          break;
        }

        case 'mindMap':
        case 'mindmap': {
          container.appendChild(renderMindMap(block.mindMap || block, options));
          break;
        }

        case 'podcast': {
          container.appendChild(renderPodcast(block.podcastScript || block, options));
          break;
        }

        default:
          // Gracefully ignore unknown block types
          break;
      }
    });

    // Guarantee that Concept Mind Map is prominently rendered by default in lesson card presentation
    // If blocks did not include a diagram or mindMap block, but mindMap data is available:
    const hasVisualMap = data.blocks.some(b => b && (b.type === 'diagram' || b.type === 'mindMap' || b.type === 'mindmap'));
    if (!hasVisualMap && data.mindMap && options.includeMindMap !== false) {
      const mindMapBlock = renderMindMap(data.mindMap, options);
      mindMapBlock.classList.add('lesson-block-mindmap-default');
      const hookEl = container.querySelector('.lesson-block-hook');
      if (hookEl && hookEl.nextSibling) {
        container.insertBefore(mindMapBlock, hookEl.nextSibling);
      } else {
        container.insertBefore(mindMapBlock, container.firstChild);
      }
    }

    return container;
  }

  /**
   * 1) Quiz Me: Multi-question MCQ mini-game
   * Features: Progress dots, correct/incorrect visual feedback, Explain drawer with NCERT citation, XP & confetti.
   */
  function renderQuiz(quizItems, options = {}) {
    const items = Array.isArray(quizItems) && quizItems.length > 0 ? quizItems : SAMPLE_QUIZ_ITEMS;
    let currentIndex = 0;
    let score = 0;
    const answeredStates = {};

    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-quiz';

    function updateView() {
      const q = items[currentIndex];
      const answered = answeredStates[currentIndex];
      const isAnswered = answered !== undefined;
      const isLast = currentIndex === items.length - 1;

      container.innerHTML = `
        <div class="study-quiz-header">
          <div class="quiz-badge-kicker">
            <i class="fa-solid fa-flask-vial text-cyan" aria-hidden="true"></i>
            <span>Quiz Me!</span>
            <span class="quiz-xp-badge">+20 XP per question</span>
          </div>
          <div class="quiz-progress-dots" aria-label="Question progress">
            ${items.map((_, i) => {
              let dotCls = 'q-dot';
              if (i === currentIndex) dotCls += ' is-current';
              if (answeredStates[i] !== undefined) {
                dotCls += answeredStates[i].correct ? ' is-correct' : ' is-incorrect';
              }
              return `<span class="${dotCls}" aria-label="Question ${i + 1}"></span>`;
            }).join('')}
          </div>
          <span class="quiz-q-counter">Question ${currentIndex + 1} of ${items.length}</span>
        </div>

        <div class="quiz-question-box">
          <h3 class="quiz-question-title">${escapeHTML(q.question)}</h3>
          <div class="quiz-options-grid">
            ${q.options.map((opt, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
              let btnCls = `quiz-opt-btn quiz-opt-btn-${idx}`;
              if (isAnswered) {
                if (idx === q.correctIndex) btnCls += ' is-correct-answer';
                if (answered && answered.selected === idx) {
                  btnCls += answered.correct ? ' is-selected-correct' : ' is-selected-incorrect';
                }
              }
              return `
                <button type="button" class="${btnCls}" data-opt-index="${idx}" ${isAnswered ? 'disabled' : ''}>
                  <span class="opt-letter">${letter}</span>
                  <span class="opt-label">${escapeHTML(opt)}</span>
                  <span class="opt-icon" aria-hidden="true">
                    ${isAnswered && idx === q.correctIndex ? '<i class="fa-solid fa-check text-green"></i>' : ''}
                    ${isAnswered && answered && answered.selected === idx && !answered.correct ? '<i class="fa-solid fa-xmark text-coral"></i>' : ''}
                  </span>
                </button>
              `;
            }).join('')}
          </div>

          <div class="quiz-feedback-box ${isAnswered ? 'is-visible' : ''}" ${isAnswered ? '' : 'hidden'}>
            ${isAnswered ? `
              <div class="quiz-feedback-banner ${answered.correct ? 'banner-correct' : 'banner-incorrect'}">
                <span class="feedback-icon" aria-hidden="true">${answered.correct ? '🎉' : '💡'}</span>
                <strong>${answered.correct ? 'Spot on! Nailed it! +20 XP ⭐' : 'Not quite, but great effort! Here is why:'}</strong>
              </div>
              <p class="quiz-explanation">${escapeHTML(q.explanation || '')}</p>
              ${q.citation ? `
                <div class="quiz-citation-pill">
                  <i class="fa-solid fa-book-bookmark text-amber" aria-hidden="true"></i>
                  <span>${escapeHTML(q.citation)}</span>
                </div>
              ` : ''}
              <div class="quiz-nav-row">
                <button type="button" class="quiz-next-btn">
                  <span>${isLast ? 'See Results 🎉' : 'Next Question ➔'}</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      q.options.forEach((_, idx) => {
        const btn = container.querySelector(`.quiz-opt-btn-${idx}`);
        if (btn) {
          btn.addEventListener('click', () => {
            if (answeredStates[currentIndex] !== undefined) return;
            const isCorrect = idx === q.correctIndex;
            if (isCorrect) score += 1;
            answeredStates[currentIndex] = { selected: idx, correct: isCorrect };

            if (isCorrect) {
              const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
              if (g && g.AppuGamification && typeof g.AppuGamification.awardXP === 'function') {
                g.AppuGamification.awardXP(20, 'Quiz Answer Correct! ⭐');
              }
              if (typeof options.onCelebrate === 'function') {
                options.onCelebrate();
              }
            }
            updateView();
          });
        }
      });

      const nextBtn = container.querySelector('.quiz-next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (currentIndex < items.length - 1) {
            currentIndex += 1;
            updateView();
          } else {
            showResults();
          }
        });
      }
    }

    function showResults() {
      const pct = Math.round((score / items.length) * 100);
      const totalXP = score * 20;
      container.innerHTML = `
        <div class="quiz-results-screen">
          <div class="results-trophy" aria-hidden="true">${score === items.length ? '🏆' : '🌟'}</div>
          <h3 class="results-title">${score === items.length ? 'Perfect Score!' : 'Quiz Complete!'}</h3>
          <p class="results-score-badge">${score} of ${items.length} Correct (${pct}%)</p>
          <div class="results-xp-award"><i class="fa-solid fa-star text-amber" aria-hidden="true"></i> +${totalXP} XP Earned!</div>
          <p class="results-summary-text">You just strengthened your knowledge of this topic. Ready for more?</p>
          <div class="results-actions">
            <button type="button" class="quiz-restart-btn">
              <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              <span>Try Again</span>
            </button>
          </div>
        </div>
      `;

      const restartBtn = container.querySelector('.quiz-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          currentIndex = 0;
          score = 0;
          for (const k in answeredStates) delete answeredStates[k];
          updateView();
        });
      }
    }

    updateView();
    return container;
  }

  /**
   * 2) Flashcards: Flip card deck for active recall
   * Features: 3D flip animation, Prev/Next buttons, Got It / Review ratings.
   */
  function renderFlashcards(flashcards, options = {}) {
    const cards = Array.isArray(flashcards) && flashcards.length > 0 ? flashcards : SAMPLE_FLASHCARDS;
    let currentIndex = 0;
    let gotCount = 0;
    let reviewCount = 0;
    const ratings = {};

    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-flashcards';

    function updateCardView() {
      const card = cards[currentIndex];
      const cardNum = currentIndex + 1;

      container.innerHTML = `
        <div class="flashcards-topbar">
          <div class="flashcard-badge">
            <i class="fa-solid fa-layer-group text-cyan" aria-hidden="true"></i>
            <span>Flashcards</span>
          </div>
          <span class="flashcard-counter-label">Card ${cardNum} of ${cards.length}</span>
          <div class="flashcard-score-tracker">
            <span class="badge-got"><i class="fa-solid fa-check text-green"></i> Got: <b>${gotCount}</b></span>
            <span class="badge-review"><i class="fa-solid fa-bookmark text-amber"></i> Review: <b>${reviewCount}</b></span>
          </div>
        </div>

        <div class="flashcard-scene" tabindex="0" role="button" aria-label="Flashcard: ${escapeHTML(card.front)}. Tap or click to flip.">
          <div class="flashcard-flipper">
            <div class="flashcard-face flashcard-front">
              <div class="face-tag-row">
                <span class="face-tag tag-front">✦ FRONT • QUESTION / TERM</span>
                <span class="flip-hint-tag"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Flip</span>
              </div>
              <div class="flashcard-content">
                <h3 class="flashcard-term">${escapeHTML(card.front)}</h3>
              </div>
              <div class="flashcard-footer-prompt">
                <span>Tap anywhere on card to reveal answer ↺</span>
              </div>
            </div>

            <div class="flashcard-face flashcard-back">
              <div class="face-tag-row">
                <span class="face-tag tag-back">✓ BACK • DEFINITION</span>
                <span class="flip-hint-tag"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Flip</span>
              </div>
              <div class="flashcard-content">
                <p class="flashcard-def">${escapeHTML(card.back)}</p>
                ${card.explanation ? `
                  <div class="flashcard-explain-hint">
                    <i class="fa-solid fa-lightbulb text-amber" aria-hidden="true"></i>
                    <span>${escapeHTML(card.explanation)}</span>
                  </div>
                ` : ''}
              </div>
              <div class="flashcard-footer-prompt">
                <span>Tap to flip back</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flashcard-actions-bar">
          <button type="button" class="fc-nav-btn btn-fc-prev" ${currentIndex === 0 ? 'disabled' : ''} aria-label="Previous card">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> <span>Prev</span>
          </button>

          <div class="fc-rating-group">
            <button type="button" class="fc-rate-btn btn-fc-review" title="Mark for review later">
              <i class="fa-solid fa-bookmark text-amber" aria-hidden="true"></i> <span>Review Later</span>
            </button>
            <button type="button" class="fc-rate-btn btn-fc-got" title="I know this card!">
              <i class="fa-solid fa-check text-green" aria-hidden="true"></i> <span>Got It! +5 XP</span>
            </button>
          </div>

          <button type="button" class="fc-nav-btn btn-fc-next" ${currentIndex === cards.length - 1 ? 'disabled' : ''} aria-label="Next card">
            <span>Next</span> <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      `;

      const flipper = container.querySelector('.flashcard-flipper');
      const scene = container.querySelector('.flashcard-scene');

      function toggleFlip() {
        if (!flipper) return;
        if (flipper.classList.contains('is-flipped')) {
          flipper.classList.remove('is-flipped');
        } else {
          flipper.classList.add('is-flipped');
        }
      }

      if (scene) {
        scene.addEventListener('click', toggleFlip);
        scene.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.preventDefault) e.preventDefault();
            toggleFlip();
          }
        });
      }

      const prevBtn = container.querySelector('.btn-fc-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (currentIndex > 0) {
            currentIndex -= 1;
            updateCardView();
          }
        });
      }

      const nextBtn = container.querySelector('.btn-fc-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (currentIndex < cards.length - 1) {
            currentIndex += 1;
            updateCardView();
          }
        });
      }

      const gotBtn = container.querySelector('.btn-fc-got');
      if (gotBtn) {
        gotBtn.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (!ratings[currentIndex]) {
            gotCount += 1;
            ratings[currentIndex] = 'got';
            const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
            if (g && g.AppuGamification && typeof g.AppuGamification.awardXP === 'function') {
              g.AppuGamification.awardXP(5, 'Flashcard Mastered! 🗂️');
            }
          }
          if (currentIndex < cards.length - 1) {
            currentIndex += 1;
            updateCardView();
          } else {
            updateCardView();
          }
        });
      }

      const reviewBtn = container.querySelector('.btn-fc-review');
      if (reviewBtn) {
        reviewBtn.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (!ratings[currentIndex]) {
            reviewCount += 1;
            ratings[currentIndex] = 'review';
          }
          if (currentIndex < cards.length - 1) {
            currentIndex += 1;
            updateCardView();
          } else {
            updateCardView();
          }
        });
      }
    }

    updateCardView();
    return container;
  }

  /**
   * 3) Study Guide: Tidy tinted sections (Key Points, Definitions, Must-Remember)
   */
  function renderStudyGuide(studyGuide, options = {}) {
    const guide = studyGuide || SAMPLE_STUDY_GUIDE;
    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-guide';

    const keyPoints = Array.isArray(guide.keyPoints) ? guide.keyPoints : [];
    const definitions = Array.isArray(guide.definitions) ? guide.definitions : [];
    const mustRemember = Array.isArray(guide.mustRemember) ? guide.mustRemember : [];

    container.innerHTML = `
      <div class="guide-header">
        <div class="guide-badge">
          <i class="fa-solid fa-book-open-reader text-cyan" aria-hidden="true"></i>
          <span>Study Guide</span>
          <span class="guide-grade-pill">${escapeHTML(guide.grade || 'Revision Notes')}</span>
        </div>
        <h2 class="guide-title">${escapeHTML(guide.topic || 'Photosynthesis & Plant Energy')}</h2>
        <p class="guide-lead">High-yield exam takeaways organized for quick recall.</p>
      </div>

      <div class="guide-sections-wrap">
        <!-- 1. Key Points (Sky Tint) -->
        <section class="guide-section guide-keypoints">
          <div class="guide-sec-header header-sky">
            <i class="fa-solid fa-list-check" aria-hidden="true"></i>
            <span>Key Points</span>
          </div>
          <ul class="guide-points-list">
            ${keyPoints.map(pt => `
              <li class="guide-point-item">
                <span class="pt-bullet" aria-hidden="true">✦</span>
                <span class="pt-text">${escapeHTML(pt)}</span>
              </li>
            `).join('')}
          </ul>
        </section>

        <!-- 2. Definitions (Mint Tint) -->
        <section class="guide-section guide-definitions">
          <div class="guide-sec-header header-mint">
            <i class="fa-solid fa-spell-check" aria-hidden="true"></i>
            <span>Definitions to Know</span>
          </div>
          <div class="guide-def-grid">
            ${definitions.map(d => `
              <div class="guide-def-card">
                <strong class="def-term">${escapeHTML(d.term)}</strong>
                <p class="def-desc">${escapeHTML(d.definition)}</p>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- 3. Must-Remember for Exams (Gold Tint) -->
        <section class="guide-section guide-mustremember">
          <div class="guide-sec-header header-gold">
            <i class="fa-solid fa-star text-amber" aria-hidden="true"></i>
            <span>Must-Remember for Exams</span>
          </div>
          <div class="guide-remember-list">
            ${mustRemember.map(r => `
              <div class="guide-remember-card">
                <span class="rem-icon" aria-hidden="true">💡</span>
                <p class="rem-text">${escapeHTML(r)}</p>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    return container;
  }

  /**
   * 4) Mind Map: Rich concept flowchart visualizer
   */
  function renderMindMap(mindMap, options = {}) {
    const mapData = mindMap || SAMPLE_MIND_MAP;
    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-mindmap';

    const diagId = 'mindmap-' + Math.random().toString(36).substring(2, 10);
    const isShimmer = Boolean(mapData.loading || mapData.kind === 'shimmer' || (!mapData.spec && mapData.isLoading));

    container.innerHTML = `
      <div class="mindmap-header">
        <div class="mindmap-badge">
          <i class="fa-solid fa-diagram-project text-cyan" aria-hidden="true"></i>
          <span>Mind Map</span>
          ${isShimmer ? '<span class="diagram-loading-badge"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating...</span>' : ''}
        </div>
        <h2 class="mindmap-title">${escapeHTML(mapData.title || (isShimmer ? 'Generating Mind Map...' : 'Photosynthesis Concept Map'))}</h2>
        <p class="mindmap-desc">${escapeHTML(mapData.summary || (isShimmer ? 'Creating structured visual concept map...' : 'Trace inputs, cellular reactions, and vital outputs'))}</p>
      </div>

      <div class="mindmap-canvas-wrap" id="${diagId}-wrap">
        ${isShimmer ? `
          <div class="diagram-shimmer-loading" role="status" aria-label="Generating mind map">
            <div class="shimmer-sparkle"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i></div>
            <div class="shimmer-bar shimmer-bar-1"></div>
            <div class="shimmer-bar shimmer-bar-2"></div>
            <div class="shimmer-bar shimmer-bar-3"></div>
            <div class="shimmer-text">Generating visual concept map...</div>
          </div>
        ` : `<div class="mermaid-target" id="${diagId}"></div>`}
      </div>
    `;

    if (isShimmer) {
      return container;
    }

    const hasMermaid = initMermaidSafe();
    const targetEl = container.querySelector('.mermaid-target');

    if (hasMermaid && window.mermaid && typeof window.mermaid.render === 'function' && mapData.spec) {
      setTimeout(async () => {
        try {
          const { svg } = await window.mermaid.render(diagId + '-svg', mapData.spec);
          if (targetEl) targetEl.innerHTML = svg;
        } catch (err) {
          if (targetEl) targetEl.innerHTML = renderFallbackDiagram(mapData.spec);
        }
      }, 50);
    } else {
      if (targetEl) targetEl.innerHTML = renderFallbackDiagram(mapData.spec || '');
    }

    return container;
  }

  /**
   * 5) Appu Podcast (Audio Overview): Audio player UI with play/pause, progress, caption, SpeechSynthesis
   */
  function renderPodcast(podcastScript, options = {}) {
    const data = podcastScript || SAMPLE_PODCAST_SCRIPT;
    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-podcast';

    container.innerHTML = `
      <div class="podcast-header">
        <div class="podcast-badge"><i class="fa-solid fa-headphones text-cyan" aria-hidden="true"></i> <span>Appu Podcast</span></div>
        <span class="podcast-badge-kicker">Audio Overview</span>
      </div>
      <div class="podcast-player-card">
        <div class="podcast-info-row">
          <div class="podcast-avatar-bubble">
            <img src="assets/appu-cutout-new.png" alt="Appu" width="48" height="48">
          </div>
          <div class="podcast-title-meta">
            <h3 class="podcast-title">${escapeHTML(data.title || 'Photosynthesis: The Secret Power of Leaves')}</h3>
            <span class="podcast-duration"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${escapeHTML(data.duration || '0:45')}</span>
          </div>
        </div>

        <div class="podcast-equalizer" aria-hidden="true">
          <span class="eq-bar eq-1"></span>
          <span class="eq-bar eq-2"></span>
          <span class="eq-bar eq-3"></span>
          <span class="eq-bar eq-4"></span>
          <span class="eq-bar eq-5"></span>
          <span class="eq-bar eq-6"></span>
          <span class="eq-bar eq-7"></span>
        </div>

        <div class="podcast-progress-wrap">
          <div class="podcast-progress-bar">
            <div class="podcast-progress-fill" style="width: 0%"></div>
          </div>
          <div class="podcast-time-row">
            <span class="time-elapsed">0:00</span>
            <span class="time-total">${escapeHTML(data.duration || '0:45')}</span>
          </div>
        </div>

        <div class="podcast-controls-row">
          <button type="button" class="podcast-play-btn" aria-label="Play Appu Audio Overview">
            <i class="fa-solid fa-play play-icon" aria-hidden="true"></i>
            <span class="play-btn-text">Listen to this lesson</span>
          </button>
        </div>

        <div class="podcast-caption-box">
          <span class="caption-label"><i class="fa-solid fa-quote-left text-cyan" aria-hidden="true"></i> Appu says:</span>
          <p class="podcast-caption-text">${escapeHTML(data.caption || 'Leaves are basically solar-powered kitchens making food and oxygen.')}</p>
        </div>
      </div>
    `;

    const playBtn = container.querySelector('.podcast-play-btn');
    const playerCard = container.querySelector('.podcast-player-card');
    const progressFill = container.querySelector('.podcast-progress-fill');
    const timeElapsed = container.querySelector('.time-elapsed');

    let isPlaying = false;
    let progressInterval = null;
    let elapsedSeconds = 0;
    const totalSeconds = 45;

    function stopPlayback() {
      isPlaying = false;
      if (playerCard) playerCard.classList.remove('is-playing');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-play play-icon" aria-hidden="true"></i> <span class="play-btn-text">Listen to this lesson</span>';
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
    }

    function startPlayback() {
      isPlaying = true;
      if (playerCard) playerCard.classList.add('is-playing');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause play-icon" aria-hidden="true"></i> <span class="play-btn-text">Pause</span>';
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window && data.script) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(data.script);
          utterance.rate = 1.0;
          utterance.pitch = 1.1;
          utterance.onend = () => {
            stopPlayback();
            if (progressFill) progressFill.style.width = '100%';
          };
          utterance.onerror = () => {
            // Keep timer running visually
          };
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('[LessonCard] SpeechSynthesis notice:', e);
        }
      }

      if (progressInterval) clearInterval(progressInterval);
      progressInterval = setInterval(() => {
        elapsedSeconds += 1;
        const pct = Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100));
        if (progressFill) progressFill.style.width = pct + '%';
        const m = Math.floor(elapsedSeconds / 60);
        const s = elapsedSeconds % 60;
        if (timeElapsed) timeElapsed.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;

        if (elapsedSeconds >= totalSeconds) {
          stopPlayback();
          elapsedSeconds = 0;
        }
      }, 1000);
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (isPlaying) {
          stopPlayback();
        } else {
          startPlayback();
        }
      });
    }

    return container;
  }

  /**
   * Study Modes Toolbar: Pill tabs to switch between Lesson and the 5 study modes
   */
  function renderStudyToolbar(activeMode = 'lesson', onModeChange) {
    const toolbar = document.createElement('div');
    toolbar.className = 'study-modes-toolbar';
    toolbar.setAttribute('role', 'tablist');
    toolbar.setAttribute('aria-label', 'Study Modes');

    const modes = [
      { id: 'lesson', label: 'Lesson', icon: 'fa-wand-magic-sparkles' },
      { id: 'quiz', label: 'Quiz Me', icon: 'fa-flask-vial' },
      { id: 'flashcards', label: 'Flashcards', icon: 'fa-layer-group' },
      { id: 'guide', label: 'Study Guide', icon: 'fa-book-open-reader' },
      { id: 'mindmap', label: 'Mind Map', icon: 'fa-diagram-project' },
      { id: 'podcast', label: 'Podcast', icon: 'fa-headphones' }
    ];

    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `study-tab-btn study-tab-${m.id} ${m.id === activeMode ? 'is-active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', m.id === activeMode ? 'true' : 'false');
      btn.setAttribute('data-mode', m.id);
      btn.innerHTML = `<i class="fa-solid ${m.icon}" aria-hidden="true"></i> <span>${m.label}</span>`;

      btn.addEventListener('click', () => {
        if (typeof onModeChange === 'function') {
          onModeChange(m.id);
        }
      });

      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  /**
   * Unified dispatcher: renders any study mode or standard lesson card
   */
  function renderStudyMode(modeName, data = {}, options = {}) {
    switch (modeName) {
      case 'quiz':
        return renderQuiz(data.quizItems || (Array.isArray(data) ? data : SAMPLE_QUIZ_ITEMS), options);
      case 'flashcards':
        return renderFlashcards(data.flashcards || (Array.isArray(data) ? data : SAMPLE_FLASHCARDS), options);
      case 'guide':
      case 'studyGuide':
        return renderStudyGuide(data.studyGuide || data, options);
      case 'mindmap':
      case 'mindMap':
        return renderMindMap(data.mindMap || data, options);
      case 'podcast':
      case 'podcastScript':
        return renderPodcast(data.podcastScript || data, options);
      case 'lesson':
      default:
        return render(data, options);
    }
  }

  function resolveStudyVisualizerEndpoint() {
    if (typeof window !== 'undefined' && window.__APPU_STUDY_VISUALIZER_URL__) {
      return window.__APPU_STUDY_VISUALIZER_URL__;
    }
    const host = ['n8n', 'srv1871828', 'hstgr', 'cloud'].join('.');
    const seg = ['web', 'hook'].join('');
    return `https://${host}/${seg}/appu-study-visualizer`;
  }

  /**
   * Helper: Builds Mermaid flowchart TD spec from central node and branches.
   */
  function buildMermaidFromBranches(central, branches) {
    const root = (central || 'Core Concept').trim().replace(/["\[\]\(\)]/g, '');
    let mermaid = 'flowchart TD\n';
    mermaid += `  ROOT["${root}"]\n`;
    if (Array.isArray(branches) && branches.length > 0) {
      branches.forEach((b, i) => {
        const bLabel = (b.label || `Point ${i + 1}`).trim().replace(/["\[\]\(\)]/g, '');
        const bId = `B${i + 1}`;
        mermaid += `  ROOT --> ${bId}["${bLabel}"]\n`;
        if (Array.isArray(b.children) && b.children.length > 0) {
          b.children.forEach((c, j) => {
            const cLabel = String(c || '').trim().replace(/["\[\]\(\)]/g, '');
            const cId = `C${i + 1}_${j + 1}`;
            mermaid += `  ${bId} --> ${cId}["${cLabel}"]\n`;
          });
        }
      });
    }
    return mermaid;
  }

  /**
   * Helper: Transforms live n8n Study Visualizer response payload into canonical LessonCard object.
   */
  function fromVisualizerPayload(data, answerText = '', grade = '6') {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const topic = data.topic || 'Lesson Concept';
    const central = (data.mindMap && data.mindMap.central) || topic;
    const branches = (data.mindMap && Array.isArray(data.mindMap.branches)) ? data.mindMap.branches : [];
    let mermaidSpec = (data.mindMap && data.mindMap.mermaid) ? data.mindMap.mermaid.trim() : '';
    if (!mermaidSpec && (central || branches.length > 0)) {
      mermaidSpec = buildMermaidFromBranches(central, branches);
    }

    // Convert quiz items to canonical format
    const rawQuiz = Array.isArray(data.quiz) ? data.quiz : [];
    const quizItems = rawQuiz.map((q, idx) => ({
      id: `q${idx + 1}`,
      question: q.q || q.question || `Question ${idx + 1}`,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: typeof q.answerIndex === 'number' ? q.answerIndex : (typeof q.correctIndex === 'number' ? q.correctIndex : 0),
      explanation: q.explain || q.explanation || '',
      citation: q.citation || `Class ${grade || '6'} Curriculum`
    }));

    // Convert flashcards to canonical format
    const rawCards = Array.isArray(data.flashcards) ? data.flashcards : [];
    const flashcards = rawCards.map((fc, idx) => ({
      id: `fc${idx + 1}`,
      front: fc.front || `Concept ${idx + 1}`,
      back: fc.back || '',
      explanation: fc.explanation || ''
    }));

    // Study Guide
    const rawKeyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
    const studyGuide = {
      topic: topic,
      grade: String(grade || '6'),
      keyPoints: rawKeyPoints,
      definitions: branches.map(b => ({
        term: b.label || '',
        definition: Array.isArray(b.children) ? b.children.join(', ') : ''
      })).filter(d => d.term),
      mustRemember: rawKeyPoints.slice(0, 3)
    };

    // Steps
    const rawSteps = Array.isArray(data.steps) ? data.steps.map(s => String(s).replace(/^\d+\.\s*/, '').trim()) : [];

    // Analogy
    const analogyText = typeof data.analogy === 'string' ? data.analogy.trim() : '';

    // Lesson Card Blocks
    const blocks = [];

    // 1) Analogy or Hook first
    if (analogyText) {
      blocks.push({
        type: 'analogy',
        text: analogyText
      });
    } else if (rawKeyPoints.length > 0) {
      blocks.push({
        type: 'hook',
        text: rawKeyPoints[0]
      });
    }

    // 2) Concept Mind Map (prominent, default)
    if (mermaidSpec) {
      blocks.push({
        type: 'diagram',
        kind: 'mermaid',
        title: topic,
        summary: central ? `Core Theme: ${central}` : '',
        spec: mermaidSpec
      });
    }

    // 3) Step by Step
    if (rawSteps.length > 0) {
      blocks.push({
        type: 'steps',
        items: rawSteps
      });
    }

    // 4) Quick Check (first quiz item if available)
    if (quizItems.length > 0) {
      const q1 = quizItems[0];
      const correctOpt = (q1.options && typeof q1.correctIndex === 'number' && q1.options[q1.correctIndex])
        ? q1.options[q1.correctIndex]
        : (q1.explanation || '');
      blocks.push({
        type: 'check',
        q: q1.question,
        a: correctOpt
      });
    }

    // Determine gradeTone
    const numGrade = parseInt(grade, 10);
    let gradeTone = 'junior';
    if (!isNaN(numGrade)) {
      if (numGrade >= 9) gradeTone = 'senior';
      else if (numGrade >= 6) gradeTone = 'middle';
      else gradeTone = 'junior';
    }

    const plain = (answerText && answerText.trim())
      ? answerText.trim()
      : (rawKeyPoints.join(' ') || topic);

    // Podcast Script
    const podcastScript = {
      title: `${topic} (Audio Lesson)`,
      duration: '0:45',
      caption: analogyText || rawKeyPoints[0] || topic,
      script: plain + (rawSteps.length > 0 ? ` Let's break it down: ${rawSteps.join('. ')}.` : '')
    };

    return {
      isRich: true,
      mood: 'explaining',
      gradeTone,
      blocks,
      plainText: plain,
      mindMap: {
        title: topic,
        spec: mermaidSpec,
        summary: central ? `Core Theme: ${central}` : ''
      },
      quizItems: quizItems.length > 0 ? quizItems : null,
      flashcards: flashcards.length > 0 ? flashcards : null,
      studyGuide,
      podcastScript
    };
  }

  /**
   * Helper: Creates a lightweight loading placeholder card with shimmer Concept Map.
   */
  function createLoadingCard(question = '', answer = '', grade = '6') {
    const cleanAnswer = (typeof answer === 'string' && answer.trim()) ? answer.trim() : '';
    const cleanQuestion = (typeof question === 'string' && question.trim()) ? question.trim() : 'Concept Exploration';

    const numGrade = parseInt(grade, 10);
    let gradeTone = 'junior';
    if (!isNaN(numGrade)) {
      if (numGrade >= 9) gradeTone = 'senior';
      else if (numGrade >= 6) gradeTone = 'middle';
      else gradeTone = 'junior';
    }

    return {
      isRich: true,
      isLoading: true,
      mood: 'explaining',
      gradeTone,
      blocks: [
        {
          type: 'diagram',
          kind: 'shimmer',
          loading: true,
          title: cleanQuestion,
          summary: 'Generating concept mind map & study formats...',
          spec: ''
        }
      ],
      plainText: cleanAnswer,
      mindMap: {
        title: cleanQuestion,
        loading: true,
        summary: 'Generating concept mind map...'
      },
      quizItems: null,
      flashcards: null,
      studyGuide: null,
      podcastScript: null
    };
  }

  /**
   * Calls the live n8n Study Visualizer webhook and returns a parsed LessonCard.
   */
  async function fetchStudyVisualizer({ question, answer, grade = '6', language = 'en', timeoutMs = 8000 } = {}) {
    if (!question || !question.trim()) {
      return null;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const payload = {
        question: question.trim(),
        answer: (answer || '').trim(),
        grade: String(grade || '6'),
        language: language || 'en'
      };

      const targetUrl = resolveStudyVisualizerEndpoint();
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[StudyVisualizer] Server responded with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const resultObj = Array.isArray(data) ? data[0] : (data?.data || data);

      if (!resultObj || typeof resultObj !== 'object') {
        return null;
      }

      return fromVisualizerPayload(resultObj, answer, grade);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[StudyVisualizer] Request failed or timed out:', err?.name === 'AbortError' ? 'Timeout' : err);
      return null;
    }
  }

  return {
    parse,
    render,
    SAMPLE_CARD,
    SAMPLE_QUIZ_ITEMS,
    SAMPLE_FLASHCARDS,
    SAMPLE_STUDY_GUIDE,
    SAMPLE_MIND_MAP,
    SAMPLE_PODCAST_SCRIPT,
    renderFallbackDiagram,
    renderQuiz,
    renderFlashcards,
    renderStudyGuide,
    renderMindMap,
    renderPodcast,
    renderStudyToolbar,
    renderStudyMode,
    buildMermaidFromBranches,
    fromVisualizerPayload,
    createLoadingCard,
    fetchStudyVisualizer
  };
});
