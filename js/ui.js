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
  // 3. Медіа-студія (Редактор)
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
    let dy = y - sy;
    if (dy > 0) {
      // Фізика опору (Resistance physics)
      const resistance = 0.4;
      if (dy > 200) dy = 200 + (dy - 200) * resistance;
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

// ── STUDIO (Media Editor & Professional Cropper) ──────────
// Професійна Медіа-студія: Pan, Zoom, Rotate + Brush & Text
let _stCallback = null, _stOptions = {}, _stImg = new Image();
let _stX = 0, _stY = 0, _stScale = 1, _stRotate = 0;
let _stDragSX = 0, _stDragSY = 0, _stDragOX = 0, _stDragOY = 0, _stDragging = false;
let _stPinchDist = 0, _stTool = 'crop';
let _stBrushColor = '#ffffff', _stIsDrawing = false;
let _stHistory = [];

/**
 * Відкриття Медіа-студії
 * @param {string} src - Шлях до фото або DataURL
 * @param {function} callback - Викликається після завершення
 * @param {object} opts - Налаштування (ratio, round і т.д.)
 */
function openStudio(src, callback, opts = {}) {
  _stCallback = callback;
  _stOptions = { ratio: 4/5, round: false, ...opts };
  _stX = 0; _stY = 0; _stScale = 1; _stRotate = 0;
  _stHistory = [];

  const studio = document.getElementById('studio');
  studio.classList.remove('hidden');
  lockScroll();
  eraPush('studio');

  _stImg.onload = () => {
    _initStudioStage();
    _renderStudio();
  };
  _stImg.src = src;

  setStudioTool('crop');
  _initStudioEvents();
  _initBrushColors();
}

function closeStudio(fromPopState = false) {
  document.getElementById('studio').classList.add('hidden');
  unlockScroll();
  _stCallback = null;
  if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
  // Прибираємо глобальні обробники коректно
  if (_stOnMoveRef) {
    window.removeEventListener('mousemove', _stOnMoveRef);
    window.removeEventListener('touchmove', _stOnMoveRef);
  }
  if (_stOnEndRef) {
    window.removeEventListener('mouseup', _stOnEndRef);
    window.removeEventListener('touchend', _stOnEndRef);
  }
}

function finishStudio() {
  const result = _exportStudio();
  if (_stCallback) _stCallback(result);
  closeStudio();
}

function setStudioTool(tool) {
  _stTool = tool;
  document.querySelectorAll('.studio-tool').forEach(b => b.classList.toggle('active', b.id === 'st-'+tool));
  document.getElementById('studio-panel-crop').classList.toggle('hidden', tool !== 'crop');
  document.getElementById('studio-panel-brush').classList.toggle('hidden', tool !== 'brush');

  const textLayer = document.getElementById('studio-text-layer');
  textLayer.style.pointerEvents = tool === 'text' ? 'auto' : 'none';

  if (tool === 'text') {
    const txt = prompt(t('crop.textPrompt') || 'Text:');
    if (txt) _addStudioText(txt);
  }
}

function _initStudioStage() {
  const stage = document.getElementById('studio-stage');
  const canvas = document.getElementById('studio-canvas');
  const wrap = document.getElementById('studio-wrap');

  const sw = stage.clientWidth * 0.9, sh = stage.clientHeight * 0.8;
  let cw = sw, ch = cw / _stOptions.ratio;
  if (ch > sh) { ch = sh; cw = ch * _stOptions.ratio; }

  wrap.style.width = cw + 'px';
  wrap.style.height = ch + 'px';
  wrap.style.borderRadius = _stOptions.round ? '50%' : '0';
  canvas.width = cw * 2; // Hi-DPI
  canvas.height = ch * 2;

  // Brush canvas
  const bc = document.getElementById('studio-brush-canvas');
  bc.width = canvas.width; bc.height = canvas.height;

  _stScale = Math.max(cw / _stImg.naturalWidth, ch / _stImg.naturalHeight);
  const zS = document.getElementById('studio-zoom');
  if (zS) { zS.value = _stScale; zS.min = _stScale * 0.5; zS.max = _stScale * 8; }
}

function _renderStudio() {
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw/2 + _stX*2, ch/2 + _stY*2);
  ctx.rotate(_stRotate * Math.PI / 180);
  ctx.scale(_stScale * 2, _stScale * 2);
  ctx.drawImage(_stImg, -_stImg.naturalWidth/2, -_stImg.naturalHeight/2);
  ctx.restore();
}

let _stOnMoveRef = null, _stOnEndRef = null;

function _initStudioEvents() {
  const wrap = document.getElementById('studio-wrap');

  const onStart = e => {
    const touch = e.touches ? e.touches[0] : e;
    _stDragSX = touch.clientX; _stDragSY = touch.clientY;
    _stDragOX = _stX; _stDragOY = _stY;

    if (_stTool === 'crop') {
      _stDragging = true;
    } else if (_stTool === 'brush') {
      _stIsDrawing = true;
      _stBeginPath(touch);
    }
    if (e.touches?.length === 2) {
      _stPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const onMove = e => {
    const touch = e.touches ? e.touches[0] : e;
    if (_stDragging && _stTool === 'crop') {
      _stX = _stDragOX + (touch.clientX - _stDragSX);
      _stY = _stDragOY + (touch.clientY - _stDragSY);
      _renderStudio();
    } else if (_stIsDrawing && _stTool === 'brush') {
      _stDrawPath(touch);
    }

    if (e.touches?.length === 2 && _stTool === 'crop') {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      _stScale *= (d / _stPinchDist);
      _stPinchDist = d;
      const zS = document.getElementById('studio-zoom'); if(zS) zS.value = _stScale;
      _renderStudio();
    }
  };

  const onEnd = () => {
    _stDragging = false;
    if (_stIsDrawing) { _stIsDrawing = false; _stSaveHistory(); }
  };

  _stOnMoveRef = onMove;
  _stOnEndRef = onEnd;

  wrap.onmousedown = onStart;
  wrap.ontouchstart = onStart;
  window.addEventListener('mousemove', _stOnMoveRef);
  window.addEventListener('touchmove', _stOnMoveRef, { passive: false });
  window.addEventListener('mouseup', _stOnEndRef);
  window.addEventListener('touchend', _stOnEndRef);

  document.getElementById('studio-zoom').oninput = e => { _stScale = parseFloat(e.target.value); _renderStudio(); };
  document.getElementById('studio-rotate').oninput = e => { _stRotate = parseFloat(e.target.value); _renderStudio(); };
}

function _initBrushColors() {
  const container = document.getElementById('studio-brush-colors');
  const colors = ['#ffffff','#000000','#ff2d55','#00c6ff','#39ff14','#ff9500','#9945ff','#ffcc00'];
  container.innerHTML = colors.map(c => `<div class="st-color${c===_stBrushColor?' active':''}" style="background:${c}" onclick="_setStColor('${c}',this)"></div>`).join('');
}

function _setStColor(c, el) {
  _stBrushColor = c;
  document.querySelectorAll('.st-color').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function _stBeginPath(touch) {
  const bc = document.getElementById('studio-brush-canvas');
  const ctx = bc.getContext('2d');
  const rect = bc.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (bc.width / rect.width);
  const y = (touch.clientY - rect.top) * (bc.height / rect.height);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = _stBrushColor; ctx.lineWidth = 12;
}

function _stDrawPath(touch) {
  const bc = document.getElementById('studio-brush-canvas');
  const ctx = bc.getContext('2d');
  const rect = bc.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (bc.width / rect.width);
  const y = (touch.clientY - rect.top) * (bc.height / rect.height);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function _addStudioText(txt) {
  const layer = document.getElementById('studio-text-layer');
  const el = document.createElement('div');
  el.className = 'studio-text-item';
  el.textContent = txt;
  el.style.left = '50%'; el.style.top = '50%';
  el.style.transform = 'translate(-50%, -50%)';

  let tx=0, ty=0, sx=0, sy=0, drag=false;
  el.onmousedown = e => { drag=true; sx=e.clientX; sy=e.clientY; el.classList.add('active'); e.stopPropagation(); };
  window.addEventListener('mousemove', e => {
    if(!drag) return;
    tx += e.clientX - sx; ty += e.clientY - sy;
    sx = e.clientX; sy = e.clientY;
    el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
  });
  window.onmouseup = () => { drag=false; };
  el.onclick = () => { if(!drag) { const n = prompt('Edit:', el.textContent); if(n) el.textContent=n; if(n==='') el.remove(); } };

  layer.appendChild(el);
}

function _stSaveHistory() {
  const bc = document.getElementById('studio-brush-canvas');
  _stHistory.push(bc.toDataURL());
  document.getElementById('studio-undo').classList.remove('hidden');
}

function studioUndo() {
  _stHistory.pop();
  const bc = document.getElementById('studio-brush-canvas');
  const ctx = bc.getContext('2d');
  ctx.clearRect(0, 0, bc.width, bc.height);
  if (_stHistory.length > 0) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = _stHistory[_stHistory.length - 1];
  } else {
    document.getElementById('studio-undo').classList.add('hidden');
  }
}

function _exportStudio() {
  const canvas = document.getElementById('studio-canvas');
  const bc = document.getElementById('studio-brush-canvas');
  const final = document.createElement('canvas');
  final.width = canvas.width; final.height = canvas.height;
  const ctx = final.getContext('2d');

  ctx.drawImage(canvas, 0, 0);
  ctx.drawImage(bc, 0, 0);

  // Render text from layer (simplified)
  const textItems = document.querySelectorAll('.studio-text-item');
  textItems.forEach(it => {
    const rect = it.getBoundingClientRect();
    const wrapRect = document.getElementById('studio-wrap').getBoundingClientRect();
    const x = (rect.left - wrapRect.left + rect.width/2) * (final.width / wrapRect.width);
    const y = (rect.top - wrapRect.top + rect.height/2) * (final.height / wrapRect.height);
    ctx.font = 'bold 48px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.fillText(it.textContent, x, y);
  });

  return final.toDataURL('image/jpeg', 0.9);
}
