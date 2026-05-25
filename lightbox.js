// js/lightbox.js — Lightbox with physics

function expandPost(pid, ctx) {
  const p = POSTS.find(x=>x.id===pid);
  if (p && !SESSION_VIEWS.has('lb-'+pid)) { SESSION_VIEWS.add('lb-'+pid); p.views=(p.views||0)+1; }
  if (ctx==='profile' && APP.profileUid) {
    LB_LIST = POSTS.filter(p=>p.userId===APP.profileUid).sort((a,b)=>b.ts-a.ts);
  } else {
    const feed = getFeedPosts();
    LB_LIST = feed.length ? feed : [...POSTS].sort((a,b)=>b.ts-a.ts);
  }
  LB_IDX = LB_LIST.findIndex(p=>p.id===pid);
  if (LB_IDX<0) LB_IDX=0;
  lockScroll(); eraPush('lightbox');
  buildLightbox();
}

function _closeLightboxInternal() {
  const pid = LB_LIST[LB_IDX]?.id;
  const lb  = document.getElementById('lightbox'); if(!lb) return;
  lb.style.transition='opacity .2s ease'; lb.style.opacity='0';
  setTimeout(()=>{ lb.remove(); unlockScroll(); if(pid) syncFeedToPost(pid); }, 190);
}

function closeLightbox() {
  _closeLightboxInternal();
  if (_histDepth>0) { _histDepth--; history.back(); }
}

function syncFeedToPost(pid) {
  if (APP.view!=='feed') return;
  const card = document.getElementById('post-'+pid);
  if (card) card.scrollIntoView({behavior:'smooth', block:'center'});
}

function lbNav(dir) {
  const next = LB_IDX+dir;
  if (next<0||next>=LB_LIST.length) {
    const lb=document.getElementById('lightbox');
    if (lb) { lb.classList.add(dir>0?'anim-spring-l':'anim-spring-r'); setTimeout(()=>lb.classList.remove('anim-spring-l','anim-spring-r'),400); }
    return;
  }
  LB_IDX=next; buildLightbox(dir);
  setTimeout(()=>syncFeedToPost(LB_LIST[LB_IDX]?.id),0);
}

function buildLightbox(dir=0) {
  document.getElementById('lightbox')?.remove();
  const p=LB_LIST[LB_IDX]; if(!p) return;
  const u=getUser(p.userId), own=APP.user&&p.userId===APP.user.id;
  const bg=postGrad(u), imgs=getPostImages(p), hasMulti=imgs&&imgs.length>1;
  lbCarState.idx=0; lbCarState.total=hasMulti?imgs.length:1;

  let imgHTML='';
  if (!imgs||imgs.length===0) imgHTML=`<div class="lb-img-abs" style="background:${bg}"></div>`;
  else if (imgs.length===1)   imgHTML=`<img src="${imgs[0]}" alt="" draggable="false">`;
  else imgHTML=`<div class="carousel-track" id="lb-ct-${p.id}" style="height:100%">${imgs.map(i=>`<div class="carousel-slide"><img src="${i}" alt="" draggable="false"></div>`).join('')}</div><div class="carousel-dots" id="lb-cd-${p.id}">${imgs.map((_,i)=>`<div class="c-dot${i===0?' on':''}"></div>`).join('')}</div>`;

  const lb=document.createElement('div'); lb.id='lightbox';
  lb.innerHTML=`
    <button class="lb-close" onclick="closeLightbox()">×</button>
    <div class="lb-wrap" id="lb-wrap-${p.id}">
      <div class="lb-img-area" id="lb-img-${p.id}">${imgHTML}</div>
      <div class="lb-meta">
        <div style="width:34px;height:34px;border-radius:50%;overflow:hidden;cursor:pointer" onclick="closeLightbox();${own?`setView('profile')`:`openUserCard('${u.id}')`}">${avatarHTML(u,34,{friend:true})}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;cursor:pointer" onclick="closeLightbox();${own?`setView('profile')`:`openUserCard('${u.id}')`}">@${esc(u.username)}</div>
          <div style="font-size:10px;color:var(--t2)">${fmtTime(p.ts)}</div>
        </div>
        ${p.views?`<span style="font-size:10px;color:var(--t3);display:flex;align-items:center;gap:2px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${fmtN(p.views)}</span>`:''}
      </div>
      ${p.desc?`<div class="lb-desc">${tags(esc(p.desc))}</div>`:''}
      <div class="lb-reactions">
        <div class="reactions-row" style="padding:8px 0 4px">
          <button class="like-btn${p.liked?' liked':''}" id="lb-lb-${p.id}" onclick="toggleLike('${p.id}')">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="${p.liked?'currentColor':'none'}" style="width:19px;height:19px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${own?`<span class="like-cnt">${fmtN(p.likes)||0}</span>`:''}
          </button>
          <div id="lb-rr-${p.id}" style="display:contents">${buildReacts(p)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;padding:4px 0">
          <button class="post-act" onclick="closeLightbox();openCmts('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${p.comments.length}</span>
          </button>
          <div style="flex:1"></div>
          <button class="post-act" onclick="sharePost('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="lb-nav-hint">← → свайп • scroll між постами</div>`;

  if (dir!==0) lb.querySelector('.lb-wrap')?.classList.add(dir>0?'anim-sl':'anim-sr');

  lb.addEventListener('wheel', e=>{ e.preventDefault(); lbNav(e.deltaY>0?1:-1); },{passive:false});

  let lbSx=0,lbSy=0,lbSwiping=false,lbOnImg=false;
  lb.addEventListener('touchstart',e=>{lbSx=e.touches[0].clientX;lbSy=e.touches[0].clientY;lbSwiping=false;lbOnImg=!!e.target.closest('.lb-img-area');},{passive:true});
  lb.addEventListener('touchmove', e=>{const dx=Math.abs(e.touches[0].clientX-lbSx),dy=Math.abs(e.touches[0].clientY-lbSy);if(dx>dy&&dx>8)lbSwiping=true;},{passive:true});
  lb.addEventListener('touchend', e=>{
    if(!lbSwiping)return; lbSwiping=false;
    const dx=e.changedTouches[0].clientX-lbSx; if(Math.abs(dx)<40)return;
    if(hasMulti&&lbOnImg){
      if(dx<0){if(lbCarState.idx<lbCarState.total-1){lbCarState.idx++;updateLbCarUI(p.id);}else lbNav(1);}
      else    {if(lbCarState.idx>0){lbCarState.idx--;updateLbCarUI(p.id);}else lbNav(-1);}
    } else lbNav(dx<0?1:-1);
  },{passive:true});

  const wrapEl=lb.querySelector('.lb-wrap');
  let vSY=0,vDrag=false;
  wrapEl.addEventListener('touchstart',e=>{if(e.target.closest('.lb-img-area'))return;if(wrapEl.scrollTop>0)return;vSY=e.touches[0].clientY;vDrag=true;wrapEl.style.transition='none';},{passive:true});
  wrapEl.addEventListener('touchmove', e=>{if(!vDrag)return;const dy=e.touches[0].clientY-vSY;if(dy>0){wrapEl.style.transform=`translateY(${dy*.75}px)`;lb.style.opacity=String(Math.max(0,1-dy/350));e.preventDefault();}},{passive:false});
  wrapEl.addEventListener('touchend', e=>{if(!vDrag)return;vDrag=false;const dy=e.changedTouches[0].clientY-vSY;wrapEl.style.transition='transform .25s ease';if(dy>90){wrapEl.style.transform='translateY(100vh)';lb.style.transition='opacity .22s';lb.style.opacity='0';setTimeout(()=>closeLightbox(),210);}else{wrapEl.style.transform='';lb.style.opacity='';setTimeout(()=>{wrapEl.style.transition='';lb.style.transition='';},300);}},{passive:true});

  const imgArea=lb.querySelector('.lb-img-area');
  let lbTapT=null,lbTapMoved=false,lbTapSX=0,lbTapSY=0;
  if(imgArea){
    imgArea.addEventListener('touchstart',e=>{lbTapSX=e.touches[0].clientX;lbTapSY=e.touches[0].clientY;lbTapMoved=false;},{passive:true});
    imgArea.addEventListener('touchmove', e=>{if(Math.abs(e.touches[0].clientX-lbTapSX)>12||Math.abs(e.touches[0].clientY-lbTapSY)>12)lbTapMoved=true;},{passive:true});
    imgArea.addEventListener('touchend', e=>{if(lbTapMoved)return;if(lbTapT){clearTimeout(lbTapT);lbTapT=null;lbDoubleTap(p.id,imgArea);}else{lbTapT=setTimeout(()=>lbTapT=null,220);}},{passive:true});
    imgArea.addEventListener('dblclick', ()=>lbDoubleTap(p.id,imgArea));
  }

  lb.addEventListener('click',e=>{if(e.target===lb)closeLightbox();});
  document.body.appendChild(lb);
}

function updateLbCarUI(pid) {
  const idx=lbCarState.idx;
  const track=document.getElementById('lb-ct-'+pid); if(track)track.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll(`#lb-cd-${pid} .c-dot`).forEach((d,i)=>{d.classList.toggle('on',i===idx);d.style.width=i===idx?'14px':'6px';});
}

function lbDoubleTap(pid, imgArea) {
  const p=POSTS.find(x=>x.id===pid); if(!p) return;
  if(!p.liked){p.liked=true;p.likes++;refreshLikeBtn(pid);}
  const heart=document.createElement('div'); heart.className='like-heart-anim'; heart.textContent='❤️';
  imgArea.appendChild(heart); setTimeout(()=>heart.remove(),700);
}
