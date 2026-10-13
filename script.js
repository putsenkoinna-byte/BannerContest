/* Конкурс — клиент. Настройки и PIN находятся только на сервере. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const select = $('employeeSelect');
  const worksNode = $('works');
  if (!select || !worksNode) return;

  let works = [], votes = [], closed = false, busy = false, winnerRows = [];
  let pendingVoteId = null;
  let voteRevision = 0;

  const FAVORITES_PREFIX = 'contest-v7-favorites:';
  let favorites = new Set();
  let previewWorkId = null;

  const favoritesButton = document.createElement('button');
  favoritesButton.type = 'button';
  favoritesButton.className = 'small-tool-btn favorites-open';
  favoritesButton.textContent = '☆ Избранное (0)';

  const normalize = s => String(s || '')
    .trim().replace(/^@+/, '').toLocaleLowerCase('ru');

  const escape = s => String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

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
    try {
      localStorage.setItem(
        favoriteKey(),
        JSON.stringify([...favorites])
      );
    } catch {}
    updateFavoriteButtons();
  }

  function remaining() {
    return Math.max(
      0,
      5 - votes.filter(
        v => normalize(v.fields?.['Voter Name']) === normalize(chosenName())
      ).length
    );
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

  function updateFavoriteButtons() {
    const count = [...favorites].filter(id => {
      const work = works.find(w => w.id === id);
      return work && !isBlocked(work);
    }).length;

    favoritesButton.textContent = `☆ Избранное (${count})`;
    favoritesButton.hidden =
      closed || !chosenName() || remaining() === 0;

    for (const b of worksNode.querySelectorAll('[data-favorite]')) {
      const saved = favorites.has(b.dataset.favorite);
      b.classList.toggle('is-marked', saved);
      b.setAttribute('aria-pressed', String(saved));
      b.textContent = saved ? '★ В избранном' : '☆ В избранное';
    }
  }

  // Временный доступ в пределах вкладки
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

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'small-tool-btn';
  addButton.textContent = '+ Добавить своё имя';

  const finishButton = document.createElement('button');
  finishButton.type = 'button';
  finishButton.className = 'small-tool-btn admin-button';
  finishButton.textContent = 'Завершить голосование';

  const winnersButton = document.createElement('button');
  winnersButton.type = 'button';
  winnersButton.className = 'small-tool-btn';
  winnersButton.textContent = '🏆 Победители';
  winnersButton.hidden = true;

  tools.append(
    addButton,
    favoritesButton,
    finishButton,
    winnersButton
  );

  select.insertAdjacentElement('afterend', tools);

  const overlay = document.createElement('div');
  overlay.className = 'contest-dialog-overlay';
  overlay.hidden = true;

  overlay.innerHTML = `
    <section class="contest-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contestDialogTitle">
      <button type="button"
        class="contest-dialog-close"
        aria-label="Закрыть">×</button>
      <div class="contest-dialog-body"></div>
    </section>
  `;

  document.body.append(overlay);

  const dialogBody = overlay.querySelector('.contest-dialog-body');

  function closeDialog() {
    previewWorkId = null;
    overlay.hidden = true;
    dialogBody.replaceChildren();
  }

  overlay.addEventListener('click', e => {
    if (
      e.target === overlay ||
      e.target.closest('.contest-dialog-close')
    ) {
      closeDialog();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) {
      closeDialog();
    }
  });

  function showDialog(html) {
    dialogBody.innerHTML = html;
    overlay.hidden = false;
    overlay.querySelector('input,button')?.focus();
  }

  let toastTimer;

  function notify(message) {
    let t = $('toast');

    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.append(t);
    }

    t.textContent = message;
    t.classList.add('active');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () => t.classList.remove('active'),
      3000
    );
  }

  function updateCounter() {
    const used = chosenName() ? 5 - remaining() : 0;

    if ($('votesLeft')) {
      $('votesLeft').textContent = chosenName()
        ? `Ваши голоса: ${used}/5`
        : '';
    }

    if ($('stickyCounterText')) {
      $('stickyCounterText').textContent =
        `Осталось голосов: ${remaining()}`;
    }

    $('stickyCounter')?.classList.toggle(
      'visible',
      Boolean(chosenName()) && !closed
    );
  }

  function setNames(names) {
    const selected =
      chosenName() ||
      localStorage.getItem('contest-voter-name') ||
      '';

    select.replaceChildren(
      new Option('Выберите своё имя', '')
    );

    for (const n of names) {
      select.add(new Option(n, n));
    }

    if (names.includes(selected)) {
      select.value = selected;
    }

    finishButton.hidden = closed;
    addButton.hidden = closed;
    winnersButton.hidden = !closed;
  }

  const authorById = () => new Map(
    works.map(w => [
      w.id,
      normalize(w.fields?.Username)
    ])
  );

  function uniqueVotes(rawVotes) {
    const authors = authorById();
    const seen = new Set();

    return rawVotes.filter(v => {
      const voter = normalize(v.fields?.['Voter Name']);

      const ids = Array.isArray(v.fields?.['Contest Work'])
        ? v.fields['Contest Work']
        : [v.fields?.['Contest Work']];

      const author = ids.map(id => authors.get(id)).find(Boolean);

      if (!voter || !author) return false;

      const fingerprint = voter + '|' + author;

      if (seen.has(fingerprint)) return false;

      seen.add(fingerprint);
      return true;
    });
  }

  function counts() {
    const count = new Map();

    for (const v of votes) {
      const ids = Array.isArray(v.fields?.['Contest Work'])
        ? v.fields['Contest Work']
        : [v.fields?.['Contest Work']];

      for (const id of ids) {
        if (id) {
          count.set(id, (count.get(id) || 0) + 1);
        }
      }
    }

    return count;
  }

  function media(files) {
    const valid = (files || [])
      .map(f => ({
        src: url(f.url),
        video: String(f.type || '').startsWith('video/')
      }))
      .filter(f => f.src);

    if (!valid.length) return '';

    const cells = valid.map((f, i) => f.video
      ? `
        <div class="video-slide slider-item">
          <video
            class="media-frame"
            preload="metadata"
            autoplay
            muted
            loop
            playsinline
            controls
            src="${escape(f.src)}"></video>
          <button
            class="video-sound-button"
            type="button"
            aria-label="Включить звук">
            🔊 Включить звук
          </button>
        </div>
      `
      : `
        <img
          class="media-frame slider-item"
          loading="lazy"
          src="${escape(f.src)}"
          alt="Конкурсная работа ${i + 1}">
      `
    ).join('');

    if (valid.length === 1) {
      return `<div class="media-area">${cells}</div>`;
    }

    return `
      <div class="media-area slider">
        <div class="slider-items">${cells}</div>
        <button type="button" class="slider-prev" aria-label="Назад">‹</button>
        <button type="button" class="slider-next" aria-label="Вперёд">›</button>
      </div>
    `;
  }

  function render() {
    const authorMap = authorById();
    const count = counts();
    const voter = normalize(chosenName());

    const own = votes.filter(
      v => normalize(v.fields?.['Voter Name']) === voter
    );

    const votedIds = new Set(
      own.flatMap(v =>
        Array.isArray(v.fields?.['Contest Work'])
          ? v.fields['Contest Work']
          : [v.fields?.['Contest Work']]
      )
    );

    const votedAuthors = new Set(
      [...votedIds].map(id => authorMap.get(id)).filter(Boolean)
    );

    const html = works
      .filter(w =>
        w.fields?.Username &&
        w.fields?.['Конкурсные работы']?.length
      )
      .map(w => {
        const f = w.fields;
        const id = w.id;
        const author = normalize(f.Username);
        const voted = votedIds.has(id);
        const blocked = isBlocked(w);

        const disabled =
          blocked ||
          closed ||
          !voter ||
          (
            !voted &&
            (remaining() <= 0 || votedAuthors.has(author))
          );

        const label = blocked
          ? 'Голосование недоступно'
          : closed
            ? 'Голосование завершено'
            : voted
              ? 'Убрать голос'
              : votedAuthors.has(author)
                ? 'За автора уже отдано'
                : 'Голосовать';

        const description =
          f['Описание'] || f['Текст'] || f['Заметка'] || '';

        const link = url(f['Ссылка на пост']);

        return `
          <article
            class="card ${voted ? 'is-voted' : ''}"
            data-work-id="${escape(id)}">

            ${media(f['Конкурсные работы'])}

            <div class="card-content">
              <div class="card-header">
                <div class="username">
                  @${escape(String(f.Username).replace(/^@+/, ''))}
                </div>
                <div class="votes-badge">
                  ❤️ ${count.get(id) || 0}
                </div>
              </
