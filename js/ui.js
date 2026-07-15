// js/ui.js — Modal system, toast, sheets, history, carousel, crop, long press

// ── Scroll lock ───────────────────────────────────────────
function lockScroll()   { document.body.classList.add('scroll-locked'); }
function unlockScroll() {
  // Перевіряємо, чи немає інших активних оверлеїв перед розблокуванням
  const studio = document.getElementById('studio');
  const lb = document.getElementById('lightbox');
  const open = document.querySelectorAll('.overlay:not(.hidden)');

  if ((!studio || studio.classList.contains('hidden')) && !lb && open.length === 0) {
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

/**
 * ERA MEDIA STUDIO
 * Професійний фронтенд-редактор для обробки медіа перед публікацією.
 * Забезпечує дотримання сітки (4:5, 1:1, 16:9), додавання малюнків та тексту.
 */

// ── MEDIA STUDIO (Професійний редактор медіа) ──────────────
let _stCallback = null, _stImg = null, _stCanvas = null, _stCtx = null;
let _stBvCanvas = null, _stBvCtx = null; // Brush layer
let _stTool = 'crop', _stRatio = 4/5, _stRound = false;
let _stX = 0, _stY = 0, _stScale = 1, _stRotate = 0;
let _stDragging = false, _stSX = 0, _stSY = 0, _stOX = 0, _stOY = 0;
let _stPinchDist = 0, _stHistory = [], _stOnMoveRef = null, _stOnEndRef = null;

/**
 * Відкриття професійного медіа-студіо.
 * Підтримує кроп (4:5, 1:1, 16:9), малювання пензлем та додавання тексту.
 */
function openStudio(src, callback, opts = {}) {
  _stCallback = callback;
  _stRatio = opts.ratio || 4/5;
  _stRound = !!opts.round;
  _stTool = 'crop';
  _stX = 0; _stY = 0; _stScale = 1; _stRotate = 0;
  _stHistory = [];

  const studio = document.getElementById('studio');
  studio.classList.remove('hidden');
  lockScroll();
  eraPush('studio');

  _stCanvas = document.getElementById('studio-canvas');
  _stCtx = _stCanvas.getContext('2d');
  _stBvCanvas = document.getElementById('studio-brush-canvas');
  _stBvCtx = _stBvCanvas.getContext('2d');

  _stImg = new Image();
  _stImg.onload = () => {
    _initStudioStage();
    setStudioTool('crop');
  };
  _stImg.src = src;

  // Ініціалізація палітри для пензля
  _initStudioColors();
}

function _initStudioStage() {
  const stage = document.getElementById('studio-stage');
  const wrap = document.getElementById('studio-wrap');
  const sw = stage.clientWidth, sh = stage.clientHeight;

  // Розрахунок розмірів рамки кропу (88% ширини екрану)
  const fw = Math.round(sw * 0.88), fh = Math.round(fw / _stRatio);
  wrap.style.width = fw + 'px';
  wrap.style.height = fh + 'px';
  if (_stRound) wrap.style.borderRadius = '50%';
  else wrap.style.borderRadius = '0';

  _stCanvas.width = _stImg.naturalWidth;
  _stCanvas.height = _stImg.naturalHeight;
  _stBvCanvas.width = _stImg.naturalWidth;
  _stBvCanvas.height = _stImg.naturalHeight;

  // Початковий масштаб, щоб заповнити рамку
  _stScale = Math.max(fw / _stImg.naturalWidth, fh / _stImg.naturalHeight);

  const zoom = document.getElementById('studio-zoom');
  if (zoom) {
    zoom.value = _stScale;
    zoom.min = _stScale * 0.5;
    zoom.max = _stScale * 10;
  }

  _updateStudioTransform();
}

function _updateStudioTransform() {
  const wrap = document.getElementById('studio-wrap');
  const canvases = wrap.querySelectorAll('canvas');
  const transform = `translate(${_stX}px, ${_stY}px) scale(${_stScale}) rotate(${_stRotate}deg)`;
  canvases.forEach(c => c.style.transform = transform);

  // Шар тексту має рухатись синхронно з фото
  const txtLayer = document.getElementById('studio-text-layer');
  if (txtLayer) txtLayer.style.transform = transform;

  // Перемальовуємо основний канвас
  _stCtx.clearRect(0, 0, _stCanvas.width, _stCanvas.height);
  _stCtx.drawImage(_stImg, 0, 0);
}

function setStudioTool(tool) {
  _stTool = tool;
  document.querySelectorAll('.studio-tool').forEach(b => b.classList.toggle('active', b.id === 'st-'+tool));
  document.querySelectorAll('.studio-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('studio-panel-' + tool)?.classList.remove('hidden');

  // Очищення попередніх обробників, щоб не було накладок
  if (_stOnMoveRef) {
    window.removeEventListener('mousemove', _stOnMoveRef);
    window.removeEventListener('touchmove', _stOnMoveRef);
  }
  if (_stOnEndRef) {
    window.removeEventListener('mouseup', _stOnEndRef);
    window.removeEventListener('touchend', _stOnEndRef);
  }

  _initToolEvents();
}

function _initStudioColors() {
  const container = document.getElementById('studio-brush-colors');
  if (!container) return;
  const colors = ['#ffffff', '#000000', '#ff2d55', '#00c6ff', '#39ff14', '#ff9500', '#9945ff'];
  container.innerHTML = colors.map(c => `<div class="st-color" style="background:${c}" onclick="_setStudioColor('${c}', this)"></div>`).join('');
  _setStudioColor('#ffffff', container.firstChild);
}

let _stBrushColor = '#ffffff';
function _setStudioColor(c, el) {
  _stBrushColor = c;
  document.querySelectorAll('.st-color').forEach(x => x.classList.remove('active'));
  el?.classList.add('active');
}

// ── STUDIO TOOLS LOGIC (Кроп, Масштаб, Поворот, Малювання) ──

/**
 * Ініціалізація подій для інструментів студії (миша, тач, колесо)
 */
function _initToolEvents() {
  const stage = document.getElementById('studio-stage');
  const zoom = document.getElementById('studio-zoom');
  const rotate = document.getElementById('studio-rotate');

  // Малювання (Brush) та Панорамування (Crop)
  const onStart = e => {
    _stDragging = true;
    const t = e.touches ? e.touches[0] : e;
    _stSX = t.clientX; _stSY = t.clientY;
    _stOX = _stX; _stOY = _stY;

    if (_stTool === 'crop') {
      if (e.touches?.length === 2) {
        _stPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    } else if (_stTool === 'brush') {
      const rect = _stBvCanvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) / (rect.width / _stBvCanvas.width);
      const y = (t.clientY - rect.top) / (rect.height / _stBvCanvas.height);

      _stBvCtx.beginPath();
      _stBvCtx.moveTo(x, y);
      _stBvCtx.strokeStyle = _stBrushColor;
      _stBvCtx.lineWidth = 15 / _stScale;
      _stBvCtx.lineCap = 'round';
      _stBvCtx.lineJoin = 'round';
    } else if (_stTool === 'text') {
      _addStudioText(t.clientX, t.clientY);
    }
  };

  const onMove = e => {
    if (!_stDragging) return;
    const t = e.touches ? e.touches[0] : e;

    if (_stTool === 'crop') {
      if (e.touches?.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        _stScale = Math.max(0.1, Math.min(10, _stScale * (d / _stPinchDist)));
        _stPinchDist = d;
        if (zoom) zoom.value = _stScale;
      } else {
        _stX = _stOX + (t.clientX - _stSX);
        _stY = _stOY + (t.clientY - _stSY);
      }
      _updateStudioTransform();
    } else if (_stTool === 'brush') {
      const rect = _stBvCanvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) / (rect.width / _stBvCanvas.width);
      const y = (t.clientY - rect.top) / (rect.height / _stBvCanvas.height);
      _stBvCtx.lineTo(x, y);
      _stBvCtx.stroke();
    }
    if (e.cancelable) e.preventDefault();
  };

  const onEnd = () => {
    if (_stTool === 'brush' && _stDragging) {
      _stBvCtx.closePath();
      _stHistory.push(_stBvCtx.getImageData(0, 0, _stBvCanvas.width, _stBvCanvas.height));
      document.getElementById('studio-undo').classList.remove('hidden');
    }
    _stDragging = false;
  };

  _stOnMoveRef = onMove; _stOnEndRef = onEnd;

  stage.addEventListener('mousedown', onStart);
  stage.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove', onMove, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);

  // Слайдери
  if (zoom) zoom.oninput = e => { _stScale = parseFloat(e.target.value); _updateStudioTransform(); };
  if (rotate) rotate.oninput = e => { _stRotate = parseFloat(e.target.value); _updateStudioTransform(); };

  // Mouse Wheel Zoom
  stage.onwheel = e => {
    if (_stTool !== 'crop') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    _stScale = Math.max(0.1, Math.min(10, _stScale * delta));
    if (zoom) zoom.value = _stScale;
    _updateStudioTransform();
  };
}

/**
 * Фіналізація редагування: Кроп + Накладення шарів (малюнок, текст)
 */
function _addStudioText(clientX, clientY) {
  // Замінюємо prompt() на кастомне поле введення
  const wrap = document.createElement('div');
  wrap.className = 'studio-text-input-wrap';
  wrap.innerHTML = `<input type="text" class="st-text-inp" placeholder="${t('crop.textPrompt')}" autofocus>`;
  document.body.appendChild(wrap);

  const inp = wrap.querySelector('input');
  inp.focus();

  const close = () => {
    const txt = inp.value.trim();
    wrap.remove();
    if (!txt) return;

    const layer = document.getElementById('studio-text-layer');
    const item = document.createElement('div');
    item.className = 'st-text-item';
    item.textContent = txt;

    const rect = layer.getBoundingClientRect();
    const x = (clientX - rect.left) / (rect.width / 100);
    const y = (clientY - rect.top) / (rect.height / 100);

    item.style.left = x + '%';
    item.style.top = y + '%';
    item.style.color = _stBrushColor;

    // Додаємо можливість перетягування тексту всередині шару
    _makeElementDraggable(item, layer);

    item.onclick = (e) => {
      if (e._wasDrag) return;
      if (confirm(t('post.delete') + '?')) item.remove();
    };
    layer.appendChild(item);
  };

  inp.onkeydown = e => { if (e.key === 'Enter') close(); };
  wrap.onclick = e => { if (e.target === wrap) close(); };
}

function _makeElementDraggable(el, parent) {
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;

  const onStart = e => {
    const t = e.touches ? e.touches[0] : e;
    sx = t.clientX; sy = t.clientY;
    ox = el.offsetLeft; oy = el.offsetTop;
    dragging = true;
    el._wasDrag = false;
    if (e.cancelable) e.preventDefault();
  };

  const onMove = e => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) el._wasDrag = true;

    const nx = ox + dx, ny = oy + dy;
    el.style.left = (nx / parent.clientWidth * 100) + '%';
    el.style.top = (ny / parent.clientHeight * 100) + '%';
  };

  const onEnd = () => { dragging = false; };

  el.addEventListener('mousedown', onStart);
  el.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function studioUndo() {
  if (_stHistory.length > 0) {
    _stHistory.pop();
    if (_stHistory.length === 0) {
      _stBvCtx.clearRect(0, 0, _stBvCanvas.width, _stBvCanvas.height);
      document.getElementById('studio-undo').classList.add('hidden');
    } else {
      _stBvCtx.putImageData(_stHistory[_stHistory.length - 1], 0, 0);
    }
  }
}

/**
 * Фінальний експорт зображення:
 * 1. Створює канвас високої роздільної здатності (1080p).
 * 2. Застосовує трансформації (zoom, rotate, pan).
 * 3. Накладає шари пензля та тексту.
 * 4. Повертає DataURL у форматі JPEG.
 */
function finishStudio() {
  const stage = document.getElementById('studio-stage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const fw = Math.round(sw * 0.88), fh = Math.round(fw / _stRatio);

  // Створюємо фінальний канвас (1080p для високої якості)
  const out = document.createElement('canvas');
  const OUT_W = 1080, OUT_H = Math.round(1080 / _stRatio);
  out.width = OUT_W; out.height = OUT_H;
  const ctx = out.getContext('2d');

  // 1. Малюємо фон (чорний для AMOLED)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  // 2. Рендеримо фото з урахуванням трансформацій
  ctx.save();
  ctx.translate(OUT_W/2, OUT_H/2);
  ctx.rotate(_stRotate * Math.PI / 180);

  // Розрахунок відносних координат кропу
  const displayToReal = OUT_W / fw;
  const drawScale = _stScale * displayToReal;
  ctx.scale(drawScale, drawScale);

  // Центрування та зсув
  const dx = (_stX / _stScale);
  const dy = (_stY / _stScale);
  ctx.drawImage(_stImg, dx - _stImg.naturalWidth/2, dy - _stImg.naturalHeight/2);
  ctx.restore();

  // 3. Накладаємо шар малювання (Brush)
  ctx.save();
  ctx.translate(OUT_W/2, OUT_H/2);
  ctx.rotate(_stRotate * Math.PI / 180);
  ctx.scale(drawScale, drawScale);
  ctx.drawImage(_stBvCanvas, dx - _stImg.naturalWidth/2, dy - _stImg.naturalHeight/2);
  ctx.restore();

  // 4. Накладаємо текст (висока якість)
  const txtContainer = document.getElementById('studio-text-layer');
  const texts = txtContainer.querySelectorAll('.st-text-item');
  if (texts.length) {
    texts.forEach(t => {
      ctx.save();
      const xPercent = parseFloat(t.style.left) / 100;
      const yPercent = parseFloat(t.style.top) / 100;

      // Рендеримо текст у координатах вихідного полотна (1080p)
      ctx.font = '700 48px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Додаємо тінь для читабельності на будь-якому фоні
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = t.style.color || '#fff';
      ctx.fillText(t.textContent, xPercent * OUT_W, yPercent * OUT_H);
      ctx.restore();
    });
  }

  const result = out.toDataURL('image/jpeg', 0.9);
  closeStudio();
  if (_stCallback) _stCallback(result);
}

function closeStudio(fromPopState = false) {
  document.getElementById('studio').classList.add('hidden');
  _stCallback = null;
  unlockScroll();
  if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
}
