// js/settings.js — Сторінка налаштувань

/**
 * Рендерить сторінку налаштувань користувача
 */
function renderSettings() {
  const u = APP.user;
  const mp = u.settings?.moodPrompt !== false;
  const priv = u.settings?.private || false;
  const vibe = currentVibeColor(u);
  const cols = vibeColors(vibe, hashStr(u.id));
  const lang = getCurrentLang();

  document.getElementById('feed-container').innerHTML = `
<div style="padding-bottom:60px">
  <div class="settings-hdr">${t('settings.title')}</div>

  <!-- Профіль -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.profile')}</div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="s-ava-circle" onclick="document.getElementById('s-ava-f').click()">
        ${avatarHTML(u, 72)}
        <input type="file" id="s-ava-f" accept="image/*" class="hidden" onchange="changeAva(event)">
      </div>
      <div>
        <div style="font-size:14px;font-weight:600">${esc(u.displayName || u.username)}</div>
        <div style="font-size:12px;color:var(--t2)">@${esc(u.username)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px">${t('settings.clickToChangePhoto')}</div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div class="f-label">${t('settings.displayName')}</div>
      <input class="s-input" id="s-dname" value="${esc(u.displayName || '')}" placeholder="${t('settings.displayName')}">
    </div>
    <div style="margin-bottom:10px">
      <div class="f-label">${t('settings.username')} <span style="color:var(--t3);font-size:10px">${t('auth.usernameHint')}</span></div>
      <input class="s-input" id="s-username" value="${esc(u.username)}" placeholder="username" oninput="cleanUsername(this)">
    </div>
    <div style="margin-bottom:14px">
      <div class="f-label">${t('settings.bio')} <span style="color:var(--t3)">${t('settings.bioHint')}</span></div>
      <textarea class="s-input s-textarea" id="s-bio" maxlength="150" style="height:60px">${esc(u.bio || '')}</textarea>
    </div>
    <div style="margin-bottom:14px">
      <div class="f-label">Website (URL)</div>
      <input class="s-input" id="s-website" value="${esc(u.website || '')}" placeholder="https://…">
    </div>
    <button class="s-btn s-btn-save" onclick="saveProfile()">${t('settings.saveProfile')}</button>
  </div>

  <!-- Vibe (Налаштування кольору) -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.vibe')}</div>
    <div style="width:100%;height:70px;border-radius:12px;overflow:hidden;border:.5px solid var(--b2);margin-bottom:12px;position:relative" id="s-vibe-cov">
      <div style="position:absolute;inset:-15px;filter:blur(22px);transform:scale(1.2)">${makeVibeCode(vibe, u.id, 400, 70)}</div>
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.2)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.12em">${t('settings.vibePreview')}</div>
    </div>
    <div class="f-label">${t('settings.vibeColor')}</div>
    <div class="vibe-row" style="margin-top:6px;margin-bottom:14px">
      <input type="color" class="vibe-swatch" id="s-vibe-col" value="${vibe}" oninput="liveVibePreview()" onchange="liveVibePreview()">
      <div style="flex:1">
        <div style="font-size:12px;color:var(--t2)">${t('settings.vibeAutoHint')}</div>
        <div style="font-size:10px;font-family:var(--mono);color:var(--t3);margin-top:4px" id="s-vibe-cols">${cols.map(c => `<span style="color:${c}">${c}</span>`).join(' + ')}</div>
      </div>
    </div>
    <button class="s-btn s-btn-save" onclick="saveVibe()">${t('settings.updateVibe')}</button>
  </div>

  <!-- Персоналізація -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.personalization')}</div>
    <div class="settings-row">
      <div><div class="sr-label">${t('settings.dailyMood')}</div><div class="sr-sub">${t('settings.dailyMoodHint')}</div></div>
      <div class="toggle${mp ? ' on' : ''}" onclick="toggleSet('moodPrompt',this)"></div>
    </div>
  </div>

  <!-- Приватність -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.privacy')}</div>
    <div class="settings-row">
      <div><div class="sr-label">${t('settings.privateAccount')}</div><div class="sr-sub">${t('settings.privateAccountHint')}</div></div>
      <div class="toggle${priv ? ' on' : ''}" onclick="toggleSet('private',this)"></div>
    </div>
  </div>

  <!-- Мова -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.language')}</div>
    <div class="settings-row" style="cursor:pointer" onclick="showLangPicker()">
      <div>
        <div class="sr-label">${lang.flag} ${lang.name}</div>
        <div class="sr-sub">${lang.native}</div>
      </div>
      <button onclick="event.stopPropagation();showLangPicker()"
        style="padding:7px 16px;border-radius:20px;border:1px solid var(--b2);background:var(--s2);color:var(--t1);font-size:12px;font-weight:600;cursor:pointer;transition:all .14s;white-space:nowrap"
        onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='var(--s2)'">${t('settings.languageChange')} 🌐</button>
    </div>
  </div>

  <!-- Акаунт -->
  <div class="settings-sec">
    <div class="settings-sec-ttl">${t('settings.account')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="s-btn s-btn-outline" onclick="logout()">${t('settings.logout')}</button>
      <button class="s-btn s-btn-danger"  onclick="deleteAccount()">${t('settings.deleteAccount')}</button>
    </div>
  </div>
</div>`;
}

/**
 * Оновлює прев'ю Vibe в реальному часі при виборі кольору
 */
function liveVibePreview() {
  const color = document.getElementById('s-vibe-col')?.value; if (!color) return;
  const cv = document.getElementById('s-vibe-cov');
  if (cv) cv.innerHTML = `<div style="position:absolute;inset:-15px;filter:blur(22px);transform:scale(1.2)">${makeVibeCode(color, APP.user.id, 400, 70)}</div><div style="position:absolute;inset:0;background:rgba(0,0,0,.2)"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.12em">${t('settings.vibePreview')}</div>`;
  const cols = vibeColors(color, hashStr(APP.user.id));
  const el = document.getElementById('s-vibe-cols');
  if (el) el.innerHTML = cols.map(c => `<span style="color:${c}">${c}</span>`).join(' + ');
}

/**
 * Зберігає оновлені дані профілю (Module 5)
 */
async function saveProfile() {
  const dname = document.getElementById('s-dname').value.trim();
  const username = document.getElementById('s-username').value.replace('@', '').trim();
  const bio = document.getElementById('s-bio').value.trim();
  const website = document.getElementById('s-website').value.trim();
  
  if (!dname) { showToast(t('settings.fillRequired')); return; }
  if (username.length < 2) { showToast(t('auth.usernameMin')); return; }
  if (!/^[a-zA-Z0-9._]+$/.test(username)) { showToast(t('auth.usernameInvalid')); return; }
  
  APP.user.displayName = dname; 
  APP.user.username = username; 
  APP.user.bio = bio; 
  APP.user.website = website;
  
  await saveUserData();
  
  document.getElementById('sb-dname').textContent = dname;
  document.getElementById('sb-handle').textContent = '@' + username;
  showToast(t('settings.profileSaved'));
}

/**
 * Зберігає новий базовий колір Vibe
 */
async function saveVibe() {
  const color = document.getElementById('s-vibe-col')?.value; if (!color) return;
  APP.user.baseColor = color;
  localStorage.removeItem('era_mhist_' + APP.user.id);
  
  await saveUserData();
  
  document.getElementById('sb-ava').innerHTML = avatarHTML(APP.user, 34);
  document.getElementById('bn-ava').innerHTML = avatarHTML(APP.user, 24);
  showToast(t('settings.vibeSaved'));
  renderSettings();
}

/**
 * Перемикає налаштування (настрій, приватність)
 */
async function toggleSet(key, el) {
  if (!APP.user.settings) APP.user.settings = {};
  APP.user.settings[key] = !APP.user.settings[key];
  el.classList.toggle('on', APP.user.settings[key]);
  if (key === 'private') APP.user.privacy = APP.user.settings.private ? 'private' : 'public';
  await saveUserData();
}

function logout() {
  localStorage.removeItem('era_session');
  location.reload();
}

/**
 * Повне видалення акаунту
 */
async function deleteAccount() {
  if (!confirm(t('settings.deleteConfirm'))) return;
  const users = JSON.parse(localStorage.getItem('era_users') || '[]');
  localStorage.setItem('era_users', JSON.stringify(users.filter(u => u.id !== APP.user.id)));
  localStorage.removeItem('era_session');
  const saved = JSON.parse(localStorage.getItem('era_posts') || '[]');
  localStorage.setItem('era_posts', JSON.stringify(saved.filter(p => p.userId !== APP.user.id)));
  location.reload();
}
