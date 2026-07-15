// js/auth.js — Авторизація та реєстрація

function authTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((el, i) => el.classList.toggle('active', tab === 'login' ? i === 0 : i === 1));
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-reg').classList.toggle('hidden', tab !== 'reg');
  if (tab === 'reg') updateVibePrev();
}

/**
 * Обробка завантаження аватара при реєстрації з автоматичним кропом 1:1
 */
function onRegAva(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    // Відкриваємо Студіо для аватара
    openStudio(ev.target.result, cropped => {
      regAvaData = cropped;
      document.getElementById('reg-ava-img').src = regAvaData;
      document.getElementById('reg-ava-img').classList.remove('hidden');
      document.getElementById('reg-ava-plus').classList.add('hidden');
    }, { ratio: 1, round: true });
  };
  r.readAsDataURL(f);
}

function updateVibePrev() {
  const color = document.getElementById('r-color')?.value || '#00c6ff';
  const uid = document.getElementById('r-user')?.value || 'preview';
  const el = document.getElementById('r-vibe-strip'); if (!el) return;
  el.innerHTML = makeVibeCode(color, uid, 300, 44);
  const svg = el.querySelector('svg'); if (svg) { svg.style.width = '100%'; svg.style.height = '44px'; }
  el.insertAdjacentHTML('beforeend', '<div class="vibe-strip-lbl">VIBE CODE</div>');
}

function cleanUsername(input) {
  input.value = input.value.replace(/[^a-zA-Z0-9._]/g, '');
}

function _isUsernameTaken(username) {
  if (SU.find(u => u.username === username)) return true;
  const users = JSON.parse(localStorage.getItem('era_users') || '[]');
  if (users.find(u => u.username === username)) return true;
  return false;
}

/**
 * Вхід в акаунт
 */
async function doLogin() {
  const u = document.getElementById('l-user').value.replace('@', '').trim();
  const p = document.getElementById('l-pass').value;
  const err = document.getElementById('l-err');
  
  if (!u || !p) { err.textContent = t('auth.enterCredentials'); return; }
  
  const users = JSON.parse(localStorage.getItem('era_users') || '[]');
  const found = users.find(x => x.username === u && x.password === p);
  
  if (found) { startSession(found); return; }
  
  // Демо-вхід
  if (u === 'demo' && p === 'demo') {
    startSession({
      id: 'demo', username: 'demo', displayName: 'Demo User', bio: 'Тестовий акаунт ERA',
      avatar: null, baseColor: '#00c6ff', password: 'demo', settings: { moodPrompt: true }, pinnedPosts: []
    });
    return;
  }
  err.textContent = t('auth.wrongCredentials');
}

/**
 * Реєстрація нового користувача (Async для майбутнього Supabase)
 */
async function doRegister() {
  const dname = document.getElementById('r-dname').value.trim();
  const u = document.getElementById('r-user').value.replace('@', '').trim();
  const p = document.getElementById('r-pass').value;
  const c = document.getElementById('r-color').value;
  const err = document.getElementById('r-err');
  
  if (!dname) { err.textContent = t('auth.enterDisplayName'); return; }
  if (u.length < 2) { err.textContent = t('auth.usernameMin'); return; }
  if (!/^[a-zA-Z0-9._]+$/.test(u)) { err.textContent = t('auth.usernameInvalid'); return; }
  if (p.length < 4) { err.textContent = t('auth.passwordMin'); return; }
  if (_isUsernameTaken(u)) { err.textContent = t('auth.usernameTaken'); return; }
  
  const nu = {
    id: 'u_' + Date.now(),
    username: u,
    displayName: dname,
    bio: '', website: '', banner: null, avatar: regAvaData || null,
    baseColor: c, password: p, settings: { moodPrompt: true },
    privacy: 'public', pinnedPosts: []
  };
  
  const users = JSON.parse(localStorage.getItem('era_users') || '[]');
  users.push(nu);
  localStorage.setItem('era_users', JSON.stringify(users));
  
  startSession(nu);
}

function startSession(user) {
  APP.user = user;
  localStorage.setItem('era_session', JSON.stringify(user));
  document.getElementById('auth-screen').classList.add('hidden');
  history.replaceState({ era: 'base', depth: 0 }, '', location.href.split('#')[0]);
  _histDepth = 0;
  
  const tm = localStorage.getItem('era_mood_' + todayKey());
  if (tm) { APP.mood = tm; bootApp(); }
  else if (user.settings?.moodPrompt !== false) { renderMoodGrid(); document.getElementById('mood-screen').classList.remove('hidden'); }
  else bootApp();
}

/**
 * Запуск додатку після авторизації
 */
function bootApp() {
  document.getElementById('app').classList.remove('hidden');
  const u = APP.user;
  
  document.getElementById('sb-dname').textContent = u.displayName || u.username;
  document.getElementById('sb-handle').textContent = '@' + u.username;
  document.getElementById('sb-ava').innerHTML = avatarHTML(u, 34);
  document.getElementById('bn-ava').innerHTML = avatarHTML(u, 24);
  
  const saved = JSON.parse(localStorage.getItem('era_posts') || '[]');
  POSTS = [...saved, ...POSTS.filter(p => !saved.find(s => s.id === p.id))];
  
  loadFollowsFromStorage();
  
  // Демонстраційні дані
  if (u.id === 'demo') {
    FOLLOWS.set('u2', 'following'); FOLLOWERS.set('u2', true);
    FOLLOWS.set('u4', 'following');
  }
  
  renderFeed();
  renderRightPanel();
  renderNotifBadge();
}
