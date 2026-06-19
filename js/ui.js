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
  // 3. Фото-редактор (Media Studio)
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
// Дозволяє закривати модальні вікна свайпом вниз за верхню частину (Handle bar)
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
      // Фізика опору: чим далі тягнемо, тим повільніше рухається
      const resistance = 0.3;
      const moveY = dy > 200 ? 200 + (dy - 200) * resistance : dy;
      sheet.style.transform = `translateY(${moveY}px)`;
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

// ── MEDIA STUDIO (Професійний редактор) ───────────────────
// Модуль для обрізки та базового редагування зображень
let _studioCb = null, _stImg = new Image(), _stRatio = 1;
let _stX = 0, _stY = 0, _stScale = 1, _stRot = 0;
let _stDrag = false, _stSX = 0, _stSY = 0, _stOX = 0, _stOY = 0;
let _stPinchDist = 0, _stRound = false;

function showCropTool(src, cb, opts = {}) {
  _studioCb = cb;
  _stRatio = opts.ratio || 4/5;
  _stRound = opts.round || false;
  _stX = 0; _stY = 0; _stScale = 1; _stRot = 0;

  const studio = document.getElementById('studio');
  studio.classList.remove('hidden');
  lockScroll();
  eraPush('studio');

  // Скидання повзунків
  const zS = document.getElementById('studio-zoom'), rS = document.getElementById('studio-rotate');
  if(zS) zS.value = 1; if(rS) rS.value = 0;

  setStudioTool('crop');

  _stImg.onload = () => {
    _fitStudio();
    _drawStudioMask();
  };
  _stImg.src = src;
  _initStudioEvents();
}

function _fitStudio() {
  const stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = sw * 0.9, fh = fw / _stRatio;

  // Початковий масштаб, щоб заповнити рамку
  _stScale = Math.max(fw / _stImg.naturalWidth, fh / _stImg.naturalHeight);
  _stX = 0; _stY = 0;

  const zS = document.getElementById('studio-zoom');
  if(zS) { zS.min = _stScale * 0.5; zS.max = _stScale * 5; zS.value = _stScale; }

  _applyStudioTransform();
}

function _applyStudioTransform() {
  const canvas = document.getElementById('studio-canvas');
  if(!canvas) return;
  const stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;

  // В даному SPA ми використовуємо Canvas для прев'ю в студії
  const ctx = canvas.getContext('2d');
  canvas.width = sw; canvas.height = sh;
  ctx.clearRect(0,0,sw,sh);

  ctx.save();
  ctx.translate(sw/2 + _stX, sh/2 + _stY);
  ctx.rotate(_stRot * Math.PI / 180);
  ctx.scale(_stScale, _stScale);
  ctx.drawImage(_stImg, -_stImg.naturalWidth/2, -_stImg.naturalHeight/2);
  ctx.restore();
}

function _drawStudioMask() {
  const stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = sw * 0.9, fh = fw / _stRatio;
  const fx = (sw - fw) / 2, fy = (sh - fh) / 2;

  // Видаляємо стару маску якщо була
  stage.querySelectorAll('.studio-mask-el').forEach(el => el.remove());

  const mask = document.createElement('div');
  mask.className = 'studio-mask-el';
  mask.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5`;
  mask.innerHTML = `
    <div style="position:absolute;top:0;left:0;right:0;height:${fy}px;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:${sh-fy-fh}px;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;top:${fy}px;left:0;width:${fx}px;height:${fh}px;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;top:${fy}px;right:0;width:${fx}px;height:${fh}px;background:rgba(0,0,0,0.6)"></div>
    <div style="position:absolute;left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px;border:1.5px solid rgba(255,255,255,0.8);${_stRound?'border-radius:50%':''}">
      ${_stRound ? '' : `
        <div style="position:absolute;inset:0;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);opacity:0.3">
          <div style="border-right:1px solid #fff;border-bottom:1px solid #fff"></div><div style="border-right:1px solid #fff;border-bottom:1px solid #fff"></div><div style="border-bottom:1px solid #fff"></div>
          <div style="border-right:1px solid #fff;border-bottom:1px solid #fff"></div><div style="border-right:1px solid #fff;border-bottom:1px solid #fff"></div><div style="border-bottom:1px solid #fff"></div>
          <div style="border-right:1px solid #fff"></div><div style="border-right:1px solid #fff"></div><div></div>
        </div>
      `}
    </div>
  `;
  stage.appendChild(mask);
}

function finishStudio() {
  const stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = sw * 0.9, fh = fw / _stRatio;

  const canvas = document.createElement('canvas');
  const OUT_W = 1080; canvas.width = OUT_W; canvas.height = OUT_W / _stRatio;
  const ctx = canvas.getContext('2d');

  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(_stRot * Math.PI / 180);
  ctx.scale(_stScale * (OUT_W / fw), _stScale * (OUT_W / fw));

  // Корекція зміщення відносно центру рамки
  const dx = _stX * (OUT_W / fw);
  const dy = _stY * (OUT_W / fw);

  ctx.drawImage(_stImg, dx / (_stScale * (OUT_W / fw)) - _stImg.naturalWidth/2, dy / (_stScale * (OUT_W / fw)) - _stImg.naturalHeight/2);

  const res = canvas.toDataURL('image/jpeg', 0.9);
  closeStudio();
  if(_studioCb) _studioCb(res);
  _studioCb = null;
}

function closeStudio(fromPopState = false) {
  document.getElementById('studio').classList.add('hidden');
  unlockScroll();
  _studioCb = null;
  if(!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
}

function setStudioTool(tool) {
  document.querySelectorAll('.studio-tool').forEach(t => t.classList.remove('active'));
  document.getElementById('st-' + tool)?.classList.add('active');

  document.querySelectorAll('.studio-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('studio-panel-' + tool)?.classList.remove('hidden');
}

// Глобальні обробники для Студії (щоб їх можна було видалити)
let _stOnMove = null, _stOnEnd = null;

function _initStudioEvents() {
  const stage = document.getElementById('studio-stage');
  const zS = document.getElementById('studio-zoom');
  const rS = document.getElementById('studio-rotate');

  // Видаляємо старі слухачі, якщо вони є
  if (_stOnMove) window.removeEventListener('mousemove', _stOnMove);
  if (_stOnEnd) window.removeEventListener('mouseup', _stOnEnd);

  const onStart = e => {
    _stDrag = true;
    const t = e.touches ? e.touches[0] : e;
    _stSX = t.clientX; _stSY = t.clientY;
    _stOX = _stX; _stOY = _stY;
    if(e.touches && e.touches.length === 2) {
      _stPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  _stOnMove = e => {
    if(!_stDrag) return;
    const t = e.touches ? e.touches[0] : e;

    if(e.touches && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = d / _stPinchDist;
      _stScale = Math.max(0.1, Math.min(10, _stScale * ratio));
      _stPinchDist = d;
      if(zS) zS.value = _stScale;
    } else {
      _stX = _stOX + (t.clientX - _stSX);
      _stY = _stOY + (t.clientY - _stSY);
    }
    _applyStudioTransform();
    if(e.cancelable) e.preventDefault();
  };

  _stOnEnd = () => { _stDrag = false; };

  stage.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', _stOnMove);
  window.addEventListener('mouseup', _stOnEnd);

  stage.addEventListener('touchstart', onStart, {passive:false});
  stage.addEventListener('touchmove', _stOnMove, {passive:false});
  stage.addEventListener('touchend', _stOnEnd);

  if(zS) zS.oninput = e => { _stScale = parseFloat(e.target.value); _applyStudioTransform(); };
  if(rS) rS.oninput = e => { _stRot = parseFloat(e.target.value); _applyStudioTransform(); };
}
