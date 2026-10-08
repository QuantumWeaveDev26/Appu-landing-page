/**
 * APPU Admin dashboard (read-only).
 * Auth: signs in via Supabase; the backend (/api/admin/*) enforces the admin
 * allowlist. This page shows/hides UI for convenience only -- it is NOT the
 * security boundary.
 */
(function () {
  'use strict';

  var CFG = window.APPU_CONFIG || {};
  var API = (CFG.apiBaseUrl || '').replace(/\/+$/, '');
  var sb = null;
  var state = { token: null, email: null, offset: 0, limit: 50, search: '', total: 0 };

  var el = function (id) { return document.getElementById(id); };
  var show = function (node) { if (node) node.hidden = false; };
  var hide = function (node) { if (node) node.hidden = true; };

  function fmtDate(v) {
    if (!v) return '—';
    try {
      var d = new Date(v);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return '—'; }
  }
  function rupees(paise) {
    var n = Math.round((Number(paise) || 0) / 100);
    return '₹' + n.toLocaleString('en-IN');
  }

  async function api(path) {
    var res = await fetch(API + path, {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    if (res.status === 401 || res.status === 403) {
      var e = new Error('forbidden'); e.code = res.status; throw e;
    }
    if (!res.ok) throw new Error('request_failed_' + res.status);
    return res.json();
  }

  // ---- views ----
  function showLogin(msg) {
    hide(el('admin-loading')); hide(el('admin-dashboard')); show(el('admin-login'));
    el('admin-login-error').textContent = msg || '';
  }
  function showDashboard() {
    hide(el('admin-loading')); hide(el('admin-login')); show(el('admin-dashboard'));
    el('admin-who').textContent = state.email || '';
  }

  function card(k, v, cls, sub) {
    return '<div class="admin-card"><div class="k">' + k + '</div>' +
      '<div class="v ' + (cls || '') + '">' + v + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }

  function renderOverview(o) {
    var subs = o.subscriptions || {};
    var active = Number(subs.ACTIVE || 0);
    var subsText = Object.keys(subs).length
      ? Object.keys(subs).map(function (s) { return s.toLowerCase() + ': ' + subs[s]; }).join(' · ')
      : 'none yet';

    el('admin-cards').innerHTML =
      card('Total accounts', o.accounts.total, 'cyan', '+' + o.accounts.newToday + ' today') +
      card('New (7 days)', o.accounts.new7d, '', o.accounts.new30d + ' in 30 days') +
      card('Active (7 days)', o.accounts.active7d, 'green', 'signed in recently') +
      card('Children', o.children, '', 'learner profiles') +
      card('Chats', o.chats.succeeded, '', o.chats.last7d + ' in last 7 days') +
      card('Free trials', o.guestSessions, '', o.chats.guest + ' guest chats') +
      card('Active subs', active, 'green', subsText) +
      card('Active MRR', rupees(o.revenue.activeMrrPaise), 'amber', 'beta: paid plans off');

    // chart
    var series = o.signupsLast14Days || [];
    var max = series.reduce(function (m, d) { return Math.max(m, d.count); }, 0) || 1;
    el('admin-chart').innerHTML = series.map(function (d) {
      var h = Math.round((d.count / max) * 96);
      var day = d.day.slice(5); // MM-DD
      return '<div class="admin-bar" title="' + d.day + ': ' + d.count + '">' +
        '<div class="cnt">' + (d.count || '') + '</div>' +
        '<div class="fill" style="height:' + h + 'px"></div>' +
        '<div class="lbl">' + day + '</div></div>';
    }).join('');
  }

  function subBadge(status) {
    if (!status) return '<span class="admin-badge none">none</span>';
    var cls = status === 'ACTIVE' ? 'active' : 'other';
    return '<span class="admin-badge ' + cls + '">' + status.toLowerCase() + '</span>';
  }

  function renderUsers(data) {
    state.total = data.total || 0;
    var rows = (data.users || []).map(function (u) {
      return '<tr>' +
        '<td>' + (u.email || '—') + '</td>' +
        '<td>' + fmtDate(u.signupAt) + '</td>' +
        '<td>' + fmtDate(u.lastSignInAt) + '</td>' +
        '<td>' + u.children + '</td>' +
        '<td>' + u.chats + '</td>' +
        '<td>' + fmtDate(u.lastActivity) + '</td>' +
        '<td>' + subBadge(u.subscriptionStatus) + '</td>' +
        '</tr>';
    }).join('');
    el('admin-users-body').innerHTML = rows || '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:24px">No accounts found.</td></tr>';

    var from = state.total ? state.offset + 1 : 0;
    var to = Math.min(state.offset + state.limit, state.total);
    el('admin-page-info').textContent = from + '–' + to + ' of ' + state.total;
    el('admin-prev').disabled = state.offset <= 0;
    el('admin-next').disabled = to >= state.total;
  }

  async function loadUsers() {
    var qs = '?limit=' + state.limit + '&offset=' + state.offset +
      (state.search ? '&search=' + encodeURIComponent(state.search) : '');
    renderUsers(await api('/api/admin/users' + qs));
  }

  async function loadAll() {
    try {
      var o = await api('/api/admin/overview');
      renderOverview(o);
      await loadUsers();
      hide(el('admin-banner'));
    } catch (e) {
      if (e.code === 403) {
        showDashboard();
        var b = el('admin-banner');
        b.textContent = 'This account (' + state.email + ') is not an admin. Ask an existing admin to add your email to the allowlist.';
        show(b);
        el('admin-cards').innerHTML = '';
        el('admin-users-body').innerHTML = '';
        el('admin-chart').innerHTML = '';
        return;
      }
      if (e.code === 401) { await signOut(); return; }
      var banner = el('admin-banner');
      banner.textContent = 'Could not load dashboard data. The admin API may not be deployed yet, or the backend is unreachable.';
      show(banner);
    }
  }

  async function signOut() {
    try { if (sb) await sb.auth.signOut(); } catch (_) {}
    state.token = null; state.email = null;
    showLogin('');
  }

  async function bootstrap() {
    if (!window.supabase || !CFG.supabaseUrl || !CFG.supabasePublishableKey) {
      showLogin('Config error: Supabase client unavailable.');
      return;
    }
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabasePublishableKey);

    var sessionRes = await sb.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    if (session && session.access_token) {
      state.token = session.access_token;
      state.email = session.user ? session.user.email : '';
      showDashboard();
      await loadAll();
    } else {
      showLogin('');
    }

    // login
    el('admin-login-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var btn = el('admin-login-btn');
      btn.disabled = true;
      el('admin-login-error').textContent = '';
      try {
        var r = await sb.auth.signInWithPassword({
          email: el('admin-email').value.trim(),
          password: el('admin-password').value
        });
        if (r.error || !r.data || !r.data.session) {
          el('admin-login-error').textContent = (r.error && r.error.message) || 'Sign in failed.';
          btn.disabled = false;
          return;
        }
        state.token = r.data.session.access_token;
        state.email = r.data.user ? r.data.user.email : '';
        showDashboard();
        await loadAll();
      } catch (e) {
        el('admin-login-error').textContent = 'Sign in failed. Please try again.';
      } finally {
        btn.disabled = false;
      }
    });

    // controls
    el('admin-signout').addEventListener('click', signOut);
    el('admin-refresh').addEventListener('click', loadAll);
    el('admin-prev').addEventListener('click', function () {
      state.offset = Math.max(0, state.offset - state.limit); loadUsers();
    });
    el('admin-next').addEventListener('click', function () {
      if (state.offset + state.limit < state.total) { state.offset += state.limit; loadUsers(); }
    });
    var searchTimer = null;
    el('admin-search').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = e.target.value.trim(); state.offset = 0; loadUsers();
      }, 350);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
