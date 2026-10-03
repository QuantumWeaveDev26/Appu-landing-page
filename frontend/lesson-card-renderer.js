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
   * Safe access to LottieCatalog (browser global or Node CommonJS module)
   */
  function getLottieCatalog() {
    if (typeof LottieCatalog !== 'undefined') return LottieCatalog;
    if (typeof window !== 'undefined' && window.LottieCatalog) return window.LottieCatalog;
    if (typeof globalThis !== 'undefined' && globalThis.LottieCatalog) return globalThis.LottieCatalog;
    if (typeof require === 'function') {
      try {
        return require('./lottie-catalog.js');
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function resolveCategoryForCard(cardOrData) {
    const catalog = getLottieCatalog();
    if (!catalog || typeof catalog.getCategoryForLesson !== 'function') return null;
    return catalog.getCategoryForLesson(cardOrData);
  }

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

  /**
   * Normalizes citation payload from n8n Study Visualizer or card input into canonical structure.
   * e.g. { label: "NCERT Class 7 Science - Nutrition in Animals", class: 7, subject: "Science", chapter: "Nutrition in Animals" }
   */
  function normalizeCitation(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed ? { label: trimmed } : null;
    }
    if (typeof raw === 'object') {
      let label = raw.label || raw.text || raw.title || '';
      if (!label && (raw.class || raw.subject)) {
        const parts = [];
        if (raw.class && raw.subject) parts.push(`NCERT Class ${raw.class} ${raw.subject}`);
        else if (raw.subject) parts.push(`NCERT ${raw.subject}`);
        if (raw.chapter) parts.push(raw.chapter);
        label = parts.join(' - ');
      }
      return label ? { ...raw, label } : null;
    }
    return null;
  }

  /**
   * Helper: Formats citation for UI pill rendering with appropriate icon and label.
   */
  function formatCitationDisplay(citation) {
    const norm = normalizeCitation(citation);
    if (!norm || !norm.label) return null;
    const rawLabel = norm.label;
    const isUpload = norm.source === 'upload' || rawLabel.toLowerCase().includes('upload');
    const icon = isUpload ? 'fa-file-lines' : 'fa-book-bookmark';
    const text = isUpload
      ? (rawLabel.startsWith('Source:') ? rawLabel : rawLabel)
      : (rawLabel.startsWith('Source:') || rawLabel.startsWith('From ') ? rawLabel : `Source: ${rawLabel}`);
    return { label: rawLabel, text, icon, isUpload };
  }

  const SAMPLE_CITATION = {
    label: 'NCERT Class 8 Science - Nutrition in Plants',
    class: 8,
    subject: 'Science',
    chapter: 'Nutrition in Plants'
  };

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
    citation: SAMPLE_CITATION,
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
    central: 'Photosynthesis',
    branches: [
      {
        label: 'Inputs & Energy',
        children: [
          'Sunlight (absorbed by chlorophyll)',
          'Water (drawn up from roots)',
          'Carbon Dioxide (absorbed from air)'
        ]
      },
      {
        label: 'Cellular Engine',
        children: [
          'Chloroplasts (special plant kitchens)',
          'Chlorophyll (green pigment trap)'
        ]
      },
      {
        label: 'How It Works',
        children: [
          'Light splits water molecules',
          'Carbon dioxide fixed into glucose'
        ]
      },
      {
        label: 'Vital Outputs',
        children: [
          'Glucose (fuel for plant growth)',
          'Oxygen (fresh air released for us)'
        ]
      }
    ],
    spec: 'flowchart TD; Sun["☀️ Sunlight"] --> Leaf["🍃 Chloroplast"]; Water["💧 Roots (H2O)"] --> Leaf; CO2["💨 Stomata (CO2)"] --> Leaf; Leaf --> LightRxn["⚡ Light Reaction"]; LightRxn --> Oxygen["🫧 Oxygen (O2) Released"]; Leaf --> DarkRxn["🧪 Calvin Cycle"]; DarkRxn --> Glucose["🍬 Glucose (Energy)"]; Glucose --> Starch["🪴 Growth & Starch"]',
    citation: SAMPLE_CITATION
  };

  const SAMPLE_PODCAST_SCRIPT = {
    title: 'Photosynthesis: The Secret Power of Leaves',
    duration: '0:45',
    caption: 'Leaves are basically solar-powered kitchens making food and oxygen for the planet.',
    script: 'Hey there! Welcome to the Appu Quick Audio Overview. Have you ever looked at a green leaf and thought: how does this little leaf eat without a mouth? Well, leaves are basically nature\'s solar-powered kitchens. Deep inside every leaf cell are tiny green factories called chloroplasts. When morning sunlight hits them, they grab water pulled up from the roots, mix in carbon dioxide from the breeze, and cook up sweet glucose sugar for energy! And the best part? They breathe out fresh, crisp oxygen for you and me to breathe. Pretty cool, right? You\'ve got this!',
    segments: [
      { label: 'Curious Hook', text: 'Have you ever looked at a green leaf and thought: how does this little leaf eat without a mouth?' },
      { label: 'Solar Kitchens', text: 'Leaves are basically nature\'s solar-powered kitchens with tiny green factories called chloroplasts.' },
      { label: 'Cooking Glucose', text: 'When morning sunlight hits them, they grab water from roots, mix in carbon dioxide from the breeze, and cook sweet glucose sugar.' },
      { label: 'Fresh Oxygen', text: 'And the best part? They breathe out fresh, crisp oxygen for you and me to breathe! You\'ve got this!' }
    ]
  };

  /**
   * Data Contract: Interactive Topic Diagrams v1
   * Returned by Appu Brain (Study Visualizer n8n) for topics with natural visual cycles/flows/parts.
   */
  const SAMPLE_DIAGRAM = {
    title: 'The Water Cycle',
    layout: 'cycle',
    citation: {
      label: 'NCERT Class 7 Science - Water: A Precious Resource',
      class: 7,
      subject: 'Science',
      chapter: 'Water: A Precious Resource'
    },
    parts: [
      {
        id: 'p1',
        label: 'Evaporation',
        explanation: 'Heat from the sun warms water in lakes, rivers, and oceans, turning liquid water into invisible water vapour that rises high into the atmosphere.'
      },
      {
        id: 'p2',
        label: 'Condensation',
        explanation: 'As warm water vapour climbs into the cool upper atmosphere, it cools down and clumps together to form fluffy clouds made of billions of tiny water droplets.'
      },
      {
        id: 'p3',
        label: 'Precipitation',
        explanation: 'When condensed water droplets in clouds merge and grow too heavy to float, gravity pulls them down to Earth as rain, snow, sleet, or hail.'
      },
      {
        id: 'p4',
        label: 'Collection',
        explanation: 'Fallen rainwater flows into rivers, lakes, oceans, and sinks into the ground as groundwater, completing the loop ready to evaporate again!'
      }
    ]
  };

  // Sample lesson-card for testing and scaffolding
  const SAMPLE_CARD = {
    mood: 'explaining',
    gradeTone: 'junior',
    citation: SAMPLE_CITATION,
    blocks: [
      { type: 'hook', text: 'Ever wonder how a plant eats without a mouth? 🌱' },
      {
        type: 'diagram',
        kind: 'mermaid',
        spec: 'flowchart LR; Sun-->Leaf; Water-->Leaf; CO2-->Leaf; Leaf-->Sugar; Leaf-->Oxygen',
        title: 'Photosynthesis Concept Map',
        central: 'Photosynthesis',
        branches: SAMPLE_MIND_MAP.branches,
        citation: SAMPLE_CITATION
      },
      { type: 'steps', items: ['Leaves catch sunlight', 'Roots drink water', 'Leaf mixes them into sugar', 'Plant breathes out oxygen'] },
      { type: 'analogy', text: 'A leaf is like a tiny solar-powered kitchen.' },
      { type: 'check', q: 'What gas does the plant breathe out?', a: 'Oxygen' }
    ],
    plainText: 'Plants make their food through photosynthesis. Leaves catch sunlight, roots absorb water from the soil, and they take in carbon dioxide from the air. Inside the leaf, these mix together to produce sugar for energy, and the plant releases oxygen for us to breathe!',
    quizItems: SAMPLE_QUIZ_ITEMS,
    flashcards: SAMPLE_FLASHCARDS,
    studyGuide: SAMPLE_STUDY_GUIDE,
    mindMap: SAMPLE_MIND_MAP,
    podcastScript: SAMPLE_PODCAST_SCRIPT,
    diagram: SAMPLE_DIAGRAM
  };

  let mermaidInitialized = false;

  function purgeMermaidErrorElements() {
    if (typeof document === 'undefined') return;
    try {
      const errorElements = document.querySelectorAll('[id^="dmermaid"], .error-icon, .mermaid-error');
      errorElements.forEach(el => el.remove());
    } catch {
      // ignore
    }
  }

  function initMermaidSafe() {
    if (mermaidInitialized) return true;
    if (typeof window !== 'undefined' && window.mermaid && typeof window.mermaid.initialize === 'function') {
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
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
        purgeMermaidErrorElements();
        return true;
      } catch (err) {
        console.warn('[LessonCard] Mermaid init failed:', err);
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
   * Normalizes interactive diagram payload from n8n Study Visualizer or card input into canonical structure.
   * Format:
   * {
   *   title: string,
   *   layout: "cycle" | "flow" | "parts",
   *   parts: [ { id: string, label: string, explanation: string } ]
   * }
   */
  function normalizeDiagram(raw, citation) {
    if (!raw || typeof raw !== 'object') return null;
    const partsArray = Array.isArray(raw.parts) ? raw.parts : [];
    if (partsArray.length < 2) return null;

    const validParts = partsArray
      .map((p, idx) => {
        if (!p || typeof p !== 'object') return null;
        const label = typeof p.label === 'string' ? p.label.trim() : '';
        if (!label) return null;
        return {
          id: p.id ? String(p.id).trim() : `p${idx + 1}`,
          label,
          explanation: typeof p.explanation === 'string' ? p.explanation.trim() : ''
        };
      })
      .filter(Boolean);

    if (validParts.length < 2) return null;

    const rawLayout = typeof raw.layout === 'string' ? raw.layout.toLowerCase().trim() : 'flow';
    const layout = ['cycle', 'flow', 'parts'].includes(rawLayout) ? rawLayout : 'flow';

    const title = typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : 'Interactive Topic Diagram';

    const normCitation = normalizeCitation(raw.citation || citation);

    return {
      title,
      layout,
      parts: validParts,
      citation: normCitation
    };
  }

  /**
   * Attempts to parse raw JSON or JSON-in-markdown into a verified lesson-card structure.
   * NEVER throws: returns a safe normalized card object with mandatory plainText.
   */
  function parse(input) {
    if (!input) {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: '', citation: null, diagram: null };
    }

    // Already an object
    if (typeof input === 'object' && input !== null) {
      const hasBlocks = Array.isArray(input.blocks) && input.blocks.length > 0;
      const plainText = typeof input.plainText === 'string' && input.plainText.trim()
        ? input.plainText.trim()
        : (typeof input.text === 'string' ? input.text : '');
      const rawMindMap = input.mindMap || (hasBlocks ? input.blocks.find(b => b && (b.type === 'mindMap' || b.type === 'diagram')) : null) || null;
      const rawCitation = normalizeCitation(input.citation || (hasBlocks ? input.blocks.find(b => b && b.citation)?.citation : null) || (rawMindMap && rawMindMap.citation));
      const rawDiagram = normalizeDiagram(
        input.diagram || (hasBlocks ? input.blocks.find(b => b && (b.type === 'interactiveDiagram' || b.type === 'topicDiagram' || (b.type === 'diagram' && Array.isArray(b.parts)))) : null) || null,
        rawCitation
      );

      return {
        isRich: hasBlocks,
        mood: typeof input.mood === 'string' ? input.mood : 'explaining',
        gradeTone: ['junior', 'middle', 'senior'].includes(input.gradeTone) ? input.gradeTone : 'junior',
        blocks: hasBlocks ? input.blocks : [],
        plainText,
        citation: rawCitation,
        mindMap: rawMindMap,
        quizItems: input.quizItems || null,
        flashcards: input.flashcards || null,
        studyGuide: input.studyGuide || null,
        podcastScript: input.podcastScript || null,
        diagram: rawDiagram
      };
    }

    if (typeof input !== 'string') {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: String(input), citation: null, diagram: null };
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return { isRich: false, mood: 'idle', gradeTone: 'junior', blocks: [], plainText: '', citation: null, diagram: null };
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
          const rawCitation = normalizeCitation(obj.citation || (hasBlocks ? obj.blocks.find(b => b && b.citation)?.citation : null) || (rawMindMap && rawMindMap.citation));
          const rawDiagram = normalizeDiagram(
            obj.diagram || (hasBlocks ? obj.blocks.find(b => b && (b.type === 'interactiveDiagram' || b.type === 'topicDiagram' || (b.type === 'diagram' && Array.isArray(b.parts)))) : null) || null,
            rawCitation
          );

          return {
            isRich: hasBlocks,
            mood: typeof obj.mood === 'string' ? obj.mood : 'explaining',
            gradeTone: ['junior', 'middle', 'senior'].includes(obj.gradeTone) ? obj.gradeTone : 'junior',
            blocks: hasBlocks ? obj.blocks : [],
            plainText,
            citation: rawCitation,
            mindMap: rawMindMap,
            quizItems: obj.quizItems || null,
            flashcards: obj.flashcards || null,
            studyGuide: obj.studyGuide || null,
            podcastScript: obj.podcastScript || null,
            diagram: rawDiagram
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
      citation: null,
      mindMap: null,
      quizItems: null,
      flashcards: null,
      studyGuide: null,
      podcastScript: null,
      diagram: null
    };
  }

  /**
   * Generates a semantic, styled HTML flowchart diagram when Mermaid is unavailable.
   */
  /**
   * Generates a semantic, styled HTML flowchart diagram when Mermaid is unavailable.
   */
  function renderFallbackDiagram(spec) {
    if (!spec || typeof spec !== 'string' || !spec.trim()) return '';

    // If spec is a single-root tree (Central -> Branches), render the clean Concept Tree!
    const parsed = parseMermaidToBranches(spec);
    if (parsed && parsed.isSingleRoot && parsed.central && Array.isArray(parsed.branches) && parsed.branches.length > 0) {
      return `
        <div class="diagram-flow-fallback diagram-concept-tree-fallback" role="figure" aria-label="Concept Flow">
          ${buildConceptTreeHTML(parsed.central, parsed.branches, { isDedicatedTab: false })}
        </div>
      `;
    }

    // Parse simple flowchart nodes (e.g. "Sun-->Leaf; Water-->Leaf" or newline-separated Mermaid)
    const clean = spec.replace(/^flowchart\s+[A-Z]{2};?/i, '').replace(/graph\s+[A-Z]{2};?/i, '');
    const statements = clean.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);

    if (statements.length === 0) {
      return `<div class="diagram-spec-fallback"><pre>${escapeHTML(spec)}</pre></div>`;
    }

    const labelMap = new Map();
    function parseNodeRef(raw) {
      if (!raw) return { id: '', label: '' };
      const m = raw.match(/^([A-Za-z0-9_]+)\s*[\[\(\{](?:["']?)(.+?)(?:["']?)[\]\)\}]$/);
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

    // If all links share the same 'from' node, render as clean concept tree so central parent is NEVER repeated!
    const allSameFrom = links.length > 1 && links.every(l => l.from === links[0].from);
    if (allSameFrom) {
      const central = links[0].from;
      const branches = links.map(l => ({ label: l.to, children: [] }));
      return `
        <div class="diagram-flow-fallback diagram-concept-tree-fallback" role="figure" aria-label="Concept Flow">
          ${buildConceptTreeHTML(central, branches, { isDedicatedTab: false })}
        </div>
      `;
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
   * Helper: Parses Mermaid flowchart statements into central node and branch trees.
   * Enables rendering the rich custom Concept Tree even when only raw Mermaid is available.
   */
  function parseMermaidToBranches(spec) {
    if (!spec || typeof spec !== 'string') return null;
    const clean = spec.replace(/^flowchart\s+[A-Z]{2};?/i, '').replace(/^graph\s+[A-Z]{2};?/i, '');
    const lines = clean.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const labelMap = new Map();
    const childrenMap = new Map();
    const parents = new Set();
    const allNodes = [];

    function registerNode(raw) {
      if (!raw) return '';
      const m = raw.match(/^([A-Za-z0-9_]+)\s*[\[\(\{](?:["']?)(.+?)(?:["']?)[\]\)\}]$/);
      if (m) {
        const id = m[1].trim();
        const label = m[2].trim();
        labelMap.set(id, label);
        if (!allNodes.includes(id)) allNodes.push(id);
        return id;
      }
      const cleanId = raw.replace(/^["']|["']$/g, '').trim();
      if (!labelMap.has(cleanId)) labelMap.set(cleanId, cleanId);
      if (!allNodes.includes(cleanId)) allNodes.push(cleanId);
      return cleanId;
    }

    for (const line of lines) {
      const parts = line.split(/-->|->|==>|-.->/);
      if (parts.length >= 2) {
        const parentId = registerNode(parts[0].trim());
        const childId = registerNode(parts[1].trim());
        if (parentId && childId) {
          if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
          childrenMap.get(parentId).push(childId);
          parents.add(childId);
        }
      }
    }

    const rootCandidates = allNodes.filter(id => childrenMap.has(id) && !parents.has(id));
    const isSingleRoot = rootCandidates.length <= 1;
    const rootId = rootCandidates.length > 0 ? rootCandidates[0] : allNodes[0];
    if (!rootId || !childrenMap.has(rootId)) return null;

    const central = labelMap.get(rootId) || rootId;
    const branchIds = childrenMap.get(rootId) || [];
    const branches = branchIds.map(bId => {
      const label = labelMap.get(bId) || bId;
      const cIds = childrenMap.get(bId) || [];
      const children = cIds.map(cId => labelMap.get(cId) || cId);
      return { label, children };
    });

    return { central, branches, isSingleRoot };
  }

  /**
   * Generates crisp, kid-friendly semantic HTML for the Concept Mind Map tree.
   * Solves the tiny/cramped Mermaid SVG issue by rendering real responsive text cards.
   */
  function buildConceptTreeHTML(central, branches, { isDedicatedTab = false } = {}) {
    if (!central && (!branches || branches.length === 0)) return '';

    const themeNames = ['sky', 'emerald', 'amber', 'purple', 'coral'];
    const themeIcons = ['fa-lightbulb', 'fa-seedling', 'fa-bolt', 'fa-atom', 'fa-star'];

    return `
      <div class="concept-tree-wrapper ${isDedicatedTab ? 'tree-dedicated' : 'tree-compact'}">
        <div class="concept-tree-central">
          <div class="central-node-pill from-node">
            <span class="central-node-icon"><i class="fa-solid fa-brain" aria-hidden="true"></i></span>
            <span class="central-node-text node-label">${escapeHTML(central || 'Core Concept')}</span>
          </div>
        </div>

        <div class="concept-tree-stalk" aria-hidden="true">
          <div class="stalk-stem-v"></div>
          <div class="stalk-hub-dot"></div>
          <div class="stalk-stem-h"></div>
        </div>

        <div class="concept-tree-branches-grid">
          ${(branches || []).map((b, idx) => {
            const theme = themeNames[idx % themeNames.length];
            const icon = themeIcons[idx % themeIcons.length];
            const children = Array.isArray(b.children) ? b.children : [];
            return `
              <div class="concept-branch-card to-node branch-theme-${theme}" style="--node-index: ${idx};">
                <div class="branch-card-top">
                  <span class="branch-order-chip" aria-hidden="true">${idx + 1}</span>
                  <span class="branch-theme-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
                  <h4 class="branch-title-text node-label">${escapeHTML(b.label || `Branch ${idx + 1}`)}</h4>
                </div>
                ${children.length > 0 ? `
                  <ul class="branch-leaf-list">
                    ${children.map(child => `
                      <li class="branch-leaf-node">
                        <span class="leaf-dot" aria-hidden="true"></span>
                        <span class="leaf-content">${escapeHTML(child)}</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
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
      const cit = formatCitationDisplay(data.citation);
      if (cit) {
        const pill = document.createElement('div');
        pill.className = `lesson-citation-pill plain-citation-pill ${cit.isUpload ? 'is-upload-source' : ''}`;
        pill.setAttribute('title', `Source: ${cit.label}`);
        pill.innerHTML = `<i class="fa-solid ${cit.icon} text-amber" aria-hidden="true"></i> <span>${escapeHTML(cit.text)}</span>`;
        plainDiv.appendChild(pill);
      }
      const p = document.createElement('p');
      p.textContent = data.plainText || '';
      plainDiv.appendChild(p);
      container.appendChild(plainDiv);
      return container;
    }

    const citationObj = normalizeCitation(data.citation);
    const topCit = formatCitationDisplay(citationObj);
    const hasDiagram = data.blocks.some(b => b && (b.type === 'diagram' || b.type === 'mindMap'));

    if (topCit && !hasDiagram) {
      const topCitation = document.createElement('div');
      topCitation.className = 'lesson-top-citation-wrap';
      topCitation.innerHTML = `
        <div class="lesson-citation-pill plain-citation-pill ${topCit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(topCit.label)}">
          <i class="fa-solid ${topCit.icon} text-amber" aria-hidden="true"></i>
          <span>${escapeHTML(topCit.text)}</span>
        </div>
      `;
      container.appendChild(topCitation);
    }

    // 2. Render blocks top-to-bottom
    data.blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') return;

      switch (block.type) {
        case 'hook': {
          const hookDiv = document.createElement('div');
          hookDiv.className = 'lesson-block lesson-block-hook';
          const cat = resolveCategoryForCard(data);
          const catalog = getLottieCatalog();
          const topic = data.topic || data.title || (data.mindMap && data.mindMap.central) || (cat && cat.label) || 'Learning Mission';
          const existingIllustrationUrl = data.__diagramIllustrationUrl || data.diagramIllustrationUrl || null;

          let stickerHTML = '';
          if (cat) {
            stickerHTML = `<span class="lesson-topic-sticker" title="${escapeHTML(cat.label)}" style="--cat-accent: ${cat.accentColor};"><span class="sticker-emoji">${cat.emoji}</span> <span class="sticker-label">${escapeHTML(cat.label)}</span></span>`;
          }

          // 1. Hero AI Visual Image HTML (prominent hero)
          let heroImageHTML = '';
          if (existingIllustrationUrl) {
            heroImageHTML = `
              <div class="lesson-hero-media-card has-image" data-active-source="ai">
                <div class="hero-image-frame">
                  <img class="hero-main-img" src="${existingIllustrationUrl}" alt="${escapeHTML(topic)}" loading="lazy" />
                  <div class="hero-media-badge-bar">
                    <span class="hero-media-tag ai-tag"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i> AI Concept Visual</span>
                    <span class="hero-media-source-pill">Grounded Topic</span>
                  </div>
                </div>
              </div>
            `;
          } else {
            heroImageHTML = `
              <div class="lesson-hero-media-card is-loading" role="status" aria-label="Painting visual illustration">
                <div class="hero-media-shimmer">
                  <div class="shimmer-sparkle"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i></div>
                  <span class="shimmer-text">Painting visual illustration for ${escapeHTML(topic)}...</span>
                </div>
              </div>
            `;
          }

          // 2. Real Photos Gallery HTML (hidden until photos load)
          const photosGalleryHTML = `
            <div class="lesson-photos-gallery" style="display: none;" role="region" aria-label="Real world photos">
              <div class="photos-gallery-header">
                <div class="photos-gallery-title">
                  <i class="fa-solid fa-camera-retro text-amber" aria-hidden="true"></i>
                  <span>Real World Field Photos</span>
                  <span class="photos-count-badge"></span>
                </div>
                <span class="photos-license-badge" title="Verified Safe Creative Commons content"><i class="fa-brands fa-creative-commons" aria-hidden="true"></i> CC Safe</span>
              </div>
              <div class="photos-gallery-track"></div>
            </div>
          `;

          // 3. Watch: Rich Lottie Explainer Mini-Panel
          let watchPanelHTML = '';
          if (cat) {
            const svgMarkup = catalog && typeof catalog.getAnimatedSVG === 'function'
              ? catalog.getAnimatedSVG(cat.id, { size: 130 })
              : '';
            watchPanelHTML = `
              <div class="lesson-watch-panel" data-category="${cat.id}">
                <div class="watch-panel-header">
                  <div class="watch-panel-title">
                    <i class="fa-solid fa-circle-play text-emerald" aria-hidden="true"></i>
                    <span>Watch: ${escapeHTML(cat.label)} Explainer</span>
                  </div>
                  <span class="watch-badge"><span class="watch-dot"></span> 60 FPS</span>
                </div>
                <div class="watch-lottie-stage" aria-label="${escapeHTML(cat.label)} animation">
                  ${svgMarkup}
                </div>
                <div class="watch-panel-caption">${escapeHTML(cat.description)}</div>
              </div>
            `;
          }

          hookDiv.innerHTML = `
            <div class="hook-kicker-row">
              <div class="hook-kicker"><i class="fa-solid fa-sparkles text-amber" aria-hidden="true"></i> <span>Did you know?</span></div>
              ${stickerHTML}
            </div>
            <p class="hook-text">${escapeHTML(block.text || '')}</p>
            <div class="lesson-rich-media-wrap">
              ${heroImageHTML}
              ${photosGalleryHTML}
            </div>
            ${watchPanelHTML}
          `;

          // Asynchronously mount Lottie player on stage
          if (typeof window !== 'undefined' && catalog && typeof catalog.mountAnimation === 'function') {
            setTimeout(() => {
              const stage = hookDiv.querySelector ? hookDiv.querySelector('.watch-lottie-stage') : null;
              if (stage) {
                catalog.mountAnimation(stage, cat ? cat.id : 'idea');
              }
            }, 0);
          }

          // Asynchronously fetch AI illustration if not already present
          if (typeof window !== 'undefined' && options.disableIllustration !== true) {
            const heroCard = hookDiv.querySelector ? hookDiv.querySelector('.lesson-hero-media-card') : null;
            if (heroCard && heroCard.classList && heroCard.classList.contains('is-loading')) {
              const gradeToFetch = options.grade || (data && data.grade) || '6';
              const imgPromise = data.__diagramIllustrationPromise || fetchStudyImage({
                topic,
                grade: gradeToFetch,
                timeoutMs: options.imageTimeoutMs || 28000
              });

              if (!data.__diagramIllustrationPromise) {
                try {
                  Object.defineProperty(data, '__diagramIllustrationPromise', {
                    value: imgPromise,
                    writable: true,
                    enumerable: false,
                    configurable: true
                  });
                } catch (_) {
                  data.__diagramIllustrationPromise = imgPromise;
                }
              }

              imgPromise.then(res => {
                const currentHero = hookDiv.querySelector ? hookDiv.querySelector('.lesson-hero-media-card') : null;
                if (!currentHero) return;
                if (res && res.imageUrl) {
                  try {
                    Object.defineProperty(data, '__diagramIllustrationUrl', {
                      value: res.imageUrl,
                      writable: true,
                      enumerable: false,
                      configurable: true
                    });
                  } catch (_) {
                    data.__diagramIllustrationUrl = res.imageUrl;
                  }

                  currentHero.className = 'lesson-hero-media-card has-image';
                  if (typeof currentHero.removeAttribute === 'function') {
                    currentHero.removeAttribute('role');
                    currentHero.removeAttribute('aria-label');
                  }
                  currentHero.innerHTML = `
                    <div class="hero-image-frame">
                      <img class="hero-main-img" src="${res.imageUrl}" alt="${escapeHTML(topic)}" loading="lazy" />
                      <div class="hero-media-badge-bar">
                        <span class="hero-media-tag ai-tag"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i> AI Concept Visual</span>
                        <span class="hero-media-source-pill">Grounded Topic</span>
                      </div>
                    </div>
                  `;
                }
              });
            }

            // Asynchronously fetch Openverse Real Photos
            const galleryEl = hookDiv.querySelector ? hookDiv.querySelector('.lesson-photos-gallery') : null;
            if (galleryEl) {
              fetchOpenversePhotos({ topic }).then(result => {
                if (!result || !Array.isArray(result.photos) || result.photos.length < 2) {
                  return;
                }

                const track = galleryEl.querySelector ? galleryEl.querySelector('.photos-gallery-track') : null;
                const countBadge = galleryEl.querySelector ? galleryEl.querySelector('.photos-count-badge') : null;
                if (!track) return;

                if (countBadge) countBadge.textContent = `${result.photos.length} Photos`;

                track.innerHTML = result.photos.map(p => `
                  <div class="photo-card" data-photo-url="${escapeHTML(p.url)}" data-photo-title="${escapeHTML(p.title)}" data-creator="${escapeHTML(p.creator)}" data-license="${escapeHTML(p.license)}" data-landing="${escapeHTML(p.foreignLandingUrl)}">
                    <div class="photo-thumb-wrap">
                      <img src="${escapeHTML(p.thumbnail)}" alt="${escapeHTML(p.title)}" loading="lazy" class="photo-thumb" />
                      <span class="photo-license-pill">${escapeHTML(p.license)}</span>
                    </div>
                    <div class="photo-card-info">
                      <a href="${escapeHTML(p.foreignLandingUrl)}" target="_blank" rel="noopener noreferrer" class="photo-attribution-link" title="Open CC source: ${escapeHTML(p.title)}">
                        <span class="photo-creator-name">${escapeHTML(p.creator)}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                      </a>
                    </div>
                  </div>
                `).join('');

                if (galleryEl.style) galleryEl.style.display = 'block';
                if (galleryEl.classList) galleryEl.classList.add('pop-in');

                if (typeof track.querySelectorAll === 'function') {
                  const cards = track.querySelectorAll('.photo-card');
                  cards.forEach(card => {
                    card.addEventListener('click', (e) => {
                      if (e.target && e.target.closest && e.target.closest('.photo-attribution-link')) return;
                      const heroFrame = hookDiv.querySelector ? hookDiv.querySelector('.hero-image-frame') : null;
                      if (!heroFrame) return;

                      const photoUrl = card.getAttribute('data-photo-url');
                      const photoTitle = card.getAttribute('data-photo-title');
                      const creator = card.getAttribute('data-creator');
                      const license = card.getAttribute('data-license');
                      const landing = card.getAttribute('data-landing');

                      cards.forEach(c => c.classList && c.classList.remove('is-active'));
                      if (card.classList) card.classList.add('is-active');

                      heroFrame.innerHTML = `
                        <img class="hero-main-img" src="${photoUrl}" alt="${photoTitle}" />
                        <div class="hero-media-badge-bar">
                          <span class="hero-media-tag real-tag"><i class="fa-solid fa-camera-retro text-amber" aria-hidden="true"></i> Real Field Photo</span>
                          <a href="${landing}" target="_blank" rel="noopener noreferrer" class="hero-media-source-pill cc-pill" title="View Source on Flickr/Wikimedia">
                            ${license} • ${creator} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                          </a>
                        </div>
                      `;
                    });
                  });
                }
              });
            }
          }

          container.appendChild(hookDiv);
          break;
        }

        case 'diagram': {
          const diagDiv = document.createElement('div');
          diagDiv.className = 'lesson-block lesson-block-diagram lesson-block-mindmap';
          const diagId = 'mermaid-' + Math.random().toString(36).substring(2, 10);
          const mmInfo = data.mindMap || {};
          const bCitationObj = normalizeCitation(block.citation || mmInfo.citation || data.citation);
          const bCit = formatCitationDisplay(bCitationObj);
          const title = block.title || mmInfo.title || '';
          const summary = block.summary || mmInfo.summary || '';
          let central = block.central || mmInfo.central || title;
          let branches = (Array.isArray(block.branches) && block.branches.length > 0)
            ? block.branches
            : (Array.isArray(mmInfo.branches) && mmInfo.branches.length > 0 ? mmInfo.branches : []);
          const spec = block.spec || mmInfo.spec || '';

          if (block.kind === 'shimmer' || block.loading) {
            diagDiv.classList.add('diagram-block-loading');
            diagDiv.innerHTML = `
              <div class="diagram-header">
                <div class="diagram-header-left">
                  <i class="fa-solid fa-diagram-project text-cyan" aria-hidden="true"></i>
                  <span>Concept Mind Map</span>
                  <span class="diagram-loading-badge"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating...</span>
                </div>
                ${bCit ? `
                  <div class="lesson-citation-pill ${bCit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(bCit.label)}">
                    <i class="fa-solid ${bCit.icon} text-amber" aria-hidden="true"></i>
                    <span>${escapeHTML(bCit.text)}</span>
                  </div>
                ` : ''}
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

          // If branches missing but spec available, parse branches from Mermaid spec
          if (branches.length === 0 && spec) {
            const parsed = parseMermaidToBranches(spec);
            if (parsed) {
              central = central || parsed.central;
              branches = parsed.branches;
            }
          }

          // Fallback to branches derived from lesson text if branches missing
          if (branches.length === 0) {
            const derived = extractBranchesFromText(data.plainText || title || central);
            if (derived.length > 0) {
              branches = derived;
            } else if (central) {
              branches = [{ label: central, children: [] }];
            }
          }

          diagDiv.innerHTML = `
            <div class="diagram-header">
              <div class="diagram-header-left">
                <i class="fa-solid fa-diagram-project text-cyan" aria-hidden="true"></i>
                <span>Concept Mind Map</span>
                <span class="diagram-live-badge">Live Visual</span>
              </div>
              ${bCit ? `
                <div class="lesson-citation-pill ${bCit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(bCit.label)}">
                  <i class="fa-solid ${bCit.icon} text-amber" aria-hidden="true"></i>
                  <span>${escapeHTML(bCit.text)}</span>
                </div>
              ` : ''}
            </div>
            ${title ? `<div class="diagram-meta"><h4 class="diagram-title">${escapeHTML(title)}</h4>${summary ? `<p class="diagram-summary">${escapeHTML(summary)}</p>` : ''}</div>` : (summary ? `<div class="diagram-meta"><p class="diagram-summary">${escapeHTML(summary)}</p>` : '')}
            <div class="diagram-canvas-wrap is-concept-mindmap" id="${diagId}-wrap">
              <div class="concept-tree-container">
                ${buildConceptTreeHTML(central, branches, { isDedicatedTab: false })}
              </div>
            </div>
          `;
          container.appendChild(diagDiv);
          purgeMermaidErrorElements();
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
              ${(() => {
                const cit = formatCitationDisplay(q.citation);
                if (!cit) return '';
                return `
                  <div class="quiz-citation-pill ${cit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(cit.label)}">
                    <i class="fa-solid ${cit.icon} text-amber" aria-hidden="true"></i>
                    <span>${escapeHTML(cit.text)}</span>
                  </div>
                `;
              })()}
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

    const cat = resolveCategoryForCard(options.card || guide);
    const cit = formatCitationDisplay(guide.citation || (options && options.citation));

    const childGrade = (typeof window !== 'undefined' && window.getActiveChildGrade && typeof window.getActiveChildGrade === 'function')
      ? window.getActiveChildGrade()
      : null;
    const rawGuideGrade = guide.grade ? String(guide.grade) : '';
    const isAnonymous = !childGrade;
    const isClass6 = /^(?:class\s*)?6$/i.test(rawGuideGrade.trim());
    const guideGradeLabel = (isAnonymous && isClass6)
      ? 'Interactive Learning'
      : (rawGuideGrade ? (rawGuideGrade.toLowerCase().startsWith('class') ? rawGuideGrade : `Class ${rawGuideGrade}`) : 'Interactive Learning');

    container.innerHTML = `
      <div class="guide-header">
        <div class="guide-badge-row">
          <div class="guide-badge">
            <i class="fa-solid fa-book-open-reader text-cyan" aria-hidden="true"></i>
            <span>Study Guide</span>
            <span class="guide-grade-pill">${escapeHTML(guideGradeLabel)}</span>
          </div>
          ${cat ? `<span class="category-badge category-${cat.id}"><span class="cat-emoji">${cat.emoji}</span> ${escapeHTML(cat.label)}</span>` : ''}
          ${cit ? `
            <div class="lesson-citation-pill ${cit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(cit.label)}">
              <i class="fa-solid ${cit.icon} text-amber" aria-hidden="true"></i>
              <span>${escapeHTML(cit.text)}</span>
            </div>
          ` : ''}
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

    const title = mapData.title || (isShimmer ? 'Generating Mind Map...' : 'Photosynthesis Concept Map');
    const summary = mapData.summary || (isShimmer ? 'Creating structured visual concept map...' : 'Trace inputs, cellular reactions, and vital outputs');
    let central = mapData.central || title;
    let branches = Array.isArray(mapData.branches) && mapData.branches.length > 0 ? mapData.branches : [];
    const spec = mapData.spec || '';

    // If branches missing but spec available, parse branches from spec
    if (!isShimmer && branches.length === 0 && spec) {
      const parsed = parseMermaidToBranches(spec);
      if (parsed) {
        central = central || parsed.central;
        branches = parsed.branches;
      }
    }

    if (!isShimmer && branches.length === 0) {
      const derived = extractBranchesFromText(mapData.plainText || mapData.summary || central);
      if (derived.length > 0) {
        branches = derived;
      } else if (central) {
        branches = [{ label: central, children: [] }];
      }
    }

    const cat = resolveCategoryForCard(options.card || mapData);
    const cit = formatCitationDisplay(mapData.citation || (options && options.citation));

    container.innerHTML = `
      <div class="mindmap-header">
        <div class="mindmap-badge-row">
          <div class="mindmap-badge">
            <i class="fa-solid fa-network-wired text-cyan" aria-hidden="true"></i>
            <span>Concept Tree</span>
            ${isShimmer ? '<span class="diagram-loading-badge"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating...</span>' : '<span class="diagram-live-badge">Live Visual</span>'}
          </div>
          ${cat ? `<span class="category-badge category-${cat.id}"><span class="cat-emoji">${cat.emoji}</span> ${escapeHTML(cat.label)}</span>` : ''}
          ${cit ? `
            <div class="lesson-citation-pill ${cit.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(cit.label)}">
              <i class="fa-solid ${cit.icon} text-amber" aria-hidden="true"></i>
              <span>${escapeHTML(cit.text)}</span>
            </div>
          ` : ''}
        </div>
        <h2 class="mindmap-title">${escapeHTML(title)}</h2>
        <p class="mindmap-desc">${escapeHTML(summary)}</p>
      </div>

      <div class="mindmap-canvas-wrap is-concept-mindmap" id="${diagId}-wrap">
        ${isShimmer ? `
          <div class="diagram-shimmer-loading" role="status" aria-label="Generating mind map">
            <div class="shimmer-sparkle"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i></div>
            <div class="shimmer-bar shimmer-bar-1"></div>
            <div class="shimmer-bar shimmer-bar-2"></div>
            <div class="shimmer-bar shimmer-bar-3"></div>
            <div class="shimmer-text">Generating visual concept map...</div>
          </div>
        ` : `
          <div class="concept-tree-container">
            ${buildConceptTreeHTML(central, branches, { isDedicatedTab: true })}
          </div>
        `}
      </div>
    `;

    purgeMermaidErrorElements();
    return container;
  }

  /**
   * 5) Appu Podcast (Audio Overview): Audio player UI with chapters, equalizer, progress, caption,
   * supporting ElevenLabs real voice (audio_base64) with seamless SpeechSynthesis fallback
   */
  function renderPodcast(podcastScript, options = {}) {
    const data = podcastScript || SAMPLE_PODCAST_SCRIPT;
    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-podcast';

    const citationDisplay = formatCitationDisplay(data.citation || options.citation);
    const citationHtml = citationDisplay
      ? `<span class="lesson-citation-pill ${citationDisplay.isUpload ? 'is-upload-source' : ''}"><i class="fa-solid ${citationDisplay.icon}" aria-hidden="true"></i> ${escapeHTML(citationDisplay.text)}</span>`
      : '';

    const segments = Array.isArray(data.segments) ? data.segments : [];

    // Parse duration seconds
    let totalSeconds = 45;
    if (data.duration && typeof data.duration === 'string') {
      const parts = data.duration.split(':');
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        if (!isNaN(m) && !isNaN(s)) {
          totalSeconds = Math.max(10, m * 60 + s);
        }
      }
    } else {
      const fullTxt = data.script || segments.map(s => s.text).join(' ');
      const words = fullTxt.split(/\s+/).filter(Boolean).length;
      totalSeconds = Math.max(30, Math.ceil((words / 140) * 60));
    }
    const formattedDuration = `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60) < 10 ? '0' : ''}${totalSeconds % 60}`;

    // Compute segment time bounds for dynamic chapter highlighting
    let segmentBounds = [];
    function recomputeSegmentBounds() {
      const totalChars = segments.reduce((sum, s) => sum + (s.text || '').length, 0) || 1;
      let accumulated = 0;
      segmentBounds = segments.map((seg, i) => {
        const segRatio = (seg.text || '').length / totalChars;
        const segSecs = Math.max(2, Math.round(segRatio * totalSeconds));
        const start = accumulated;
        accumulated += segSecs;
        return { index: i, start, end: accumulated, label: seg.label, text: seg.text };
      });
      if (segmentBounds.length > 0) {
        segmentBounds[segmentBounds.length - 1].end = totalSeconds;
      }
    }
    recomputeSegmentBounds();

    // Check for real ElevenLabs audio (audio_base64)
    const rawAudioBase64 = data.audio_base64 || data.audioBase64 || null;
    const hasAudioBase64 = Boolean(typeof rawAudioBase64 === 'string' && rawAudioBase64.trim());
    const audioSrc = hasAudioBase64
      ? (rawAudioBase64.startsWith('data:') ? rawAudioBase64 : `data:audio/mpeg;base64,${rawAudioBase64.trim()}`)
      : null;

    const kickerHtml = hasAudioBase64
      ? '<span class="podcast-badge-kicker"><i class="fa-solid fa-sparkles text-cyan" aria-hidden="true"></i> Appu\'s Voice</span>'
      : '<span class="podcast-badge-kicker">Audio Lesson</span>';

    const segmentsHtml = segments.length > 0
      ? `
        <div class="podcast-segments-section">
          <div class="podcast-segments-head">
            <span class="podcast-segments-title"><i class="fa-solid fa-layer-group text-cyan" aria-hidden="true"></i> Lesson Chapters</span>
            <span class="podcast-segments-count">${segments.length} chapters</span>
          </div>
          <div class="podcast-segments-list" role="list">
            ${segments.map((seg, idx) => `
              <div class="podcast-segment-card ${idx === 0 ? 'is-active-segment' : ''}" data-segment-index="${idx}" role="listitem" tabindex="0">
                <div class="segment-card-head">
                  <span class="segment-number">${idx + 1}</span>
                  <span class="segment-label">${escapeHTML(seg.label || `Chapter ${idx + 1}`)}</span>
                  <button type="button" class="btn-segment-play" data-segment-index="${idx}" aria-label="Play chapter: ${escapeHTML(seg.label || `Chapter ${idx + 1}`)}">
                    <i class="fa-solid fa-play" aria-hidden="true"></i>
                  </button>
                </div>
                <p class="segment-text">${escapeHTML(seg.text || '')}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    container.innerHTML = `
      <div class="podcast-header">
        <div class="podcast-badge-group">
          <div class="podcast-badge"><i class="fa-solid fa-headphones text-cyan" aria-hidden="true"></i> <span>Appu Podcast</span></div>
          ${kickerHtml}
        </div>
        ${citationHtml}
      </div>
      <div class="podcast-player-card">
        <div class="podcast-info-row">
          <div class="podcast-avatar-bubble">
            <img src="assets/appu-cutout-new.png" alt="Appu" width="48" height="48">
          </div>
          <div class="podcast-title-meta">
            <h3 class="podcast-title">${escapeHTML(data.title || 'Photosynthesis: The Secret Power of Leaves')}</h3>
            <span class="podcast-duration"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${escapeHTML(data.duration || formattedDuration)}</span>
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
            <span class="time-total">${escapeHTML(data.duration || formattedDuration)}</span>
          </div>
        </div>

        <div class="podcast-controls-row">
          <button type="button" class="podcast-play-btn" aria-label="Play Appu Audio Lesson">
            <i class="fa-solid fa-play play-icon" aria-hidden="true"></i>
            <span class="play-btn-text">Listen to this lesson</span>
          </button>
        </div>

        <div class="podcast-caption-box">
          <span class="caption-label"><i class="fa-solid fa-quote-left text-cyan" aria-hidden="true"></i> Appu says:</span>
          <p class="podcast-caption-text">${escapeHTML(data.caption || (segments[0] && segments[0].text) || data.script || 'Leaves are basically solar-powered kitchens making food and oxygen.')}</p>
        </div>
      </div>
      ${segmentsHtml}
    `;

    const playBtn = container.querySelector('.podcast-play-btn');
    const playerCard = container.querySelector('.podcast-player-card');
    const progressFill = container.querySelector('.podcast-progress-fill');
    const timeElapsed = container.querySelector('.time-elapsed');
    const timeTotal = container.querySelector('.time-total');
    const captionText = container.querySelector('.podcast-caption-text');
    const segmentCards = typeof container.querySelectorAll === 'function'
      ? container.querySelectorAll('.podcast-segment-card')
      : [];

    // Native audio element instantiation when ElevenLabs audio is present
    let audioElement = null;
    if (audioSrc) {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        try {
          audioElement = document.createElement('audio');
          audioElement.src = audioSrc;
          audioElement.preload = 'metadata';
          audioElement.className = 'podcast-native-audio';
          audioElement.style.display = 'none';
          container.appendChild(audioElement);
        } catch (_) {
          audioElement = null;
        }
      } else if (typeof Audio !== 'undefined') {
        try {
          audioElement = new Audio(audioSrc);
        } catch (_) {
          audioElement = null;
        }
      }
    }

    if (audioElement && typeof audioElement.addEventListener === 'function') {
      audioElement.addEventListener('loadedmetadata', () => {
        if (isFinite(audioElement.duration) && audioElement.duration > 0) {
          totalSeconds = Math.round(audioElement.duration);
          recomputeSegmentBounds();
          const m = Math.floor(totalSeconds / 60);
          const s = totalSeconds % 60;
          const fmt = `${m}:${s < 10 ? '0' : ''}${s}`;
          if (timeTotal) timeTotal.textContent = fmt;
          const durBadge = container.querySelector('.podcast-duration');
          if (durBadge) {
            durBadge.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i> ${escapeHTML(fmt)}`;
          }
        }
      });
      audioElement.addEventListener('ended', () => {
        stopPlayback(true);
        if (progressFill) progressFill.style.width = '100%';
      });
      audioElement.addEventListener('pause', () => {
        if (!audioElement.ended && !isPaused && isPlaying) {
          pausePlayback();
        }
      });
    }

    let isPlaying = false;
    let isPaused = false;
    let progressInterval = null;
    let elapsedSeconds = 0;
    let activeSegmentIdx = 0;

    function highlightSegment(idx) {
      if (!segmentCards || typeof segmentCards.forEach !== 'function') return;
      if (idx === activeSegmentIdx && segmentCards[idx]?.classList?.contains('is-active-segment')) return;
      activeSegmentIdx = idx;
      segmentCards.forEach((c, i) => {
        if (i === idx) {
          c.classList?.add('is-active-segment');
          try { c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
        } else {
          c.classList?.remove('is-active-segment');
        }
      });
      if (segments[idx] && captionText) {
        captionText.textContent = segments[idx].text || '';
      }
    }

    function stopPlayback(isComplete = false) {
      isPlaying = false;
      isPaused = false;
      if (playerCard) playerCard.classList.remove('is-playing');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-play play-icon" aria-hidden="true"></i> <span class="play-btn-text">' + (isComplete ? 'Listen again' : 'Listen to this lesson') + '</span>';
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (audioElement && typeof audioElement.pause === 'function') {
        try {
          audioElement.pause();
          if (isComplete && isFinite(audioElement.currentTime)) {
            audioElement.currentTime = 0;
          }
        } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
    }

    function pausePlayback() {
      isPlaying = false;
      isPaused = true;
      if (playerCard) playerCard.classList.remove('is-playing');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-play play-icon" aria-hidden="true"></i> <span class="play-btn-text">Resume</span>';
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (audioElement && typeof audioElement.pause === 'function') {
        try { audioElement.pause(); } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.pause(); } catch (_) {}
      }
    }

    function startPlayback(customText = null, startFromSecond = null) {
      isPlaying = true;
      isPaused = false;
      if (playerCard) playerCard.classList.add('is-playing');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause play-icon" aria-hidden="true"></i> <span class="play-btn-text">Pause</span>';
      }

      // 1. Native ElevenLabs audio playback
      if (audioElement) {
        try {
          if (startFromSecond !== null && isFinite(startFromSecond)) {
            audioElement.currentTime = startFromSecond;
            elapsedSeconds = Math.round(startFromSecond);
          }
          const playPromise = audioElement.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((err) => {
              console.warn('[LessonCard] Audio play error:', err);
            });
          }
        } catch (e) {
          console.warn('[LessonCard] Native audio play exception:', e);
        }

        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(() => {
          if (!audioElement) return;
          const curr = isFinite(audioElement.currentTime) ? audioElement.currentTime : elapsedSeconds;
          elapsedSeconds = Math.round(curr);
          const dur = (isFinite(audioElement.duration) && audioElement.duration > 0) ? audioElement.duration : totalSeconds;
          const pct = Math.min(100, Math.round((curr / dur) * 100));
          if (progressFill) progressFill.style.width = pct + '%';
          const m = Math.floor(curr / 60);
          const s = Math.floor(curr % 60);
          if (timeElapsed) timeElapsed.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;

          if (segmentBounds.length > 0) {
            const currentBound = segmentBounds.find(st => curr >= st.start && curr < st.end);
            if (currentBound) {
              highlightSegment(currentBound.index);
            }
          }

          if (audioElement.ended || curr >= dur) {
            stopPlayback(true);
            if (progressFill) progressFill.style.width = '100%';
            if (timeElapsed) timeElapsed.textContent = formattedDuration;
          }
        }, 250);

        return;
      }

      // 2. Fallback SpeechSynthesis path
      const textToSpeak = customText || data.script || segments.map(s => s.text).join(' ');
      if (startFromSecond !== null) {
        elapsedSeconds = startFromSecond;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window && textToSpeak) {
        try {
          if (window.speechSynthesis.paused && isPaused) {
            window.speechSynthesis.resume();
          } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.rate = 1.0;
            utterance.pitch = 1.05;
            utterance.onend = () => {
              stopPlayback(true);
              if (progressFill) progressFill.style.width = '100%';
              if (timeElapsed) timeElapsed.textContent = formattedDuration;
            };
            utterance.onerror = () => {
              // Keep timer running visually
            };
            window.speechSynthesis.speak(utterance);
          }
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

        if (segmentBounds.length > 0) {
          const currentBound = segmentBounds.find(st => elapsedSeconds >= st.start && elapsedSeconds < st.end);
          if (currentBound) {
            highlightSegment(currentBound.index);
          }
        }

        if (elapsedSeconds >= totalSeconds) {
          stopPlayback(true);
          elapsedSeconds = 0;
        }
      }, 1000);
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (isPlaying) {
          pausePlayback();
        } else {
          startPlayback();
        }
      });
    }

    if (typeof container.querySelectorAll === 'function') {
      container.querySelectorAll('.btn-segment-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-segment-index'), 10);
          if (!isNaN(idx) && segments[idx]) {
            const bound = segmentBounds[idx];
            highlightSegment(idx);
            if (audioElement) {
              startPlayback(null, bound ? bound.start : 0);
            } else {
              startPlayback(segments[idx].text, bound ? bound.start : null);
            }
          }
        });
      });
    }

    if (segmentCards && typeof segmentCards.forEach === 'function') {
      segmentCards.forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.getAttribute('data-segment-index'), 10);
          if (!isNaN(idx) && segments[idx]) {
            const bound = segmentBounds[idx];
            highlightSegment(idx);
            if (audioElement) {
              startPlayback(null, bound ? bound.start : 0);
            } else {
              startPlayback(segments[idx].text, bound ? bound.start : null);
            }
          }
        });
      });
    }

    return container;
  }

  const DIAGRAM_I18N = {
    en: {
      explore: 'Explore (Tap)',
      practice: 'Practice (Drag)',
      tapToExplore: 'Tap any part to explore how it works ✨',
      dragToLabel: 'Drag or tap labels into the matching slots! 🎯',
      dropPlaceholder: 'Drop label here',
      labelBank: 'Label Bank',
      reset: 'Reset',
      correct: 'Correct',
      tryAgain: 'Not quite! Try another slot.',
      mastered: 'Diagram Mastered! 🎉',
      masteredSub: 'You correctly identified and labeled every part of the diagram!',
      nextPart: 'Next',
      prevPart: 'Previous',
      cycleBadge: 'Cycle',
      flowBadge: 'Linear Flow',
      partsBadge: 'Components',
      stepOf: (curr, total) => `Part ${curr} of ${total}`,
      xpAwarded: '+20 XP ⭐'
    },
    kn: {
      explore: 'ಅನ್ವೇಷಿಸಿ (ಟ್ಯಾಪ್)',
      practice: 'ಅಭ್ಯಾಸ (ಡ್ರ್ಯಾಗ್)',
      tapToExplore: 'ವಿವರಣೆ ನೋಡಲು ಯಾವುದೇ ಭಾಗವನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ ✨',
      dragToLabel: 'ಸೂಕ್ತ ಸ್ಲಾಟ್‌ಗೆ ಲೇಬಲ್ ಎಳೆಯಿರಿ ಅಥವಾ ಟ್ಯಾಪ್ ಮಾಡಿ! 🎯',
      dropPlaceholder: 'ಇಲ್ಲಿ ಇರಿಸಿ',
      labelBank: 'ಲೇಬಲ್ ಸಂಗ್ರಹ',
      reset: 'ಮರುಹೊಂದಿಸಿ',
      correct: 'ಸರಿ',
      tryAgain: 'ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ!',
      mastered: 'ಚಿತ್ರ ನಕ್ಷೆ ಪೂರ್ಣಗೊಂಡಿದೆ! 🎉',
      masteredSub: 'ನೀವು ಎಲ್ಲಾ ಭಾಗಗಳನ್ನು ಸರಿಯಾಗಿ ಗುರುತಿಸಿ ಜೋಡಿಸಿದ್ದೀರಿ!',
      nextPart: 'ಮುಂದಿನ ಭಾಗ',
      prevPart: 'ಹಿಂದಿನ ಭಾಗ',
      cycleBadge: 'ಚಕ್ರ',
      flowBadge: 'ಹಂತಗಳ ಪ್ರಕ್ರಿಯೆ',
      partsBadge: 'ಭಾಗಗಳು',
      stepOf: (curr, total) => `ಭಾಗ ${curr} / ${total}`,
      xpAwarded: '+20 XP ⭐'
    },
    hi: {
      explore: 'अन्वेषण (टैप)',
      practice: 'अभ्यास (ड्रैग)',
      tapToExplore: 'विवरण देखने के लिए किसी भी भाग पर टैप करें ✨',
      dragToLabel: 'लेबल को सही स्लॉट में खींचें या टैप करें! 🎯',
      dropPlaceholder: 'यहाँ रखें',
      labelBank: 'लेबल बैंक',
      reset: 'रीसेट',
      correct: 'सही',
      tryAgain: 'पुनः प्रयास करें!',
      mastered: 'आरेख पूरा हुआ! 🎉',
      masteredSub: 'आपने आरेख के सभी भागों की सही पहचान कर ली है!',
      nextPart: 'अगला',
      prevPart: 'पिछला',
      cycleBadge: 'चक्र',
      flowBadge: 'क्रमिक प्रवाह',
      partsBadge: 'घटक भाग',
      stepOf: (curr, total) => `भाग ${curr} / ${total}`,
      xpAwarded: '+20 XP ⭐'
    }
  };

  function shuffleArray(arr) {
    const copy = (arr || []).slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  /**
   * 6) Interactive Topic Diagrams (v1):
   * Supports "cycle" (ring), "flow" (step arrows), and "parts" (component grid) layouts.
   * Mode 1: Tap-to-Explore with active highlights and sequential next/prev navigation.
   * Mode 2: Drag-to-Label Practice with blank drop slots, shuffled label bank, HTML5 drag/drop,
   * tap-to-place fallback for mobile/touch, instant feedback, and celebration XP.
   */
  function renderInteractiveDiagram(diagramData, options = {}) {
    let raw = diagramData;
    if (raw && typeof raw === 'object' && raw.diagram && typeof raw.diagram === 'object') {
      raw = raw.diagram;
    }
    const diagram = normalizeDiagram(raw, options.citation) || SAMPLE_DIAGRAM;
    const parts = diagram.parts;
    const title = diagram.title;
    const layout = diagram.layout;
    const lang = options.language || (typeof window !== 'undefined' && (window.currentLang || (window.AppuApp && window.AppuApp.currentLang))) || 'en';
    const i18n = DIAGRAM_I18N[lang] || DIAGRAM_I18N.en;

    const citationDisplay = formatCitationDisplay(diagram.citation || options.citation);
    const citationHtml = citationDisplay
      ? `<div class="lesson-citation-pill ${citationDisplay.isUpload ? 'is-upload-source' : ''}" title="Source: ${escapeHTML(citationDisplay.label)}">
           <i class="fa-solid ${citationDisplay.icon} text-amber" aria-hidden="true"></i>
           <span>${escapeHTML(citationDisplay.text)}</span>
         </div>`
      : '';

    let layoutIcon = 'fa-arrows-rotate';
    let layoutLabel = i18n.cycleBadge;
    if (layout === 'flow') {
      layoutIcon = 'fa-arrow-right-long';
      layoutLabel = i18n.flowBadge;
    } else if (layout === 'parts') {
      layoutIcon = 'fa-cubes';
      layoutLabel = i18n.partsBadge;
    }

    const container = document.createElement('div');
    container.className = 'appu-study-card study-mode-diagram';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', title);

    let currentBank = shuffleArray(parts);
    let currentExploreIdx = 0;
    const solvedPartIds = new Set();
    let selectedChipPartId = null;
    let selectedSlotTargetId = null;

    function safeQuery(selector, root = container) {
      if (!root || typeof root.querySelector !== 'function') return null;
      return root.querySelector(selector);
    }

    function safeQueryAll(selector, root = container) {
      if (!root) return [];
      if (typeof root.querySelectorAll === 'function') {
        return Array.from(root.querySelectorAll(selector));
      }
      const single = root.querySelector ? root.querySelector(selector) : null;
      return single ? [single] : [];
    }

    function buildExploreNodesHTML() {
      return parts.map((p, idx) => {
        let connector = '';
        if (layout === 'cycle') {
          if (idx < parts.length - 1) {
            connector = '<div class="diagram-connector diagram-connector-cycle" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></div>';
          } else {
            connector = '<div class="diagram-connector diagram-connector-cycle diagram-connector-return" aria-hidden="true" title="Loop repeats"><i class="fa-solid fa-arrows-rotate"></i></div>';
          }
        } else if (layout === 'flow') {
          if (idx < parts.length - 1) {
            connector = '<div class="diagram-connector diagram-connector-flow" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></div>';
          }
        }

        const stepBadgeText = layout === 'flow' ? `Step ${idx + 1}` : (layout === 'parts' ? `Part ${idx + 1}` : `${idx + 1}`);

        return `
          <button type="button" class="diagram-node diagram-node-${layout} ${layout === 'parts' ? 'diagram-node-part' : ''} ${idx === 0 ? 'is-selected' : ''}" data-part-id="${p.id}" data-index="${idx}" style="--node-index: ${idx};" aria-pressed="${idx === 0 ? 'true' : 'false'}" aria-label="${escapeHTML(p.label)}">
            <span class="node-step-badge">${stepBadgeText}</span>
            <span class="node-label">${escapeHTML(p.label)}</span>
            ${layout === 'parts' ? '<i class="fa-solid fa-circle-info node-info-icon" aria-hidden="true"></i>' : ''}
          </button>
          ${connector}
        `;
      }).join('');
    }

    function buildPracticeSlotsHTML() {
      return parts.map((p, idx) => {
        let connector = '';
        if (layout === 'cycle') {
          if (idx < parts.length - 1) {
            connector = '<div class="diagram-connector diagram-connector-cycle" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></div>';
          } else {
            connector = '<div class="diagram-connector diagram-connector-cycle diagram-connector-return" aria-hidden="true" title="Loop repeats"><i class="fa-solid fa-arrows-rotate"></i></div>';
          }
        } else if (layout === 'flow') {
          if (idx < parts.length - 1) {
            connector = '<div class="diagram-connector diagram-connector-flow" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></div>';
          }
        }

        const stepBadgeText = layout === 'flow' ? `Step ${idx + 1}` : `Slot ${idx + 1}`;

        return `
          <div class="diagram-slot" data-slot-id="${p.id}" data-target-id="${p.id}" data-index="${idx}" style="--node-index: ${idx};" tabindex="0" role="button" aria-label="Slot ${idx + 1}">
            <span class="slot-badge">${stepBadgeText}</span>
            <div class="slot-content">
              <span class="slot-placeholder">${i18n.dropPlaceholder}</span>
              <span class="slot-placed-label" style="display:none;"></span>
            </div>
            <span class="slot-feedback-icon" aria-hidden="true"></span>
          </div>
          ${connector}
        `;
      }).join('');
    }

    function buildBankChipsHTML() {
      return currentBank.map(p => `
        <div class="diagram-label-chip ${solvedPartIds.has(p.id) ? 'is-placed' : ''}" draggable="true" data-part-id="${p.id}" tabindex="0" role="button" aria-label="Label: ${escapeHTML(p.label)}" style="${solvedPartIds.has(p.id) ? 'display:none;' : ''}">
          <i class="fa-solid fa-grip-vertical chip-drag-handle" aria-hidden="true"></i>
          <span class="chip-text">${escapeHTML(p.label)}</span>
        </div>
      `).join('');
    }

    const targetCard = options.card || (raw && typeof raw === 'object' && (raw.diagram || raw.parts || raw.topic || raw.title) ? raw : (diagramData && typeof diagramData === 'object' ? diagramData : null));
    const existingIllustrationUrl = targetCard ? (targetCard.__diagramIllustrationUrl || targetCard.diagramIllustrationUrl) : null;

    function buildIllustrationHTML() {
      if (options.disableIllustration === true) return '';

      if (existingIllustrationUrl) {
        return `
          <div class="diagram-illustration-card has-image">
            <div class="diagram-illustration-header">
              <span class="diagram-illustration-badge">
                <i class="fa-solid fa-sparkles text-cyan" aria-hidden="true"></i>
                <span>Visual Illustration</span>
              </span>
            </div>
            <div class="diagram-illustration-frame">
              <img class="diagram-illustration-img" src="${existingIllustrationUrl}" alt="${escapeHTML(title)}" loading="lazy" />
            </div>
          </div>
        `;
      }

      return `
        <div class="diagram-illustration-card is-loading" role="status" aria-label="Painting visual illustration">
          <div class="diagram-illustration-shimmer">
            <div class="shimmer-sparkle"><i class="fa-solid fa-wand-magic-sparkles text-cyan" aria-hidden="true"></i></div>
            <span class="shimmer-text">Painting visual illustration...</span>
          </div>
        </div>
      `;
    }

    const cat = resolveCategoryForCard(options.card || targetCard || diagramData);

    container.innerHTML = `
      <div class="diagram-header">
        <div class="diagram-badge-row">
          <div class="diagram-badge">
            <i class="fa-solid fa-shapes text-cyan" aria-hidden="true"></i>
            <span class="diagram-title">${escapeHTML(title)}</span>
          </div>
          <span class="diagram-layout-pill">
            <i class="fa-solid ${layoutIcon}" aria-hidden="true"></i>
            <span>${layoutLabel}</span>
          </span>
          ${cat ? `<span class="category-badge category-${cat.id}"><span class="cat-emoji">${cat.emoji}</span> ${escapeHTML(cat.label)}</span>` : ''}
          ${citationHtml}
        </div>

        <div class="diagram-mode-controls">
          <div class="diagram-mode-segmented" role="tablist" aria-label="Diagram Modes">
            <button type="button" class="diagram-mode-tab is-active" data-submode="explore" role="tab" aria-selected="true">
              <i class="fa-solid fa-compass" aria-hidden="true"></i>
              <span>${i18n.explore}</span>
            </button>
            <button type="button" class="diagram-mode-tab" data-submode="practice" role="tab" aria-selected="false">
              <i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i>
              <span>${i18n.practice}</span>
            </button>
          </div>
        </div>
      </div>

      ${buildIllustrationHTML()}

      <!-- EXPLORE VIEW (Tap to reveal explanation) -->
      <div class="diagram-explore-view" role="tabpanel">
        <div class="diagram-prompt">
          <i class="fa-solid fa-hand-pointer text-cyan" aria-hidden="true"></i>
          <span>${i18n.tapToExplore}</span>
        </div>

        <div class="diagram-canvas diagram-layout-${layout}">
          ${buildExploreNodesHTML()}
        </div>

        <div class="diagram-explanation-card" role="region" aria-live="polite">
          <div class="diagram-exp-header">
            <span class="diagram-exp-tag">
              <i class="fa-solid fa-lightbulb text-amber" aria-hidden="true"></i>
              <span class="diagram-exp-step">${i18n.stepOf(1, parts.length)}</span>
            </span>
            <h4 class="diagram-exp-title">${escapeHTML(parts[0].label)}</h4>
          </div>
          <p class="diagram-exp-text">${escapeHTML(parts[0].explanation || '')}</p>
          <div class="diagram-exp-nav">
            <button type="button" class="diagram-nav-btn btn-prev-part" ${parts.length <= 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>${i18n.prevPart}</span>
            </button>
            <button type="button" class="diagram-nav-btn btn-next-part" ${parts.length <= 1 ? 'disabled' : ''}>
              <span>${i18n.nextPart}</span>
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- PRACTICE VIEW (Drag & Drop / Tap to Label) -->
      <div class="diagram-practice-view" role="tabpanel" style="display: none;">
        <div class="diagram-prompt">
          <i class="fa-solid fa-puzzle-piece text-amber" aria-hidden="true"></i>
          <span>${i18n.dragToLabel}</span>
        </div>

        <div class="diagram-canvas diagram-layout-${layout} diagram-practice-canvas">
          ${buildPracticeSlotsHTML()}
        </div>

        <div class="diagram-label-bank-wrap">
          <div class="label-bank-header">
            <span class="label-bank-title">
              <i class="fa-solid fa-tags text-cyan" aria-hidden="true"></i>
              <span>${i18n.labelBank}</span>
            </span>
            <span class="diagram-score-pill">
              <span class="score-current">0</span> / ${parts.length} ${i18n.correct}
            </span>
            <button type="button" class="diagram-btn-reset" title="Reset diagram">
              <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              <span>${i18n.reset}</span>
            </button>
          </div>
          <div class="diagram-label-bank" role="list">
            ${buildBankChipsHTML()}
          </div>
          <div class="diagram-practice-feedback" style="display:none;" aria-live="polite"></div>
        </div>

        <div class="diagram-victory-banner" style="display:none;" role="status">
          <div class="victory-icon" aria-hidden="true">🎉</div>
          <h3 class="victory-title">${i18n.mastered}</h3>
          <p class="victory-sub">${i18n.masteredSub}</p>
          <div class="victory-xp-badge">${i18n.xpAwarded}</div>
          <button type="button" class="btn-play-again">${i18n.reset}</button>
        </div>
      </div>
    `;

    // 1) Segmented submode switching
    const exploreTabBtn = safeQuery('.diagram-mode-tab[data-submode="explore"]');
    const practiceTabBtn = safeQuery('.diagram-mode-tab[data-submode="practice"]');
    const exploreViewEl = safeQuery('.diagram-explore-view');
    const practiceViewEl = safeQuery('.diagram-practice-view');

    function setSubmode(mode) {
      if (mode === 'practice') {
        if (exploreTabBtn) { exploreTabBtn.classList.remove('is-active'); exploreTabBtn.setAttribute('aria-selected', 'false'); }
        if (practiceTabBtn) { practiceTabBtn.classList.add('is-active'); practiceTabBtn.setAttribute('aria-selected', 'true'); }
        if (exploreViewEl) exploreViewEl.style.display = 'none';
        if (practiceViewEl) practiceViewEl.style.display = 'flex';
      } else {
        if (practiceTabBtn) { practiceTabBtn.classList.remove('is-active'); practiceTabBtn.setAttribute('aria-selected', 'false'); }
        if (exploreTabBtn) { exploreTabBtn.classList.add('is-active'); exploreTabBtn.setAttribute('aria-selected', 'true'); }
        if (practiceViewEl) practiceViewEl.style.display = 'none';
        if (exploreViewEl) exploreViewEl.style.display = 'flex';
      }
    }

    if (exploreTabBtn) exploreTabBtn.addEventListener('click', () => setSubmode('explore'));
    if (practiceTabBtn) practiceTabBtn.addEventListener('click', () => setSubmode('practice'));
    if (options.mode === 'practice') setSubmode('practice');

    // 0) Lazy AI Concept Visual Illustration
    if (options.disableIllustration !== true && !existingIllustrationUrl) {
      const illustCard = safeQuery('.diagram-illustration-card');
      if (illustCard) {
        const topicToFetch = (targetCard && (targetCard.topic || targetCard.mindMap?.central || targetCard.title)) || title || 'Science';
        const gradeToFetch = options.grade || (targetCard && targetCard.grade) || (typeof window !== 'undefined' && window.appuSession && typeof window.appuSession.getGrade === 'function' ? window.appuSession.getGrade() : '6');

        if (targetCard && !targetCard.__diagramIllustrationPromise) {
          const promise = fetchStudyImage({
            topic: topicToFetch,
            grade: gradeToFetch,
            timeoutMs: options.imageTimeoutMs || 28000
          });
          try {
            Object.defineProperty(targetCard, '__diagramIllustrationPromise', {
              value: promise,
              writable: true,
              enumerable: false, // Prevents serialization in JSON.stringify / localStorage
              configurable: true
            });
          } catch (_) {
            targetCard.__diagramIllustrationPromise = promise;
          }
        }

        const fetchPromise = (targetCard && targetCard.__diagramIllustrationPromise) || fetchStudyImage({
          topic: topicToFetch,
          grade: gradeToFetch,
          timeoutMs: options.imageTimeoutMs || 28000
        });

        fetchPromise.then(res => {
          const currentCard = safeQuery('.diagram-illustration-card');
          if (!currentCard) return;

          if (res && res.imageUrl) {
            if (targetCard) {
              try {
                Object.defineProperty(targetCard, '__diagramIllustrationUrl', {
                  value: res.imageUrl,
                  writable: true,
                  enumerable: false, // Prevents persistence in JSON.stringify / localStorage
                  configurable: true
                });
              } catch (_) {
                targetCard.__diagramIllustrationUrl = res.imageUrl;
              }
            }

            currentCard.className = 'diagram-illustration-card has-image';
            currentCard.removeAttribute('role');
            currentCard.removeAttribute('aria-label');
            currentCard.innerHTML = `
              <div class="diagram-illustration-header">
                <span class="diagram-illustration-badge">
                  <i class="fa-solid fa-sparkles text-cyan" aria-hidden="true"></i>
                  <span>Visual Illustration</span>
                </span>
              </div>
              <div class="diagram-illustration-frame">
                <img class="diagram-illustration-img" src="${res.imageUrl}" alt="${escapeHTML(title)}" loading="lazy" />
              </div>
            `;
            if (typeof options.onIllustrationLoaded === 'function') {
              options.onIllustrationLoaded(res.imageUrl);
            }
          } else {
            // Graceful fallback: on error or timeout, hide the illustration card; interactive diagram is never blocked
            currentCard.style.display = 'none';
            if (targetCard) targetCard.__diagramIllustrationPromise = null;
          }
        }).catch(err => {
          if (targetCard) targetCard.__diagramIllustrationPromise = null;
          const currentCard = safeQuery('.diagram-illustration-card');
          if (currentCard) currentCard.style.display = 'none';
        });
      }
    }

    // 2) Explore node selection & navigation
    const expStepEl = safeQuery('.diagram-exp-step');
    const expTitleEl = safeQuery('.diagram-exp-title');
    const expTextEl = safeQuery('.diagram-exp-text');
    const prevBtn = safeQuery('.btn-prev-part');
    const nextBtn = safeQuery('.btn-next-part');
    const nodeEls = safeQueryAll('.diagram-node');

    function selectExploreIndex(idx) {
      if (parts.length === 0) return;
      currentExploreIdx = (idx + parts.length) % parts.length;
      const target = parts[currentExploreIdx];

      nodeEls.forEach((n, i) => {
        const rawAttr = n.getAttribute('data-index');
        const nIdx = rawAttr !== null ? parseInt(rawAttr, 10) : i;
        if (nIdx === currentExploreIdx) {
          n.classList.add('is-selected');
          n.setAttribute('aria-pressed', 'true');
          n.classList.remove('pulse-glow');
          if (typeof n.offsetWidth !== 'undefined') {
            void n.offsetWidth;
          }
          n.classList.add('pulse-glow');
        } else {
          n.classList.remove('is-selected');
          n.setAttribute('aria-pressed', 'false');
          n.classList.remove('pulse-glow');
        }
      });

      if (expStepEl) expStepEl.textContent = i18n.stepOf(currentExploreIdx + 1, parts.length);
      if (expTitleEl) expTitleEl.textContent = target.label;
      if (expTextEl) expTextEl.textContent = target.explanation || '';
    }

    nodeEls.forEach((n, i) => {
      n.addEventListener('click', () => {
        const rawIdx = n.getAttribute('data-index');
        const idx = rawIdx !== null ? parseInt(rawIdx, 10) : i;
        selectExploreIndex(idx);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        selectExploreIndex(currentExploreIdx - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        selectExploreIndex(currentExploreIdx + 1);
      });
    }

    // 3) Practice Drag & Drop and Tap-to-Place
    const scoreEl = safeQuery('.score-current');
    const feedbackEl = safeQuery('.diagram-practice-feedback');
    const victoryBanner = safeQuery('.diagram-victory-banner');
    const resetBtn = safeQuery('.diagram-btn-reset');
    const playAgainBtn = safeQuery('.btn-play-again');
    const bankContainer = safeQuery('.diagram-label-bank');
    const slotEls = safeQueryAll('.diagram-slot');

    function updateScore() {
      if (scoreEl) scoreEl.textContent = String(solvedPartIds.size);
    }

    function checkVictory() {
      if (solvedPartIds.size >= parts.length && parts.length > 0) {
        if (victoryBanner) victoryBanner.style.display = 'flex';
        if (typeof options.onCelebrate === 'function') {
          options.onCelebrate();
        } else if (typeof window !== 'undefined' && window.AppuGamification && typeof window.AppuGamification.awardXP === 'function') {
          window.AppuGamification.awardXP(20, 'Diagram Mastered! 🎯');
        } else if (typeof window !== 'undefined' && window.appMascot && typeof window.appMascot.celebrate === 'function') {
          window.appMascot.celebrate(3000);
        }
      }
    }

    function handlePlacement(chipPartId, slotTargetId) {
      if (!chipPartId || !slotTargetId) return;
      if (solvedPartIds.has(slotTargetId)) return;

      const targetPart = parts.find(p => p.id === slotTargetId);
      const draggedPart = parts.find(p => p.id === chipPartId);
      if (!targetPart || !draggedPart) return;

      const targetSlotEl = slotEls.find(s => (s.getAttribute('data-slot-id') || s.getAttribute('data-target-id')) === slotTargetId);
      const targetChipEl = safeQueryAll('.diagram-label-chip').find(c => c.getAttribute('data-part-id') === chipPartId);

      if (chipPartId === slotTargetId) {
        // CORRECT!
        solvedPartIds.add(slotTargetId);
        selectedChipPartId = null;
        selectedSlotTargetId = null;

        if (targetSlotEl) {
          targetSlotEl.classList.remove('is-selected', 'is-drag-over', 'is-wrong');
          targetSlotEl.classList.add('is-correct');
          const placeholder = targetSlotEl.querySelector('.slot-placeholder');
          const placedLabel = targetSlotEl.querySelector('.slot-placed-label');
          if (placeholder) placeholder.style.display = 'none';
          if (placedLabel) {
            placedLabel.style.display = 'inline-flex';
            placedLabel.innerHTML = `<i class="fa-solid fa-circle-check text-green" aria-hidden="true"></i> <span>${escapeHTML(targetPart.label)}</span>`;
          }
        }

        if (targetChipEl) {
          targetChipEl.classList.remove('is-selected', 'is-dragging');
          targetChipEl.classList.add('is-placed');
          targetChipEl.style.display = 'none';
        }

        safeQueryAll('.diagram-label-chip').forEach(c => c.classList.remove('is-selected'));
        slotEls.forEach(s => s.classList.remove('is-selected'));

        updateScore();
        checkVictory();
      } else {
        // INCORRECT!
        if (targetSlotEl) {
          targetSlotEl.classList.remove('is-selected', 'is-drag-over');
          targetSlotEl.classList.add('is-wrong');
          setTimeout(() => {
            targetSlotEl.classList.remove('is-wrong');
          }, 600);
        }

        if (feedbackEl) {
          feedbackEl.textContent = i18n.tryAgain;
          feedbackEl.style.display = 'block';
          setTimeout(() => {
            feedbackEl.style.display = 'none';
          }, 2200);
        }

        selectedChipPartId = null;
        selectedSlotTargetId = null;
        safeQueryAll('.diagram-label-chip').forEach(c => c.classList.remove('is-selected'));
        slotEls.forEach(s => s.classList.remove('is-selected'));
      }
    }

    function wireChipInteractions(chip) {
      const partId = chip.getAttribute('data-part-id');

      // Desktop HTML5 Drag and Drop
      chip.addEventListener('dragstart', (e) => {
        chip.classList.add('is-dragging');
        if (e && e.dataTransfer) {
          e.dataTransfer.setData('text/plain', partId);
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      chip.addEventListener('dragend', () => {
        chip.classList.remove('is-dragging');
      });

      // Mobile Touch Drag and Drop
      let touchGhostEl = null;
      let touchDraggingPartId = null;
      let touchStartX = 0;
      let touchStartY = 0;
      let isTouchDragActive = false;

      chip.addEventListener('touchstart', (e) => {
        if (solvedPartIds.has(partId)) return;
        if (!e.touches || e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchDraggingPartId = partId;
        isTouchDragActive = false;
      }, { passive: true });

      chip.addEventListener('touchmove', (e) => {
        if (!touchDraggingPartId || touchDraggingPartId !== partId) return;
        if (!e.touches || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (!isTouchDragActive && Math.hypot(dx, dy) > 8) {
          isTouchDragActive = true;
          chip.classList.add('is-dragging');

          if (!touchGhostEl && typeof document !== 'undefined') {
            touchGhostEl = chip.cloneNode(true);
            touchGhostEl.classList.add('is-touch-ghost');
            touchGhostEl.style.position = 'fixed';
            touchGhostEl.style.zIndex = '99999';
            touchGhostEl.style.pointerEvents = 'none';
            touchGhostEl.style.opacity = '0.9';
            touchGhostEl.style.transform = 'translate(-50%, -50%) scale(1.08)';
            touchGhostEl.style.boxShadow = '0 12px 28px rgba(14, 165, 233, 0.35)';
            touchGhostEl.style.transition = 'none';
            document.body.appendChild(touchGhostEl);
          }
        }

        if (isTouchDragActive) {
          if (e.cancelable) e.preventDefault();
          if (touchGhostEl) {
            touchGhostEl.style.left = `${touch.clientX}px`;
            touchGhostEl.style.top = `${touch.clientY}px`;
          }

          if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
            const elUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            const hoveredSlot = elUnderFinger ? elUnderFinger.closest('.diagram-slot') : null;
            slotEls.forEach(s => {
              const sId = s.getAttribute('data-slot-id') || s.getAttribute('data-target-id');
              if (s === hoveredSlot && !solvedPartIds.has(sId)) {
                s.classList.add('is-drag-over');
              } else {
                s.classList.remove('is-drag-over');
              }
            });
          }
        }
      }, { passive: false });

      const handleTouchEnd = (e) => {
        if (touchDraggingPartId === partId && isTouchDragActive) {
          if (e.cancelable) e.preventDefault();
          const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
          let dropTarget = null;
          if (touch && typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            dropTarget = el ? el.closest('.diagram-slot') : null;
          }

          if (dropTarget) {
            const targetSlotId = dropTarget.getAttribute('data-slot-id') || dropTarget.getAttribute('data-target-id');
            if (targetSlotId && !solvedPartIds.has(targetSlotId)) {
              handlePlacement(partId, targetSlotId);
            }
          }
        }

        chip.classList.remove('is-dragging');
        slotEls.forEach(s => s.classList.remove('is-drag-over'));
        if (touchGhostEl && touchGhostEl.parentNode) {
          touchGhostEl.parentNode.removeChild(touchGhostEl);
        }
        touchGhostEl = null;
        touchDraggingPartId = null;
        isTouchDragActive = false;
      };

      chip.addEventListener('touchend', handleTouchEnd);
      chip.addEventListener('touchcancel', handleTouchEnd);

      // Tap-to-select / Tap-to-place fallback
      chip.addEventListener('click', (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (solvedPartIds.has(partId)) return;

        if (selectedSlotTargetId) {
          handlePlacement(partId, selectedSlotTargetId);
        } else {
          if (selectedChipPartId === partId) {
            selectedChipPartId = null;
            chip.classList.remove('is-selected');
          } else {
            safeQueryAll('.diagram-label-chip').forEach(c => c.classList.remove('is-selected'));
            selectedChipPartId = partId;
            chip.classList.add('is-selected');
          }
        }
      });
    }

    function wireSlotInteractions(slot) {
      const slotId = slot.getAttribute('data-slot-id') || slot.getAttribute('data-target-id');

      slot.addEventListener('dragover', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!solvedPartIds.has(slotId)) {
          slot.classList.add('is-drag-over');
          if (e && e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('is-drag-over');
      });

      slot.addEventListener('drop', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        slot.classList.remove('is-drag-over');
        if (solvedPartIds.has(slotId)) return;
        const droppedPartId = e && e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
        if (droppedPartId) {
          handlePlacement(droppedPartId, slotId);
        }
      });

      slot.addEventListener('click', (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (solvedPartIds.has(slotId)) return;

        if (selectedChipPartId) {
          handlePlacement(selectedChipPartId, slotId);
        } else {
          if (selectedSlotTargetId === slotId) {
            selectedSlotTargetId = null;
            slot.classList.remove('is-selected');
          } else {
            slotEls.forEach(s => s.classList.remove('is-selected'));
            selectedSlotTargetId = slotId;
            slot.classList.add('is-selected');
          }
        }
      });
    }

    safeQueryAll('.diagram-label-chip').forEach(wireChipInteractions);
    slotEls.forEach(wireSlotInteractions);

    function resetPractice() {
      solvedPartIds.clear();
      selectedChipPartId = null;
      selectedSlotTargetId = null;
      updateScore();

      if (victoryBanner) victoryBanner.style.display = 'none';
      if (feedbackEl) feedbackEl.style.display = 'none';

      slotEls.forEach(slot => {
        slot.classList.remove('is-correct', 'is-wrong', 'is-selected', 'is-drag-over');
        const placeholder = slot.querySelector('.slot-placeholder');
        const placedLabel = slot.querySelector('.slot-placed-label');
        if (placeholder) placeholder.style.display = 'inline';
        if (placedLabel) {
          placedLabel.style.display = 'none';
          placedLabel.innerHTML = '';
        }
      });

      currentBank = shuffleArray(parts);
      if (bankContainer) {
        bankContainer.innerHTML = buildBankChipsHTML();
        safeQueryAll('.diagram-label-chip', bankContainer).forEach(wireChipInteractions);
      }
    }

    if (resetBtn) resetBtn.addEventListener('click', resetPractice);
    if (playAgainBtn) playAgainBtn.addEventListener('click', resetPractice);

    return container;
  }

  const STUDY_TOOLBAR_LABELS = {
    en: { lesson: 'Lesson', quiz: 'Quiz Me', flashcards: 'Flashcards', guide: 'Study Guide', mindmap: 'Mind Map', diagram: 'Diagram', podcast: 'Podcast' },
    kn: { lesson: 'ಪಾಠ', quiz: 'ರಸಪ್ರಶ್ನೆ', flashcards: 'ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್ಸ್', guide: 'ಅಧ್ಯಯನ ಮಾರ್ಗದರ್ಶಿ', mindmap: 'ಮೈಂಡ್ ಮ್ಯಾಪ್', diagram: 'ಚಿತ್ರ ನಕ್ಷೆ', podcast: 'ಪಾಡ್‌ಕ್ಯಾಸ್ಟ್' },
    hi: { lesson: 'पाठ', quiz: 'क्विज़', flashcards: 'फ़्लैशकार्ड', guide: 'अध्ययन गाइड', mindmap: 'माइंड मैप', diagram: 'चित्र आरेख', podcast: 'पॉडकास्ट' }
  };

  /**
   * Study Modes Toolbar: Pill tabs to switch between Lesson and the study modes
   */
  function renderStudyToolbar(activeMode = 'lesson', onModeChange, language, onShare, options = {}) {
    const toolbar = document.createElement('div');
    toolbar.className = 'study-modes-toolbar';
    toolbar.setAttribute('role', 'tablist');
    toolbar.setAttribute('aria-label', 'Study Modes');

    let shareCallback = onShare;
    let opts = options || {};
    if (onShare && typeof onShare === 'object') {
      opts = onShare;
      shareCallback = opts.onShare;
    }

    const lang = language || (typeof window !== 'undefined' && (window.currentLang || (window.AppuApp && window.AppuApp.currentLang))) || (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || 'en';
    const labels = STUDY_TOOLBAR_LABELS[lang] || STUDY_TOOLBAR_LABELS.en;

    const targetCard = opts.card || (typeof window !== 'undefined' && ((window.app && typeof window.app.getActiveLessonCard === 'function' && window.app.getActiveLessonCard()) || window.activePopupLessonCard));

    const hasDiagram = Boolean(
      opts.hasDiagram ||
      opts.diagram ||
      activeMode === 'diagram' ||
      (targetCard && targetCard.diagram && Array.isArray(targetCard.diagram.parts) && targetCard.diagram.parts.length > 0)
    );

    const modes = [
      { id: 'lesson', label: labels.lesson, icon: 'fa-wand-magic-sparkles' },
      { id: 'quiz', label: labels.quiz, icon: 'fa-flask-vial' },
      { id: 'flashcards', label: labels.flashcards, icon: 'fa-layer-group' },
      { id: 'guide', label: labels.guide, icon: 'fa-book-open-reader' },
      { id: 'mindmap', label: labels.mindmap, icon: 'fa-diagram-project' }
    ];

    if (hasDiagram) {
      modes.push({ id: 'diagram', label: labels.diagram || 'Diagram', icon: 'fa-shapes' });
    }

    modes.push({ id: 'podcast', label: labels.podcast, icon: 'fa-headphones' });

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

    // Save action button (renders when onShare, opts.onSave, opts.card, or showActions is provided)
    if (typeof opts.onSave === 'function' || opts.onSave === true || opts.card || shareCallback) {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'study-tab-btn study-tab-save btn-save-card';

      const checkSaved = () => {
        if (typeof opts.isSaved === 'boolean') return opts.isSaved;
        if (typeof window !== 'undefined' && window.SavedLessonsUI && typeof window.SavedLessonsUI.isLessonSaved === 'function') {
          return window.SavedLessonsUI.isLessonSaved(targetCard);
        }
        return false;
      };

      let isSaved = checkSaved();

      const updateSaveBtnUI = (saved) => {
        isSaved = saved;
        if (saved) {
          saveBtn.classList.add('is-saved');
          saveBtn.setAttribute('title', 'Saved to My Learning — click to remove');
          saveBtn.setAttribute('aria-label', 'Saved to My Learning');
          saveBtn.innerHTML = `<i class="fa-solid fa-bookmark text-amber" aria-hidden="true"></i> <span>Saved ✓</span>`;
        } else {
          saveBtn.classList.remove('is-saved');
          saveBtn.setAttribute('title', 'Save to My Learning');
          saveBtn.setAttribute('aria-label', 'Save to My Learning');
          saveBtn.innerHTML = `<i class="fa-regular fa-bookmark text-amber" aria-hidden="true"></i> <span>Save</span>`;
        }
      };

      updateSaveBtnUI(isSaved);

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          // Cancel auto-dismiss timer on user interaction so study view is never abruptly blanked
          if (typeof window !== 'undefined') {
            if (window.app && typeof window.app.cancelVoicePopupTimer === 'function') {
              window.app.cancelVoicePopupTimer();
            }
            if (typeof window.__appuCancelVoicePopupTimer === 'function') {
              window.__appuCancelVoicePopupTimer();
            }
          }

          const currentCard = opts.card || (typeof window !== 'undefined' && ((window.app && typeof window.app.getActiveLessonCard === 'function' && window.app.getActiveLessonCard()) || window.activePopupLessonCard));

          let newSavedState = !isSaved;
          if (typeof window !== 'undefined' && window.SavedLessonsUI && typeof window.SavedLessonsUI.toggleSaveLesson === 'function') {
            const res = window.SavedLessonsUI.toggleSaveLesson(currentCard);
            newSavedState = res ? Boolean(res.isSaved) : !isSaved;
          } else if (typeof window !== 'undefined' && window.SavedLessonsUI) {
            if (!isSaved) {
              window.SavedLessonsUI.saveLesson(currentCard);
              newSavedState = true;
            } else {
              const savedItem = typeof window.SavedLessonsUI.findSavedLesson === 'function' ? window.SavedLessonsUI.findSavedLesson(currentCard) : null;
              if (savedItem && savedItem.id) {
                window.SavedLessonsUI.removeSavedLesson(savedItem.id);
              }
              newSavedState = false;
            }
          }

          updateSaveBtnUI(newSavedState);

          saveBtn.classList.add('btn-bounce');
          setTimeout(() => {
            try { saveBtn.classList.remove('btn-bounce'); } catch (_) {}
          }, 400);

          if (typeof opts.onSave === 'function') {
            opts.onSave(newSavedState, currentCard);
          }
        } catch (saveErr) {
          console.warn('[LessonCardRenderer] Error during save toggle:', saveErr);
        }
      });

      if (typeof window !== 'undefined') {
        const onUpdateListener = () => {
          updateSaveBtnUI(checkSaved());
        };
        window.addEventListener('appu:saved-lessons-updated', onUpdateListener);
      }

      toolbar.appendChild(saveBtn);
    }

    // Send to WhatsApp action button on study toolbar (when onShare callback provided)
    if (typeof shareCallback === 'function' || shareCallback === true) {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'study-tab-btn study-tab-share btn-share-whatsapp';
      shareBtn.setAttribute('title', 'Send study notes to WhatsApp');
      shareBtn.setAttribute('aria-label', 'Send study notes to WhatsApp');
      shareBtn.innerHTML = `<i class="fa-brands fa-whatsapp text-whatsapp" aria-hidden="true"></i> <span>Share</span>`;
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof shareCallback === 'function') {
          shareCallback();
        } else if (typeof window !== 'undefined' && window.SavedLessonsUI && typeof window.SavedLessonsUI.shareLessonToWhatsApp === 'function') {
          const activeCard = opts.card || (window.app && typeof window.app.getActiveLessonCard === 'function' && window.app.getActiveLessonCard()) || window.activePopupLessonCard;
          window.SavedLessonsUI.shareLessonToWhatsApp(activeCard);
        }
      });
      toolbar.appendChild(shareBtn);
    }

    return toolbar;
  }

  /**
   * Unified dispatcher: renders any study mode or standard lesson card
   */
  function renderStudyMode(modeName, data = {}, options = {}) {
    const cardCitation = (data && data.citation) || (options && options.citation);
    const enhancedOptions = cardCitation ? { ...options, citation: cardCitation } : options;
    switch (modeName) {
      case 'quiz':
        return renderQuiz(data.quizItems || (Array.isArray(data) ? data : SAMPLE_QUIZ_ITEMS), enhancedOptions);
      case 'flashcards':
        return renderFlashcards(data.flashcards || (Array.isArray(data) ? data : SAMPLE_FLASHCARDS), enhancedOptions);
      case 'guide':
      case 'studyGuide':
        return renderStudyGuide(data.studyGuide || data, enhancedOptions);
      case 'mindmap':
      case 'mindMap':
        return renderMindMap(data.mindMap || data, enhancedOptions);
      case 'podcast':
      case 'podcastScript':
        return renderPodcast(data.podcastScript || data, enhancedOptions);
      case 'diagram':
      case 'interactiveDiagram':
      case 'topicDiagram':
        return renderInteractiveDiagram(data.diagram || data, {
          ...enhancedOptions,
          language: enhancedOptions.language || (data && data.language) || (typeof window !== 'undefined' && (window.currentLang || (window.app && window.app.currentLang))),
          card: enhancedOptions.card || (data && (data.diagram || data.blocks || data.plainText) ? data : null)
        });
      case 'lesson':
      default:
        return render(data, enhancedOptions);
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
  function fromVisualizerPayload(data, answerText = '', grade = null) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const knownGrade = grade || (typeof window !== 'undefined' && window.getActiveChildGrade && typeof window.getActiveChildGrade === 'function' ? window.getActiveChildGrade() : null);
    const topic = data.topic || 'Lesson Concept';
    let citation = normalizeCitation(data.citation);
    if (!knownGrade && citation && citation.label) {
      citation = {
        ...citation,
        label: citation.label
          .replace(/\bClass\s*\d+\s*Curriculum\b/i, 'Interactive Learning')
          .replace(/\bNCERT Class \d+\s*/i, 'NCERT ')
          .replace(/\bClass \d+\s*-\s*/i, '')
          .trim() || 'Interactive Learning'
      };
    }
    const citationLabel = citation ? citation.label : '';
    const central = (data.mindMap && data.mindMap.central) || topic;
    const branches = (data.mindMap && Array.isArray(data.mindMap.branches)) ? data.mindMap.branches : [];
    let mermaidSpec = (data.mindMap && data.mindMap.mermaid) ? data.mindMap.mermaid.trim() : '';
    if (!mermaidSpec && (central || branches.length > 0)) {
      mermaidSpec = buildMermaidFromBranches(central, branches);
    }

    // Convert quiz items to canonical format
    const rawQuiz = Array.isArray(data.quiz) ? data.quiz : [];
    const quizItems = rawQuiz.map((q, idx) => {
      const qCitation = normalizeCitation(q.citation);
      let qCitationLabel = qCitation ? qCitation.label : (citationLabel || '');
      if (!knownGrade && qCitationLabel) {
        qCitationLabel = qCitationLabel
          .replace(/\bClass\s*\d+\s*Curriculum\b/i, 'Interactive Learning')
          .replace(/\bNCERT Class \d+\s*/i, 'NCERT ')
          .replace(/\bClass \d+\s*-\s*/i, '')
          .trim() || 'Interactive Learning';
      }
      return {
        id: `q${idx + 1}`,
        question: q.q || q.question || `Question ${idx + 1}`,
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: typeof q.answerIndex === 'number' ? q.answerIndex : (typeof q.correctIndex === 'number' ? q.correctIndex : 0),
        explanation: q.explain || q.explanation || '',
        citation: qCitationLabel || (knownGrade ? `Class ${knownGrade} Curriculum` : 'Interactive Learning')
      };
    });

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
      grade: knownGrade ? String(knownGrade) : '',
      keyPoints: rawKeyPoints,
      definitions: branches.map(b => ({
        term: b.label || '',
        definition: Array.isArray(b.children) ? b.children.join(', ') : ''
      })).filter(d => d.term),
      mustRemember: rawKeyPoints.slice(0, 3),
      citation
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
    if (branches.length > 0 || mermaidSpec) {
      blocks.push({
        type: 'diagram',
        kind: 'mindmap',
        title: topic,
        central: central,
        branches: branches,
        summary: central ? `Core Theme: ${central}` : '',
        spec: mermaidSpec,
        citation
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
    let podcastScript = null;
    if (data.podcastScript && typeof data.podcastScript === 'object') {
      podcastScript = {
        title: data.podcastScript.title || `${topic} (Audio Lesson)`,
        duration: data.podcastScript.duration || '0:45',
        caption: data.podcastScript.caption || analogyText || rawKeyPoints[0] || topic,
        script: data.podcastScript.script || plain,
        segments: Array.isArray(data.podcastScript.segments) ? data.podcastScript.segments : [],
        isLiveFetched: Boolean(data.podcastScript.isLiveFetched),
        citation
      };
    } else if (data.podcast && typeof data.podcast === 'object') {
      podcastScript = {
        title: data.podcast.title || `${topic} (Audio Lesson)`,
        duration: data.podcast.duration || '0:45',
        caption: data.podcast.caption || analogyText || rawKeyPoints[0] || topic,
        script: data.podcast.script || plain,
        segments: Array.isArray(data.podcast.segments) ? data.podcast.segments : [],
        isLiveFetched: Boolean(data.podcast.isLiveFetched),
        citation
      };
    } else {
      podcastScript = buildFallbackPodcastScript(topic, plain, citation);
    }

    // Interactive Topic Diagram
    const diagram = normalizeDiagram(
      data.diagram || (Array.isArray(data.blocks) ? data.blocks.find(b => b && (b.type === 'interactiveDiagram' || b.type === 'topicDiagram' || (b.type === 'diagram' && Array.isArray(b.parts)))) : null),
      citation
    );

    return {
      isRich: true,
      mood: 'explaining',
      gradeTone,
      blocks,
      plainText: plain,
      citation,
      mindMap: {
        title: topic,
        central: central,
        branches: branches,
        spec: mermaidSpec,
        summary: central ? `Core Theme: ${central}` : '',
        citation
      },
      quizItems: quizItems.length > 0 ? quizItems : null,
      flashcards: flashcards.length > 0 ? flashcards : null,
      studyGuide,
      podcastScript,
      diagram
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
   * Helper: Extracts short readable branch ideas from text.
   */
  function extractBranchesFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const clean = text.replace(/^[#*>\-\d.\s]+/gm, '').trim();
    const sentences = clean
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 10 && !s.toLowerCase().startsWith('let me know') && !s.toLowerCase().startsWith('ask me'));
    if (sentences.length === 0) return [];
    return sentences.slice(0, 4).map((s, idx) => {
      const words = s.split(/\s+/);
      const label = words.slice(0, 3).join(' ');
      const detail = words.length > 3 ? words.slice(3).join(' ') : s;
      return {
        label: label || `Key Point ${idx + 1}`,
        children: detail ? [detail] : []
      };
    });
  }

  /**
   * Topic Guard: Checks whether a card's topic aligns with the given question & answer,
   * guarding against sample cards, stale responses, or mismatched topics.
   */
  function isCardTopicMatching(card, question = '', answer = '') {
    if (!card || typeof card !== 'object') return false;

    const qLower = String(question || '').toLowerCase();
    const aLower = String(answer || '').toLowerCase();
    const cardTopic = String(
      card.mindMap?.central ||
      card.mindMap?.title ||
      card.studyGuide?.topic ||
      card.topic ||
      ''
    ).toLowerCase();

    // 1. Guard against hardcoded sample photosynthesis data leaking into other topics
    const sampleKeywords = ['photosynthesis', 'nutrition in plants', 'chloroplast', 'chlorophyll', 'plant food'];
    const cardHasSampleTopic = sampleKeywords.some(k => cardTopic.includes(k));
    const userAskedSampleTopic = sampleKeywords.some(k => qLower.includes(k) || aLower.includes(k));
    if (cardHasSampleTopic && !userAskedSampleTopic) {
      return false;
    }

    // 2. Keyword relevance check:
    const fillerWords = new Set([
      'explain', 'detail', 'details', 'detailed', 'many', 'much', 'points', 'point',
      'possible', 'what', 'when', 'where', 'which', 'about', 'tell', 'help', 'with',
      'your', 'from', 'this', 'that', 'have', 'class', 'grade', 'please', 'know',
      'understand', 'want', 'like', 'give', 'show', 'make', 'easy', 'simple', 'fun',
      'notes', 'textbook', 'chapter', 'question', 'answer'
    ]);

    const qWords = qLower
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !fillerWords.has(w));

    if (qWords.length > 0) {
      const cardCorpus = (
        cardTopic + ' ' +
        (card.plainText || '') + ' ' +
        (card.mindMap?.central || '') + ' ' +
        (card.studyGuide?.topic || '') + ' ' +
        (Array.isArray(card.mindMap?.branches) ? card.mindMap.branches.map(b => (b.label || '') + ' ' + (b.children || []).join(' ')).join(' ') : '')
      ).toLowerCase();

      const matchesQuestion = qWords.some(w => cardCorpus.includes(w));
      const answerMatchesQuestion = qWords.some(w => aLower.includes(w));

      if (answerMatchesQuestion && !matchesQuestion) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: Builds a minimal grounded card directly from the real answer and question text.
   * Used when backend visualizer times out or fails, ensuring ZERO sample leakage.
   */
  function buildMinimalAnswerCard(question = '', answer = '', grade = null, options = {}) {
    const cleanAnswer = (typeof answer === 'string' && answer.trim()) ? answer.trim() : '';
    const cleanQuestion = (typeof question === 'string' && question.trim()) ? question.trim() : 'Lesson Concept';

    let topic = cleanQuestion
      .replace(/^(?:explain|tell me about|what is|how does|what are|describe|discuss|summarise|summarize)\s+/i, '')
      .replace(/\s+(?:in detail|with examples|as many key points as possible|for class \d+|for grade \d+).*$/i, '')
      .trim();
    if (!topic || topic.length < 2) {
      topic = cleanQuestion.slice(0, 40).trim();
    }
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);

    const cleanSentences = cleanAnswer
      .split(/(?<=[.?!])\s+/)
      .map(s => s.replace(/^[#*>\-\d.\s]+/, '').trim())
      .filter(s => s.length >= 10 && !s.toLowerCase().startsWith('let me know') && !s.toLowerCase().startsWith('ask me'));

    const branches = [];
    if (cleanSentences.length > 0) {
      cleanSentences.slice(0, 5).forEach((sentence, idx) => {
        const words = sentence.split(/\s+/);
        const label = words.slice(0, 3).join(' ');
        const detail = words.length > 3 ? words.slice(3).join(' ') : sentence;
        branches.push({
          label: label || `Key Point ${idx + 1}`,
          children: [detail]
        });
      });
    } else {
      branches.push({
        label: topic,
        children: [cleanAnswer.slice(0, 100)]
      });
    }

    const keyPoints = cleanSentences.length > 0 ? cleanSentences.slice(0, 6) : [cleanAnswer];

    const numGrade = parseInt(grade, 10);
    let gradeTone = 'junior';
    if (!isNaN(numGrade)) {
      if (numGrade >= 9) gradeTone = 'senior';
      else if (numGrade >= 6) gradeTone = 'middle';
      else gradeTone = 'junior';
    }

    const blocks = [
      {
        type: 'diagram',
        kind: 'mindmap',
        title: topic,
        central: topic,
        branches: branches,
        summary: `Grounded visual overview for ${topic}`,
        citation: options.citation || null,
        isFallback: true
      },
      {
        type: 'steps',
        items: cleanSentences.slice(0, 4)
      }
    ];

      const knownGrade = grade || (typeof window !== 'undefined' && window.getActiveChildGrade && typeof window.getActiveChildGrade === 'function' ? window.getActiveChildGrade() : null);
      return {
      isRich: true,
      isGroundedMinimal: true,
      mood: 'explaining',
      gradeTone,
      blocks,
      plainText: cleanAnswer,
      citation: options.citation || null,
      mindMap: {
        title: topic,
        central: topic,
        branches: branches,
        summary: `Core Theme: ${topic}`,
        citation: options.citation || null,
        isFallback: true
      },
      studyGuide: {
        topic: topic,
        grade: knownGrade ? String(knownGrade) : '',
        keyPoints: keyPoints,
        definitions: branches.map(b => ({
          term: b.label,
          definition: (b.children || []).join(', ')
        })),
        mustRemember: keyPoints.slice(0, 3),
        citation: options.citation || null
      },
      quizItems: null,
      flashcards: null,
      podcastScript: buildFallbackPodcastScript(topic, cleanAnswer, options.citation || null),
      diagram: options.diagram
        ? normalizeDiagram(options.diagram, options.citation)
        : (branches.length >= 2 ? {
            title: topic,
            layout: 'flow',
            parts: branches.map((b, idx) => ({
              id: `p${idx + 1}`,
              label: b.label,
              explanation: (Array.isArray(b.children) && b.children[0]) ? b.children[0] : b.label
            })),
            citation: options.citation || null
          } : null)
    };
  }

  /**
   * Calls the live n8n Study Visualizer webhook and returns a parsed LessonCard.
   */
  async function fetchStudyVisualizer({ question, answer, grade = '6', language = 'en', timeoutMs = 22000, maxRetries = 1 } = {}) {
    if (!question || !question.trim()) {
      return null;
    }

    const payload = {
      question: question.trim(),
      answer: (answer || '').trim(),
      grade: String(grade || '6'),
      language: language || 'en'
    };

    const targetUrl = resolveStudyVisualizerEndpoint();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
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
          console.warn(`[StudyVisualizer] Server responded with status ${response.status} (attempt ${attempt + 1})`);
          if (attempt < maxRetries) continue;
          return null;
        }

        const data = await response.json();
        const resultObj = Array.isArray(data) ? data[0] : (data?.data || data);

        if (!resultObj || typeof resultObj !== 'object') {
          if (attempt < maxRetries) continue;
          return null;
        }

        const card = fromVisualizerPayload(resultObj, answer, grade);
        if (card && !isCardTopicMatching(card, question, answer)) {
          console.warn('[StudyVisualizer] Topic Guard: Card topic mismatch, rejected:', {
            topic: card.mindMap?.central || card.topic,
            question
          });
          return null;
        }

        return card;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`[StudyVisualizer] Request failed or timed out (attempt ${attempt + 1}):`, err?.name === 'AbortError' ? 'Timeout' : err);
        if (attempt < maxRetries) continue;
        return null;
      }
    }

    return null;
  }

  function resolveNotesTutorEndpoint() {
    if (typeof window !== 'undefined' && window.__APPU_NOTES_TUTOR_URL__) {
      return window.__APPU_NOTES_TUTOR_URL__;
    }
    const host = ['n8n', 'srv1871828', 'hstgr', 'cloud'].join('.');
    const seg = ['web', 'hook'].join('');
    return `https://${host}/${seg}/appu-notes-tutor`;
  }

  /**
   * Calls the live n8n Notes Tutor webhook and returns { answer, lessonCard, raw }.
   * Request JSON: { question, documentText, grade, language }
   */
  async function fetchNotesTutor({ question = '', documentText, grade = '6', language = 'en', timeoutMs = 22000, maxRetries = 1 } = {}) {
    if (!documentText || !documentText.trim()) {
      return null;
    }

    const cappedText = String(documentText).trim().slice(0, 16000);
    const payload = {
      question: typeof question === 'string' ? question.trim() : '',
      documentText: cappedText,
      grade: String(grade || '6'),
      language: language || 'en'
    };

    const targetUrl = resolveNotesTutorEndpoint();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
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
          console.warn(`[NotesTutor] Server responded with status ${response.status} (attempt ${attempt + 1})`);
          if (attempt < maxRetries) continue;
          return null;
        }

        const data = await response.json();
        const resultObj = Array.isArray(data) ? data[0] : (data?.data || data);

        if (!resultObj || typeof resultObj !== 'object') {
          if (attempt < maxRetries) continue;
          return null;
        }

        const answer = typeof resultObj.answer === 'string' ? resultObj.answer.trim() : '';
        let lessonCard = fromVisualizerPayload(resultObj, answer, grade);

        // Topic Guard check
        if (lessonCard && question && !isCardTopicMatching(lessonCard, question, answer)) {
          console.warn('[NotesTutor] Topic Guard: Card topic mismatch, replacing with grounded minimal card:', {
            topic: lessonCard.mindMap?.central || lessonCard.topic,
            question
          });
          lessonCard = buildMinimalAnswerCard(question, answer, grade, {
            citation: { label: 'Your uploaded notes', source: 'upload' }
          });
        }

        const rawAudio = resultObj.audio_base64 || resultObj.audioBase64 || null;
        const audio_base64 = (typeof rawAudio === 'string' && rawAudio.trim()) ? rawAudio.trim() : null;

        return {
          answer,
          lessonCard,
          audio_base64,
          raw: resultObj
        };
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`[NotesTutor] Request failed or timed out (attempt ${attempt + 1}):`, err?.name === 'AbortError' ? 'Timeout' : err);
        if (attempt < maxRetries) continue;
        return null;
      }
    }

    return null;
  }

  function buildFallbackPodcastScript(topic, answer = '', citation = null) {
    const safeTopic = (topic || '').trim();
    const cleanAns = (answer || '').trim();
    const title = safeTopic ? `${safeTopic} (Audio Lesson)` : 'Appu Audio Lesson';

    const sentences = cleanAns
      ? cleanAns.split(/(?<=[.?!])\s+/).map(s => s.replace(/^[#*>\-\d.\s]+/, '').trim()).filter(s => s.length > 5)
      : [];

    const segments = [];
    if (sentences.length > 0) {
      if (sentences.length <= 2) {
        segments.push({ label: 'Lesson Overview', text: sentences.join(' ') });
      } else {
        const chunkSize = Math.max(1, Math.ceil(sentences.length / 3));
        segments.push({ label: 'Curious Hook & Overview', text: sentences.slice(0, chunkSize).join(' ') });
        segments.push({ label: 'Core Concepts', text: sentences.slice(chunkSize, chunkSize * 2).join(' ') });
        segments.push({ label: 'Recap & Sign-off', text: sentences.slice(chunkSize * 2).join(' ') });
      }
    } else {
      segments.push({
        label: 'Audio Lesson',
        text: safeTopic ? `Let's explore ${safeTopic} together with Appu!` : 'Listen to this lesson overview.'
      });
    }

    const script = cleanAns || (safeTopic ? `Let's explore ${safeTopic} together with Appu!` : 'Appu Audio Lesson.');
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Math.max(30, Math.ceil((wordCount / 140) * 60));
    const duration = `${Math.floor(estimatedSeconds / 60)}:${(estimatedSeconds % 60) < 10 ? '0' : ''}${estimatedSeconds % 60}`;

    return {
      title,
      script,
      segments,
      duration,
      caption: sentences[0] || (safeTopic ? `Key concepts for ${safeTopic}` : 'Audio lesson overview'),
      isLiveFetched: false,
      isFallback: true,
      citation: citation || null
    };
  }

  function createPodcastLoadingCard(topic = 'Lesson') {
    const safeTopic = escapeHTML(topic || 'Lesson');
    const inner = `
      <div class="podcast-header">
        <div class="podcast-badge-group">
          <div class="podcast-badge"><i class="fa-solid fa-headphones text-cyan" aria-hidden="true"></i> <span>Appu Podcast</span></div>
          <span class="podcast-badge-kicker">Generating Audio...</span>
        </div>
      </div>
      <div class="podcast-player-card podcast-loading-shimmer">
        <div class="podcast-info-row">
          <div class="podcast-avatar-bubble podcast-avatar-pulse">
            <img src="assets/appu-cutout-new.png" alt="Appu" width="48" height="48">
          </div>
          <div class="podcast-title-meta">
            <h3 class="podcast-title">${safeTopic} (Audio Lesson)</h3>
            <span class="podcast-duration"><i class="fa-solid fa-sparkles text-cyan" aria-hidden="true"></i> Writing narration...</span>
          </div>
        </div>
        <div class="podcast-equalizer podcast-eq-loading" aria-hidden="true">
          <span class="eq-bar eq-1"></span>
          <span class="eq-bar eq-2"></span>
          <span class="eq-bar eq-3"></span>
          <span class="eq-bar eq-4"></span>
          <span class="eq-bar eq-5"></span>
          <span class="eq-bar eq-6"></span>
          <span class="eq-bar eq-7"></span>
        </div>
        <div class="podcast-loading-message">
          <p class="podcast-loading-prompt"><i class="fa-solid fa-microphone-lines text-cyan" aria-hidden="true"></i> Appu is preparing your personalized audio lesson...</p>
          <p class="podcast-loading-subtext">Structuring hook, spoken concepts, real-life examples, and chapter recap.</p>
        </div>
      </div>
    `;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const container = document.createElement('div');
      container.className = 'appu-study-card study-mode-podcast podcast-loading-state';
      container.innerHTML = inner;
      return container;
    }

    return {
      className: 'appu-study-card study-mode-podcast podcast-loading-state',
      classList: {
        contains: (cls) => cls === 'appu-study-card' || cls === 'study-mode-podcast' || cls === 'podcast-loading-state'
      },
      innerHTML: inner,
      querySelector: () => null
    };
  }

  function resolvePodcastEndpoint() {
    if (typeof window !== 'undefined' && window.__APPU_PODCAST_URL__) {
      return window.__APPU_PODCAST_URL__;
    }
    const host = ['n8n', 'srv1871828', 'hstgr', 'cloud'].join('.');
    const seg = ['web', 'hook'].join('');
    return `https://${host}/${seg}/appu-podcast`;
  }

  /**
   * Calls the live n8n Podcast generator webhook and returns normalized podcastScript.
   * Request JSON: { topic, question, answer, grade, language, [documentText] }
   * Response JSON: { title, script, segments: [{ label, text }] }
   */
  async function fetchPodcast({ topic = '', question = '', answer = '', grade = '6', language = 'en', documentText, timeoutMs = 22000, maxRetries = 1 } = {}) {
    const safeTopic = String(topic || question || '').trim();
    const safeQuestion = String(question || topic || '').trim();
    const safeAnswer = String(answer || '').trim();

    if (!safeTopic && !safeQuestion && !safeAnswer && !documentText) {
      return null;
    }

    const payload = {
      topic: safeTopic,
      question: safeQuestion,
      answer: safeAnswer,
      grade: String(grade || '6'),
      language: language || 'en'
    };

    if (documentText && String(documentText).trim()) {
      payload.documentText = String(documentText).trim().slice(0, 16000);
    }

    const targetUrl = resolvePodcastEndpoint();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
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
          console.warn(`[Podcast] Server responded with status ${response.status} (attempt ${attempt + 1})`);
          if (attempt < maxRetries) continue;
          return null;
        }

        const data = await response.json();
        const resultObj = Array.isArray(data) ? data[0] : (data?.data || data?.body || data);

        if (!resultObj || typeof resultObj !== 'object') {
          if (attempt < maxRetries) continue;
          return null;
        }

        const script = typeof resultObj.script === 'string' ? resultObj.script.trim() : '';
        const title = typeof resultObj.title === 'string' && resultObj.title.trim()
          ? resultObj.title.trim()
          : (safeTopic ? `${safeTopic} (Audio Lesson)` : 'Appu Audio Lesson');

        const segments = Array.isArray(resultObj.segments)
          ? resultObj.segments.filter(s => s && (s.label || s.text))
          : [];

        if (!script && segments.length === 0) {
          if (attempt < maxRetries) continue;
          return null;
        }

        const resolvedSegments = segments.length > 0 ? segments : (
          script.split(/(?<=[.?!])\s+/).filter(Boolean).map((text, i) => ({
            label: i === 0 ? 'Introduction' : (i === 1 ? 'Key Idea' : `Chapter ${i + 1}`),
            text: text.trim()
          }))
        );

        const wordCount = (script || resolvedSegments.map(s => s.text).join(' ')).split(/\s+/).filter(Boolean).length;
        const estimatedSeconds = Math.max(30, Math.ceil((wordCount / 140) * 60));
        const formattedDuration = `${Math.floor(estimatedSeconds / 60)}:${(estimatedSeconds % 60) < 10 ? '0' : ''}${estimatedSeconds % 60}`;

        const caption = resolvedSegments[0]?.text
          ? resolvedSegments[0].text.slice(0, 140)
          : (script.slice(0, 140) || 'Audio overview lesson');

        const rawAudio = resultObj.audio_base64 || resultObj.audioBase64 || resultObj.audio || null;
        const audio_base64 = (typeof rawAudio === 'string' && rawAudio.trim()) ? rawAudio.trim() : null;

        return {
          title,
          script: script || resolvedSegments.map(s => s.text).join(' '),
          segments: resolvedSegments,
          duration: resultObj.duration || formattedDuration,
          caption,
          isLiveFetched: true,
          audio_base64
        };
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`[Podcast] Request failed or timed out (attempt ${attempt + 1}):`, err?.name === 'AbortError' ? 'Timeout' : err);
        if (attempt < maxRetries) continue;
        return null;
      }
    }

    return null;
  }

  function resolveStudyImageEndpoint() {
    if (typeof window !== 'undefined' && window.__APPU_STUDY_IMAGE_URL__) {
      return window.__APPU_STUDY_IMAGE_URL__;
    }
    const host = ['n8n', 'srv1871828', 'hstgr', 'cloud'].join('.');
    const seg = ['web', 'hook'].join('');
    return `https://${host}/${seg}/appu-study-image`;
  }

  /**
   * Calls the live n8n Study Image webhook and returns normalized { imageUrl, topic }.
   * Request JSON: { topic, grade }
   * Response JSON: { imageUrl: "data:image/png;base64,...", topic }
   */
  async function fetchStudyImage({ topic, grade = '6', timeoutMs = 28000 } = {}) {
    if (!topic || !String(topic).trim()) {
      return null;
    }

    const payload = {
      topic: String(topic).trim(),
      grade: String(grade || '6')
    };

    const targetUrl = resolveStudyImageEndpoint();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[StudyImage] Server responded with status ${res.status}`);
        return null;
      }

      const data = await res.json();
      const resultObj = Array.isArray(data) ? data[0] : (data?.data || data);

      if (resultObj && typeof resultObj.imageUrl === 'string' && resultObj.imageUrl.startsWith('data:image/')) {
        return {
          imageUrl: resultObj.imageUrl,
          topic: resultObj.topic || topic
        };
      }
      return null;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[StudyImage] Request notice:', err?.name === 'AbortError' ? 'Timeout' : err);
      return null;
    }
  }

  /**
   * Fetches real, educational, Creative Commons licensed photos from Openverse API.
   * Hard Kid-Safety Invariants:
   * 1. Always mature=false
   * 2. Query built strictly from sanitized topic/subject (never raw child free-text)
   * 3. Cap to 3-5 images with valid thumbnail and attribution
   * 4. Full CC licensing metadata and source links (foreign_landing_url)
   * 5. If < 2 results, API error, or timeout -> returns null (clean fallback to AI image only)
   */
  async function fetchOpenversePhotos({ topic, timeoutMs = 8000 } = {}) {
    if (!topic || !String(topic).trim()) return null;

    const rawTopic = String(topic).trim();
    const cleanTopic = rawTopic
      .replace(/[\?\!\.\,\:\;\"\'\(\)\[\]\{\}\/\\\#\$\%\^\&\*\@\_\+\=\<\>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTopic.length < 2) return null;

    const query = cleanTopic
      .replace(/^(what is|explain|tell me about|how does|how do|introduction to|lesson on)\s+/i, '')
      .trim() || cleanTopic;

    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&mature=false&license_type=commercial,modification&source=wikimedia&page_size=8`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) {
        console.warn(`[Openverse] API responded with status ${res.status}`);
        return null;
      }

      const data = await res.json();
      const rawResults = Array.isArray(data?.results) ? data.results : [];

      const validPhotos = [];
      for (const item of rawResults) {
        if (!item || !item.url) continue;
        const photoUrl = item.url;
        const thumbUrl = item.thumbnail || item.url;
        const landingUrl = item.foreign_landing_url || item.url;
        const creator = (item.creator && String(item.creator).trim()) || 'Openverse Contributor';
        const title = (item.title && String(item.title).trim()) || query;
        const licenseCode = item.license ? `CC ${String(item.license).toUpperCase()} ${item.license_version || ''}`.trim() : 'CC Licensed';
        const licenseUrl = item.license_url || 'https://creativecommons.org/';

        validPhotos.push({
          id: item.id || String(Math.random().toString(36).substring(2, 9)),
          title,
          url: photoUrl,
          thumbnail: thumbUrl,
          creator,
          creatorUrl: item.creator_url || landingUrl,
          foreignLandingUrl: landingUrl,
          license: licenseCode,
          licenseUrl,
          attribution: item.attribution || `"${title}" by ${creator} (${licenseCode})`
        });

        if (validPhotos.length >= 4) break;
      }

      if (validPhotos.length < 2) {
        return null;
      }

      return {
        topic: query,
        source: 'Openverse / Creative Commons',
        photos: validPhotos
      };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[Openverse] Request notice:', err?.name === 'AbortError' ? 'Timeout' : err);
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
    SAMPLE_DIAGRAM,
    SAMPLE_CITATION,
    normalizeCitation,
    formatCitationDisplay,
    normalizeDiagram,
    DIAGRAM_I18N,
    renderFallbackDiagram,
    renderQuiz,
    renderFlashcards,
    renderStudyGuide,
    renderMindMap,
    renderPodcast,
    renderInteractiveDiagram,
    createPodcastLoadingCard,
    buildFallbackPodcastScript,
    STUDY_TOOLBAR_LABELS,
    renderStudyToolbar,
    renderStudyMode,
    buildMermaidFromBranches,
    parseMermaidToBranches,
    buildConceptTreeHTML,
    fromVisualizerPayload,
    createLoadingCard,
    buildMinimalAnswerCard,
    isCardTopicMatching,
    extractBranchesFromText,
    fetchStudyVisualizer,
    fetchNotesTutor,
    resolveNotesTutorEndpoint,
    fetchPodcast,
    resolvePodcastEndpoint,
    fetchStudyImage,
    resolveStudyImageEndpoint,
    fetchOpenversePhotos,
    purgeMermaidErrorElements,
    getLottieCatalog,
    resolveCategoryForCard
  };
});
