// APPU minimalist landing page (welcome.html): theme toggle and the ask composer.
(function () {
  'use strict';

  var THEME_STORAGE_KEY = 'appu_theme'; // shared with the main app (app.js)
  var root = document.documentElement;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncToggle() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    var label = currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
    syncToggle();
  }

  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }
  syncToggle();

  // Composer: grow with the text, disable send when empty, Enter submits.
  var form = document.getElementById('ask-form');
  var input = document.getElementById('ask-input');
  var send = form ? form.querySelector('.send-btn') : null;

  function resize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    send.disabled = input.value.trim() === '';
  }

  if (form && input && send) {
    input.addEventListener('input', resize);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (input.value.trim()) form.requestSubmit ? form.requestSubmit() : form.submit();
      }
    });
    form.addEventListener('submit', function (event) {
      if (!input.value.trim()) event.preventDefault();
    });

    document.querySelectorAll('.chip[data-prompt]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        input.value = chip.getAttribute('data-prompt');
        resize();
        input.focus();
      });
    });

    resize();
  }
})();
