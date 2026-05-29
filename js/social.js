// js/social.js — Privacy, Friends, Follow Requests, Pins

/**
 * Перевіряє, чи є користувач другом (взаємна підписка)
 */
function isFriend(uid) {
  return FOLLOWS.get(uid) === 'following' && FOLLOWERS.get(uid) === true;
}

function getFriendIds() {
  const ids = [];
  FOLLOWS.forEach((status, uid) => {
    if (status === 'following' && FOLLOWERS.get(uid) === true) ids.push(uid);
  });
  return ids;
}

// ── Підписка / Відписка (Async для майбутнього Supabase) ──────────────────

/**
 * Підписатися на користувача
 */
async function followUser(uid) {
  const user = getUser(uid);
  const isPrivate = user?.privacy === 'private';

  if (isPrivate) {
    FOLLOWS.set(uid, 'requested');
    saveFollowsToStorage();
    // Додаємо лише одне сповіщення про запит
    const already = NOTIFS.find(n => n.userId === APP.user.id && n.type === 'request' && !n._processed);
    if (!already) addNotif({ type: 'request', fromUid: APP.user.id, toUid: uid });
    showToast(t('social.requestSent', { user: user.username }));
  } else {
    FOLLOWS.set(uid, 'following');
    saveFollowsToStorage();
    const wasFollowedBack = FOLLOWERS.get(uid) === true;
    if (wasFollowedBack) {
      showToast(t('social.nowFriends', { user: user.username }));
    } else {
      showToast(t('social.followedPublic', { user: user.username }));
    }
    renderRightPanel();
  }
}

/**
 * Відписатися від користувача
 */
async function unfollowUser(uid) {
  const user = getUser(uid);
  FOLLOWS.delete(uid);
  saveFollowsToStorage();
  showToast(t('social.unfollowed', { user: user?.username || uid }));
  renderRightPanel();
}

/**
 * Скасувати запит на підписку
 */
async function cancelFollowRequest(uid) {
  FOLLOWS.delete(uid);
  saveFollowsToStorage();
  _removeRequestNotif(uid);
  showToast(t('social.requestCancelled'));
}

function _removeRequestNotif(fromUid) {
  const before = NOTIFS.length;
  NOTIFS.splice(0, NOTIFS.length, ...NOTIFS.filter(n => !(n.userId === fromUid && n.type === 'request')));
  if (NOTIFS.length !== before) renderNotifBadge();
}

/**
 * Перемикач підписки (використовується в кнопках)
 */
async function toggleFollowUser(uid, btn) {
  const status = getFollowStatus(uid);
  if (status === 'following') {
    await unfollowUser(uid);
    if (btn) { btn.textContent = t('profile.follow'); btn.classList.remove('on'); }
  } else if (status === 'requested') {
    await cancelFollowRequest(uid);
    if (btn) { btn.textContent = t('profile.follow'); btn.classList.remove('requested'); }
  } else {
    await followUser(uid);
    const user = getUser(uid);
    if (btn) {
      if (user?.privacy === 'private') { btn.textContent = t('profile.requested'); btn.classList.add('requested'); }
      else { btn.textContent = t('profile.youFollow'); btn.classList.add('on'); }
    }
  }
}

// ── Схвалення / Відхилення запитів ──────────────────────────

/**
 * Дія 1: Дозволити перегляд (користувач стає підписником)
 */
async function approveRequest(fromUid) {
  FOLLOWERS.set(fromUid, true);
  REQUESTS.delete(fromUid);
  _removeRequestNotif(fromUid);
  addNotif({ type: 'approved', fromUid: APP.user.id, toUid: fromUid });
  showToast(t('profile.requestApproved'));

  // Оновлюємо UI залежно від поточного екрану
  if (document.getElementById('follow-requests-screen')) renderFollowRequests();
  if (APP.view === 'profile') renderProfile(APP.profileUid);
  if (APP.view === 'notif') renderNotif();
  renderNotifBadge();
}

/**
 * Дія 2: Підписатися у відповідь (після Дії 1 для статусу Друзі)
 */
async function followBack(uid) {
  await followUser(uid);
  if (APP.view === 'notif') renderNotif();
}

/**
 * Відхилити запит на підписку
 */
async function declineRequest(fromUid) {
  REQUESTS.delete(fromUid);
  _removeRequestNotif(fromUid);
  if (document.getElementById('follow-requests-screen')) renderFollowRequests();
  renderNotifBadge();
}

function renderFollowRequests() {
  const container = document.getElementById('follow-requests-screen'); if (!container) return;
  const requests = [...REQUESTS.values()];
  if (!requests.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-ico">✉️</div><div class="empty-txt">${t('profile.noRequests')}</div></div>`;
    return;
  }
  container.innerHTML = requests.map(user => `
    <div class="req-item" id="req-${user.id}">
      <div class="req-ava" onclick="openUserCard('${user.id}')">${avatarHTML(user, 42)}</div>
      <div class="req-info" onclick="openUserCard('${user.id}')">
        <div class="req-name">@${esc(user.username)}</div>
        <div class="req-bio">${esc(user.displayName || '')}</div>
      </div>
      <div class="req-actions">
        <button class="req-approve" onclick="approveRequest('${user.id}');document.getElementById('req-${user.id}').remove()">${t('profile.approve')}</button>
        <button class="req-decline" onclick="declineRequest('${user.id}');document.getElementById('req-${user.id}').remove()">${t('profile.decline')}</button>
      </div>
    </div>`).join('');
}

function getRequestCount() { return REQUESTS.size; }

// ── Система закріплених постів (Pin System) ────────────────

const MAX_PINS = 3;

function getPinnedPosts(uid) {
  const u = uid === APP.user?.id ? APP.user : getUser(uid);
  return (u?.pinnedPosts || []).filter(pid => POSTS.find(p => p.id === pid));
}

/**
 * Закріпити пост (ліміт 3)
 */
async function pinPost(pid) {
  if (!APP.user) return;
  const pinned = APP.user.pinnedPosts || [];
  if (pinned.includes(pid)) return;

  if (pinned.length >= MAX_PINS) {
    showPinReplaceDialog(pid);
    return;
  }

  APP.user.pinnedPosts = [pid, ...pinned];
  const p = POSTS.find(x => x.id === pid); if (p) p.pinned = true;
  await saveUserData();
  showToast(t('post.pinned'));
  if (APP.view === 'profile') renderProfile(APP.user.id);
}

/**
 * Відкріпити пост
 */
async function unpinPost(pid) {
  if (!APP.user) return;
  APP.user.pinnedPosts = (APP.user.pinnedPosts || []).filter(id => id !== pid);
  const p = POSTS.find(x => x.id === pid); if (p) p.pinned = false;
  await saveUserData();
  showToast(t('post.unpinned'));
  if (APP.view === 'profile') renderProfile(APP.user.id);
}

/**
 * Модальне вікно для заміни закріпленого поста
 */
function showPinReplaceDialog(newPid) {
  const pinnedIds = getPinnedPosts(APP.user.id);
  const lb = document.createElement('div'); lb.id = 'pin-replace-dialog';
  lb.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease';

  lb.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--b2);border-radius:20px;padding:24px;width:100%;max-width:380px">
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">${t('post.pinLimit')}</div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:18px">${t('post.pinLimitHint')}</div>
      <div style="display:flex;gap:10px;margin-bottom:18px">
        ${pinnedIds.map(pid => {
          const p = POSTS.find(x => x.id === pid), u = getUser(p?.userId || '');
          const bg = postGrad(u), imgs = getPostImages(p);
          return `<div style="flex:1;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border .18s"
            onclick="replacePinWith('${pid}','${newPid}');document.getElementById('pin-replace-dialog').remove()"
            onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='transparent'">
            ${imgs && imgs[0] ? `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover">` :
            `<div style="width:100%;height:100%;background:${bg}"></div>`}
          </div>`;
        }).join('')}
      </div>
      <button onclick="document.getElementById('pin-replace-dialog').remove()" style="width:100%;padding:10px;border-radius:9px;background:var(--s2);border:1px solid var(--b1);color:var(--t2);font-size:13px;font-weight:600;cursor:pointer">Скасувати</button>
    </div>`;

  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
}

async function replacePinWith(oldPid, newPid) {
  if (!APP.user) return;
  const pinned = APP.user.pinnedPosts || [];
  const idx = pinned.indexOf(oldPid); if (idx >= 0) pinned[idx] = newPid;
  APP.user.pinnedPosts = pinned;
  const oldP = POSTS.find(x => x.id === oldPid); if (oldP) oldP.pinned = false;
  const newP = POSTS.find(x => x.id === newPid); if (newP) newP.pinned = true;
  await saveUserData();
  showToast(t('post.pinned'));
  if (APP.view === 'profile') renderProfile(APP.user.id);
}

// ── Сповіщення ─────────────────────────────────────────────

function addNotif(opts) {
  if (opts.type === 'request') {
    const exists = NOTIFS.find(n => n.userId === opts.fromUid && n.type === 'request');
    if (exists) return;
  }
  const notif = {
    id: 'n_' + Date.now(),
    userId: opts.fromUid,
    type: opts.type,
    postId: opts.postId || null,
    text: opts.text || null,
    unread: true,
    ts: Date.now()
  };
  NOTIFS.unshift(notif);
  renderNotifBadge();
}
