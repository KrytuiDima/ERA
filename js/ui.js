// js/ui.js — Modal system, toast, sheets, history, carousel, crop, long press

// ── Scroll lock ───────────────────────────────────────────
function lockScroll()   { document.body.classList.add('scroll-locked'); }
function unlockScroll() { document.body.classList.remove('scroll-locked'); }

// ── History API (Керування історією та кнопкою Назад) ─────
// Модальні вікна інтегровані з історією браузера для коректної роботи кнопки "Назад"
let _histDepth = 0;

// Додаємо новий стан в історію при відкритті будь-якого вікна
function eraPush(id) {
  _histDepth++;
  history.pushState({ era: id, depth: _histDepth }, '', location.href.split('#')[0] + '#' + id);
}

// Програмна імітація натискання кнопки "Назад"
function eraBack() {
  if (_histDepth > 0) {
    history.back();
  } else {
    _closeTopModal();
  }
}

// Закриття самого верхнього активного вікна
function _closeTopModal(fromPopState = false) {
  // 1. Лайтбокс (Media View)
  if (document.getElementById('lightbox')) {
    _closeLightboxInternal(fromPopState);
    return;
  }
  // 2. Діалог заміни пінів
  if (document.getElementById('pin-replace-dialog')) {
    document.getElementById('pin-replace-dialog').remove();
    if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
    return;
  }
  // 3. Фото-редактор (Studio)
  const studio = document.getElementById('studio');
  if (studio && !studio.classList.contains('hidden')) {
    closeStudio(fromPopState);
    return;
  }
  // 4. Стандартні Overlay (Створення поста, Коментарі, Профіль)
  const open = [...document.querySelectorAll('.overlay:not(.hidden)')];
  if (open.length) {
    const o = open[open.length - 1];
    _animateSheetOut(o, null, fromPopState);
  }
}

// Обробка системної кнопки "Назад" (Android) або свайпу (iOS)
window.addEventListener('popstate', e => {
  _histDepth = e.state?.depth || 0;
  _closeTopModal(true);
});

// ── Sheet animation helpers ───────────────────────────────
// Плавна анімація виїзду шторки вниз
function _animateSheetOut(overlayEl, cb, fromPopState = false) {
  const sheet = overlayEl.querySelector('.sheet');
  if (sheet) {
    sheet.style.transition = 'transform .28s cubic-bezier(.22,1,.36,1)';
    sheet.style.transform = 'translateY(105%)';
    setTimeout(() => {
      overlayEl.classList.add('hidden');
      sheet.style.transform = '';
      sheet.style.transition = '';
      unlockScroll();
      if (cb) cb();
      // Синхронізуємо історію, якщо закриття ініційовано кодом, а не кнопкою "Назад"
      if (!fromPopState && _histDepth > 0) {
        _histDepth--;
        history.back();
      }
    }, 270);
  } else {
    overlayEl.classList.add('hidden');
    unlockScroll();
    if (cb) cb();
    if (!fromPopState && _histDepth > 0) {
      _histDepth--;
      history.back();
    }
  }
}

// ── Open / close modals ───────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id); if(!el) return;
  el.classList.remove('hidden');
  const sheet = el.querySelector('.sheet');
  if (sheet) { sheet.style.transform='translateY(100%)'; sheet.style.transition='none'; requestAnimationFrame(()=>{ sheet.style.transition='transform .3s cubic-bezier(.22,1,.36,1)'; sheet.style.transform=''; }); }
  lockScroll(); eraPush(id);
  // Init drag-to-close
  const pairs = { 'modal-create':['handle-create','sheet-create'], 'modal-cmt':['handle-cmt','sheet-cmt'], 'modal-user':['handle-user','sheet-user'] };
  if (pairs[id]) _makeDraggable(...pairs[id], id);
}

function closeModal(id) {
  const el = document.getElementById(id); if(!el) return;
  _animateSheetOut(el);
}

function ovClose(e, id) { if(e.target===document.getElementById(id)) closeModal(id); }

// ── Sheet drag-to-close (Фізика шторки) ───────────────────
// Дозволяє закривати модальні вікна свайпом вниз за верхню частину (Handle bar) (Module 3)
function _makeDraggable(handleId, sheetId, overlayId) {
  const handle = document.getElementById(handleId);
  const sheet = document.getElementById(sheetId);
  if (!handle || !sheet) return;
  
  let sy = 0, dragging = false, startTime = 0;
  const hdr = sheet.querySelector('.sheet-hdr');
  const targets = [handle, hdr].filter(Boolean);

  const onStart = e => {
    sy = e.touches ? e.touches[0].clientY : e.clientY;
    dragging = true;
    startTime = Date.now();
    sheet.style.transition = 'none';
  };

  const onMove = e => {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - sy;
    if (dy > 0) {
      // Фізика опору: чим далі тягнемо, тим повільніше рухається (Module 3)
      const resistance = 1 + (dy / 200);
      sheet.style.transform = `translateY(${dy / resistance}px)`;

      // Візуально затінюємо фон залежно від прогресу
      const opacity = Math.max(0.4, 0.75 - dy / 800);
      document.getElementById(overlayId).style.backgroundColor = `rgba(0,0,0,${opacity})`;

      if (e.cancelable) e.preventDefault();
    }
  };

  const onEnd = e => {
    if (!dragging) return;
    dragging = false;
    const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const dy = y - sy;
    const dt = Date.now() - startTime;
    const vel = dy / dt; // Швидкість свайпу

    sheet.style.transition = 'transform .3s cubic-bezier(.22,1,.36,1)';
    
    // Закриваємо, якщо потягнули більше ніж на 120px або швидкий свайп
    if (dy > 120 || (vel > 0.6 && dy > 40)) {
      _animateSheetOut(document.getElementById(overlayId));
    } else {
      sheet.style.transform = '';
      document.getElementById(overlayId).style.backgroundColor = '';
    }
  };

  targets.forEach(el => {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('mousedown', onStart);
  });

  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchend', onEnd);
  window.addEventListener('mouseup', onEnd);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, dur=2800) {
  const c=document.getElementById('toasts'), el=document.createElement('div');
  el.className='toast'; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),250); }, dur);
}

// ── Feed carousel ─────────────────────────────────────────
function initCarousel(pid, total, isLb=false) {
  if (total<=1) return;
  const state = {idx:0, total, isLb};
  if (isLb) lbCarState.idx=0; else carousels.set(pid, state);

  const wrapId = isLb ? 'lb-img-'+pid : 'img-'+pid;
  const trackId = isLb ? 'lb-ct-'+pid : 'ct-'+pid;
  const wrap = document.getElementById(wrapId); if(!wrap) return;
  const track = document.getElementById(trackId);

  let sx=0, sy=0, dx=0, dragging=false;

  const onStart = e => {
    sx = e.touches ? e.touches[0].clientX : e.clientX;
    sy = e.touches ? e.touches[0].clientY : e.clientY;
    dragging = true;
    if(track) track.style.transition = 'none';
  };

  const onMove = e => {
    if(!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dx = x - sx;
    const dy = y - sy;

    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
      const st = isLb ? lbCarState : carousels.get(pid);
      let tx = -st.idx * wrap.clientWidth + dx;

      // Rubber-band effect
      if((st.idx === 0 && dx > 0) || (st.idx === st.total-1 && dx < 0)) {
        tx = -st.idx * wrap.clientWidth + dx * 0.3;
      }

      if(track) track.style.transform = `translateX(${tx}px)`;
      if(e.cancelable) e.preventDefault();
    }
  };

  const onEnd = () => {
    if(!dragging) return;
    dragging = false;
    if(track) track.style.transition = '';
    const st = isLb ? lbCarState : carousels.get(pid);

    if(Math.abs(dx) > 50) {
      if(dx < 0 && st.idx < st.total-1) st.idx++;
      else if(dx > 0 && st.idx > 0) st.idx--;
    }
    updateCarouselUI(pid, st.idx, isLb);
    dx = 0;
  };

  wrap.addEventListener('touchstart', onStart, {passive:true});
  wrap.addEventListener('touchmove', onMove, {passive:false});
  wrap.addEventListener('touchend', onEnd);

  wrap.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
}

function updateCarouselUI(pid, idx, isLb=false) {
  const trackId = isLb ? 'lb-ct-'+pid : 'ct-'+pid;
  const dotId = isLb ? 'lb-cd-'+pid : 'cd-'+pid;
  const ctrId = isLb ? 'lb-cc-'+pid : 'cc-'+pid;

  const track = document.getElementById(trackId);
  if(track) track.style.transform = `translateX(-${idx*100}%)`;

  document.querySelectorAll(`#${dotId} .c-dot`).forEach((d,i) => {
    d.classList.toggle('on', i === idx);
    d.style.width = i === idx ? '14px' : '6px';
  });

  const ctr = document.getElementById(ctrId);
  const st = isLb ? lbCarState : carousels.get(pid);
  if(ctr && st) ctr.textContent = `${idx+1}/${st.total}`;
}

// ── Long press (context menu) ─────────────────────────────
let _lpTimer=null, _lpMoved=false;
function _lpStart(e,pid) {
  _lpMoved=false;
  const touch=e.touches?e.touches[0]:e;
  const x=touch.clientX, y=touch.clientY;
  _lpTimer=setTimeout(()=>{
    if(_lpMoved)return;
    const card=document.getElementById('post-'+pid);
    if(card){ const r=document.createElement('div'); r.className='lp-ripple'; r.style.left=(x-card.getBoundingClientRect().left)+'px'; r.style.top=(y-card.getBoundingClientRect().top)+'px'; card.appendChild(r); setTimeout(()=>r.remove(),600); }
    showPostMenu(pid,x,y);
  },520);
}
function _lpMove() { _lpMoved=true; clearTimeout(_lpTimer); }
function _lpEnd()  { clearTimeout(_lpTimer); }

function showPostMenu(pid,x,y) {
  document.getElementById('ctx-m')?.remove();
  const p=POSTS.find(x=>x.id===pid); if(!p) return;
  const own=APP.user&&p.userId===APP.user.id;
  const isPinned=own&&(APP.user.pinnedPosts||[]).includes(pid);
  const menu=document.createElement('div'); menu.id='ctx-m'; menu.className='ctx-menu';
  const items = own
    ? [
        {ico:'✏️',lbl:t('post.editDesc'),     fn:`editDesc('${pid}')`},
        {ico:isPinned?'📌':'📍', lbl:isPinned?t('post.unpin'):t('post.pin'), fn:isPinned?`unpinPost('${pid}')`:` pinPost('${pid}')`},
        {ico:'🔗',lbl:t('post.share'),         fn:`sharePost('${pid}')`},
        {sep:true},
        {ico:'🗑️',lbl:t('post.delete'),        fn:`deletePost('${pid}')`, d:true},
      ]
    : [
        {ico:'👤',lbl:t('post.authorProfile'), fn:`openUserCard('${p.userId}')`},
        {ico:'🔗',lbl:t('post.share'),         fn:`sharePost('${pid}')`},
        {ico:'🔖',lbl:t('post.save'),          fn:`showToast('${t('post.saved')}')`},
        {ico:'🚩',lbl:t('post.report'),        fn:`showToast('${t('post.reported')}')`, d:true},
      ];
  menu.innerHTML=items.map(it=>it.sep?`<div class="ctx-sep"></div>`:
    `<button class="ctx-item${it.d?' danger':''}" onclick="${it.fn};document.getElementById('ctx-m')?.remove()"><span>${it.ico}</span><span>${it.lbl}</span></button>`).join('');
  const mH=items.filter(i=>!i.sep).length*42+10;
  let top=y+8, left=x-90;
  if(top+mH>window.innerHeight-16) top=y-mH-8;
  if(left<8) left=8; if(left+180>window.innerWidth-8) left=window.innerWidth-188;
  menu.style.cssText=`top:${top}px;left:${left}px`;
  document.body.appendChild(menu);
}

// ── Media Studio (Медіа-редактор) ─────────────────────────
// Професійний інструмент для обрізки та редагування фото (Module 2)
let _stCallback = null, _stImage = null, _stRatio = 4/5, _stRound = false;
let _stX = 0, _stY = 0, _stScale = 1, _stRotate = 0;
let _stDragSX = 0, _stDragSY = 0, _stDragOX = 0, _stDragOY = 0, _stDragging = false;

// Відкриття студії: src — шлях до фото, callback — функція після завершення, opts — налаштування пропорцій
function openStudio(src, callback, opts = {}) {
  _stCallback = callback;
  const options = { ratio: 4/5, round: false, ...opts };
  _stRatio = options.ratio;
  _stRound = options.round;

  const studio = document.getElementById('studio');
  if (!studio) return;
  studio.classList.remove('hidden');
  lockScroll();
  eraPush('studio');

  _stImage = new Image();
  _stImage.onload = () => {
    _stFit();
    _stDraw();
    setStudioTool('crop');
  };
  _stImage.src = src;
  _initStudioEvents();
}

// Закриття студії без збереження
function closeStudio(fromPopState = false) {
  const studio = document.getElementById('studio');
  if (!studio) return;
  studio.classList.add('hidden');
  unlockScroll();
  _stCallback = null;

  // Прибираємо глобальні обробники, щоб не було витоків
  window.removeEventListener('mousemove', _stOnMove);
  window.removeEventListener('mouseup', _stOnEnd);

  if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
}

// Підгонка розміру канвасу та початкового масштабу фото
function _stFit() {
  const stage = document.getElementById('studio-stage');
  const canvas = document.getElementById('studio-canvas');
  if (!stage || !canvas) return;
  const sw = stage.clientWidth, sh = stage.clientHeight;

  // Визначаємо розмір канвасу згідно з пропорціями (наприклад, 4:5)
  let cw = sw * 0.88, ch = cw / _stRatio;
  if (ch > sh * 0.8) { ch = sh * 0.8; cw = ch * _stRatio; }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';

  // Початковий масштаб, щоб фото заповнило всю рамку
  _stScale = Math.max(cw / _stImage.naturalWidth, ch / _stImage.naturalHeight);
  _stX = 0; _stY = 0; _stRotate = 0;

  const zS = document.getElementById('studio-zoom'), rS = document.getElementById('studio-rotate');
  if (zS) { zS.value = _stScale; zS.min = _stScale * 0.5; zS.max = _stScale * 5; }
  if (rS) { rS.value = 0; }
}

// Малювання фото на канвасі з урахуванням трансформацій
function _stDraw() {
  const canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  // Переносимо центр координат в центр канвасу
  ctx.translate(canvas.width / 2 + _stX * dpr, canvas.height / 2 + _stY * dpr);
  ctx.rotate(_stRotate * Math.PI / 180);
  ctx.scale(_stScale * dpr, _stScale * dpr);
  // Малюємо фото
  ctx.drawImage(_stImage, -_stImage.naturalWidth / 2, -_stImage.naturalHeight / 2);
  ctx.restore();

  // Якщо це аватарка, робимо прев'ю круглим
  canvas.style.borderRadius = _stRound ? '50%' : '0';
}

function _stOnMove(e) {
  if (!_stDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _stX = _stDragOX + (clientX - _stDragSX);
  _stY = _stDragOY + (clientY - _stDragSY);
  _stDraw();
  if (e.touches && e.cancelable) e.preventDefault();
}

function _stOnEnd() { _stDragging = false; }

// Ініціалізація подій перетягування та повзунків
function _initStudioEvents() {
  const stage = document.getElementById('studio-stage');
  if (!stage) return;

  const onStart = e => {
    _stDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    _stDragSX = clientX; _stDragSY = clientY;
    _stDragOX = _stX; _stDragOY = _stY;
  };

  stage.onmousedown = onStart;
  window.addEventListener('mousemove', _stOnMove);
  window.addEventListener('mouseup', _stOnEnd);

  stage.addEventListener('touchstart', onStart, {passive: true});
  stage.addEventListener('touchmove', _stOnMove, {passive: false});
  stage.addEventListener('touchend', _stOnEnd);

  const zS = document.getElementById('studio-zoom'), rS = document.getElementById('studio-rotate');
  if (zS) zS.oninput = e => { _stScale = parseFloat(e.target.value); _stDraw(); };
  if (rS) rS.oninput = e => { _stRotate = parseFloat(e.target.value); _stDraw(); };
}

// Перемикання інструментів (Crop, Brush, Text)
function setStudioTool(tool) {
  document.querySelectorAll('.studio-tool').forEach(b => b.classList.toggle('active', b.id === 'st-'+tool));
  document.querySelectorAll('.studio-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('studio-panel-'+tool)?.classList.remove('hidden');
}

// Фінальна обрізка та повернення результату (Base64)
function finishStudio() {
  const canvas = document.createElement('canvas');
  const OUT_SIZE = 1080; // Висока роздільна здатність для збереження якості
  canvas.width = OUT_SIZE;
  canvas.height = Math.round(OUT_SIZE / _stRatio);
  const ctx = canvas.getContext('2d');

  const viewWidth = document.getElementById('studio-canvas').clientWidth;
  const ratio = OUT_SIZE / viewWidth;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(_stRotate * Math.PI / 180);

  const s = _stScale * ratio;
  ctx.scale(s, s);

  // Розраховуємо зміщення відносно центру
  const dx = (_stX * ratio) / s;
  const dy = (_stY * ratio) / s;

  ctx.drawImage(_stImage, dx - _stImage.naturalWidth / 2, dy - _stImage.naturalHeight / 2);

  const result = canvas.toDataURL('image/jpeg', 0.9);
  const cb = _stCallback;
  closeStudio();
  if (cb) cb(result);
}

function studioUndo() {
  showToast("Undo not implemented");
}

// ── Search functionality (Module 5) ────────────────────────
// Простий та швидкий пошук за нікнеймами користувачів
async function renderExplore(q) {
  const sq = q.toLowerCase();
  // Отримуємо всіх користувачів (SU — вшиті, localStorage — зареєстровані)
  const stored = JSON.parse(localStorage.getItem('era_users') || '[]');
  const all = [...SU, ...stored.filter(u => !SU.find(s => s.id === u.id))];
  const filtered = sq ? all.filter(u => u.username.toLowerCase().includes(sq) || (u.displayName || '').toLowerCase().includes(sq)) : all;

  const myVibe = currentVibeColor(APP.user || { baseColor: '#00c6ff' });
  const myCols = vibeColors(myVibe, hashStr(APP.user?.id || 'me'));

  document.getElementById('feed-container').innerHTML = `
<div style="padding:12px 12px 6px">
  <input class="explore-inp" id="explore-inp" placeholder="${t('explore.placeholder')}" value="${esc(q)}" oninput="renderExplore(this.value)">
</div>
${filtered.length === 0
  ? `<div class="empty-state"><div class="empty-ico">🔍</div><div class="empty-txt">${t('explore.notFound')}</div></div>`
  : `<div style="padding: 4px; display: flex; flex-direction: column; gap: 6px">
    ${filtered.map(u => {
      const frnd = isFriend(u.id);
      const status = getFollowStatus(u.id);
      const isF = status === 'following';
      const isReq = status === 'requested';

      let statusTxt = '';
      if (frnd) statusTxt = t('profile.friends');
      else if (isF) statusTxt = t('profile.youFollow');
      else if (isReq) statusTxt = t('profile.requested');

      return `<div class="rp-user" style="background: var(--s1); border: 1px solid var(--b1); padding: 12px; border-radius:14px; transition: transform .2s" onclick="openUserCard('${u.id}')">
        <!-- Аватар -->
        <div style="width:46px; height:46px; flex-shrink:0; position:relative">
          ${avatarHTML(u, 46, { friend: true })}
          ${isUserPrivate(u.id) ? `<div style="position:absolute; bottom:-2px; right:-2px; font-size:10px; background:var(--s2); border-radius:50%; padding:2px; border:1px solid var(--b1)">🔒</div>` : ''}
        </div>
        <!-- Інфо та статус -->
        <div style="flex:1; min-width:0; margin-left:4px">
          <div style="font-size:14px; font-weight:700; color:var(--t1)">@${esc(u.username)}</div>
          <div style="font-size:12px; color:var(--t2)">${esc(u.displayName || '') || '&nbsp;'}</div>
          ${statusTxt ? `<div style="font-size:10px; font-weight:600; color:${frnd ? myCols[0] : 'var(--t3)'}; margin-top:3px">${statusTxt}</div>` : ''}
        </div>
        <!-- Vibe Code -->
        <div style="width:64px; height:32px; border-radius:6px; overflow:hidden; border:1px solid var(--b1); flex-shrink:0">
          ${makeVibeCode(u.baseColor, u.id, 64, 32, { friend: true })}
        </div>
      </div>`;
    }).join('')}
  </div>`}`;

  const inp = document.getElementById('explore-inp');
  if (inp && q) { const l = q.length; inp.setSelectionRange(l, l); }
}
