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

// ── Approve / Decline ─────────────────────────────────────
// Схвалення запиту: Дія 1 — Дозволити перегляд (Action 1)
// Це дає користувачу статус підписника та доступ до контенту.
// Замість видалення запиту, ми міняємо його статус.
async function approveRequest(fromUid) {
  // Користувач тепер підписник
  FOLLOWERS.set(fromUid, true);

  // Оновлюємо статус у списку сповіщень для відображення Дії 2
  const n = NOTIFS.find(x => x.userId === fromUid && x.type === 'request');
  if (n) {
    n._approved = true;
    n.unread = false; // Позначаємо як прочитане при дії
  }

  // Надсилаємо сповіщення про схвалення
  addNotif({ type: 'approved', fromUid: APP.user.id, toUid: fromUid });
  showToast(t('profile.requestApproved'));

  // Оновлюємо інтерфейс
  if (document.getElementById('follow-requests-screen')) renderFollowRequests();
  if (APP.view === 'profile') renderProfile(APP.profileUid);
  if (APP.view === 'notif') renderNotif();
  renderNotifBadge();
}

// Крок 2 — Підписатися у відповідь (Action 2)
// Коли підписка стає взаємною, статус автоматично змінюється на "Друзі"
async function followBack(uid) {
  await followUser(uid);
  // Після підписки у відповідь запит можна вважати повністю опрацьованим
  REQUESTS.delete(uid);
  if (APP.view === 'notif') renderNotif();
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

// Закріплення поста (макс 3)
async function pinPost(pid) {
  if (!APP.user) return;
  const pinned=APP.user.pinnedPosts||[];
  if (pinned.includes(pid)) return;

  // Якщо вже 3 закріплено — показуємо модалку заміни
  if (pinned.length>=MAX_PINS){
    showPinReplaceDialog(pid);
    return;
  }

  APP.user.pinnedPosts=[pid,...pinned];
  const p=POSTS.find(x=>x.id===pid); if(p) p.pinned=true;
  await saveUserData();
  showToast(t('post.pinned'));
  if (APP.view==='profile') renderProfile(APP.user.id);
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

function showPinReplaceDialog(newPid) {
  const pinned=getPinnedPosts(APP.user.id);
  eraPush('pin-replace');
  const lb=document.createElement('div'); lb.id='pin-replace-dialog';
  lb.style.cssText='position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease';
  lb.innerHTML=`
    <div style="background:var(--s1);border:1px solid var(--b2);border-radius:20px;padding:24px;width:100%;max-width:380px">
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">${t('post.pinLimit')}</div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:18px">${t('post.pinLimitHint')}</div>
      <div style="display:flex;gap:10px;margin-bottom:18px">
        ${pinned.map(pid=>{
          const p=POSTS.find(x=>x.id===pid),u=getUser(p?.userId||'');
          const bg=postGrad(u),imgs=getPostImages(p);
          return`<div style="flex:1;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border .18s" onclick="replacePinWith('${pid}','${newPid}');eraBack()" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='transparent'">
            ${imgs&&imgs[0]?`<img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover">`:
            `<div style="width:100%;height:100%;background:${bg}"></div>`}
          </div>`;
        }).join('')}
      </div>
      <button onclick="eraBack()" style="width:100%;padding:10px;border-radius:9px;background:var(--s2);border:1px solid var(--b1);color:var(--t2);font-size:13px;font-weight:600;cursor:pointer">Скасувати</button>
    </div>`;
  lb.addEventListener('click',e=>{if(e.target===lb)eraBack();});
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
