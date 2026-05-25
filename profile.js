// js/profile.js — Profile views

function renderProfile(uid) {
  APP.profileUid = uid;
  const u    = getUser(uid), own = APP.user && u.id===APP.user.id;
  const isF  = getFollowStatus(uid)==='following';
  const isReq= getFollowStatus(uid)==='requested';
  const frnd = isFriend(uid);
  const vibe = currentVibeColor(u);
  const cols = vibeColors(vibe, hashStr(u.id));
  const followers = own ? Math.floor(srand(hashStr(uid+55))*800+10) : Math.floor(srand(hashStr(uid+33))*1200+50);
  const following  = own ? [...FOLLOWS.values()].filter(s=>s==='following').length : Math.floor(srand(hashStr(uid+22))*400+5);
  const reqCount   = own ? getRequestCount() : 0;
  const myPosts    = POSTS.filter(p=>p.userId===uid);

  // Sort: pinned first
  const pinnedIds = getPinnedPosts(uid);
  const sorted = [
    ...pinnedIds.map(pid=>myPosts.find(p=>p.id===pid)).filter(Boolean),
    ...myPosts.filter(p=>!pinnedIds.includes(p.id)).sort((a,b)=>b.ts-a.ts),
  ];

  // Follow button
  let followBtn = '';
  if (own) {
    followBtn = `<button class="profile-edit-btn" onclick="setView('settings')">${t('profile.editProfile')}</button>`;
  } else if (isF) {
    followBtn = `<button class="profile-follow-btn on" id="pfb" onclick="toggleFollowUser('${uid}',this)">${frnd?t('profile.nowFriends'):t('profile.youFollow')}</button>`;
  } else if (isReq) {
    followBtn = `<button class="profile-follow-btn requested" id="pfb" onclick="toggleFollowUser('${uid}',this)">${t('profile.requested')}</button>`;
  } else {
    followBtn = `<button class="profile-follow-btn" id="pfb" onclick="toggleFollowUser('${uid}',this)">${t('profile.follow')}</button>`;
  }

  // Private + no access
  const canSee = !isUserPrivate(uid) || own || isF;

  document.getElementById('feed-container').innerHTML = `
<div class="profile-cover">
  <div class="profile-cover-inner">${makeVibeCode(vibe,u.id,600,120)}</div>
  <div class="profile-cover-fade"></div>
  <div class="profile-cover-lbl">${t('profile.vibe')}</div>
</div>
<div class="profile-info">
  <div class="profile-ava-row">
    <div class="profile-ava" ${own?`onclick="document.getElementById('pava-f').click()" title="${t('profile.changePhoto')}"`:''}>
      <div class="profile-ava-glow" style="background:linear-gradient(135deg,${cols[0]},${cols[1]},${cols[2]});${frnd?'filter:blur(6px);opacity:.9;animation:none':''}"></div>
      <div class="profile-ava-ring">${avatarHTML(u,84,{friend:false})}</div>
      ${own?`<input type="file" id="pava-f" accept="image/*" class="hidden" onchange="changeAva(event)">`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
      ${followBtn}
      ${own && reqCount>0 && (u.settings?.private||APP.user.settings?.private)
        ? `<button onclick="showFollowRequestsScreen()" style="padding:6px 14px;border-radius:8px;border:1px solid var(--blue);background:rgba(0,149,246,.08);color:var(--blue);font-size:12px;font-weight:600;cursor:pointer">${t('profile.followRequests')} (+${reqCount})</button>`
        : ''}
    </div>
  </div>
  <div class="profile-dname">${esc(u.displayName||u.username)}${frnd?` <span style="font-size:11px;color:${cols[0]};font-weight:400">· ${t('profile.friends')}</span>`:''}</div>
  <div class="profile-handle">@${esc(u.username)}</div>
  ${u.bio?`<div class="profile-bio">${esc(u.bio)}</div>`:''}
  <div class="profile-stats">
    <div><div class="ps-n">${followers}</div><div class="ps-l">${t('profile.followers')}</div></div>
    <div><div class="ps-n">${following}</div><div class="ps-l">${t('profile.following')}</div></div>
  </div>
  ${own?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--b1);display:flex;align-items:center;gap:8px">
    <div style="font-size:13px;color:var(--t2)">${APP.mood?`${MOODS.find(m=>m.id===APP.mood)?.emoji||''} ${t('mood.moods.'+APP.mood)}`:`${t('profile.moodNotSet')}`}</div>
    <button onclick="changeMood()" style="margin-left:auto;padding:4px 12px;border-radius:20px;border:1px solid var(--b2);background:var(--s2);font-size:11px;font-weight:600;color:var(--t2);cursor:pointer;transition:all .14s">${APP.mood?t('profile.changeMood'):t('profile.chooseMood')}</button>
  </div>`:''}
  <div class="vibe-sig">
    <span style="font-family:var(--mono);font-size:9px;color:var(--t3);letter-spacing:.08em">${t('profile.vibe')}</span>
    <div class="vibe-sig-bar">${makeVibeCode(vibe,u.id,200,18)}</div>
    <span style="font-family:var(--mono);font-size:8px;color:var(--t3)">${vibe}</span>
  </div>
</div>
${!canSee
  ? `<div class="empty-state"><div class="empty-ico">🔒</div><div class="empty-txt">Закритий акаунт.<br>Підпишись, щоб бачити пости.</div></div>`
  : sorted.length===0
    ? `<div class="empty-state"><div class="empty-ico">📸</div><div class="empty-txt">${own?t('post.emptyPosts'):t('post.emptyOtherPosts')}</div></div>`
    : `<div class="profile-grid">${sorted.map(p=>{
        const bg=postGrad(u), imgs=getPostImages(p);
        return `<div class="grid-cell" onclick="expandPost('${p.id}','profile')">
          ${imgs&&imgs.length>0?`<img src="${imgs[0]}" alt="">`:
            `<div class="grid-cell-abs" style="background:${bg}"></div>`}
          ${p.pinned?`<div class="grid-multi-badge">📌</div>`:
            imgs&&imgs.length>1?`<div class="grid-multi-badge">▪▪</div>`:''}
        </div>`;
      }).join('')}</div>`}`;
}

function renderFullProfile(uid) {
  APP.profileUid = uid;
  setView('profile');
  renderProfile(uid);
}

function changeAva(e) {
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    APP.user.avatar=ev.target.result; saveUserData();
    document.getElementById('sb-ava').innerHTML=avatarHTML(APP.user,34);
    document.getElementById('bn-ava').innerHTML=avatarHTML(APP.user,24);
    renderProfile(APP.user.id); showToast(t('profile.photoUpdated'));
  };
  r.readAsDataURL(f);
}

// ── User card popup ───────────────────────────────────────
function openUserCard(uid) {
  if (uid===APP.user?.id) { setView('profile'); return; }
  const u      = getUser(uid);
  const status = getFollowStatus(uid);
  const frnd   = isFriend(uid);
  const cols   = vibeColors(u.baseColor, hashStr(u.id));
  const uPosts = POSTS.filter(p=>p.userId===uid).length;
  const followers = Math.floor(srand(hashStr(uid+33))*1200+50);
  let btnTxt='', btnCls='';
  if (status==='following') { btnTxt=frnd?t('profile.nowFriends'):t('profile.youFollow'); btnCls='on'; }
  else if (status==='requested') { btnTxt=t('profile.requested'); btnCls='requested'; }
  else btnTxt=t('profile.follow');
  document.getElementById('uc-ttl').textContent='@'+u.username;
  document.getElementById('uc-body').innerHTML=`
<div class="uc-cover">
  <div class="uc-cover-inner">${makeVibeCode(u.baseColor,u.id,400,80)}</div>
  <div class="uc-cover-fade"></div>
</div>
<div class="uc-body">
  <div style="position:relative;width:56px;height:56px;margin-bottom:8px">
    <div style="position:absolute;inset:-4px;border-radius:50%;background:linear-gradient(135deg,${cols[0]},${cols[1]});filter:blur(6px);opacity:${frnd?.8:.5};z-index:0"></div>
    <div class="uc-ava" style="z-index:1;position:relative">${avatarHTML(u,56,{friend:true})}</div>
  </div>
  <div style="font-size:16px;font-weight:700">${esc(u.displayName||u.username)}${frnd?` <span style="font-size:11px;color:${cols[0]}">· ${t('profile.friends')}</span>`:''}</div>
  <div style="font-size:12px;color:var(--t2);margin-bottom:${u.bio?'6px':'12px'}">@${esc(u.username)}</div>
  ${u.bio?`<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:12px">${esc(u.bio)}</div>`:''}
  ${isUserPrivate(uid)?`<div style="font-size:11px;color:var(--t3);margin-bottom:8px">🔒 Закритий акаунт</div>`:''}
  <div style="display:flex;gap:20px;margin-bottom:14px">
    <div><div style="font-size:14px;font-weight:700">${uPosts}</div><div style="font-size:10px;color:var(--t2)">постів</div></div>
    <div><div style="font-size:14px;font-weight:700">${followers}</div><div style="font-size:10px;color:var(--t2)">${t('profile.followers')}</div></div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="uc-follow-btn${btnCls?' '+btnCls:''}" id="ucfb" onclick="toggleFollowUser('${uid}',this)">${btnTxt}</button>
    <button onclick="closeModal('modal-user');renderFullProfile('${uid}')" style="padding:9px 14px;border-radius:9px;background:var(--s2);border:1px solid var(--b2);color:var(--t1);font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap">Весь профіль →</button>
  </div>
</div>`;
  openModal('modal-user');
}

// ── Follow requests screen ────────────────────────────────
function showFollowRequestsScreen() {
  const c = document.getElementById('feed-container');
  c.innerHTML = `
<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--b1)">
  <button onclick="renderProfile(APP.user.id)" style="background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;padding:0 6px 0 0">←</button>
  <span style="font-size:15px;font-weight:700">${t('profile.followRequests')}</span>
</div>
<div id="follow-requests-screen" style="padding:8px 0"></div>`;
  renderFollowRequests();
}

// Mood change
function changeMood() {
  localStorage.removeItem('era_mood_'+todayKey());
  APP.mood=null; selMood=null;
  renderMoodGrid();
  document.getElementById('mood-confirm')?.classList.remove('ready');
  document.getElementById('mood-screen').classList.remove('hidden');
}
