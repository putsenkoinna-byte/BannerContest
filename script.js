/* Конкурс — клиент. Настройки и PIN находятся только на сервере. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const select = $('employeeSelect');
  const worksNode = $('works');
  if (!select || !worksNode) return;

  let works = [], votes = [], closed = false, busy = false, winnerRows = [];
  let pendingVoteId = null;
  let lastRefreshId = 0;
  let voteRevision = 0;
  const FAVORITES_PREFIX = 'contest-v7-favorites:';
  let favorites = new Set();
  let choiceIds = new Set();
  let choosing = false;
  const favoritesButton = document.createElement('button');
  favoritesButton.type = 'button';
  favoritesButton.className = 'small-tool-btn favorites-open';
  favoritesButton.textContent = '☆ Мои отмеченные (0)';
  function favoriteKey() { return FAVORITES_PREFIX + normalize(chosenName() || 'guest'); }
  function loadFavorites() {
    try { favorites = new Set(JSON.parse(localStorage.getItem(favoriteKey()) || '[]')); }
    catch { favorites = new Set(); }
  }
  function saveFavorites() {
    localStorage.setItem(favoriteKey(), JSON.stringify([...favorites]));
    updateFavoriteButtons();
  }
  function clearCompletedFavorites() {
    if (!chosenName() || remaining() !== 0) return false;
    favorites.clear();
    choiceIds.clear();
    try { localStorage.removeItem(favoriteKey()); } catch {}
    updateFavoriteButtons();
    return true;
  }

  function updateFavoriteButtons() {
    favoritesButton.textContent = `☆ Мои отмеченные (${[...favorites].filter(id => !isBlocked(works.find(w => w.id === id))).length})`;
    favoritesButton.hidden = closed || !chosenName() || remaining() === 0;
    for (const b of worksNode.querySelectorAll('[data-favorite]')) {
      const saved = favorites.has(b.dataset.favorite);
      b.classList.toggle('is-marked', saved);
      b.setAttribute('aria-pressed', String(saved));
      b.textContent = saved ? '★ Отмечено' : '☆ Отметить';
    }
  }

  const normalize = s => String(s || '').trim().replace(/^@+/, '').toLocaleLowerCase('ru');
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = s => { try { const u = new URL(String(s)); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  // Временный доступ в пределах текущей вкладки.
  const ACCESS_KEY = 'cosplaybattle-tab-access-v11';
  let accessToken = '';
  try { accessToken = sessionStorage.getItem(ACCESS_KEY) || ''; } catch {}
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (accessToken) headers['X-Contest-Access'] = accessToken;
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  const post = (path, body) => api(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

  const tools = document.createElement('div'); tools.className = 'contest-tools';
  const addButton = document.createElement('button'); addButton.type='button'; addButton.className='small-tool-btn'; addButton.textContent='+ Добавить своё имя';
  const finishButton = document.createElement('button'); finishButton.type='button'; finishButton.className='small-tool-btn admin-button'; finishButton.textContent='Завершить голосование'; finishButton.hidden=false;
  const winnersButton = document.createElement('button'); winnersButton.type='button'; winnersButton.className='small-tool-btn'; winnersButton.textContent='🏆 Победители'; winnersButton.hidden=true;
  tools.append(addButton, favoritesButton, finishButton, winnersButton); select.insertAdjacentElement('afterend',tools);
  const overlay = document.createElement('div'); overlay.className='contest-dialog-overlay'; overlay.hidden=true; overlay.innerHTML='<section class="contest-dialog" role="dialog" aria-modal="true" aria-labelledby="contestDialogTitle"><button type="button" class="contest-dialog-close" aria-label="Закрыть">×</button><div class="contest-dialog-body"></div></section>';
  document.body.append(overlay);
  const dialogBody = overlay.querySelector('.contest-dialog-body');
  const closeDialog = () => {overlay.hidden=true; dialogBody.replaceChildren();};
  overlay.addEventListener('click', e => {if(e.target===overlay || e.target.closest('.contest-dialog-close')) closeDialog();});
  document.addEventListener('keydown', e => {if(e.key==='Escape' && !overlay.hidden) closeDialog();});
  function showDialog(html) {dialogBody.innerHTML=html; overlay.hidden=false; overlay.querySelector('input,button')?.focus();}
  let toastTimer;
  function notify(message) {
    let t = $('toast');
    if (!t) {t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.append(t);}
    t.textContent=message; t.classList.add('active'); clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>t.classList.remove('active'),3000);
  }
  function chosenName() {return select.value.trim();}
  function remaining() {return Math.max(0,5-votes.filter(v=>normalize(v.fields?.['Voter Name'])===normalize(chosenName())).length);}
  function updateCounter() {
    const used=chosenName()?5-remaining():0;
    if ($('votesLeft')) $('votesLeft').textContent=chosenName()?`Ваши голоса: ${used}/5`:'';
    if ($('stickyCounterText')) $('stickyCounterText').textContent=`Осталось голосов: ${remaining()}`;
    $('stickyCounter')?.classList.toggle('visible',Boolean(chosenName()) && !closed);
  }
  function setNames(names) {
    const selected=chosenName() || localStorage.getItem('contest-voter-name') || '';
    select.replaceChildren(new Option('Выберите своё имя',''));
    for (const n of names) select.add(new Option(n,n));
    if (names.includes(selected)) select.value=selected;
    finishButton.hidden=closed;
    addButton.hidden=closed;
    winnersButton.hidden=!closed;
  }
  const isBlocked = work => /без\s+голосования/i.test(String(work?.fields?.['Примечания'] || ''));
  const authorById = () => new Map(works.map(w=>[w.id,normalize(w.fields?.Username)]));
  function uniqueVotes(rawVotes) {
    const authors=authorById();
    const seen=new Set();
    return rawVotes.filter(v=>{
      const voter=normalize(v.fields?.['Voter Name']);
      const ids=Array.isArray(v.fields?.['Contest Work'])?v.fields['Contest Work']:[v.fields?.['Contest Work']];
      const author=ids.map(id=>authors.get(id)).find(Boolean);
      if(!voter || !author) return false;
      const fingerprint=voter+'|'+author;
      if(seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }
  function counts() {
    const count=new Map(); for(const v of votes) for(const id of (Array.isArray(v.fields?.['Contest Work']) ? v.fields['Contest Work'] : [v.fields?.['Contest Work']])) if(id) count.set(id,(count.get(id)||0)+1);
    return count;
  }
  function media(files) {
    const valid=(files||[]).map(f=>({src:url(f.url),video:String(f.type||'').startsWith('video/')})).filter(f=>f.src);
    if(!valid.length) return '';
    const cells=valid.map((f,i)=>f.video
      ? `<div class="video-slide slider-item"><video class="media-frame" ${i?'preload="metadata"':'preload="metadata"'} autoplay muted loop playsinline controls src="${escape(f.src)}"></video><button class="video-sound-button" type="button" aria-label="Включить звук">🔊 Включить звук</button></div>`
      : `<img class="media-frame slider-item" loading="lazy" src="${escape(f.src)}" alt="Конкурсная работа ${i+1}">`).join('');
    if(valid.length===1) return `<div class="media-area">${cells}</div>`;
    return `<div class="media-area slider"><div class="slider-items">${cells}</div><button type="button" class="slider-prev" aria-label="Назад">‹</button><button type="button" class="slider-next" aria-label="Вперёд">›</button></div>`;
  }
  function render() {
    const authorMap=authorById(), count=counts(), voter=normalize(chosenName());
    const own=votes.filter(v=>normalize(v.fields?.['Voter Name'])===voter);
    const votedIds=new Set(own.flatMap(v=>Array.isArray(v.fields?.['Contest Work'])?v.fields['Contest Work']:[v.fields?.['Contest Work']]));
    const votedAuthors=new Set([...votedIds].map(id=>authorMap.get(id)).filter(Boolean));
    const html=works.filter(w=>w.fields?.Username && w.fields?.['Конкурсные работы']?.length).map(w=>{
      const f=w.fields, id=w.id, author=normalize(f.Username), voted=votedIds.has(id);
      const blocked=isBlocked(w);
      const disabled=blocked || closed || !voter || (!voted && (remaining()<=0 || votedAuthors.has(author)));
      const label=blocked?'Голосование недоступно':closed?'Голосование завершено':voted?'Убрать голос':votedAuthors.has(author)?'За автора уже отдано':'Голосовать';
      const description=f['Описание'] || f['Текст'] || f['Заметка'] || '';
      const link=url(f['Ссылка на пост']);
      return `<article class="card ${voted?'is-voted':''}" data-work-id="${escape(id)}">${media(f['Конкурсные работы'])}<div class="card-content"><div class="card-header"><div class="username">@${escape(String(f.Username).replace(/^@+/,''))}</div><div class="votes-badge">❤️ ${count.get(id)||0}</div></div>${description?`<div class="work-text-container"><div class="work-text">${escape(description)}</div>${String(description).length>90?'<button type="button" class="text-toggle-btn">Читать полностью ▼</button>':''}</div>`:''}<div class="button-row">${!blocked && !closed && remaining()>0?`<button type="button" class="favorite-button" data-favorite="${escape(id)}" aria-pressed="${favorites.has(id)}">${favorites.has(id)?'★ Отмечено':'☆ Отметить'}</button>`:''}<button type="button" class="vote-button ${voted?'remove':''} ${pendingVoteId===id?'is-saving':''}" data-vote="${escape(id)}" ${disabled?'disabled':''}>${label}</button>${link?`<a class="link-button" aria-label="Открыть пост" target="_blank" rel="noopener noreferrer" href="${escape(link)}">🔗</a>`:''}</div></div></article>`;
    }).join('');
    worksNode.innerHTML=html || '<p class="contest-empty">Работ пока нет. Проверьте Airtable.</p>';
    updateCounter();
    observeCards();
    updateFavoriteButtons();
    observeVideos();
  }
  const cardObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');cardObserver.unobserve(entry.target);}}
  },{threshold:0.04,rootMargin:'0px 0px 70px 0px'}) : null;
  function observeCards(){for(const card of worksNode.querySelectorAll('.card')){if(cardObserver)cardObserver.observe(card);else card.classList.add('is-visible');}}
  // On mobile do not decode/play dozens of videos while scrolling.
  const videoObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    for (const {target, isIntersecting, intersectionRatio} of entries) {
      if (isIntersecting && intersectionRatio >= 0.55 && !document.hidden) {
        target.play().catch(() => {});
      } else {
        target.pause();
      }
    }
  }, { threshold: [0, 0.55] }) : null;
  function observeVideos() {
    for (const video of worksNode.querySelectorAll('video')) {
      video.autoplay = false;
      video.pause();
      if (videoObserver) videoObserver.observe(video);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) worksNode.querySelectorAll('video').forEach(v => v.pause());
  });
  function pulse(button){button.classList.remove('vote-pop');void button.offsetWidth;button.classList.add('vote-pop');}
  function updateVoteWidgets(){
    const countsMap=counts(), current=normalize(chosenName()), authorMap=authorById();
    const mine=votes.filter(v=>normalize(v.fields?.['Voter Name'])===current);
    const selectedIds=new Set(mine.flatMap(v=>Array.isArray(v.fields?.['Contest Work'])?v.fields['Contest Work']:[v.fields?.['Contest Work']]));
    const selectedAuthors=new Set([...selectedIds].map(id=>authorMap.get(id)));
    for(const card of worksNode.querySelectorAll('.card')){
      const id=card.dataset.workId, button=card.querySelector('[data-vote]'), badge=card.querySelector('.votes-badge');
      const selected=selectedIds.has(id), locked=!selected&&(remaining()===0||selectedAuthors.has(authorMap.get(id)));
      const blocked=isBlocked(works.find(w=>w.id===id));
      badge.textContent=`❤️ ${countsMap.get(id)||0}`;card.classList.toggle('is-voted',selected);
      button.classList.toggle('remove',selected);button.classList.toggle('is-saving',pendingVoteId===id);
      button.disabled=blocked||closed||!current||locked;button.textContent=blocked?'Голосование недоступно':closed?'Голосование завершено':selected?'Убрать голос':locked?'Недоступно':'Голосовать';
    }
    updateCounter();
  }
  function renderWinners(list) {
    winnerRows=list;
    const medals=['🥇','🥈','🥉','✦','✦'];
    showDialog(`<div class="winners-hero"><div class="winners-kicker">#CosplayBattle · ФИНАЛ</div><div class="winners-trophy">🏆</div><h2 id="contestDialogTitle">Наши победители</h2><p>Пять авторов, которых мы выбрали</p></div><div class="contest-winners">${list.length?list.map((w,i)=>`<article class="winner-card place-${i+1}"><div class="winner-place"><span>${medals[i]||'✦'}</span><small>${w.rank} место</small></div><div class="winner-main"><div class="winner-name">@${escape(w.username)}</div><div class="winner-votes">♥ ${w.count} ${w.count===1?'голос':'голосов'}</div><div class="winner-actions"><button type="button" data-copy="@${escape(w.username)}" class="winner-action">Скопировать ник</button>${url(w.link)?`<button type="button" data-copy="${escape(url(w.link))}" class="winner-action">Копировать ссылку</button><a href="${escape(url(w.link))}" target="_blank" rel="noopener noreferrer" class="winner-action winner-view">Открыть ↗</a>`:''}</div></div></article>`).join(''):'<p>Пока никто не получил голосов.</p>'}</div>`);
  }
  async function refresh() {
    const [state,w,v]=await Promise.all([api('/api/state'),api('/api/works'),api('/api/votes')]);
    closed=state.closed;
    // Пометка «В конец» в поле «Примечания» отправляет работу вниз списка.
    // Остальные работы сохраняют порядок, полученный от Airtable.
    works=(w.records||[]).sort((a,b)=>{
      const isLast=work=>String(work.fields?.['Примечания']||'').toLocaleLowerCase('ru').includes('в конец');
      return Number(isLast(a))-Number(isLast(b));
    });
    votes=uniqueVotes(v.records||[]);
    setNames(state.names||[]); loadFavorites(); clearCompletedFavorites(); render();
    if (!closed && !votes.length) { winnerRows=[]; winnersButton.hidden=true; }
    if(closed) { const result=await api('/api/winners'); winnerRows=result.winners||[]; winnersButton.hidden=false; }
  }
  addButton.addEventListener('click',()=>{
    showDialog('<h2 id="contestDialogTitle">Укажите имя</h2><form id="contest-register"><input id="contest-new-name" name="name" maxlength="60" minlength="2" required autocomplete="off" aria-label="Имя в рабочем аккаунте" placeholder="Как в рабочем аккаунте"><button type="submit" class="vote-button">Добавить</button><p class="contest-form-message" aria-live="polite"></p></form>');
    $('contest-register').addEventListener('submit',async e=>{
      e.preventDefault(); const btn=e.currentTarget.querySelector('button'); const name=e.currentTarget.elements.name.value.trim();btn.disabled=true;
      try {await post('/api/register',{name});await refresh(); select.value=name;select.dispatchEvent(new Event('change'));closeDialog();notify('Имя добавлено! У вас 5 голосов.');}
      catch(err){e.currentTarget.querySelector('.contest-form-message').textContent=err.message;btn.disabled=false;}
    });
  });

  function openFavorites() {
    if (!chosenName()) {
      notify('Сначала выберите своё имя.');
      select.focus();
      return;
    }
    choosing = true;
    choiceIds.clear();
    renderFavorites();
  }
  function renderFavorites() {
    for (const id of choiceIds) if (isBlocked(works.find(w=>w.id===id))) choiceIds.delete(id);
    const authorMap = authorById();
    const mine = votes.filter(v => normalize(v.fields?.['Voter Name']) === normalize(chosenName()));
    const chosenAuthors = new Set(mine.flatMap(v => {
      const ids = Array.isArray(v.fields?.['Contest Work']) ? v.fields['Contest Work'] : [v.fields?.['Contest Work']];
      return ids.map(id => authorMap.get(id));
    }).filter(Boolean));
    const max = remaining();
    const marked = works.filter(w => favorites.has(w.id) && w.fields?.Username && !isBlocked(w));
    const rows = marked.map(w => {
      const author = normalize(w.fields.Username);
      const already = chosenAuthors.has(author);
      const blocked = isBlocked(w);
      const selected = choiceIds.has(w.id);
      const unavailable = closed || blocked || already;
      const thumb = (w.fields['Конкурсные работы'] || []).find(f => (f.type || '').startsWith('image/'));
      return `<div class="favorite-row ${selected ? 'selected' : ''}">
        ${thumb && url(thumb.url) ? `<img loading="lazy" src="${escape(url(thumb.url))}" alt="">` : '<div class="favorite-placeholder">★</div>'}
        <div class="favorite-row-main"><strong>@${escape(String(w.fields.Username).replace(/^@+/, ''))}</strong><small>${already ? 'Вы уже проголосовали за автора' : blocked ? 'Голосование недоступно' : 'В избранном'}</small></div>
        <button type="button" class="favorite-remove" data-unmark="${escape(w.id)}" title="Убрать из отмеченных" aria-label="Убрать из отмеченных">×</button>
        <button type="button" class="favorite-pick ${selected ? 'active' : ''}" data-pick="${escape(w.id)}" ${unavailable ? 'disabled' : ''}>${already ? 'Учтено' : selected ? '✓ Выбрано' : 'Выбрать'}</button>
      </div>`;
    }).join('');
    showDialog(`<div class="favorites-screen"><h2 id="contestDialogTitle">Мои отмеченные</h2><p>Отметки — это не голоса. Выберите авторов и подтвердите выбор.</p>
      <div class="favorite-summary">Отмечено: <b>${marked.length}</b> · Уже отдано: <b>${5-max}/5</b> · К выбору: <b>${max}</b></div>
      <div class="favorite-list">${rows || '<p class="favorite-empty">Пока ничего не отмечено. Закройте окно и нажмите «☆ Отметить» у понравившихся работ.</p>'}</div>
      <div class="favorites-footer"><span>Выбрано сейчас: <b>${choiceIds.size}</b> из ${max}</span><button class="vote-button" type="button" id="favoriteConfirm" ${!choiceIds.size || busy || closed ? 'disabled' : ''}>Подтвердить ${choiceIds.size} голосов</button></div>
      <p class="contest-form-message" id="favoritesMessage" aria-live="polite"></p></div>`);
  }
  favoritesButton.addEventListener('click', openFavorites);
  overlay.addEventListener('click', async e => {
    const rm = e.target.closest('[data-unmark]');
    if (rm) {
      favorites.delete(rm.dataset.unmark);
      choiceIds.delete(rm.dataset.unmark);
      saveFavorites(); renderFavorites(); return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick && !pick.disabled) {
      const id = pick.dataset.pick;
      const author = normalize(works.find(w => w.id === id)?.fields?.Username);
      if (choiceIds.has(id)) choiceIds.delete(id);
      else {
        if (choiceIds.size >= remaining()) {notify('Больше свободных голосов нет.'); return;}
        for (const selected of [...choiceIds]) {
          if (normalize(works.find(w => w.id === selected)?.fields?.Username) === author) choiceIds.delete(selected);
        }
        choiceIds.add(id);
      }
      renderFavorites(); return;
    }
    if (e.target.id !== 'favoriteConfirm' || busy || closed) return;
    const btn = e.target;
    if (!choiceIds.size) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = 'Подтверждаем...';
    const requested = [...choiceIds];
    let saved = 0;
    let lastError = '';
    for (const id of requested) {
      try {
        await post('/api/vote', {voterName:chosenName(),contestWork:id,action:'add'});
        saved++;
      } catch (err) { lastError = err.message; break; }
    }
    try {
      votes = uniqueVotes((await api('/api/votes')).records || []);
    } catch (err) { lastError = lastError || 'Не удалось сверить голоса. Обновите страницу.'; }
    busy = false;
    choiceIds.clear();
    if (!lastError) clearCompletedFavorites();
    render();
    if (saved === requested.length && !lastError) {
      closeDialog();
      notify(`Сохранено голосов: ${saved}`);
    } else {
      renderFavorites();
      $('favoritesMessage').textContent = `Сохранено: ${saved} из ${requested.length}. ${lastError} Проверьте свои голоса перед повтором.`;
    }
  });

  finishButton.addEventListener('click',()=>{
    showDialog('<h2 id="contestDialogTitle">Только для администратора — Арины</h2><p>Для завершения нужен PIN администратора. После завершения новые голоса и отмены будут заблокированы. Результаты увидят все.</p><form id="contest-finish"><label for="contest-pin">PIN администратора</label><input id="contest-pin" name="pin" type="password" autocomplete="off" required placeholder="Введите PIN"><button type="submit" class="vote-button">Подтвердить завершение</button><p class="contest-form-message" aria-live="polite"></p></form>');
    $('contest-finish').addEventListener('submit',async e=>{
      e.preventDefault();const btn=e.currentTarget.querySelector('button'); btn.disabled=true;
      try {const result=await post('/api/finish',{pin:e.currentTarget.elements.pin.value});await refresh();renderWinners(result.winners||[]);}
      catch(err){e.currentTarget.querySelector('.contest-form-message').textContent=err.message;btn.disabled=false;}
    });
  });
  winnersButton.addEventListener('click',async()=>{try{renderWinners((await api('/api/winners')).winners||[]);}catch(e){notify(e.message);}});
  select.addEventListener('change',()=>{localStorage.setItem('contest-voter-name',chosenName());loadFavorites();clearCompletedFavorites();finishButton.hidden=closed;render();});
  worksNode.addEventListener('click',async e=>{
    const soundButton=e.target.closest('.video-sound-button');
    if(soundButton){
      const video=soundButton.closest('.video-slide')?.querySelector('video');
      if(!video)return;
      video.muted=!video.muted;
      soundButton.textContent=video.muted?'🔊 Включить звук':'🔇 Выключить звук';
      soundButton.setAttribute('aria-label',video.muted?'Включить звук':'Выключить звук');
      if(video.paused) video.play().catch(()=>notify('Нажмите ▶ на видео, чтобы начать просмотр.'));
      return;
    }
    const toggle=e.target.closest('.text-toggle-btn');
    if(toggle){const t=toggle.previousElementSibling;const expanded=t.classList.toggle('expanded');toggle.textContent=expanded?'Свернуть ▲':'Читать полностью ▼';return;}
    const arrow=e.target.closest('.slider-next,.slider-prev');
    if(arrow){const slider=arrow.closest('.slider'),box=slider.querySelector('.slider-items');const direction=arrow.classList.contains('slider-next')?1:-1;box.scrollBy({left:direction*box.clientWidth,behavior:'smooth'});return;}
    const mark=e.target.closest('[data-favorite]');
    if(mark){const id=mark.dataset.favorite;if(isBlocked(works.find(w=>w.id===id)))return;if(favorites.has(id))favorites.delete(id);else favorites.add(id);saveFavorites();return;}
    const btn=e.target.closest('[data-vote]');if(!btn||busy||closed)return;
    const workId=btn.dataset.vote;
    if(btn.disabled)return;
    const removing=votes.some(v=>normalize(v.fields?.['Voter Name'])===normalize(chosenName())&&(v.fields?.['Contest Work']||[]).includes(workId));
    const before=votes;
    busy=true;pendingVoteId=workId;
    const revision=++voteRevision;
    if(removing){
      votes=votes.filter(v=>!(normalize(v.fields?.['Voter Name'])===normalize(chosenName())&&(v.fields?.['Contest Work']||[]).includes(workId)));
    }else{
      votes=[...votes,{id:'optimistic-'+Date.now(),fields:{'Voter Name':chosenName(),'Contest Work':[workId]}}];
    }
    updateVoteWidgets();pulse(btn);
    try {
      await post('/api/vote',{voterName:chosenName(),contestWork:workId,action:removing?'delete':'add'});
      // Reconcile with Airtable before clearing favorites; optimistic fifth vote alone is insufficient.
      if (!removing && remaining() === 0) {
        try { votes=uniqueVotes((await api('/api/votes')).records||[]); clearCompletedFavorites(); }
        catch (syncError) { console.warn('Не удалось подтвердить пятый голос',syncError); }
      }
      notify(removing?'Голос отменён':'Голос учтён!');
      // Не задерживаем кнопку вторым запросом в Airtable. Сверяем данные фоном.
      api('/api/votes').then(result=>{
        if(revision===voteRevision && !busy){votes=uniqueVotes(result.records||[]);updateVoteWidgets();}
      }).catch(err=>console.warn('Фоновая синхронизация голосов:',err));
    }catch(err){
      votes=before;notify(err.message);
      try{votes=uniqueVotes((await api('/api/votes')).records||[]);}catch{}
    }finally{busy=false;pendingVoteId=null;updateVoteWidgets();}
  });
  overlay.addEventListener('click',async e=>{
    const b=e.target.closest('[data-copy]');if(!b)return;
    try{await navigator.clipboard.writeText(b.dataset.copy);notify('Скопировано!');}
    catch{notify('Не удалось скопировать — попробуйте открыть сайт по HTTPS.');}
  });
  // Remove legacy modals/easter eggs from the previous version.
  for(const id of ['waitModalOverlay','modalOverlay']) $(id)?.remove();
  function loadContest() {
    refresh().catch(err=>{
      console.error(err);
      worksNode.innerHTML='<p class="contest-empty">Не удалось загрузить конкурсные работы: '+escape(err.message)+'</p>';
      notify('Ошибка загрузки. Проверьте настройки Airtable.');
    });
  }
  const accessWall = $('accessWall');
  const accessForm = $('accessForm');
  const accessError = $('accessError');
  function grantAccess() {
    document.body.classList.remove('access-locked');
    document.body.classList.add('access-granted');
    if (accessWall) accessWall.hidden = true;
    loadContest();
  }
  if (accessForm) {
    accessForm.addEventListener('submit', async e => {
      e.preventDefault();
      const button = $('accessSubmit');
      const field = $('accessPin');
      button.disabled = true;
      accessError.textContent = '';
      try {
        const result = await post('/api/access', { pin: field.value });
        if (!result.accessToken) throw new Error('Сервер не вернул ключ доступа');
        accessToken = result.accessToken;
        try { sessionStorage.setItem(ACCESS_KEY, accessToken); } catch {}
        field.value = '';
        grantAccess();
      } catch (err) {
        accessError.textContent = err.message || 'Не удалось войти';
      } finally {
        button.disabled = false;
      }
    });
  }
  api('/api/access').then(data => {
    if (data.authenticated) grantAccess();
    else {
      accessToken = '';
      try { sessionStorage.removeItem(ACCESS_KEY); } catch {}
      $('accessPin')?.focus();
    }
  }).catch(err => {
    accessError.textContent = 'Не удалось проверить доступ. Обновите страницу.';
    console.error(err);
  });
})();
