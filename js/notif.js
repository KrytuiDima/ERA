// js/notif.js — Інтелектуальний центр сповіщень

/**
 * Рендерить список сповіщень з групуванням
 */
function renderNotif() {
  const grouped = _groupNotifs(NOTIFS);
  const unreadCount = NOTIFS.filter(n => n.unread).length;

  document.getElementById('feed-container').innerHTML = `
<div style="padding:14px 16px 10px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between">
  <span style="font-size:15px;font-weight:700">${t('notif.title')}</span>
  ${unreadCount ? `<span style="font-size:11px;color:var(--blue);font-weight:600">${t('notif.newCount', { n: unreadCount })}</span>` : ''}
</div>
${grouped.length === 0
  ? `<div class="empty-state"><div class="empty-ico">🔔</div><div class="empty-txt">${t('notif.empty')}</div></div>`
  : grouped.map((n, i) => renderNotifRow(n, i)).join('')}`;

  // Автоматично позначаємо всі як прочитані при відкритті вкладки
  NOTIFS.forEach(n => n.unread = false);
  renderNotifBadge();
}

/**
 * Групує повторювані дії (наприклад, кілька лайків від одного юзера)
 */
function _groupNotifs(notifs) {
  const out = [], seen = new Set();
  for (const n of notifs) {
    if (seen.has(n.id)) continue;

    // Анти-спам: групуємо лайки від одного користувача
    if (n.type === 'like') {
      const sameUserLikes = notifs.filter(x => x.userId === n.userId && x.type === 'like' && !seen.has(x.id));
      if (sameUserLikes.length > 1) {
        const merged = { ...sameUserLikes[0], _count: sameUserLikes.length, _ids: sameUserLikes.map(x => x.id) };
        sameUserLikes.forEach(x => seen.add(x.id));
        out.push(merged);
        continue;
      }
    }

    seen.add(n.id);
    out.push(n);
  }
  return out;
}

/**
 * Рендерить один рядок сповіщення з чітким зонуванням кліків
 */
function renderNotifRow(n, idx) {
  const u = getUser(n.userId);
  const post = n.postId ? POSTS.find(p => p.id === n.postId) : null;
  const postBg = post ? postGrad(getUser(post.userId)) : '';
  const postImg = post ? (getPostImages(post) || [])[0] : null;

  // Колір маркера новизни — вайб поточного користувача
  const myVibe = currentVibeColor(APP.user || { baseColor: '#00c6ff' });
  const myCols = vibeColors(myVibe, hashStr(APP.user?.id || 'me'));
  const dotColor = myCols[0];

  let text = '';
  const cnt = n._count || 0;

  switch (n.type) {
    case 'like':
      text = cnt > 1
        ? `<strong>@${u.username}</strong> ${t('notif.likedManyPosts', { n: cnt - 1 })}`
        : t('notif.likedPost', { user: u.username });
      break;
    case 'comment':
      text = t('notif.commented', { user: u.username, text: (n.text || '').slice(0, 40) });
      break;
    case 'follow':
      text = isFriend(n.userId) ? t('notif.followedBack', { user: u.username }) : t('notif.followed', { user: u.username });
      break;
    case 'request':
      text = t('notif.wantsToFollow', { user: u.username });
      break;
    case 'approved':
      text = t('notif.requestApproved', { user: u.username });
      break;
    default:
      text = `@${u.username}`;
  }

  // Кнопки дій для запитів (Action Buttons)
  const actionBtns = n.type === 'request' ? `
    <div style="display:flex;gap:6px;margin-top:8px">
      <button onclick="event.stopPropagation(); approveRequest('${n.userId}')" style="padding:6px 14px;border-radius:8px;background:var(--grad);border:none;color:#000;font-size:12px;font-weight:700;cursor:pointer">${t('notif.approve')}</button>
      <button onclick="event.stopPropagation(); declineRequest('${n.userId}')" style="padding:6px 14px;border-radius:8px;background:var(--s3);border:1px solid var(--b1);color:var(--t2);font-size:12px;font-weight:600;cursor:pointer">${t('notif.decline')}</button>
    </div>` : '';

  // Кнопка "Підписатися у відповідь"
  const isReq = getFollowStatus(n.userId) === 'requested';
  const followBackBtn = (n.type === 'follow' || n.type === 'approved') && !isFriend(n.userId) && getFollowStatus(n.userId) !== 'following'
    ? `<button onclick="event.stopPropagation(); followBack('${n.userId}')" style="padding:6px 14px;border-radius:20px;border:1px solid var(--b2);background:transparent;color:var(--t1);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;margin-left:auto">${isReq ? t('profile.requested') : t('notif.followBack')}</button>`
    : '';

  return `
<div class="notif-row" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--b1);animation:fadeUp .22s ease ${idx * 25}ms both; position: relative">

  <!-- Маркер новизни -->
  ${n.unread ? `<div style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor}"></div>` : ''}

  <!-- Зона A: Аватар -> Перехід у профіль -->
  <div style="flex-shrink:0;cursor:pointer" onclick="event.stopPropagation(); renderFullProfile('${u.id}')">
    ${avatarHTML(u, 40, { friend: true })}
  </div>

  <!-- Зона B: Текст -> Відкриття поста або перехід у профіль -->
  <div style="flex:1;min-width:0;cursor:pointer" onclick="${post ? `expandPost('${post.id}')` : `renderFullProfile('${u.id}')`}">
    <div style="font-size:13px;color:var(--t1);line-height:1.4">${text}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:3px;font-weight:500">${fmtTime(n.ts)}</div>
    ${actionBtns}
  </div>

  ${followBackBtn}

  <!-- Зона C: Міні-прев'ю поста -> Лайтбокс -->
  ${post ? `
    <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;background:${postBg};cursor:pointer;border:1px solid var(--b1)"
         onclick="event.stopPropagation(); expandPost('${post.id}')">
      ${postImg ? `<img src="${postImg}" style="width:100%;height:100%;object-fit:cover">` : ''}
    </div>` : ''}
</div>`;
}

/**
 * Оновлює лічильник нечитаних сповіщень на іконках меню
 */
function renderNotifBadge() {
  const count = NOTIFS.filter(n => n.unread).length;
  ['nb-notif', 'bn-notif'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    let badge = el.querySelector('.nb');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nb';
        el.style.position = 'relative';
        el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
    } else if (badge) {
      badge.remove();
    }
  });
}
