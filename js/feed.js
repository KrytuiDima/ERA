// js/feed.js — Feed rendering & post interactions

// ── Feed tabs ─────────────────────────────────────────────
function setFeed(tab) {
  APP.feed = tab;
  document.querySelectorAll('.feed-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ftb-'+tab)?.classList.add('active');
  renderFeed();
}

function getFeedPosts() {
  const all = [...POSTS].sort((a,b) => b.ts-a.ts);
  if (APP.feed === 'following') {
    const fids = [...FOLLOWS.entries()].filter(([,s])=>s==='following').map(([id])=>id);
    return all.filter(p => fids.includes(p.userId));
  }
  // For You: mood-aware + friends boost
  if (APP.mood) {
    const mc = MOODS.find(m=>m.id===APP.mood)?.color||'#888';
    const mH = hexToHsl(mc).h;
    return all.map(p => {
      const u   = getUser(p.userId);
      const uH  = hexToHsl(u.baseColor).h;
      const diff= Math.min(Math.abs(mH-uH),360-Math.abs(mH-uH));
      const friendBoost = isFriend(p.userId) ? 0.2 : 0;
      const score = (1-diff/180)*.45 + Math.log10(p.likes+1)/4*.25
                  + Math.max(0,1-(Date.now()-p.ts)/(7*86400000))*.2
                  + friendBoost + srand(hashStr(p.id+(APP.mood||'')))*.1;
      return {...p, _score:score};
    }).sort((a,b) => b._score-a._score);
  }
  return all;
}

function renderFeed() {
  const posts = getFeedPosts();
  const c = document.getElementById('feed-container');
  if (!posts.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-ico">${APP.feed==='following'?'👥':'✨'}</div><div class="empty-txt">${t(APP.feed==='following'?'feed.emptyFollowing':'feed.emptyForYou')}</div></div>`;
    return;
  }
  // Track views
  posts.forEach(p => { if(!SESSION_VIEWS.has(p.id)){SESSION_VIEWS.add(p.id);p.views=(p.views||0)+1;} });
  c.innerHTML = posts.map((p,i) => renderPostCard(p,i*28)).join('');
  setTimeout(() => {
    posts.forEach(p => { const imgs=getPostImages(p); if(imgs&&imgs.length>1) initCarousel(p.id,imgs.length); });
  }, 0);
}

// ── Post card ─────────────────────────────────────────────
// Рендеринг картки поста для стрічки
function renderPostCard(post, delay = 0) {
  const u = getUser(post.userId);
  const own = APP.user && post.userId === APP.user.id;
  const frnd = isFriend(post.userId);
  const vibe = currentVibeColor(u);
  const cols = vibeColors(vibe, hashStr(u.id));
  const imgs = getPostImages(post);
  const bg = postGrad(u);
  const hasMulti = imgs && imgs.length > 1;

  let imgContent = '';
  if (!imgs || imgs.length === 0) {
    imgContent = `<div class="post-img-abs" style="background:${bg}"></div>`;
  } else if (imgs.length === 1) {
    imgContent = `<img src="${imgs[0]}" alt="" draggable="false">`;
  } else {
    imgContent = `<div class="carousel-track" id="ct-${post.id}">${imgs.map(i => `<div class="carousel-slide"><img src="${i}" alt="" draggable="false"></div>`).join('')}</div><div class="carousel-dots" id="cd-${post.id}">${imgs.map((_, i) => `<div class="c-dot${i === 0 ? ' on' : ''}"></div>`).join('')}</div><div class="carousel-ctr" id="cc-${post.id}">1/${imgs.length}</div>`;
  }

  // Акцент для друзів: неон кольору ВЛАСНОГО вайбу
  const myVibe = currentVibeColor(APP.user || { baseColor: '#00c6ff' });
  const myCols = vibeColors(myVibe, hashStr(APP.user?.id || 'me'));
  const friendMark = frnd
    ? `<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${myCols[0]}; margin-left:6px; box-shadow:0 0 8px ${myCols[0]}; vertical-align:middle" title="Друг"></span>`
    : '';

  return `<div class="post-card" style="animation-delay:${delay}ms" id="post-${post.id}"
    oncontextmenu="event.preventDefault();showPostMenu('${post.id}',event.clientX,event.clientY)"
    ontouchstart="_lpStart(event,'${post.id}')" ontouchmove="_lpMove()" ontouchend="_lpEnd()">
  <div class="post-head">
    <div class="post-ava" onclick="${own?`setView('profile')`:`openUserCard('${u.id}')`}">${avatarHTML(u,38,{friend:true})}</div>
    <div class="post-meta">
      <div class="post-uname" onclick="${own?`setView('profile')`:`openUserCard('${u.id}')`}">@${esc(u.username)}${friendMark}</div>
      <div class="post-time">${fmtTime(post.ts)}</div>
    </div>
    <div class="vibe-dot" style="background:${frnd ? myCols[0] : cols[0]}${frnd?';box-shadow:0 0 8px '+myCols[0]:''}; ${frnd ? 'outline: 1px solid ' + myCols[0] : ''}"></div>
  </div>
  <div class="post-img-wrap${hasMulti?' carousel-wrap':''}" id="img-${post.id}"
    ondblclick="feedDblTap(event,'${post.id}')"
    onclick="feedImgClick(event,'${post.id}')">
    ${imgContent}
  </div>
  <div class="reactions-row" id="rr-${post.id}">
    <button class="like-btn${post.liked?' liked':''}" id="lb-${post.id}" onclick="toggleLike('${post.id}')">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="${post.liked?'currentColor':'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      ${own?`<span class="like-cnt" id="lc-${post.id}">${fmtN(post.likes)||0}</span>`:''}
    </button>
    ${buildReacts(post)}
  </div>
  <div class="post-footer">
    <button class="post-act" onclick="openCmts('${post.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span id="cc-cmt-${post.id}">${post.comments.length}</span>
    </button>
    ${post.views?`<span style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:3px;padding:0 6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${fmtN(post.views)}</span>`:''}
    ${post.pinned?`<span style="font-size:11px;color:var(--t3);padding:0 4px">📌</span>`:''}
    <div class="post-spacer"></div>
    <button class="post-act" onclick="sharePost('${post.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
    </button>
  </div>
  ${post.desc?`<div class="post-desc">${tags(esc(post.desc))}</div>`:''}
</div>`;
}

// ── Reactions ─────────────────────────────────────────────
function buildReacts(post) {
  if (!post.reactions) post.reactions = {};
  return REACT_LIST.map(e => {
    const cnt = post.reactions[e]||0, isMe = post.myReaction===e;
    return `<button class="react-pill${isMe?' my':''}" id="rp-${post.id}-${e.codePointAt(0)}" onclick="applyReact('${post.id}','${e}',this)">
      ${e}${cnt>0?`<span class="react-cnt">${fmtN(cnt)}</span>`:''}
    </button>`;
  }).join('');
}

/**
 * Керування реакціями та лайками.
 * Функції асинхронні для майбутньої синхронізації з Supabase.
 */
async function applyReact(pid, emoji, btn) {
  const p = POSTS.find(x => x.id === pid); if (!p) return;
  if (!p.reactions) p.reactions = {};

  const prev = p.myReaction;
  if (prev === emoji) {
    p.reactions[emoji] = Math.max(0, (p.reactions[emoji] || 1) - 1);
    p.myReaction = null;
  } else {
    if (prev) p.reactions[prev] = Math.max(0, (p.reactions[prev] || 1) - 1);
    p.reactions[emoji] = (p.reactions[emoji] || 0) + 1;
    p.myReaction = emoji;

    // Автоматично ставимо лайк при додаванні реакції, якщо його не було
    if (!p.liked) {
      p.liked = true; p.likes++;
      refreshLikeBtn(pid);
    }

    if (btn) {
      btn.classList.remove('burst'); void btn.offsetWidth; btn.classList.add('burst');
      const fl = document.createElement('span'); fl.className = 'react-float'; fl.textContent = '+1';
      btn.appendChild(fl); setTimeout(() => fl.remove(), 700);
    }
  }

  // Оновлюємо інтерфейс реакцій у стрічці та лайтбоксі
  const rr = document.getElementById('rr-' + pid);
  if (rr) {
    const lb = document.getElementById('lb-' + pid);
    rr.innerHTML = '';
    if (lb) rr.appendChild(lb);
    rr.insertAdjacentHTML('beforeend', buildReacts(p));
  }
  const lbRr = document.getElementById('lb-rr-' + pid);
  if (lbRr) lbRr.innerHTML = buildReacts(p);

  // В майбутньому: await supabase.from('reactions').upsert({ post_id: pid, user_id: APP.user.id, emoji: p.myReaction });
}

async function toggleLike(pid) {
  const p = POSTS.find(x => x.id === pid); if (!p) return;

  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;

  refreshLikeBtn(pid);

  const btn = document.getElementById('lb-' + pid);
  if (btn) {
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => btn.style.transform = '', 200);
  }

  // В майбутньому: p.liked ? await supabase.from('likes').insert(...) : await supabase.from('likes').delete(...);
}

function refreshLikeBtn(pid) {
  const p=POSTS.find(x=>x.id===pid); if(!p) return;
  const own=APP.user&&p.userId===APP.user.id;
  const btn=document.getElementById('lb-'+pid);
  if (btn) {
    btn.className='like-btn'+(p.liked?' liked':'');
    btn.innerHTML=`<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="${p.liked?'currentColor':'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${own?`<span class="like-cnt" id="lc-${pid}">${fmtN(p.likes)||0}</span>`:''}`;
    btn.onclick=()=>toggleLike(pid);
  }
  const lbLb=document.getElementById('lb-lb-'+pid);
  if(lbLb){lbLb.className='like-btn'+(p.liked?' liked':'');lbLb.querySelector('svg')?.setAttribute('fill',p.liked?'currentColor':'none');const cnt=lbLb.querySelector('.like-cnt');if(cnt)cnt.textContent=fmtN(p.likes)||0;}
}

// ── Image tap / double-tap ────────────────────────────────
let feedTapTimer = null;
function feedImgClick(e, pid) {
  const st = carousels.get(pid); if(st&&e._wasDrag) return;
  if (feedTapTimer) { clearTimeout(feedTapTimer); feedTapTimer=null; feedDblTap(e,pid); return; }
  feedTapTimer = setTimeout(()=>{ feedTapTimer=null; expandPost(pid); }, 200);
}
function feedDblTap(e, pid) {
  clearTimeout(feedTapTimer); feedTapTimer=null;
  const wrap = document.getElementById('img-' + pid);
  if (wrap) lbDoubleTap(pid, wrap);
}

// ── Post actions ──────────────────────────────────────────
function sharePost(pid) {
  navigator.clipboard?.writeText(`https://era.app/p/${pid}`).then(()=>showToast(t('post.linkCopied')));
}

function goTag(tag) {
  setView('explore');
  setTimeout(()=>{ const inp=document.getElementById('explore-inp'); if(inp){inp.value=tag.replace(/^[#@]/,'');inp.dispatchEvent(new Event('input'));} },80);
}

function deletePost(pid) {
  if (!confirm(t('post.delete')+'?')) return;
  POSTS = POSTS.filter(p=>p.id!==pid);
  const saved=JSON.parse(localStorage.getItem('era_posts')||'[]');
  localStorage.setItem('era_posts',JSON.stringify(saved.filter(p=>p.id!==pid)));
  const card=document.getElementById('post-'+pid);
  if(card){card.style.transition='opacity .25s,transform .25s';card.style.opacity='0';card.style.transform='translateX(-10px)';setTimeout(()=>card.remove(),260);}
  showToast(t('post.deleted'));
}

function editDesc(pid) {
  const p=POSTS.find(x=>x.id===pid); if(!p||p.userId!==APP.user.id) return;
  const nd=prompt(t('post.newDesc'),p.desc||''); if(nd===null) return;
  p.desc=nd.slice(0,300);
  const card=document.getElementById('post-'+pid);
  if(card){const de=card.querySelector('.post-desc');if(p.desc){if(de)de.innerHTML=tags(esc(p.desc));else card.querySelector('.post-footer').insertAdjacentHTML('afterend',`<div class="post-desc">${tags(esc(p.desc))}</div>`);}else if(de)de.remove();}
  showToast(t('post.descUpdated'));
}

// ── Comments ──────────────────────────────────────────────
function openCmts(pid) {
  OPEN_POST=pid; CMT_PHOTO=null;
  document.getElementById('cmt-ph-prev').classList.add('hidden');
  document.getElementById('cmt-input').value='';
  document.getElementById('cmt-file').value='';
  document.getElementById('cmt-bar-ava').innerHTML=avatarHTML(APP.user,30);
  const p=POSTS.find(x=>x.id===pid), pu=getUser(p.userId);
  document.getElementById('cmt-body').innerHTML=`
  <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--b1)">
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
      <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;cursor:pointer" onclick="openUserCard('${pu.id}')">${avatarHTML(pu,28,{friend:true})}</div>
      <span style="font-size:13px;font-weight:600;cursor:pointer" onclick="openUserCard('${pu.id}')">@${esc(pu.username)}</span>
      <span style="font-size:11px;color:var(--t2)">${fmtTime(p.ts)}</span>
    </div>
    ${p.desc?`<div style="font-size:13px;color:var(--t2);line-height:1.55">${tags(esc(p.desc))}</div>`:''}
  </div>
  <div class="cmt-list" id="cmt-list">${p.comments.map(c=>renderCmt(c)).join('')}</div>
  ${p.comments.length===0?`<div style="text-align:center;font-size:12px;color:var(--t3);padding:16px 0">${t('post.firstComment')}</div>`:''}`;
  openModal('modal-cmt');
}

// Рендеринг одного коментаря
// Реалізовано відображення фото у вигляді квадратного прев'ю з відкриттям у загальному лайтбоксі
function renderCmt(c) {
  const u = getUser(c.userId);
  const frnd = isFriend(c.userId);
  const myVibe = currentVibeColor(APP.user || { baseColor: '#00c6ff' });
  const myCols = vibeColors(myVibe, hashStr(APP.user?.id || 'me'));

  return `<div class="cmt-item">
  <div class="cmt-ava" style="cursor:pointer" onclick="openUserCard('${u.id}')">${avatarHTML(u, 30, { friend: true })}</div>
  <div class="cmt-bwrap">
    <div>
      <span class="cmt-uname" style="cursor:pointer" onclick="openUserCard('${u.id}')">@${esc(u.username)}</span>
      ${frnd ? `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${myCols[0]}; margin-left:5px; vertical-align:middle; box-shadow:0 0 5px ${myCols[0]}"></span>` : ''}
      <span class="cmt-utime">${fmtTime(c.ts)}</span>
    </div>
    ${c.text ? `<div class="cmt-text">${esc(c.text)}</div>` : ''}
    
    <!-- Фото в коментарі: маленьке квадратне прев'ю -->
    ${c.photo ? `<div class="cmt-ph-wrap" onclick="openPhotoLightbox('${c.photo}')">
      <img class="cmt-photo-img" src="${c.photo}" alt="">
    </div>` : ''}
  </div></div>`;
}

// Відкриття окремого фото (наприклад, з коментарів) у лайтбоксі
function openPhotoLightbox(src) {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.innerHTML = `
    <button class="lb-close" onclick="this.parentElement.remove(); unlockScroll(); eraBack()">×</button>
    <div class="lb-wrap" style="align-items:center; justify-content:center; height:100%; animation:fadeIn .2s">
      <img src="${src}" style="max-width:90%; max-height:85vh; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.8)">
    </div>`;
  lb.onclick = e => { if (e.target === lb) { lb.remove(); unlockScroll(); eraBack(); } };
  lockScroll();
  eraPush('photo-view');
  document.body.appendChild(lb);
}

function onCmtFile(e) {
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=ev=>{CMT_PHOTO=ev.target.result;document.getElementById('cmt-ph-img').src=CMT_PHOTO;document.getElementById('cmt-ph-prev').classList.remove('hidden');}; r.readAsDataURL(f);
}
function rmCmtPh() { CMT_PHOTO=null; document.getElementById('cmt-ph-prev').classList.add('hidden'); document.getElementById('cmt-file').value=''; }

// Надсилання коментаря (асинхронно для Supabase)
async function sendCmt() {
  const txt = document.getElementById('cmt-input').value.trim();
  if (!txt && !CMT_PHOTO) return;
  
  const p = POSTS.find(x => x.id === OPEN_POST);
  if (!p) return;

  const nc = {
    id: 'c_' + Date.now(),
    userId: APP.user.id,
    text: txt,
    photo: CMT_PHOTO,
    ts: Date.now()
  };

  p.comments.push(nc);
  
  // Оновлюємо UI миттєво
  const list = document.getElementById('cmt-list');
  if (list) {
    list.insertAdjacentHTML('beforeend', renderCmt(nc));
    list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
  }

  // Очищення полів
  document.getElementById('cmt-input').value = '';
  CMT_PHOTO = null;
  document.getElementById('cmt-ph-prev').classList.add('hidden');
  document.getElementById('cmt-file').value = '';
  
  const cc = document.getElementById('cc-cmt-' + p.id);
  if (cc) cc.textContent = p.comments.length;
}
