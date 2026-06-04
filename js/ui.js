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
  // 3. Фото-редактор (Кропер)
  const cropModal = document.getElementById('crop-modal');
  if (cropModal && !cropModal.classList.contains('hidden')) {
    cancelCrop(fromPopState);
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

// ── Sheet drag-to-close (Фізика шторки — Module 3) ────────
// Дозволяє закривати модальні вікна свайпом вниз за верхню частину (Handle bar)
function _makeDraggable(handleId, sheetId, overlayId) {
  const handle = document.getElementById(handleId);
  const sheet = document.getElementById(sheetId);
  if (!handle || !sheet) return;
  
  let sy = 0, dragging = false, startTime = 0;
  const hdr = sheet.querySelector('.sheet-hdr');
  const targets = [handle, hdr].filter(Boolean);

  const onStart = e => {
    // Якщо скролимо контент всередині шторки — не перехоплюємо жест
    if (e.target.closest('.sheet-body') && e.target.closest('.sheet-body').scrollTop > 0) return;

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
      // Плавна трансформація вниз
      sheet.style.transform = `translateY(${dy}px)`;
      if (e.cancelable) e.preventDefault();
    } else {
      // Опір при спробі потягнути вгору
      sheet.style.transform = `translateY(${dy * 0.15}px)`;
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

      // Rubber-band effect (Module 3)
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

// ── Crop tool (Медіа-редактор — Module 2) ──────────────────
// Професійний фронтенд-кропер для постів (4:5), аватарок (1:1) та банерів (16:9)
let _cropCallback = null, _cropX = 0, _cropY = 0, _cropScale = 1, _cropRotate = 0;
let _cropDragSX = 0, _cropDragSY = 0, _cropDragOX = 0, _cropDragOY = 0, _cropDragging = false;
let _cropPinchDist = 0, _cropOptions = {};

// Відкриття редактора фото
function showCropTool(src, callback, opts = {}) {
  _cropCallback = callback;
  _cropX = 0; _cropY = 0; _cropScale = 1; _cropRotate = 0;
  _cropOptions = { ratio: 4 / 5, round: false, ...opts };

  const modal = document.getElementById('crop-modal');
  if (!modal) {
    // Якщо модалки немає в HTML (наприклад, забули додати), створюємо її динамічно
    _createCropModal();
  }

  document.getElementById('crop-modal').classList.remove('hidden');
  lockScroll();
  eraPush('crop');

  const img = document.getElementById('crop-img');
  const zS = document.getElementById('crop-zoom'), rS = document.getElementById('crop-rotate');
  if (zS) { zS.value = 1; zS.min = 0.1; zS.max = 5; }
  if (rS) { rS.value = 0; }

  img.onload = () => {
    _fitCrop(img);
    _drawCropMask();
  };
  img.src = src;
  _initCropEvents();
}

function _createCropModal() {
  const m = document.createElement('div');
  m.id = 'crop-modal';
  m.className = 'hidden';
  m.innerHTML = `
    <div class="crop-hdr">
      <button class="crop-cancel" onclick="cancelCrop()">${t('crop.cancel')}</button>
      <div class="crop-title">${t('crop.title')}</div>
      <button class="crop-apply" onclick="applyCrop()">${t('crop.apply')}</button>
    </div>
    <div class="crop-stage" id="crop-stage">
      <img id="crop-img" src="" alt="">
      <div class="crop-mask" id="crop-mask"></div>
      <div class="crop-hint">${t('crop.hint')}</div>
    </div>
    <div class="crop-controls">
      <div class="crop-control-row">
        <span>ZOOM</span>
        <input type="range" class="crop-slider" id="crop-zoom" min="0.1" max="5" step="0.01" value="1">
      </div>
      <div class="crop-control-row">
        <span>ROTATE</span>
        <input type="range" class="crop-slider" id="crop-rotate" min="-180" max="180" step="1" value="0">
      </div>
    </div>`;
  document.body.appendChild(m);
}

function _fitCrop(img) {
  const stage=document.getElementById('crop-stage');
  const fw=stage.clientWidth*.88, fh=fw/_cropOptions.ratio;
  _cropScale=Math.max(fw/img.naturalWidth, fh/img.naturalHeight);
  _cropX=0; _cropY=0;
  img.style.width=img.naturalWidth+'px'; img.style.height=img.naturalHeight+'px';
  const zS=document.getElementById('crop-zoom'); if(zS){ zS.value=_cropScale; zS.min=_cropScale*.5; zS.max=_cropScale*5; }
  _applyTransform(img);
}

function _applyTransform(img) {
  if(!img) img=document.getElementById('crop-img');
  if(!img) return;
  img.style.transform=`translate(calc(-50% + ${_cropX}px),calc(-50% + ${_cropY}px)) scale(${_cropScale}) rotate(${_cropRotate}deg)`;
  img.style.left='50%'; img.style.top='50%'; img.style.position='absolute';
}

function _drawCropMask() {
  const stage=document.getElementById('crop-stage'), mask=document.getElementById('crop-mask');
  const sw=stage.clientWidth, sh=stage.clientHeight;
  const fw=Math.round(sw*.88), fh=Math.round(fw/_cropOptions.ratio);
  const fx=Math.round((sw-fw)/2), fy=Math.round((sh-fh)/2);
  mask.innerHTML=`
    <div class="crop-shade" style="top:0;left:0;right:0;height:${fy}px"></div>
    <div class="crop-shade" style="top:${fy}px;left:0;width:${fx}px;height:${fh}px"></div>
    <div class="crop-shade" style="top:${fy}px;right:0;width:${fx}px;height:${fh}px"></div>
    <div class="crop-shade" style="bottom:0;left:0;right:0;height:${sh-fy-fh}px"></div>
    <div class="crop-frame-border${_cropOptions.round?' round':''}" style="left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px">
      ${_cropOptions.round?'':`
      <div class="crop-corner tl"></div><div class="crop-corner tr"></div>
      <div class="crop-corner bl"></div><div class="crop-corner br"></div>
      <div class="crop-grid-line" style="position:absolute;left:${Math.round(fw/3)}px;top:0;width:1px;height:100%"></div>
      <div class="crop-grid-line" style="position:absolute;left:${Math.round(fw*2/3)}px;top:0;width:1px;height:100%"></div>
      <div class="crop-grid-line" style="position:absolute;left:0;top:${Math.round(fh/3)}px;width:100%;height:1px"></div>
      <div class="crop-grid-line" style="position:absolute;left:0;top:${Math.round(fh*2/3)}px;width:100%;height:1px"></div>
      `}
    </div>`;
}

function _initCropEvents() {
  const s = document.getElementById('crop-stage');
  if (!s) return;

  const onStart = e => {
    const touch = e.touches ? e.touches[0] : e;
    _cropDragging = true;
    _cropDragSX = touch.clientX;
    _cropDragSY = touch.clientY;
    _cropDragOX = _cropX;
    _cropDragOY = _cropY;
    s.classList.add('dragging');

    if (e.touches && e.touches.length === 2) {
      _cropPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const onMove = e => {
    if (!_cropDragging) return;

    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = d / _cropPinchDist;
      _cropScale = Math.max(0.1, Math.min(10, _cropScale * ratio));
      _cropPinchDist = d;
      const zS = document.getElementById('crop-zoom');
      if (zS) zS.value = _cropScale;
      _applyTransform();
      return;
    }

    const touch = e.touches ? e.touches[0] : e;
    _cropX = _cropDragOX + (touch.clientX - _cropDragSX);
    _cropY = _cropDragOY + (touch.clientY - _cropDragSY);
    _applyTransform();
    if (e.cancelable && e.touches) e.preventDefault();
  };

  const onEnd = () => {
    _cropDragging = false;
    s.classList.remove('dragging');
  };

  s.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  s.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);

  s.onwheel = e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    _cropScale = Math.max(0.1, Math.min(10, _cropScale * delta));
    const zS = document.getElementById('crop-zoom');
    if (zS) zS.value = _cropScale;
    _applyTransform();
  };

  const zS = document.getElementById('crop-zoom'), rS = document.getElementById('crop-rotate');
  if (zS) zS.oninput = e => { _cropScale = parseFloat(e.target.value); _applyTransform(); };
  if (rS) rS.oninput = e => { _cropRotate = parseFloat(e.target.value); _applyTransform(); };
}

function applyCrop() {
  const img=document.getElementById('crop-img'), stage=document.getElementById('crop-stage');
  const sw=stage.clientWidth, sh=stage.clientHeight;
  const fw=Math.round(sw*.88), fh=Math.round(fw/_cropOptions.ratio);
  const fx=(sw-fw)/2, fy=(sh-fh)/2;
  const canvas=document.createElement('canvas');
  const OUT=800; canvas.width=OUT; canvas.height=Math.round(OUT/_cropOptions.ratio);
  const ctx=canvas.getContext('2d');

  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(_cropRotate * Math.PI / 180);
  ctx.scale(_cropScale, _cropScale);

  // Calculate relative position
  const drawW = img.naturalWidth;
  const drawH = img.naturalHeight;
  const dx = (_cropX - (sw/2 - (fx + fw/2))) / _cropScale;
  const dy = (_cropY - (sh/2 - (fy + fh/2))) / _cropScale;

  ctx.drawImage(img, dx - drawW/2, dy - drawH/2, drawW, drawH);

  const result=canvas.toDataURL('image/jpeg',.9);
  document.getElementById('crop-modal').classList.add('hidden');
  if(_cropCallback) _cropCallback(result);
  _cropCallback=null;
}

function cancelCrop(fromPopState=false) {
  document.getElementById('crop-modal').classList.add('hidden');
  _cropCallback=null;
  if(!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
}
