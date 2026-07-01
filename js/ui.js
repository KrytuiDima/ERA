// js/ui.js — Modal system, toast, sheets, history, carousel, crop, long press

// ── Scroll lock ───────────────────────────────────────────
// Блокуємо скрол основної сторінки при відкритті модалок
function lockScroll()   { document.body.classList.add('scroll-locked'); }
function unlockScroll() {
  // Знімаємо блок тільки якщо немає інших відкритих оверлеїв (Module 3 Fix)
  const anyOverlay = document.querySelector('.overlay:not(.hidden)');
  const lightbox = document.getElementById('lightbox');
  const studio = document.getElementById('studio');
  const studioVisible = studio && !studio.classList.contains('hidden');

  if (!anyOverlay && !lightbox && !studioVisible) {
    document.body.classList.remove('scroll-locked');
  }
}

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
  // 3. Фото-редактор (Студія / Кропер)
  const studioModal = document.getElementById('studio');
  if (studioModal && !studioModal.classList.contains('hidden')) {
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

function openCreatePost() {
  POST_IMGS = [];
  document.getElementById('post-file').value = '';
  document.getElementById('upload-ph').classList.remove('hidden');
  document.getElementById('upload-grid').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('has-imgs');
  document.getElementById('desc-ta').value = '';
  document.getElementById('desc-cnt').textContent = '0/300';
  openModal('modal-create');
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
      // Фізика опору: чим далі тягнемо, тим повільніше рухається (опціонально)
      sheet.style.transform = `translateY(${dy}px)`;
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
    
    // Закриваємо, якщо потягнули більше ніж на 120px або швидкий свайп (Module 3)
    if (dy > 120 || (vel > 0.5 && dy > 50)) {
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

      // Rubber-band effect (Module 3)
      if((st.idx === 0 && dx > 0) || (st.idx === st.total-1 && dx < 0)) {
        tx = -st.idx * wrap.clientWidth + dx * 0.35;
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

// ── Media Studio (Медіа-редактор / Кропер) ─────────────────
// Професійний фронтенд-інструмент для обрізки фото (Module 2)
let _stCallback = null, _stX = 0, _stY = 0, _stScale = 1, _stRotate = 0;
let _stDragSX = 0, _stDragSY = 0, _stDragOX = 0, _stDragOY = 0, _stDragging = false;
let _stPinchDist = 0, _stOptions = {};

// Відкриття Media Studio (пропорції 4:5, 1:1 або 16:9)
function openStudio(src, callback, opts = {}) {
  _stCallback = callback;
  _stX = 0; _stY = 0; _stScale = 1; _stRotate = 0;
  _stOptions = { ratio: 4 / 5, round: false, ...opts };

  const studio = document.getElementById('studio');
  studio.classList.remove('hidden');
  lockScroll();
  eraPush('studio');

  const img = document.getElementById('studio-img');
  const zS = document.getElementById('studio-zoom'), rS = document.getElementById('studio-rotate');
  if (zS) zS.value = 1;
  if (rS) rS.value = 0;

  img.onload = () => {
    _fitStudio(img);
    _drawStudioMask();
  };
  img.src = src;
  _initStudioEvents();
}

function _fitStudio(img) {
  const stage = document.getElementById('studio-stage');
  const fw = stage.clientWidth * 0.88, fh = fw / _stOptions.ratio;
  _stScale = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
  _stX = 0; _stY = 0;
  img.style.width = img.naturalWidth + 'px';
  img.style.height = img.naturalHeight + 'px';
  const zS = document.getElementById('studio-zoom');
  if (zS) {
    zS.value = _stScale;
    zS.min = _stScale * 0.5;
    zS.max = _stScale * 8;
  }
  _applyStudioTransform(img);
}

function _applyStudioTransform(img) {
  if (!img) img = document.getElementById('studio-img');
  if (!img) return;
  img.style.transform = `translate(calc(-50% + ${_stX}px), calc(-50% + ${_stY}px)) scale(${_stScale}) rotate(${_stRotate}deg)`;
  img.style.left = '50%'; img.style.top = '50%'; img.style.position = 'absolute';
}

function _drawStudioMask() {
  const stage = document.getElementById('studio-stage'), mask = document.getElementById('studio-mask');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = Math.round(sw * 0.88), fh = Math.round(fw / _stOptions.ratio);
  const fx = Math.round((sw - fw) / 2), fy = Math.round((sh - fh) / 2);

  mask.innerHTML = `
    <div class="crop-shade" style="top:0; left:0; right:0; height:${fy}px"></div>
    <div class="crop-shade" style="top:${fy}px; left:0; width:${fx}px; height:${fh}px"></div>
    <div class="crop-shade" style="top:${fy}px; right:0; width:${fx}px; height:${fh}px"></div>
    <div class="crop-shade" style="bottom:0; left:0; right:0; height:${sh - fy - fh}px"></div>
    <div class="crop-frame-border${_stOptions.round ? ' round' : ''}" style="left:${fx}px; top:${fy}px; width:${fw}px; height:${fh}px">
      ${_stOptions.round ? '' : `
      <div class="crop-corner tl"></div><div class="crop-corner tr"></div>
      <div class="crop-corner bl"></div><div class="crop-corner br"></div>
      <div class="crop-grid-line" style="position:absolute; left:${Math.round(fw / 3)}px; top:0; width:1px; height:100%"></div>
      <div class="crop-grid-line" style="position:absolute; left:${Math.round(fw * 2 / 3)}px; top:0; width:1px; height:100%"></div>
      <div class="crop-grid-line" style="position:absolute; left:0; top:${Math.round(fh / 3)}px; width:100%; height:1px"></div>
      <div class="crop-grid-line" style="position:absolute; left:0; top:${Math.round(fh * 2 / 3)}px; width:100%; height:1px"></div>
      `}
    </div>`;
}

let _stOnMove, _stOnEnd;

function _initStudioEvents() {
  const s = document.getElementById('studio-stage'), img = document.getElementById('studio-img');

  const onStart = e => {
    if (e.touches && e.touches.length === 2) {
      _stPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      return;
    }
    _stDragging = true;
    const t = e.touches ? e.touches[0] : e;
    _stDragSX = t.clientX; _stDragSY = t.clientY;
    _stDragOX = _stX; _stDragOY = _stY;
    s.classList.add('dragging');
  };

  _stOnMove = e => {
    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (_stPinchDist > 0) {
        _stScale = Math.max(0.1, Math.min(10, _stScale * (d / _stPinchDist)));
        const zS = document.getElementById('studio-zoom');
        if (zS) zS.value = _stScale;
        _applyStudioTransform();
      }
      _stPinchDist = d;
      return;
    }
    if (!_stDragging) return;
    const t = e.touches ? e.touches[0] : e;
    _stX = _stDragOX + (t.clientX - _stDragSX);
    _stY = _stDragOY + (t.clientY - _stDragSY);
    _applyStudioTransform();
  };

  _stOnEnd = () => {
    _stDragging = false;
    _stPinchDist = 0;
    s.classList.remove('dragging');
  };

  s.onmousedown = onStart;
  s.ontouchstart = onStart;

  window.addEventListener('mousemove', _stOnMove);
  window.addEventListener('touchmove', _stOnMove, { passive: false });
  window.addEventListener('mouseup', _stOnEnd);
  window.addEventListener('touchend', _stOnEnd);

  const zS = document.getElementById('studio-zoom'), rS = document.getElementById('studio-rotate');
  if (zS) zS.oninput = e => { _stScale = parseFloat(e.target.value); _applyStudioTransform(); };
  if (rS) rS.oninput = e => { _stRotate = parseFloat(e.target.value); _applyStudioTransform(); };
}

function applyStudio() {
  const img = document.getElementById('studio-img'), stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = Math.round(sw * 0.88), fh = Math.round(fw / _stOptions.ratio);
  const fx = (sw - fw) / 2, fy = (sh - fh) / 2;

  const canvas = document.createElement('canvas');
  const OUT = 1080; // Висока якість для Supabase
  canvas.width = OUT; canvas.height = Math.round(OUT / _stOptions.ratio);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(_stRotate * Math.PI / 180);
  ctx.scale(_stScale, _stScale);

  const drawW = img.naturalWidth;
  const drawH = img.naturalHeight;

  // Розрахунок позиції відносно центру рамки кропу
  const scaleInCanvas = OUT / fw;
  const dx = (_stX * scaleInCanvas) / _stScale;
  const dy = (_stY * scaleInCanvas) / _stScale;

  ctx.drawImage(img, dx - drawW / 2, dy - drawH / 2, drawW, drawH);

  const result = canvas.toDataURL('image/jpeg', 0.9);
  closeStudio();
  if (_stCallback) _stCallback(result);
  _stCallback = null;
}

function closeStudio(fromPopState = false) {
  document.getElementById('studio').classList.add('hidden');
  window.removeEventListener('mousemove', _stOnMove);
  window.removeEventListener('touchmove', _stOnMove);
  window.removeEventListener('mouseup', _stOnEnd);
  window.removeEventListener('touchend', _stOnEnd);
  _stCallback = null;
  unlockScroll();
  if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
}
