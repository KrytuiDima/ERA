// js/main.js — App init, navigation, explore, right panel, mood

// ── Views ─────────────────────────────────────────────────
function setView(v) {
  APP.view = v;
  if (v !== 'profile') APP.profileUid = null;
  ['feed','explore','notif','profile','settings'].forEach(k => {
    document.getElementById('nb-'+k)?.classList.toggle('active', k===v);
    document.getElementById('bn-'+k)?.classList.toggle('active', k===v);
  });
  document.getElementById('feed-header').style.display = v==='feed' ? '' : 'none';
  if      (v==='feed')     renderFeed();
  else if (v==='explore')  renderExplore('');
  else if (v==='notif')    renderNotif();
  else if (v==='profile')  { APP.profileUid=APP.user.id; renderProfile(APP.user.id); }
  else if (v==='settings') renderSettings();
}

// ── Explore ───────────────────────────────────────────────
function renderExplore(q) {
  const sq = q.toLowerCase();
  const stored = JSON.parse(localStorage.getItem('era_users')||'[]');
  const all = [...SU, ...stored.filter(u=>!SU.find(s=>s.id===u.id))];
  const filtered = sq ? all.filter(u=>u.username.toLowerCase().includes(sq)||(u.displayName||'').toLowerCase().includes(sq)) : all;

  const myVibe = currentVibeColor(APP.user || {baseColor:'#00c6ff'});
  const myCols = vibeColors(myVibe, hashStr(APP.user?.id || 'me'));

  document.getElementById('feed-container').innerHTML = `
<div style="padding:12px 12px 6px">
  <input class="explore-inp" id="explore-inp" placeholder="${t('explore.placeholder')}" value="${esc(q)}" oninput="renderExplore(this.value)">
</div>
${filtered.length===0
  ? `<div class="empty-state"><div class="empty-ico">🔍</div><div class="empty-txt">${t('explore.notFound')}</div></div>`
  : `<div style="padding: 4px; display: flex; flex-direction: column; gap: 4px">
    ${filtered.map(u => {
      const frnd = isFriend(u.id);
      const isF = getFollowStatus(u.id) === 'following';
      const isReq = getFollowStatus(u.id) === 'requested';
      const cols = vibeColors(u.baseColor, hashStr(u.id));

      let statusTxt = '';
      if (frnd) statusTxt = t('profile.friends');
      else if (isF) statusTxt = t('profile.youFollow');
      else if (isReq) statusTxt = t('profile.requested');

      return `<div class="rp-user" style="background: var(--s1); border: 1px solid var(--b1); padding: 12px" onclick="openUserCard('${u.id}')">
        <div style="width:44px;height:44px;flex-shrink:0;position:relative">
          ${avatarHTML(u,44,{friend:true})}
          ${isUserPrivate(u.id)?`<div style="position:absolute;bottom:-2px;right:-2px;font-size:10px;background:var(--s2);border-radius:50%;padding:2px">🔒</div>`:''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--t1)">@${esc(u.username)}</div>
          <div style="font-size:12px;color:var(--t2)">${esc(u.displayName||'')}</div>
          ${statusTxt ? `<div style="font-size:10px; color:${frnd ? myCols[0] : 'var(--t3)'}; margin-top:2px">${statusTxt}</div>` : ''}
        </div>
        <div style="width:60px;height:30px;border-radius:4px;overflow:hidden;border:1px solid var(--b1)">
          ${makeVibeCode(u.baseColor, u.id, 60, 30)}
        </div>
      </div>`;
    }).join('')}
  </div>`}`;
  const inp = document.getElementById('explore-inp');
  if (inp && q) { const l=q.length; inp.setSelectionRange(l,l); }
}

// ── Right panel ───────────────────────────────────────────
function renderRightPanel() {
  const sugg = [...SU,...JSON.parse(localStorage.getItem('era_users')||'[]')]
    .filter(u=>u&&u.id!==APP.user?.id&&getFollowStatus(u.id)!=='following').slice(0,5);

  document.getElementById('rp-suggest').innerHTML = sugg.map(u => {
    const frnd = isFriend(u.id), cols=vibeColors(u.baseColor,hashStr(u.id));
    return `<div class="rp-user" onclick="openUserCard('${u.id}')">
    <div style="width:36px;height:36px;flex-shrink:0;position:relative">
      ${avatarHTML(u,36,{friend:true})}
      ${isUserPrivate(u.id)?`<div style="position:absolute;bottom:-1px;right:-1px;font-size:9px;background:var(--s2);border-radius:50%;padding:1px">🔒</div>`:''}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--t1)">@${esc(u.username)}</div>
      <div style="font-size:11px;color:var(--t2)">${esc(u.displayName||'')}</div>
    </div>
    <button class="rp-follow" id="rpfb-${u.id}" onclick="event.stopPropagation();_rpFollow('${u.id}',this)">${t('rp.follow')}</button>
  </div>`}).join('');

  const specs = [
    {name:'Neon Cyan',color:'#00ffcc',cnt:'2.4к'},
    {name:'Ultra Violet',color:'#6600ff',cnt:'1.8к'},
    {name:'Blood Orange',color:'#ff4400',cnt:'1.2к'},
    {name:'Ice Blue',color:'#007aff',cnt:'980'},
    {name:'Acid Green',color:'#39ff14',cnt:'756'},
  ];
  document.getElementById('rp-spectrums').innerHTML = specs.map(s => `
  <div class="rp-spec">
    <div class="rp-spec-bar">${makeVibeCode(s.color,s.name,44,28)}</div>
    <div><div style="font-size:12px;font-weight:500;color:var(--t1)">${s.name}</div><div style="font-size:10px;color:var(--t2)">${s.cnt} юзерів</div></div>
  </div>`).join('');
}

function _rpFollow(uid, btn) {
  toggleFollowUser(uid, btn);
  setTimeout(renderRightPanel, 300);
}

// ── Mood screen ───────────────────────────────────────────
let selMood = null;

function renderMoodGrid() {
  document.getElementById('mood-grid').innerHTML = MOODS.map(m => `
    <button class="mood-btn" id="mb-${m.id}" onclick="_selMood('${m.id}','${m.color}')">
      <span class="mood-emoji">${m.emoji}</span>
      <span class="mood-label">${t('mood.moods.'+m.id)}</span>
    </button>`).join('');
}

function _selMood(id, color) {
  selMood = id;
  document.querySelectorAll('.mood-btn').forEach(b=>{b.classList.remove('sel');b.style.borderColor='';b.style.color='';});
  const btn = document.getElementById('mb-'+id);
  if (btn) { btn.classList.add('sel'); btn.style.borderColor=color; btn.style.color=color; }
  document.getElementById('mood-confirm').classList.add('ready');
}

function confirmMood() {
  if (!selMood) return;
  APP.mood = selMood;
  localStorage.setItem('era_mood_'+todayKey(), selMood);
  saveMoodHist(selMood);
  document.getElementById('mood-screen').classList.add('hidden');
  // If app already booted (mood change from profile), update and re-render
  if (!document.getElementById('app').classList.contains('hidden')) {
    showToast(t('mood.saved',{emoji:MOODS.find(m=>m.id===selMood)?.emoji||''}));
    if (APP.view==='profile') renderProfile(APP.user.id);
    else renderFeed();
  } else {
    bootApp();
  }
}

function skipMood() {
  document.getElementById('mood-screen').classList.add('hidden');
  bootApp();
}

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Push base history state
  history.replaceState({era:'base',depth:0},'',location.href.split('#')[0]);

  // Restore session
  const saved = localStorage.getItem('era_session');
  if (saved) {
    try {
      APP.user = JSON.parse(saved);
      document.getElementById('auth-screen').classList.add('hidden');
      const tm = localStorage.getItem('era_mood_'+todayKey());
      if (tm) { APP.mood=tm; bootApp(); }
      else if (APP.user.settings?.moodPrompt!==false) { renderMoodGrid(); document.getElementById('mood-screen').classList.remove('hidden'); }
      else bootApp();
    } catch(e) { localStorage.removeItem('era_session'); }
  }

  // Auth enter keys
  updateVibePrev();
  document.getElementById('l-pass')?.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('l-user')?.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('r-pass')?.addEventListener('keydown', e=>{ if(e.key==='Enter') doRegister(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') eraBack();
    if (document.getElementById('lightbox')) {
      if (e.key==='ArrowRight'||e.key==='ArrowDown')  lbNav(1);
      else if (e.key==='ArrowLeft'||e.key==='ArrowUp') lbNav(-1);
    }
  });

  // Close context menu on outside interaction
  document.addEventListener('click',      e=>{ const m=document.getElementById('ctx-m'); if(m&&!m.contains(e.target))m.remove(); });
  document.addEventListener('touchstart', e=>{ const m=document.getElementById('ctx-m'); if(m&&!m.contains(e.target))m.remove(); },{passive:true});

  // Drag-drop upload
  const zone = document.getElementById('upload-zone');
  if (zone) {
    zone.addEventListener('dragover',  e=>{ e.preventDefault(); zone.style.borderColor='#00c6ff'; });
    zone.addEventListener('dragleave', ()=>zone.style.borderColor='');
    zone.addEventListener('drop', e=>{
      e.preventDefault(); zone.style.borderColor='';
      const f=e.dataTransfer.files; if(f.length) onPostFile({target:{files:f,value:''}});
    });
  }

  // Toast offset for mobile
  const isM = ()=>window.innerWidth<=768;
  if (isM()) document.getElementById('toasts').style.bottom='80px';
  window.addEventListener('resize', ()=>document.getElementById('toasts').style.bottom=isM()?'80px':'24px');
});
