// js/social.js — Privacy, Friends, Follow Requests, Pins

function isFriend(uid) {
  return FOLLOWS.get(uid)==='following' && FOLLOWERS.get(uid)===true;
}

function getFriendIds() {
  const ids=[];
  FOLLOWS.forEach((status,uid)=>{ if(status==='following'&&FOLLOWERS.get(uid)===true) ids.push(uid); });
  return ids;
}

// ── Follow / Unfollow ─────────────────────────────────────
// Підписка на користувача (враховуючи приватність)
// Всі мутації асинхронні для майбутньої інтеграції з Supabase
async function followUser(uid) {
  const user = getUser(uid);
  const isPrivate = user?.privacy === 'private';

  if (isPrivate) {
    // Для приватних акаунтів створюємо запит
    FOLLOWS.set(uid, 'requested');
    await saveFollowsToStorage();
    addNotif({ type: 'request', fromUid: APP.user.id, toUid: uid });
    showToast(t('social.requestSent', { user: user.username }));
  } else {
    // Для публічних — миттєва підписка
    FOLLOWS.set(uid, 'following');
    await saveFollowsToStorage();
    
    // Якщо підписка взаємна — вони тепер друзі
    if (FOLLOWERS.get(uid) === true) {
      showToast(t('social.nowFriends', { user: user.username }));
    } else {
      showToast(t('social.followedPublic', { user: user.username }));
    }
    if (APP.view === 'explore') renderExplore(document.getElementById('explore-inp')?.value || '');
    renderRightPanel();
  }
}

// Відписка від користувача
async function unfollowUser(uid) {
  const user = getUser(uid);
  FOLLOWS.delete(uid);
  await saveFollowsToStorage();
  showToast(t('social.unfollowed', { user: user?.username || uid }));
  
  if (APP.view === 'explore') renderExplore(document.getElementById('explore-inp')?.value || '');
  renderRightPanel();
}

// Скасування запиту на підписку
async function cancelFollowRequest(uid) {
  FOLLOWS.delete(uid);
  await saveFollowsToStorage();
  _removeRequestNotif(uid);
  showToast(t('social.requestCancelled'));
}

function _removeRequestNotif(fromUid) {
  const before=NOTIFS.length;
  // Видаляємо всі нотіфікації про запити від цього юзера
  NOTIFS.splice(0, NOTIFS.length, ...NOTIFS.filter(n=>!(n.userId===fromUid&&n.type==='request')));
  if (NOTIFS.length!==before) renderNotifBadge();
}

// Перемикач підписки (для кнопок)
async function toggleFollowUser(uid, btn) {
  const status=getFollowStatus(uid);
  if (status==='following') {
    await unfollowUser(uid);
    if (btn){btn.textContent=t('profile.follow');btn.classList.remove('on');}
  } else if (status==='requested') {
    await cancelFollowRequest(uid);
    if (btn){btn.textContent=t('profile.follow');btn.classList.remove('requested');}
  } else {
    await followUser(uid);
    const user=getUser(uid);
    if (btn){
      if (user?.privacy==='private'){btn.textContent=t('profile.requested');btn.classList.add('requested');}
      else{btn.textContent=t('profile.youFollow');btn.classList.add('on');}
    }
  }
}

// ── Approve / Decline (Дворівневе схвалення) ──────────────
// Action 1: "Дозволити перегляд". Користувач стає підписником.
// Це дає доступ до перегляду постів та медіа-коментарів.
async function approveRequest(fromUid) {
  // Майбутній Supabase: await supabase.from('permissions').update({ is_follower: true }).match({ user_id: APP.user.id, target_id: fromUid });
  FOLLOWERS.set(fromUid, true);
  REQUESTS.delete(fromUid);

  // Оновлюємо статус у списку сповіщень для розблокування Action 2
  const n = NOTIFS.find(x => x.userId === fromUid && x.type === 'request');
  if (n) n._approved = true;

  // Надсилаємо сповіщення про схвалення (Action 1 завершено)
  addNotif({ type: 'approved', fromUid: APP.user.id, toUid: fromUid });
  showToast(t('profile.requestApproved'));

  // Оновлюємо інтерфейс для відображення змін
  if (document.getElementById('follow-requests-screen')) renderFollowRequests();
  if (APP.profileUid === APP.user?.id || APP.profileUid === fromUid) renderProfile(APP.profileUid);
  if (APP.view === 'notif') renderNotif();
  renderNotifBadge();
}

// Action 2: "+ Підписатися у відповідь". Стає доступною лише після Action 1.
// Коли підписка стає взаємною, статус автоматично змінюється на "Друзі".
async function followBack(uid) {
  // Перевіряємо, чи вже дозволено перегляд (Action 1)
  if (!FOLLOWERS.has(uid)) {
    console.warn("Потрібно спочатку дозволити перегляд");
    return;
  }

  await followUser(uid);
  // Після взаємної підписки isFriend(uid) поверне true
  if (APP.view === 'notif') renderNotif();
  if (APP.view === 'profile') renderProfile(APP.profileUid);
}

async function declineRequest(fromUid) {
  REQUESTS.delete(fromUid);
  // Remove ALL notifications related to this request — no notification to requester
  _removeRequestNotif(fromUid);
  if (document.getElementById('follow-requests-screen')) renderFollowRequests();
  renderNotifBadge();
}

function renderFollowRequests() {
  const container=document.getElementById('follow-requests-screen'); if(!container) return;
  const requests=[...REQUESTS.values()];
  if (!requests.length) {
    container.innerHTML=`<div class="empty-state"><div class="empty-ico">✉️</div><div class="empty-txt">${t('profile.noRequests')}</div></div>`;
    return;
  }
  container.innerHTML=requests.map(user=>`
    <div class="req-item" id="req-${user.id}">
      <div class="req-ava" onclick="openUserCard('${user.id}')">${avatarHTML(user,42)}</div>
      <div class="req-info" onclick="openUserCard('${user.id}')">
        <div class="req-name">@${esc(user.username)}</div>
        <div class="req-bio">${esc(user.displayName||'')}</div>
      </div>
      <div class="req-actions">
        <button class="req-approve" onclick="approveRequest('${user.id}');document.getElementById('req-${user.id}').remove()">${t('profile.approve')}</button>
        <button class="req-decline" onclick="declineRequest('${user.id}');document.getElementById('req-${user.id}').remove()">${t('profile.decline')}</button>
      </div>
    </div>`).join('');
}

function getRequestCount() { return REQUESTS.size; }

// ── Pins ─────────────────────────────────────────────────
const MAX_PINS=3;

function getPinnedPosts(uid) {
  const u=uid===APP.user?.id?APP.user:getUser(uid);
  return (u?.pinnedPosts||[]).filter(pid=>POSTS.find(p=>p.id===pid));
}

// Закріплення поста (макс 3 — Module 5)
async function pinPost(pid) {
  if (!APP.user) return;
  const pinned = APP.user.pinnedPosts || [];
  if (pinned.includes(pid)) return;

  // Якщо вже 3 закріплено — показуємо модальне вікно заміни (Module 5)
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

// Відкріплення
async function unpinPost(pid) {
  if (!APP.user) return;
  APP.user.pinnedPosts=(APP.user.pinnedPosts||[]).filter(id=>id!==pid);
  const p=POSTS.find(x=>x.id===pid); if(p) p.pinned=false;
  await saveUserData();
  showToast(t('post.unpinned'));
  if (APP.view==='profile') renderProfile(APP.user.id);
}

// Швидке модальне вікно для заміни закріпленого поста (Module 5)
function showPinReplaceDialog(newPid) {
  const pinned = getPinnedPosts(APP.user.id);
  const lb = document.createElement('div');
  lb.id = 'pin-replace-dialog';
  lb.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease';

  // Інтеграція з History API
  eraPush('pin-replace');

  lb.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--b2);border-radius:24px;padding:28px;width:100%;max-width:400px;box-shadow:0 15px 50px rgba(0,0,0,0.8)">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;text-align:center">${t('post.pinLimit')}</div>
      <div style="font-size:13px;color:var(--t2);margin-bottom:24px;text-align:center;line-height:1.5">${t('post.pinLimitHint')}</div>
      <div style="display:flex;gap:12px;margin-bottom:24px">
        ${pinned.map(pid => {
          const p = POSTS.find(x => x.id === pid), u = getUser(p?.userId || '');
          const bg = postGrad(u), imgs = getPostImages(p);
          return `<div style="flex:1;aspect-ratio:1;border-radius:12px;overflow:hidden;cursor:pointer;border:2px solid var(--b1);transition:all .2s ease"
            onclick="replacePinWith('${pid}','${newPid}');eraBack()"
            onmouseover="this.style.borderColor='var(--blue)';this.style.transform='scale(1.05)'"
            onmouseout="this.style.borderColor='var(--b1)';this.style.transform='scale(1)'">
            ${imgs && imgs[0] ? `<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover">` :
            `<div style="width:100%;height:100%;background:${bg}"></div>`}
          </div>`;
        }).join('')}
      </div>
      <button onclick="eraBack()" style="width:100%;padding:12px;border-radius:12px;background:var(--s2);border:1px solid var(--b2);color:var(--t1);font-size:14px;font-weight:600;cursor:pointer;transition:background .15s">Скасувати</button>
    </div>`;

  lb.addEventListener('click', e => { if (e.target === lb) eraBack(); });
  document.body.appendChild(lb);
}

// Заміна одного закріпленого поста іншим
async function replacePinWith(oldPid,newPid) {
  if (!APP.user) return;
  const pinned=APP.user.pinnedPosts||[];
  const idx=pinned.indexOf(oldPid);
  if(idx>=0) pinned[idx]=newPid;

  APP.user.pinnedPosts=pinned;
  const oldP=POSTS.find(x=>x.id===oldPid); if(oldP) oldP.pinned=false;
  const newP=POSTS.find(x=>x.id===newPid); if(newP) newP.pinned=true;

  await saveUserData();
  showToast(t('post.pinned'));
  if (APP.view==='profile') renderProfile(APP.user.id);
}

// ── Notification helper ───────────────────────────────────
function addNotif(opts) {
  // Prevent duplicate request notifications
  if (opts.type==='request') {
    const exists=NOTIFS.find(n=>n.userId===opts.fromUid&&n.type==='request');
    if (exists) return;
  }
  const notif={id:'n_'+Date.now(),userId:opts.fromUid,type:opts.type,
    postId:opts.postId||null,text:opts.text||null,unread:true,ts:Date.now()};
  NOTIFS.unshift(notif);
  renderNotifBadge();
}
