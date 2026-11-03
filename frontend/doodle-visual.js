/**
 * Doodle visuals for Appu answers: a comic-strip "see it in steps" explainer and a
 * hand-drawn mind map. Children remember a few friendly, sketch-style pictures better
 * than a stack of diagrams, so each answer gets exactly these two.
 * Shapes are drawn with rough.js (MIT) when it is loaded; plain CSS borders otherwise.
 */
(function () {
  'use strict';

  const COLORS = [
    { stroke: '#0ea5e9', fill: '#e0f2fe' },
    { stroke: '#f97316', fill: '#ffedd5' },
    { stroke: '#10b981', fill: '#d1fae5' },
    { stroke: '#a855f7', fill: '#f3e8ff' },
    { stroke: '#ec4899', fill: '#fce7f3' },
    { stroke: '#eab308', fill: '#fef9c3' }
  ];

  // Keyword -> emoji, so a step about roots gets a root and a step about magnets a magnet.
  const EMOJI_RULES = [
    // Specific topics first, so "a plant or animal dies" is a fossil step, not a plant one.
    [/fossil|bone|dinosaur|remains|dead|dies/i, '🦴'],
    [/sun|light|day|heat|energy|solar/i, '☀️'], [/water|rain|river|ocean|sea|liquid|drop/i, '💧'],
    [/plant|leaf|leaves|tree|seed|flower|root|grow/i, '🌱'], [/air|gas|wind|breath|oxygen|carbon/i, '💨'],
    [/food|eat|sugar|glucose|nutri|digest/i, '🍎'],
    [/rock|stone|mud|sand|soil|layer|earth/i, '🪨'], [/magnet|pole|attract|repel/i, '🧲'],
    [/electric|current|circuit|battery|charge/i, '⚡'], [/force|push|pull|motion|speed|move/i, '🏃'],
    [/time|year|age|long ago|history|ancient/i, '⏳'], [/number|add|sum|equation|solve|multiply|divide|fraction/i, '🔢'],
    [/shape|angle|triangle|circle|square|geometry/i, '📐'], [/cell|body|blood|heart|organ|health/i, '🫀'],
    [/animal|bird|fish|insect/i, '🐾'], [/space|planet|star|moon|orbit/i, '🪐'],
    [/read|word|story|write|book|language|poem/i, '📖'], [/map|country|state|city|india|place/i, '🗺️'],
    [/money|trade|price|market|buy/i, '💰'], [/think|idea|brain|remember|why/i, '💡'],
    [/check|test|result|answer|correct/i, '✅'], [/heat|fire|burn|hot/i, '🔥'], [/cold|ice|freeze/i, '🧊'],
    [/mix|react|chemical|acid|salt/i, '🧪']
  ];
  const FALLBACK_EMOJI = ['💡', '🔍', '⭐', '🎯', '🚀', '🧩'];

  function pickEmoji(text, index) {
    const s = String(text || '');
    for (const [re, emoji] of EMOJI_RULES) if (re.test(s)) return emoji;
    return FALLBACK_EMOJI[index % FALLBACK_EMOJI.length];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function roughFor(svg) {
    return (typeof window !== 'undefined' && window.rough && typeof window.rough.svg === 'function') ? window.rough.svg(svg) : null;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(w, h) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }

  // Draw a sketchy frame behind an element once it has a size.
  function sketchFrame(host, color, seed) {
    const draw = () => {
      const w = host.offsetWidth, h = host.offsetHeight;
      if (!w || !h) return false;
      const old = host.querySelector(':scope > svg.doodle-frame'); if (old) old.remove();
      const svg = svgEl(w, h); svg.classList.add('doodle-frame');
      const rc = roughFor(svg);
      if (!rc) return true; // CSS border fallback stays visible
      host.classList.add('has-rough');
      svg.appendChild(rc.rectangle(3, 3, w - 6, h - 6, { stroke: color.stroke, strokeWidth: 2.2, roughness: 1.6, bowing: 1.4, fill: color.fill, fillStyle: 'solid', seed }));
      host.insertBefore(svg, host.firstChild);
      return true;
    };
    whenSized(host, draw);
  }

  function whenSized(el, fn) {
    if (typeof ResizeObserver === 'undefined') {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fn());
      return;
    }
    let lastW = 0, lastH = 0;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (w && h && (Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 2)) {
        lastW = w;
        lastH = h;
        fn();
      }
    });
    ro.observe(el);
  }

  /** Comic strip: 2-5 panels, each one big picture + one short sentence. */
  function renderStory(steps, options = {}) {
    const items = (Array.isArray(steps) ? steps : []).filter((s) => s && (s.label || s.text)).slice(0, 5);
    const wrap = document.createElement('section');
    wrap.className = 'doodle-story';
    if (items.length < 2) return null;
    wrap.innerHTML = `
      <header class="doodle-head"><span class="doodle-kicker">🎬 ${esc(options.kicker || 'See it in steps')}</span>${options.title ? `<h4 class="doodle-title">${esc(options.title)}</h4>` : ''}</header>
      <ol class="doodle-panels"></ol>
      <button type="button" class="doodle-replay">↻ ${esc(options.replayLabel || 'Play again')}</button>`;
    const list = wrap.querySelector('.doodle-panels');
    items.forEach((s, i) => {
      const color = COLORS[i % COLORS.length];
      const li = document.createElement('li');
      li.className = 'doodle-panel';
      li.style.setProperty('--doodle-i', i);
      li.style.setProperty('--doodle-stroke', color.stroke);
      li.style.setProperty('--doodle-fill', color.fill);
      const title = s.label || '';
      const text = s.text && s.text !== title ? s.text : '';
      li.innerHTML = `
        <span class="doodle-step-no">${i + 1}</span>
        <span class="doodle-emoji" aria-hidden="true">${s.emoji || pickEmoji(title + ' ' + text, i)}</span>
        ${title ? `<strong class="doodle-panel-title">${esc(title)}</strong>` : ''}
        ${text ? `<p class="doodle-panel-text">${esc(text)}</p>` : ''}`;
      list.appendChild(li);
      if (i < items.length - 1) {
        const arrow = document.createElement('li');
        arrow.className = 'doodle-arrow'; arrow.setAttribute('aria-hidden', 'true');
        arrow.style.setProperty('--doodle-i', i + 0.5);
        arrow.textContent = '➜';
        list.appendChild(arrow);
      }
      sketchFrame(li, color, 11 + i * 7);
    });
    wrap.querySelector('.doodle-replay').addEventListener('click', () => {
      wrap.classList.remove('is-playing'); void wrap.offsetWidth; wrap.classList.add('is-playing');
    });
    wrap.classList.add('is-playing');
    return wrap;
  }

  /** Hand-drawn mind map: radial on wide screens, a doodle tree on phones. */
  function renderMindMap(mindMap, options = {}) {
    const central = (mindMap && (mindMap.central || mindMap.title)) || '';
    const branches = (mindMap && Array.isArray(mindMap.branches) ? mindMap.branches : [])
      .filter((b) => b && b.label).slice(0, 6);
    if (!central || branches.length < 2) return null;

    const wrap = document.createElement('section');
    wrap.className = 'doodle-mindmap';
    wrap.innerHTML = `
      <header class="doodle-head"><span class="doodle-kicker">🧠 ${esc(options.kicker || 'Mind map')}</span></header>
      <div class="doodle-map-stage">
        <div class="doodle-center"><span class="doodle-emoji" aria-hidden="true">${pickEmoji(central, 0)}</span><strong>${esc(central)}</strong></div>
        <ul class="doodle-branches"></ul>
      </div>`;
    const stage = wrap.querySelector('.doodle-map-stage');
    const list = wrap.querySelector('.doodle-branches');
    branches.forEach((b, i) => {
      const color = COLORS[i % COLORS.length];
      const li = document.createElement('li');
      li.className = 'doodle-branch';
      li.style.setProperty('--doodle-i', i);
      li.style.setProperty('--doodle-stroke', color.stroke);
      li.style.setProperty('--doodle-fill', color.fill);
      const kids = (Array.isArray(b.children) ? b.children : []).filter(Boolean).slice(0, 4);
      li.innerHTML = `
        <strong class="doodle-branch-label"><span aria-hidden="true">${pickEmoji(b.label + ' ' + kids.join(' '), i + 1)}</span> ${esc(b.label)}</strong>
        ${kids.length ? `<ul class="doodle-leaves">${kids.map((k) => `<li>${esc(typeof k === 'string' ? k : (k.label || ''))}</li>`).join('')}</ul>` : ''}`;
      list.appendChild(li);
    });

    // Lay out (radial or stacked) and draw the wobbly branch lines once the stage has a width.
    whenSized(stage, () => layoutMindMap(stage, branches.length));
    return wrap;
  }

  function layoutMindMap(stage, count) {
    const center = stage.querySelector('.doodle-center');
    const nodes = [...stage.querySelectorAll('.doodle-branch')];
    const old = stage.querySelector(':scope > svg.doodle-lines'); if (old) old.remove();
    const width = stage.clientWidth;
    if (!width || !center || !nodes.length) return;
    const radial = width >= 620;
    stage.classList.toggle('is-radial', radial);
    stage.classList.toggle('is-stacked', !radial);
    nodes.forEach((n) => { n.style.left = ''; n.style.top = ''; n.style.width = ''; });
    center.style.left = ''; center.style.top = '';

    const placements = [];
    let centerBox;

    if (radial) {
      const cw = center.offsetWidth || 140;
      const ch = center.offsetHeight || 48;
      const nodeW = Math.max(150, Math.min(220, Math.floor((width - cw - 68) / 2)));
      nodes.forEach((n) => { n.style.width = `${nodeW}px`; });

      const rightCount = Math.ceil(count / 2);
      const rightNodes = nodes.slice(0, rightCount);
      const leftNodes = nodes.slice(rightCount);
      const vGap = 18;
      const colHeight = (col) => col.reduce((sum, n) => sum + n.offsetHeight, 0) + Math.max(0, col.length - 1) * vGap;
      const rightH = colHeight(rightNodes);
      const leftH = colHeight(leftNodes);
      const height = Math.max(260, rightH + 24, leftH + 24, ch + 80);
      stage.style.height = `${height}px`;

      const cx = width / 2, cy = height / 2;
      const cLeft = Math.round(cx - cw / 2);
      const cTop = Math.round(cy - ch / 2);
      center.style.left = `${cLeft}px`;
      center.style.top = `${cTop}px`;
      centerBox = { left: cLeft, top: cTop, width: cw, height: ch, cx, cy };

      const arcInset = Math.min(18, Math.max(0, Math.floor((width - cw - nodeW * 2 - 56) / 2)));

      let rY = Math.round((height - rightH) / 2);
      rightNodes.forEach((n, k) => {
        const h = n.offsetHeight;
        const inset = (rightNodes.length === 3 && k !== 1) ? arcInset : 0;
        const nLeft = Math.round(width - nodeW - 6 - inset);
        const nTop = Math.round(rY);
        n.style.left = `${nLeft}px`;
        n.style.top = `${nTop}px`;
        placements.push({ left: nLeft, top: nTop, width: nodeW, height: h, side: 'right', color: COLORS[k % COLORS.length], idx: k });
        rY += h + vGap;
      });

      let lY = Math.round((height - leftH) / 2);
      leftNodes.forEach((n, k) => {
        const idx = rightCount + k;
        const h = n.offsetHeight;
        const inset = (leftNodes.length === 3 && k !== 1) ? arcInset : 0;
        const nLeft = Math.round(6 + inset);
        const nTop = Math.round(lY);
        n.style.left = `${nLeft}px`;
        n.style.top = `${nTop}px`;
        placements.push({ left: nLeft, top: nTop, width: nodeW, height: h, side: 'left', color: COLORS[idx % COLORS.length], idx });
        lY += h + vGap;
      });
    } else {
      stage.style.height = '';
      const cw = center.offsetWidth || 130;
      const ch = center.offsetHeight || 44;
      centerBox = { left: center.offsetLeft, top: center.offsetTop, width: cw, height: ch, cx: center.offsetLeft + cw / 2, cy: center.offsetTop + ch / 2 };
      nodes.forEach((n, i) => {
        placements.push({
          left: n.offsetLeft,
          top: n.offsetTop,
          width: n.offsetWidth,
          height: n.offsetHeight,
          side: 'stacked',
          color: COLORS[i % COLORS.length],
          idx: i
        });
      });
    }

    // Wobbly connectors from the centre bubble to each branch using layout coordinates (immune to CSS entry transforms).
    const svg = svgEl(width, stage.offsetHeight || 260); svg.classList.add('doodle-lines');
    const rc = roughFor(svg);
    placements.forEach((b) => {
      const by = b.top + b.height / 2;
      let from, to, mid;
      if (b.side === 'right') {
        from = { x: centerBox.left + centerBox.width - 2, y: centerBox.cy + (by - centerBox.cy) * 0.22 };
        to = { x: b.left + 2, y: by };
        mid = [(from.x + to.x) / 2, from.y + (to.y - from.y) * 0.35];
      } else if (b.side === 'left') {
        from = { x: centerBox.left + 2, y: centerBox.cy + (by - centerBox.cy) * 0.22 };
        to = { x: b.left + b.width - 2, y: by };
        mid = [(from.x + to.x) / 2, from.y + (to.y - from.y) * 0.35];
      } else {
        const trunkX = 14;
        const targetY = b.top + Math.min(24, b.height / 2);
        from = { x: trunkX, y: centerBox.top + centerBox.height - 2 };
        to = { x: b.left + 2, y: targetY };
        mid = [trunkX, targetY];
      }
      if (rc) {
        svg.appendChild(rc.curve([[from.x, from.y], mid, [to.x, to.y]], { stroke: b.color.stroke, strokeWidth: 2.8, roughness: 1.3, seed: 5 + b.idx }));
      } else {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', `M${from.x},${from.y} Q${mid[0]},${mid[1]} ${to.x},${to.y}`);
        p.setAttribute('stroke', b.color.stroke); p.setAttribute('stroke-width', '2.8'); p.setAttribute('fill', 'none'); p.setAttribute('stroke-linecap', 'round');
        svg.appendChild(p);
      }
    });
    stage.insertBefore(svg, stage.firstChild);
  }

  const api = { renderStory, renderMindMap, pickEmoji };
  if (typeof window !== 'undefined') window.DoodleVisual = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
