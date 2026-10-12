/* Конкурс — клиент. Настройки и PIN находятся только на сервере. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const select = $('employeeSelect');
  const worksNode = $('works');
  if (!select || !worksNode) return;

  let works = [], votes = [], closed = false, busy = false, winnerRows = [];
  let lastRefreshId = 0;
  const normalize = s => String(s || '').trim().replace(/^@+/, '').toLocaleLowerCase('ru');
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = s => { try { const u = new URL(String(s)); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  const post = (path, body) => api(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

  const tools = document.createElement('div'); tools.className = 'contest-tools';
  const addButton = document.createElement('button'); addButton.type='button'; addButton.className='small-tool-btn'; addButton.textContent='+ Добавить своё имя';
  const finishButton = document.createElement('button'); finishButton.type='button'; finishButton.className='small-tool-btn admin-button'; finishButton.textContent='Завершить голосование'; finishButton.hidden=true;
  const winnersButton = document.createElement('button'); winnersButton.type='button'; winnersButton.className='small-tool-btn'; winnersButton.textContent='🏆 Победители'; winnersButton.hidden=true;
  tools.append(addButton, finishButton, winnersButton); select.insertAdjacentElement('afterend',tools);
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
    finishButton.hidden=normalize(chosenName())!=='арина' || closed;
    addButton.hidden=closed;
    winnersButton.hidden=!closed;
  }
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
      const disabled=closed || !voter || busy || (!voted && (remaining()<=0 || votedAuthors.has(author)));
      const label=closed?'Голосование завершено':voted?'Убрать голос':votedAuthors.has(author)?'За автора уже отдано':'Голосовать';
      const description=f['Описание'] || f['Текст'] || f['Заметка'] || '';
      const link=url(f['Ссылка на пост']);
      return `<article class="card" data-work-id="${escape(id)}">${media(f['Конкурсные работы'])}<div class="card-content"><div class="card-header"><div class="username">@${escape(String(f.Username).replace(/^@+/,''))}</div><div class="votes-badge">❤️ ${count.get(id)||0}</div></div>${description?`<div class="work-text-container"><div class="work-text">${escape(description)}</div>${String(description).length>90?'<button type="button" class="text-toggle-btn">Читать полностью ▼</button>':''}</div>`:''}<div class="button-row"><button type="button" class="vote-button ${voted?'remove':''}" data-vote="${escape(id)}" ${disabled?'disabled':''}>${label}</button>${link?`<a class="link-button" aria-label="Открыть пост" target="_blank" rel="noopener noreferrer" href="${escape(link)}">🔗</a>`:''}</div></div></article>`;
    }).join('');
    worksNode.innerHTML=html || '<p class="contest-empty">Работ пока нет. Проверьте Airtable.</p>';
    updateCounter();
  }
  function renderWinners(list) {
    winnerRows=list;
    showDialog(`<div class="winners-heading">🏆</div><h2 id="contestDialogTitle">Наши победители!</h2><p>Топ-5 авторов по количеству голосов</p><div class="contest-winners">${list.length?list.map(w=>`<div class="winner-item"><span class="winner-rank">${w.rank} место</span><button type="button" class="copy-user-btn" data-copy="@${escape(w.username)}">@${escape(w.username)}</button><span class="winner-votes">❤️ ${w.count}</span>${url(w.link)?`<button type="button" class="copy-post-btn" data-copy="${escape(url(w.link))}">Копировать ссылку</button><a href="${escape(url(w.link))}" target="_blank" rel="noopener noreferrer" class="winner-open" aria-label="Открыть пост">↗</a>`:''}</div>`).join(''):'<p>Пока никто не получил голосов.</p>'}</div><p class="winner-help">Ник и ссылку можно копировать по отдельности.</p>`);
  }
  async function refresh() {
    const [state,w,v]=await Promise.all([api('/api/state'),api('/api/works'),api('/api/votes')]);
    closed=state.closed; works=w.records||[]; votes=uniqueVotes(v.records||[]);
    setNames(state.names||[]); render();
    if(closed) { const result=await api('/api/winners'); winnerRows=result.winners||[]; winnersButton.hidden=false; }
  }
  addButton.addEventListener('click',()=>{
    showDialog('<h2 id="contestDialogTitle">Добавить своё имя</h2><form id="contest-register"><label for="contest-new-name">Как вас зовут?</label><input id="contest-new-name" name="name" maxlength="60" minlength="2" required autocomplete="name" placeholder="Ваше имя"><button type="submit" class="vote-button">Добавить</button><p class="contest-form-message" aria-live="polite"></p></form>');
    $('contest-register').addEventListener('submit',async e=>{
      e.preventDefault(); const btn=e.currentTarget.querySelector('button'); const name=e.currentTarget.elements.name.value.trim();btn.disabled=true;
      try {await post('/api/register',{name});await refresh(); select.value=name;select.dispatchEvent(new Event('change'));closeDialog();notify('Имя добавлено! У вас 5 голосов.');}
      catch(err){e.currentTarget.querySelector('.contest-form-message').textContent=err.message;btn.disabled=false;}
    });
  });
  finishButton.addEventListener('click',()=>{
    showDialog('<h2 id="contestDialogTitle">Завершить голосование?</h2><p>После завершения новые голоса и отмены будут заблокированы. Результаты увидят все.</p><form id="contest-finish"><label for="contest-pin">PIN администратора</label><input id="contest-pin" name="pin" type="password" autocomplete="off" required placeholder="Введите PIN"><button type="submit" class="vote-button">Подтвердить завершение</button><p class="contest-form-message" aria-live="polite"></p></form>');
    $('contest-finish').addEventListener('submit',async e=>{
      e.preventDefault();const btn=e.currentTarget.querySelector('button'); btn.disabled=true;
      try {const result=await post('/api/finish',{pin:e.currentTarget.elements.pin.value});await refresh();renderWinners(result.winners||[]);}
      catch(err){e.currentTarget.querySelector('.contest-form-message').textContent=err.message;btn.disabled=false;}
    });
  });
  winnersButton.addEventListener('click',async()=>{try{renderWinners((await api('/api/winners')).winners||[]);}catch(e){notify(e.message);}});
  select.addEventListener('change',()=>{localStorage.setItem('contest-voter-name',chosenName());finishButton.hidden=normalize(chosenName())!=='арина'||closed;render();});
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
    const btn=e.target.closest('[data-vote]');if(!btn||busy||closed)return;
    const workId=btn.dataset.vote;busy=true;render();
    try {
      const removing=votes.some(v=>normalize(v.fields?.['Voter Name'])===normalize(chosenName())&&(v.fields?.['Contest Work']||[]).includes(workId));
      await post('/api/vote',{voterName:chosenName(),contestWork:workId,action:removing?'delete':'add'});
      const result=await api('/api/votes');votes=uniqueVotes(result.records||[]);
      notify(removing?'Голос отменён':'Голос учтён!');
    }catch(err){notify(err.message);try{votes=uniqueVotes((await api('/api/votes')).records||[]);}catch{}}
    finally{busy=false;render();}
  });
  overlay.addEventListener('click',async e=>{
    const b=e.target.closest('[data-copy]');if(!b)return;
    try{await navigator.clipboard.writeText(b.dataset.copy);notify('Скопировано!');}
    catch{notify('Не удалось скопировать — попробуйте открыть сайт по HTTPS.');}
  });
  // Remove legacy modals/easter eggs from the previous version.
  for(const id of ['waitModalOverlay','modalOverlay']) $(id)?.remove();
  refresh().catch(err=>{console.error(err);worksNode.innerHTML='<p class="contest-empty">Не удалось загрузить конкурсные работы: '+escape(err.message)+'</p>';notify('Ошибка загрузки. Проверьте настройки Airtable.');});
})();
