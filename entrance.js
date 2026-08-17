/* ==========================================================================
   APPU — ENTRANCE CHOREOGRAPHY
   Boots the loader (0 → 100%), then releases the CSS-driven entrance
   transitions by removing `is-loading` from <body>.
   No GSAP dependency — pure CSS transitions with staggered delays.
   ========================================================================== */

(function () {
  'use strict';

  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderCount = document.getElementById('loader-count');
  const body = document.body;

  if (!loader || !loaderBar || !loaderCount) {
    body.classList.remove('is-loading');
    return;
  }

  let progress = 0;
  let done = false;

  const duration = 1800;
  const startTime = performance.now();

  function tick() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    progress = Math.floor(t * 100);

    loaderBar.style.width = progress + '%';
    loaderCount.textContent = String(progress).padStart(3, '0');

    if (progress < 100) {
      requestAnimationFrame(tick);
    } else if (!done) {
      done = true;
      setTimeout(finishBoot, 250);
    }
  }

  function finishBoot() {
    loader.classList.add('is-done');
    body.classList.remove('is-loading');
    try {
      const sfx = window.__appuSfx;
      if (sfx && typeof sfx.portalActivate === 'function') sfx.portalActivate();
    } catch (e) { /* non-fatal */ }
  }

  requestAnimationFrame(tick);
})();
