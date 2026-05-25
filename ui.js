// js/ui.js — Modal system, toast, sheets, history, carousel, crop, long press

// ── Scroll lock ───────────────────────────────────────────
function lockScroll()   { document.body.classList.add('scroll-locked'); }
function unlockScroll() { document.body.classList.remove('scroll-locked'); }

// ── History API ───────────────────────────────────────────
let _histDepth = 0;
function eraPush(id) { _histDepth++; history.pushState({era:id,depth:_histDepth},'',location.href.split('#')[0]+'#'+id); }
function eraBack()  { if(_histDepth>0){_histDepth--;history.back();}else{_closeTopModal();} }

function _closeTopModal() {
  if (document.getElementById('lightbox'))      { _closeLightboxInternal(); return; }
  if (document.getElementById('pin-replace-dialog')) { document.getElementById('pin-replace-dialog').remove(); return; }
  const cropModal = document.getElementById('crop-modal');
  if (cropModal && !cropModal.classList.contains('hidden')) { cancelCrop(); return; }
  const open = [...document.querySelectorAll('.overlay:not(.hidden)')];
  if (open.length) { const o=open[open.length-1]; _animateSheetOut(o); unlockScroll(); }
}

window.addEventListener('popstate', e => {
  if (e.state?.era) _histDepth = Math.max(0,_histDepth-1);
  _closeTopModal();
});

// ── Sheet animation helpers ───────────────────────────────
function _animateSheetOut(overlayEl, cb) {
  const sheet = overlayEl.querySelector('.sheet');
  if (sheet) {
    sheet.style.transition = 'transform .26s cubic-bezier(.22,1,.36,1)';
    sheet.style.transform  = 'translateY(110%)';
    setTimeout(() => { overlayEl.classList.add('hidden'); sheet.style.transform=''; sheet.style.transition=''; unlockScroll(); if(cb)cb(); }, 250);
  } else { overlayEl.classList.add('hidden'); unlockScroll(); if(cb)cb(); }
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
  if (_histDepth>0) { _histDepth--; history.back(); }
}

function ovClose(e, id) { if(e.target===document.getElementById(id)) closeModal(id); }

// ── Sheet drag-to-close ───────────────────────────────────
function _makeDraggable(handleId, sheetId, overlayId) {
  const handle = document.getElementById(handleId);
  const sheet  = document.getElementById(sheetId);
  if (!handle||!sheet) return;
  let sy=0, dragging=false;
  const targets = [handle, sheet.querySelector('.sheet-hdr')].filter(Boolean);
  targets.forEach(el => {
    el.addEventListener('touchstart', e=>{ sy=e.touches[0].clientY; dragging=true; sheet.style.transition='none'; },{passive:true});
    el.addEventListener('touchmove',  e=>{ if(!dragging)return; const dy=e.touches[0].clientY-sy; if(dy>0){sheet.style.transform=`translateY(${dy}px)`;e.preventDefault();} },{passive:false});
    el.addEventListener('touchend',   e=>{ if(!dragging)return; dragging=false;
      const dy=e.changedTouches[0].clientY-sy;
      sheet.style.transition='transform .28s cubic-bezier(.22,1,.36,1)';
      if(dy>80){ sheet.style.transform='translateY(110%)'; setTimeout(()=>{ document.getElementById(overlayId)?.classList.add('hidden'); sheet.style.transform=''; sheet.style.transition=''; unlockScroll(); if(_histDepth>0){_histDepth--;history.back();} },260); }
      else { sheet.style.transform=''; setTimeout(()=>sheet.style.transition='',300); }
    },{passive:true});
  });
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, dur=2800) {
  const c=document.getElementById('toasts'), el=document.createElement('div');
  el.className='toast'; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),250); }, dur);
}

// ── Feed carousel ─────────────────────────────────────────
function initCarousel(pid, total) {
  if (total<=1) return;
  carousels.set(pid,{idx:0,total});
  const wrap = document.getElementById('img-'+pid); if(!wrap) return;
  let sx=0,sy=0,sw=false,startT=0;
  wrap.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; sw=false; startT=Date.now(); },{passive:true});
  wrap.addEventListener('touchmove',  e=>{ const dx=Math.abs(e.touches[0].clientX-sx),dy=Math.abs(e.touches[0].clientY-sy); if(dx>dy&&dx>8){sw=true;e.preventDefault();} },{passive:false});
  wrap.addEventListener('touchend',   e=>{ if(!sw)return; const dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)>40){ const st=carousels.get(pid);if(!st)return; if(dx<0&&st.idx<st.total-1)st.idx++;else if(dx>0&&st.idx>0)st.idx--;updateCarouselUI(pid,st.idx);} sw=false; },{passive:true});
  // Desktop drag
  let mx=0,md=false,mm=false;
  wrap.addEventListener('mousedown', e=>{ mx=e.clientX; md=true; mm=false; });
  wrap.addEventListener('mousemove', e=>{ if(md&&Math.abs(e.clientX-mx)>8)mm=true; });
  wrap.addEventListener('mouseup',   e=>{ if(!md)return;md=false; if(!mm)return; const dx=e.clientX-mx; if(Math.abs(dx)>40){const st=carousels.get(pid);if(!st)return;if(dx<0&&st.idx<st.total-1)st.idx++;else if(dx>0&&st.idx>0)st.idx--;updateCarouselUI(pid,st.idx);} mm=false; });
  wrap.addEventListener('mouseleave',()=>{md=false;});
}

function updateCarouselUI(pid, idx) {
  const track=document.getElementById('ct-'+pid); if(track) track.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll(`#cd-${pid} .c-dot`).forEach((d,i)=>{d.classList.toggle('on',i===idx);d.style.width=i===idx?'14px':'6px';});
  const ctr=document.getElementById('cc-'+pid); const st=carousels.get(pid); if(ctr&&st) ctr.textContent=`${idx+1}/${st.total}`;
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

// ── Crop tool ─────────────────────────────────────────────
let _cropCallback=null, _cropX=0, _cropY=0, _cropScale=1;
let _cropDragSX=0, _cropDragSY=0, _cropDragOX=0, _cropDragOY=0, _cropDragging=false;
let _cropPinchDist=0;
const CROP_RATIO = 4/5;

function showCropTool(src, callback) {
  _cropCallback=callback; _cropX=0; _cropY=0; _cropScale=1;
  const modal=document.getElementById('crop-modal');
  modal.classList.remove('hidden');
  const img=document.getElementById('crop-img');
  img.onload=()=>{ _fitCrop(img); _drawCropMask(); };
  img.src=src;
  _initCropEvents();
}

function _fitCrop(img) {
  const stage=document.getElementById('crop-stage');
  const fw=stage.clientWidth*.88, fh=fw/CROP_RATIO;
  _cropScale=Math.max(fw/img.naturalWidth, fh/img.naturalHeight);
  _cropX=0; _cropY=0;
  img.style.width=img.naturalWidth+'px'; img.style.height=img.naturalHeight+'px';
  _applyTransform(img);
}

function _applyTransform(img) {
  if(!img) img=document.getElementById('crop-img');
  if(!img) return;
  img.style.transform=`translate(calc(-50% + ${_cropX}px),calc(-50% + ${_cropY}px)) scale(${_cropScale})`;
  img.style.left='50%'; img.style.top='50%'; img.style.position='absolute';
}

function _drawCropMask() {
  const stage=document.getElementById('crop-stage'), mask=document.getElementById('crop-mask');
  const sw=stage.clientWidth, sh=stage.clientHeight;
  const fw=Math.round(sw*.88), fh=Math.round(fw/CROP_RATIO);
  const fx=Math.round((sw-fw)/2), fy=Math.round((sh-fh)/2);
  mask.innerHTML=`
    <div class="crop-shade" style="top:0;left:0;right:0;height:${fy}px"></div>
    <div class="crop-shade" style="top:${fy}px;left:0;width:${fx}px;height:${fh}px"></div>
    <div class="crop-shade" style="top:${fy}px;right:0;width:${fx}px;height:${fh}px"></div>
    <div class="crop-shade" style="bottom:0;left:0;right:0;height:${sh-fy-fh}px"></div>
    <div class="crop-frame-border" style="left:${fx}px;top:${fy}px;width:${fw}px;height:${fh}px">
      <div class="crop-corner tl"></div><div class="crop-corner tr"></div>
      <div class="crop-corner bl"></div><div class="crop-corner br"></div>
      <div class="crop-grid-line" style="position:absolute;left:${Math.round(fw/3)}px;top:0;width:1px;height:100%"></div>
      <div class="crop-grid-line" style="position:absolute;left:${Math.round(fw*2/3)}px;top:0;width:1px;height:100%"></div>
      <div class="crop-grid-line" style="position:absolute;left:0;top:${Math.round(fh/3)}px;width:100%;height:1px"></div>
      <div class="crop-grid-line" style="position:absolute;left:0;top:${Math.round(fh*2/3)}px;width:100%;height:1px"></div>
    </div>`;
}

function _initCropEvents() {
  const stage=document.getElementById('crop-stage');
  // Remove old listeners by cloning
  const fresh=stage.cloneNode(true); fresh.appendChild(document.getElementById('crop-img')); fresh.appendChild(document.getElementById('crop-mask')); fresh.querySelector('.crop-hint')&&fresh.querySelector('.crop-hint').remove();
  stage.parentNode.replaceChild(fresh,stage);
  const s=document.getElementById('crop-stage');
  s.addEventListener('mousedown', e=>{ _cropDragging=true; _cropDragSX=e.clientX; _cropDragSY=e.clientY; _cropDragOX=_cropX; _cropDragOY=_cropY; s.classList.add('dragging'); });
  s.addEventListener('mousemove', e=>{ if(!_cropDragging)return; _cropX=_cropDragOX+(e.clientX-_cropDragSX); _cropY=_cropDragOY+(e.clientY-_cropDragSY); _applyTransform(); });
  s.addEventListener('mouseup',   ()=>{ _cropDragging=false; s.classList.remove('dragging'); });
  s.addEventListener('wheel',     e=>{ e.preventDefault(); _cropScale=Math.max(.4,Math.min(6,_cropScale-(e.deltaY>0?.06:-.06))); _applyTransform(); },{passive:false});
  s.addEventListener('touchstart',e=>{ if(e.touches.length===1){ _cropDragging=true; _cropDragSX=e.touches[0].clientX; _cropDragSY=e.touches[0].clientY; _cropDragOX=_cropX; _cropDragOY=_cropY; } if(e.touches.length===2){ _cropPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); } },{passive:true});
  s.addEventListener('touchmove', e=>{ e.preventDefault(); if(e.touches.length===1&&_cropDragging){ _cropX=_cropDragOX+(e.touches[0].clientX-_cropDragSX); _cropY=_cropDragOY+(e.touches[0].clientY-_cropDragSY); _applyTransform(); } if(e.touches.length===2){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); _cropScale=Math.max(.4,Math.min(6,_cropScale*(d/_cropPinchDist))); _cropPinchDist=d; _applyTransform(); } },{passive:false});
  s.addEventListener('touchend',  ()=>{ _cropDragging=false; });
}

function applyCrop() {
  const img=document.getElementById('crop-img');
  const stage=document.getElementById('crop-stage');
  const sw=stage.clientWidth, sh=stage.clientHeight;
  const fw=Math.round(sw*.88), fh=Math.round(fw/CROP_RATIO);
  const fx=(sw-fw)/2, fy=(sh-fh)/2;
  const canvas=document.createElement('canvas');
  const OUT=800; canvas.width=OUT; canvas.height=Math.round(OUT/CROP_RATIO);
  const ctx=canvas.getContext('2d');
  const icx=sw/2+_cropX, icy=sh/2+_cropY;
  const toImg=(px,py)=>({x:(px-icx)/_cropScale+img.naturalWidth/2, y:(py-icy)/_cropScale+img.naturalHeight/2});
  const tl=toImg(fx,fy);
  ctx.drawImage(img, tl.x, tl.y, fw/_cropScale, fh/_cropScale, 0, 0, canvas.width, canvas.height);
  const result=canvas.toDataURL('image/jpeg',.88);
  document.getElementById('crop-modal').classList.add('hidden');
  if(_cropCallback) _cropCallback(result);
  _cropCallback=null;
}

function cancelCrop() {
  document.getElementById('crop-modal').classList.add('hidden');
  _cropCallback=null;
}
