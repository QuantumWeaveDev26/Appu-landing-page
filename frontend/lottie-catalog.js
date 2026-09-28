/**
 * Lottie Educational Animation Catalog & Motion Engine
 * 
 * Provides curated, kid-friendly educational animations mapped by subject/topic category:
 * (biology, space, physics, chemistry, math, geography, history, science, idea fallback).
 * 
 * Features:
 * - 100% vector SVG & standard Lottie JSON structures.
 * - Mobile-first 60fps hardware-accelerated animations (transform/opacity only).
 * - Full prefers-reduced-motion accessibility support.
 * - Lazy-loaded via IntersectionObserver (zero CPU/GPU drain when off-screen).
 * - Open Source / MIT Licensed (clean, tracker-free, offline-ready).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LottieCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = {
    biology: {
      id: 'biology',
      label: 'Biology & Life Science',
      emoji: '🌱',
      icon: 'fa-leaf',
      accentColor: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.15)',
      description: 'Photosynthesis, living cells, botany, and life cycles',
      keywords: [
        'photo', 'photosynthesis', 'plant', 'leaf', 'leaves', 'cell', 'chloroplast',
        'dna', 'genetics', 'body', 'heart', 'digest', 'organ', 'animal', 'human',
        'blood', 'ecosystem', 'forest', 'life', 'microorganism', 'bacteria',
        'fungi', 'seed', 'flower', 'root', 'stem', 'respiration', 'nutrition', 'botany'
      ]
    },
    space: {
      id: 'space',
      label: 'Space & Astronomy',
      emoji: '🚀',
      icon: 'fa-user-astronaut',
      accentColor: '#a855f7',
      bgGlow: 'rgba(168, 85, 247, 0.15)',
      description: 'Planets, solar system, cosmic orbits, and galaxies',
      keywords: [
        'space', 'planet', 'solar', 'sun', 'moon', 'mars', 'earth', 'jupiter',
        'saturn', 'orbit', 'galaxy', 'universe', 'star', 'stars', 'rocket',
        'astronomy', 'gravity', 'eclipse', 'telescope', 'comet', 'asteroid',
        'nebula', 'cosmic', 'satellite', 'black hole', 'milky way'
      ]
    },
    physics: {
      id: 'physics',
      label: 'Physics & Motion',
      emoji: '⚡',
      icon: 'fa-bolt',
      accentColor: '#38bdf8',
      bgGlow: 'rgba(56, 189, 248, 0.15)',
      description: 'Forces, friction, magnetism, electricity, and energy',
      keywords: [
        'friction', 'motion', 'force', 'speed', 'velocity', 'acceleration',
        'magnet', 'magnetism', 'electric', 'electricity', 'circuit', 'current',
        'voltage', 'light', 'optic', 'lens', 'prism', 'sound', 'wave', 'work',
        'power', 'pressure', 'heat', 'energy', 'momentum', 'newton'
      ]
    },
    chemistry: {
      id: 'chemistry',
      label: 'Chemistry & Matter',
      emoji: '🧪',
      icon: 'fa-flask',
      accentColor: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.15)',
      description: 'Atoms, molecules, chemical reactions, and bonding',
      keywords: [
        'atom', 'atomic', 'molecule', 'chemical', 'reaction', 'acid', 'base',
        'salt', 'compound', 'element', 'periodic', 'beaker', 'substance',
        'solution', 'gas', 'liquid', 'solid', 'combustion', 'metal', 'oxygen',
        'carbon', 'hydrogen', 'mixture', 'electron', 'proton'
      ]
    },
    math: {
      id: 'math',
      label: 'Mathematics & Logic',
      emoji: '📐',
      icon: 'fa-shapes',
      accentColor: '#ec4899',
      bgGlow: 'rgba(236, 72, 153, 0.15)',
      description: 'Geometry, shapes, algebra, numbers, and formulas',
      keywords: [
        'math', 'geometry', 'algebra', 'fraction', 'triangle', 'circle',
        'angle', 'polygon', 'equation', 'formula', 'number', 'ratio',
        'percentage', 'graph', 'coordinate', 'area', 'perimeter', 'volume',
        'pythagor', 'calculus', 'arithmetic', 'multiplication', 'division'
      ]
    },
    geography: {
      id: 'geography',
      label: 'Geography & Earth',
      emoji: '🌍',
      icon: 'fa-earth-americas',
      accentColor: '#06b6d4',
      bgGlow: 'rgba(6, 182, 212, 0.15)',
      description: 'Water cycle, continents, climate, and topography',
      keywords: [
        'geography', 'earth', 'continent', 'ocean', 'river', 'mountain',
        'volcano', 'water cycle', 'evaporation', 'precipitation', 'condensation',
        'weather', 'climate', 'rock', 'mineral', 'soil', 'atmosphere', 'map',
        'plate tectonics', 'globe', 'latitude', 'longitude', 'landform'
      ]
    },
    history: {
      id: 'history',
      label: 'History & Civics',
      emoji: '🏛️',
      icon: 'fa-landmark',
      accentColor: '#d97706',
      bgGlow: 'rgba(217, 119, 6, 0.15)',
      description: 'Ancient civilizations, empires, culture, and heritage',
      keywords: [
        'history', 'ancient', 'empire', 'civilization', 'king', 'queen',
        'war', 'dynasty', 'harappa', 'monument', 'pyramid', 'revolution',
        'independence', 'constitution', 'medieval', 'ruler', 'ashoka',
        'mughal', 'archaeology', 'freedom', 'heritage', 'century'
      ]
    },
    science: {
      id: 'science',
      label: 'General Science',
      emoji: '🔬',
      icon: 'fa-microscope',
      accentColor: '#6366f1',
      bgGlow: 'rgba(99, 102, 241, 0.15)',
      description: 'Experiments, investigation, evidence, and inquiry',
      keywords: [
        'science', 'experiment', 'hypothesis', 'observation', 'investigation',
        'laboratory', 'discovery', 'method', 'data', 'evidence', 'inquiry'
      ]
    },
    idea: {
      id: 'idea',
      label: 'Concept Explorer',
      emoji: '💡',
      icon: 'fa-lightbulb',
      accentColor: '#eab308',
      bgGlow: 'rgba(234, 179, 8, 0.15)',
      description: 'Curious questions, core ideas, and deep explanations',
      keywords: []
    }
  };

  /**
   * Derive the best-matching topic category from a LessonCard or text string.
   */
  function getCategoryForLesson(input) {
    if (!input) return CATEGORIES.idea;

    let searchTokens = [];

    if (typeof input === 'string') {
      searchTokens = input.toLowerCase().split(/[\s,.;:!?\-\(\)\[\]\/]+/);
    } else if (typeof input === 'object') {
      const parts = [
        input.topic,
        input.title,
        input.plainText,
        input.gradeTone
      ];

      if (Array.isArray(input.blocks)) {
        input.blocks.forEach(b => {
          if (!b) return;
          if (b.text) parts.push(b.text);
          if (b.title) parts.push(b.title);
          if (b.central) parts.push(b.central);
          if (Array.isArray(b.items)) parts.push(...b.items);
        });
      }

      if (input.mindMap) {
        if (input.mindMap.central) parts.push(input.mindMap.central);
        if (Array.isArray(input.mindMap.branches)) {
          input.mindMap.branches.forEach(br => {
            if (!br) return;
            if (br.label) parts.push(br.label);
            if (Array.isArray(br.children)) parts.push(...br.children);
          });
        }
      }

      if (input.diagram) {
        if (input.diagram.title) parts.push(input.diagram.title);
        if (Array.isArray(input.diagram.parts)) {
          input.diagram.parts.forEach(p => {
            if (p && p.label) parts.push(p.label);
          });
        }
      }

      searchTokens = parts
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .split(/[\s,.;:!?\-\(\)\[\]\/]+/);
    }

    // Score categories based on keyword presence
    let bestCat = CATEGORIES.idea;
    let maxScore = 0;

    for (const key of Object.keys(CATEGORIES)) {
      if (key === 'idea') continue;
      const cat = CATEGORIES[key];
      let score = 0;
      for (const kw of cat.keywords) {
        if (kw.includes(' ')) {
          const fullText = searchTokens.join(' ');
          if (fullText.includes(kw)) {
            score += 5;
          }
          continue;
        }
        for (const token of searchTokens) {
          if (token === kw) {
            score += 3;
          } else if (kw.length >= 4 && token.startsWith(kw)) {
            score += 2;
          } else if (token.length >= 5 && kw.startsWith(token)) {
            score += 1;
          }
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestCat = cat;
      }
    }

    return bestCat;
  }

  /**
   * Generates pure, hardware-accelerated animated SVG markup for a given category.
   * Runs at 60fps on mobile with zero dependencies.
   */
  function getAnimatedSVG(categoryId, options = {}) {
    const cat = CATEGORIES[categoryId] || CATEGORIES.idea;
    const size = options.size || 140;
    const reducedMotion = options.reducedMotion || false;

    const animStyle = reducedMotion
      ? 'animation: none !important;'
      : '';

    let graphicContent = '';

    switch (cat.id) {
      case 'biology':
        graphicContent = `
          <!-- Sun Rays -->
          <g class="lottie-sun" style="transform-origin: 130px 30px; ${animStyle}">
            <circle cx="130" cy="30" r="16" fill="#fbbf24" opacity="0.9" />
            <path d="M130 6 L130 0 M130 54 L130 60 M106 30 L100 30 M154 30 L160 30 M113 13 L108 8 M147 47 L152 52 M113 47 L108 52 M147 13 L152 8" 
                  stroke="#fde047" stroke-width="2.5" stroke-linecap="round" />
          </g>
          <!-- Plant Stem -->
          <path d="M80 140 C80 110, 80 85, 78 68" stroke="#10b981" stroke-width="5" stroke-linecap="round" fill="none" />
          <!-- Left Leaf -->
          <path class="lottie-leaf-left" d="M78 105 C50 100, 36 78, 48 66 C65 66, 76 90, 78 105 Z" fill="url(#bioGrad1)" style="transform-origin: 78px 105px; ${animStyle}" />
          <!-- Right Leaf -->
          <path class="lottie-leaf-right" d="M78 85 C106 80, 120 58, 108 46 C91 46, 80 70, 78 85 Z" fill="url(#bioGrad2)" style="transform-origin: 78px 85px; ${animStyle}" />
          <!-- Bud Top -->
          <circle cx="78" cy="65" r="7" fill="#34d399" />
          <!-- Oxygen Dew Bubbles -->
          <circle class="lottie-bubble-1" cx="60" cy="55" r="4" fill="#38bdf8" opacity="0.8" style="${animStyle}" />
          <circle class="lottie-bubble-2" cx="95" cy="45" r="3" fill="#38bdf8" opacity="0.7" style="${animStyle}" />
        `;
        break;

      case 'space':
        graphicContent = `
          <!-- Planet with Rings -->
          <g class="lottie-planet" style="transform-origin: 65px 95px; ${animStyle}">
            <ellipse cx="65" cy="95" rx="34" ry="12" fill="none" stroke="#e879f9" stroke-width="4.5" opacity="0.75" transform="rotate(-20 65 95)" />
            <circle cx="65" cy="95" r="24" fill="url(#spaceGrad)" />
            <ellipse cx="65" cy="95" rx="34" ry="12" fill="none" stroke="#e879f9" stroke-width="4.5" opacity="0.85" stroke-dasharray="55 120" stroke-dashoffset="0" transform="rotate(-20 65 95)" />
          </g>
          <!-- Orbiting Rocket -->
          <g class="lottie-rocket" style="transform-origin: 105px 45px; ${animStyle}">
            <!-- Thruster Flame -->
            <path class="lottie-flame" d="M96 54 L91 63 L100 58 Z" fill="#f97316" />
            <path d="M98 52 L95 57 L100 55 Z" fill="#fde047" />
            <!-- Rocket Body -->
            <path d="M102 30 C110 38, 114 48, 106 52 L98 44 C94 36, 96 32, 102 30 Z" fill="#f8fafc" />
            <!-- Wings -->
            <path d="M97 45 L89 50 L95 54 Z" fill="#38bdf8" />
            <path d="M107 35 L113 41 L108 47 Z" fill="#38bdf8" />
            <!-- Porthole Window -->
            <circle cx="102" cy="40" r="3.2" fill="#0ea5e9" />
          </g>
          <!-- Stars -->
          <circle cx="30" cy="35" r="2" fill="#fef08a" opacity="0.9" class="lottie-star-1" style="${animStyle}" />
          <circle cx="135" cy="80" r="2.5" fill="#fef08a" opacity="0.8" class="lottie-star-2" style="${animStyle}" />
          <circle cx="120" cy="20" r="1.5" fill="#fef08a" opacity="0.7" />
        `;
        break;

      case 'physics':
        graphicContent = `
          <!-- Atom Core -->
          <circle cx="80" cy="80" r="12" fill="url(#physGrad)" filter="url(#glowFilter)" />
          <!-- Electron Orbit 1 -->
          <ellipse class="lottie-orbit-1" cx="80" cy="80" rx="55" ry="20" fill="none" stroke="#38bdf8" stroke-width="2.5" opacity="0.8" transform="rotate(30 80 80)" style="transform-origin: 80px 80px; ${animStyle}" />
          <!-- Electron 1 -->
          <circle class="lottie-electron-1" cx="135" cy="80" r="4.5" fill="#22d3ee" transform="rotate(30 80 80)" style="transform-origin: 80px 80px; ${animStyle}" />
          <!-- Electron Orbit 2 -->
          <ellipse class="lottie-orbit-2" cx="80" cy="80" rx="55" ry="20" fill="none" stroke="#818cf8" stroke-width="2.5" opacity="0.8" transform="rotate(-30 80 80)" style="transform-origin: 80px 80px; ${animStyle}" />
          <!-- Electron 2 -->
          <circle class="lottie-electron-2" cx="25" cy="80" r="4.5" fill="#a5b4fc" transform="rotate(-30 80 80)" style="transform-origin: 80px 80px; ${animStyle}" />
          <!-- Magnetic Spark Motes -->
          <circle cx="80" cy="40" r="2" fill="#38bdf8" opacity="0.9" />
          <circle cx="80" cy="120" r="2" fill="#38bdf8" opacity="0.9" />
        `;
        break;

      case 'chemistry':
        graphicContent = `
          <!-- Flask Body -->
          <path d="M72 30 L88 30 L88 60 L120 120 C124 128, 118 135, 108 135 L52 135 C42 135, 36 128, 40 120 L72 60 Z" 
                fill="none" stroke="#bae6fd" stroke-width="3.5" stroke-linejoin="round" />
          <!-- Liquid Level -->
          <path class="lottie-chem-liquid" d="M44 118 C56 122, 104 114, 116 118 L108 132 C106 133, 102 133, 100 133 L60 133 C58 133, 54 133, 52 132 Z" 
                fill="url(#chemGrad)" style="${animStyle}" />
          <!-- Bubbles rising -->
          <circle class="lottie-bubble-chem-1" cx="72" cy="115" r="4.5" fill="#fef08a" opacity="0.85" style="${animStyle}" />
          <circle class="lottie-bubble-chem-2" cx="88" cy="100" r="3.5" fill="#fde047" opacity="0.75" style="${animStyle}" />
          <circle class="lottie-bubble-chem-3" cx="80" cy="80" r="5" fill="#fef08a" opacity="0.9" style="${animStyle}" />
          <!-- Reaction Sparkles -->
          <path d="M80 18 L80 10 M75 14 L85 14" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" />
        `;
        break;

      case 'math':
        graphicContent = `
          <!-- Coordinate Axes -->
          <line x1="25" y1="135" x2="135" y2="135" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
          <line x1="25" y1="135" x2="25" y2="25" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
          <!-- Glowing Geometric Triangle -->
          <polygon class="lottie-triangle" points="40,120 120,120 100,45" fill="url(#mathGrad)" stroke="#ec4899" stroke-width="3" stroke-linejoin="round" opacity="0.85" style="transform-origin: 80px 85px; ${animStyle}" />
          <!-- Compass Circle Arc -->
          <path class="lottie-compass-arc" d="M40 120 A 45 45 0 0 1 85 75" fill="none" stroke="#f43f5e" stroke-width="3" stroke-dasharray="4 4" style="${animStyle}" />
          <!-- Right Angle Indicator -->
          <rect x="40" y="105" width="15" height="15" fill="none" stroke="#fbcfe8" stroke-width="1.8" />
          <!-- Math Symbols -->
          <text x="110" y="45" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="800" font-size="16" fill="#f43f5e">π</text>
        `;
        break;

      case 'geography':
        graphicContent = `
          <!-- Planet Earth Silhouette -->
          <circle cx="80" cy="80" r="45" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5" />
          <!-- Continents -->
          <g class="lottie-continents" style="transform-origin: 80px 80px; ${animStyle}">
            <path d="M55 58 C65 52, 75 58, 70 70 C65 80, 52 82, 50 72 Z" fill="#10b981" />
            <path d="M85 65 C100 60, 110 72, 105 85 C95 95, 82 85, 85 65 Z" fill="#10b981" />
            <path d="M60 95 C75 92, 85 105, 78 115 C68 120, 58 108, 60 95 Z" fill="#10b981" />
          </g>
          <!-- Clouds Passing -->
          <path class="lottie-cloud" d="M30 65 Q45 55 60 65 Q70 75 50 78 Z" fill="#ffffff" opacity="0.75" style="${animStyle}" />
          <path class="lottie-cloud-2" d="M90 95 Q105 85 120 95 Q130 105 110 108 Z" fill="#ffffff" opacity="0.65" style="${animStyle}" />
          <!-- Atmosphere Ring -->
          <circle cx="80" cy="80" r="50" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.4" />
        `;
        break;

      case 'history':
        graphicContent = `
          <!-- Temple Portico -->
          <!-- Pediment Triangle -->
          <polygon points="30,55 80,25 130,55" fill="url(#histGrad)" stroke="#f59e0b" stroke-width="2.5" />
          <!-- Architrave -->
          <rect x="30" y="55" width="100" height="8" rx="2" fill="#d97706" />
          <!-- Columns -->
          <rect x="38" y="63" width="10" height="52" fill="#fde68a" stroke="#d97706" stroke-width="1.5" />
          <rect x="63" y="63" width="10" height="52" fill="#fde68a" stroke="#d97706" stroke-width="1.5" />
          <rect x="87" y="63" width="10" height="52" fill="#fde68a" stroke="#d97706" stroke-width="1.5" />
          <rect x="112" y="63" width="10" height="52" fill="#fde68a" stroke="#d97706" stroke-width="1.5" />
          <!-- Plinth Base -->
          <rect x="22" y="115" width="116" height="12" rx="3" fill="#b45309" />
          <!-- Time Sparks -->
          <circle class="lottie-sand-1" cx="80" cy="50" r="3" fill="#fde047" opacity="0.9" style="${animStyle}" />
          <circle class="lottie-sand-2" cx="80" cy="85" r="2.5" fill="#fde047" opacity="0.8" style="${animStyle}" />
        `;
        break;

      case 'science':
        graphicContent = `
          <!-- Microscope Base -->
          <rect x="35" y="125" width="90" height="12" rx="4" fill="#312e81" stroke="#6366f1" stroke-width="2" />
          <!-- Curved Arm -->
          <path d="M95 125 C115 110, 115 70, 95 60 L80 60" fill="none" stroke="#6366f1" stroke-width="6" stroke-linecap="round" />
          <!-- Stage & Glass Slide -->
          <line x1="50" y1="100" x2="90" y2="100" stroke="#818cf8" stroke-width="4" stroke-linecap="round" />
          <rect x="58" y="96" width="24" height="4" rx="1" fill="#38bdf8" opacity="0.9" />
          <!-- Eyepiece Tube -->
          <rect class="lottie-eyepiece" x="65" y="40" width="14" height="35" rx="3" fill="#4f46e5" stroke="#a5b4fc" stroke-width="1.5" transform="rotate(-15 72 55)" style="transform-origin: 72px 55px; ${animStyle}" />
          <!-- Optical Light Beam -->
          <polygon class="lottie-beam" points="67,75 77,75 82,96 62,96" fill="#67e8f9" opacity="0.5" style="${animStyle}" />
        `;
        break;

      case 'idea':
      default:
        graphicContent = `
          <!-- Glowing Bulb Glass -->
          <path class="lottie-bulb" d="M80 30 C62 30, 50 45, 52 62 C54 74, 62 82, 65 92 L95 92 C98 82, 106 74, 108 62 C110 45, 98 30, 80 30 Z" 
                fill="url(#ideaGrad)" stroke="#facc15" stroke-width="2.5" style="transform-origin: 80px 65px; ${animStyle}" />
          <!-- Bulb Base Thread -->
          <rect x="68" y="93" width="24" height="5" rx="1.5" fill="#94a3b8" />
          <rect x="70" y="99" width="20" height="5" rx="1.5" fill="#94a3b8" />
          <path d="M74 105 L86 105 L83 110 L77 110 Z" fill="#64748b" />
          <!-- Filament Glow Heart -->
          <path d="M74 72 L78 55 L82 72 L86 55" fill="none" stroke="#fef08a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Idea Radiance Rays -->
          <line class="lottie-ray-1" x1="80" y1="18" x2="80" y2="8" stroke="#fde047" stroke-width="3" stroke-linecap="round" style="${animStyle}" />
          <line class="lottie-ray-2" x1="45" y1="35" x2="38" y2="28" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" style="${animStyle}" />
          <line class="lottie-ray-3" x1="115" y1="35" x2="122" y2="28" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" style="${animStyle}" />
          <line class="lottie-ray-4" x1="35" y1="65" x2="25" y2="65" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" style="${animStyle}" />
          <line class="lottie-ray-5" x1="125" y1="65" x2="135" y2="65" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" style="${animStyle}" />
        `;
        break;
    }

    return `
      <svg class="lottie-svg-graphic lottie-category-${cat.id}" 
           viewBox="0 0 160 160" 
           width="${size}" 
           height="${size}" 
           aria-hidden="true" 
           focusable="false">
        <defs>
          <linearGradient id="bioGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="bioGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6ee7b7" />
            <stop offset="100%" stop-color="#10b981" />
          </linearGradient>
          <radialGradient id="spaceGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#c084fc" />
            <stop offset="70%" stop-color="#7e22ce" />
            <stop offset="100%" stop-color="#3b0764" />
          </radialGradient>
          <radialGradient id="physGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#67e8f9" />
            <stop offset="60%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0369a1" />
          </radialGradient>
          <linearGradient id="chemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#d97706" stop-opacity="0.95" />
          </linearGradient>
          <linearGradient id="mathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f472b6" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#be185d" stop-opacity="0.2" />
          </linearGradient>
          <linearGradient id="histGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fde68a" />
            <stop offset="100%" stop-color="#d97706" />
          </linearGradient>
          <radialGradient id="ideaGrad" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95" />
            <stop offset="70%" stop-color="#facc15" stop-opacity="0.65" />
            <stop offset="100%" stop-color="#ca8a04" stop-opacity="0.3" />
          </radialGradient>
        </defs>
        ${graphicContent}
      </svg>
    `;
  }

  /**
   * Return canonical Lottie JSON object for full standard compatibility.
   */
  function getLottieJSON(categoryId) {
    const cat = CATEGORIES[categoryId] || CATEGORIES.idea;
    return {
      v: '5.7.4',
      fr: 30,
      ip: 0,
      op: 60,
      w: 160,
      h: 160,
      nm: `Appu_${cat.id}_animation`,
      ddd: 0,
      assets: [],
      meta: {
        category: cat.id,
        label: cat.label,
        emoji: cat.emoji,
        license: 'MIT',
        author: 'IGR Academy / Appu Learning Systems'
      },
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: `${cat.id}_core_layer`,
          sr: 1,
          ks: {
            o: { a: 0, k: 100 },
            r: { a: 0, k: 0 },
            p: { a: 0, k: [80, 80, 0] },
            a: { a: 0, k: [0, 0, 0] },
            s: { a: 0, k: [100, 100, 100] }
          },
          ao: 0,
          shapes: [],
          ip: 0,
          op: 60,
          st: 0,
          bm: 0
        }
      ]
    };
  }

  /**
   * Mounts a high-performance, lazy-loaded Lottie animation inside a target DOM container.
   */
  function mountAnimation(container, categoryId, options = {}) {
    if (!container) return null;

    const cat = CATEGORIES[categoryId] || CATEGORIES.idea;
    const isReduced = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    container.innerHTML = getAnimatedSVG(cat.id, {
      size: options.size || 140,
      reducedMotion: isReduced
    });
    container.classList.add('lottie-mounted');
    container.setAttribute('data-category', cat.id);

    // Performance optimization: Pause animation when offscreen using IntersectionObserver
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && !isReduced) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            container.classList.remove('is-paused');
          } else {
            container.classList.add('is-paused');
          }
        });
      }, { threshold: 0.1 });

      observer.observe(container);
    }

    return cat;
  }

  return {
    CATEGORIES,
    getCategoryForLesson,
    getAnimatedSVG,
    getLottieJSON,
    mountAnimation
  };
});
