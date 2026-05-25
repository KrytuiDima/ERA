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

  document.getElementById('feed-container').innerHTML = `
<div style="padding:12px 12px 6px">
  <input class="explore-inp" id="explore-inp" placeholder="${t('explore.placeholder')}" value="${esc(q)}" oninput="renderExplore(this.value)">
</div>
${filtered.length===0
  ? `<div class="empty-state"><div class="empty-ico">🔍</div><div class="empty-txt">${t('explore.notFound')}</div></div>`
  : `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:4px">
    ${filtered.map(u => {
      const bg = postGrad(u);
      const uPosts = POSTS.filter(p=>p.userId===u.id);
      const firstImg = uPosts.length>0 ? (getPostImages(uPosts[0])||[])[0] : null;
      const frnd = isFriend(u.id);
      const cols = vibeColors(u.baseColor, hashStr(u.id));
      return `<div style="aspect-ratio:1;overflow:hidden;cursor:pointer;position:relative;background:${bg}" onclick="openUserCard('${u.id}')">
        ${firstImg ? `<img src="${firstImg}" style="width:100%;height:100%;object-fit:cover;display:block">` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 55%)"></div>
        ${frnd?`<div style="position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:${cols[0]};box-shadow:0 0 5px ${cols[0]}"></div>`:''}
        ${isUserPrivate(u.id)?`<div style="position:absolute;top:5px;left:5px;font-size:10px">🔒</div>`:''}
        <div style="position:absolute;bottom:6px;left:6px;display:flex;align-items:center;gap:5px">
          <div style="width:20px;height:20px;border-radius:50%;overflow:hidden">${avatarHTML(u,20)}</div>
          <span style="font-size:10px;color:#fff;font-weight:500">@${esc(u.username)}</span>
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
