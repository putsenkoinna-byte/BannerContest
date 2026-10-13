/* #CosplayBattle — клиентская часть */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const select = $('employeeSelect');
  const worksNode = $('works');

  if (!select || !worksNode) return;

  let works = [];
  let votes = [];
  let closed = false;
  let busy = false;
  let pendingVoteId = null;
  let voteRevision = 0;
  let previewWorkId = null;
  let favorites = new Set();

  const FAVORITES_PREFIX = 'contest-v7-favorites:';

  const normalize = s =>
    String(s || '').trim().replace(/^@+/, '').toLocaleLowerCase('ru');

  const escape = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const url = s => {
    try {
      const u = new URL(String(s));
      return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  };

  function chosenName() {
    return select.value.trim();
  }

  function remaining() {
    return Math.max(
      0,
      5 - votes.filter(v =>
        normalize(v.fields?.['Voter Name']) ===
        normalize(chosenName())
      ).length
    );
  }

  function favoriteKey() {
    return FAVORITES_PREFIX + normalize(chosenName() || 'guest');
  }

  function loadFavorites() {
    try {
      favorites = new Set(
        JSON.parse(localStorage.getItem(favoriteKey()) || '[]')
      );
    } catch {
      favorites = new Set();
    }
  }

  function saveFavorites() {
    localStorage.setItem(
      favoriteKey(),
      JSON.stringify([...favorites])
    );
    updateFavoriteButtons();
  }

  function clearCompletedFavorites() {
    if (!chosenName() || remaining() !== 0) return false;

    favorites.clear();

    try {
      localStorage.removeItem(favoriteKey());
    } catch {}

    updateFavoriteButtons();
    return true;
  }

  const isBlocked = work =>
    /без\s+голосования/i.test(
      String(work?.fields?.['Примечания'] || '')
    );

  // Авторизация сохранена из рабочего скрипта.
  const ACCESS_KEY = 'cosplaybattle-tab-access-v11';
  let accessToken = '';

  try {
    accessToken = sessionStorage.getItem(ACCESS_KEY) || '';
  } catch {}

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (accessToken) {
      headers['X-Contest-Access'] = accessToken;
    }

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

  const post = (path, body) => api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const tools = document.createElement('div');
  tools.className = 'contest-tools';

  const addButton = document.createElement('
