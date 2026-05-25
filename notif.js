// js/notif.js — Smart notifications center

function renderNotif() {
  const grouped = _groupNotifs(NOTIFS);
  const unread  = NOTIFS.filter(n=>n.unread).length;

  // Mark all as read once tab is opened
  NOTIFS.forEach(n=>n.unread=false);
  renderNotifBadge();

  document.getElementById('feed-container').innerHTML = `
<div style="padding:14px 16px 10px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between">
  <span style="font-size:15px;font-weight:700">${t('notif.title')}</span>
  ${unread?`<span style="font-size:11px;color:var(--blue)">${t('notif.newCount',{n:unread})}</span>`:''}
</div>
${grouped.length===0
  ? `<div class="empty-state"><div class="empty-ico">🔔</div><div class="empty-txt">${t('notif.empty')}</div></div>`
  : grouped.map((n,i) => renderNotifRow(n,i)).join('')}`;
}

function _groupNotifs(notifs) {
  // Group: same user liked multiple posts → show once
  const out = [], seen = new Set();
  for (const n of notifs) {
    if (seen.has(n.id)) continue;
    if (n.type==='like') {
      const sameUser = notifs.filter(x=>x.userId===n.userId&&x.type==='like'&&!seen.has(x.id));
      if (sameUser.length>1) {
        const merged = {...sameUser[0], _count:sameUser.length, _ids:sameUser.map(x=>x.id)};
        sameUser.forEach(x=>seen.add(x.id));
        out.push(merged); continue;
      }
    }
    seen.add(n.id); out.push(n);
  }
  return out;
}

function renderNotifRow(n, idx) {
  const u    = getUser(n.userId);
  const post = n.postId ? POSTS.find(p=>p.id===n.postId) : null;
  const postBg  = post ? postGrad(getUser(post.userId)) : '';
  const postImg = post ? (getPostImages(post)||[])[0] : null;
  const vibe    = currentVibeColor(APP.user||{baseColor:'#00c6ff',id:'me'});
  const vcols   = vibeColors(vibe, hashStr(APP.user?.id||'me'));
  const dotColor= vcols[0]; // user's own vibe colour for unread dot

  // Build text
  let text = '';
  const cnt = n._count||0;
  switch (n.type) {
    case 'like':
      text = cnt>1
        ? `<strong>@${u.username}</strong> та ще ${cnt-1} вподобали твій пост`
        : t('notif.likedPost',{user:u.username});
      break;
    case 'comment':
      text = t('notif.commented',{user:u.username, text:(n.text||'').slice(0,40)});
      break;
    case 'follow':
      text = isFriend(n.userId)
        ? t('notif.followedBack',{user:u.username})
        : t('notif.followed',{user:u.username});
      break;
    case 'request':
      text = t('notif.wantsToFollow',{user:u.username});
      break;
    case 'approved':
      text = t('notif.requestApproved',{user:u.username});
      break;
    case 'follow_back':
      text = t('notif.followedBack',{user:u.username});
      break;
    default: text = `@${u.username}`;
  }

  // Action buttons (inline for follow requests)
  const actionBtns = n.type==='request' ? `
    <div style="display:flex;gap:6px;margin-top:6px">
      <button onclick="approveRequest('${n.userId}');this.closest('.notif-row').remove();renderNotifBadge()" style="padding:5px 14px;border-radius:7px;background:linear-gradient(135deg,#00c6ff,#9945ff);border:none;color:#000;font-size:12px;font-weight:600;cursor:pointer">${t('notif.approve')}</button>
      <button onclick="declineRequest('${n.userId}');this.closest('.notif-row').remove()" style="padding:5px 14px;border-radius:7px;background:var(--s3);border:1px solid var(--b1);color:var(--t2);font-size:12px;font-weight:600;cursor:pointer">${t('notif.decline')}</button>
    </div>` : '';

  // Follow-back button
  const followBackBtn = n.type==='follow' && !isFriend(n.userId) && getFollowStatus(n.userId)!=='following'
    ? `<button onclick="toggleFollowUser('${n.userId}',this);this.style.display='none'" style="padding:5px 14px;border-radius:20px;border:1px solid var(--b2);background:transparent;color:var(--t1);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">${t('notif.followBack')}</button>`
    : '';

  return `<div class="notif-row" style="display:flex;align-items:flex-start;gap:11px;padding:12px 16px;border-bottom:1px solid var(--b1);animation:fadeUp .22s ease ${idx*30}ms both">
  <!-- Zone A: Avatar → profile -->
  <div style="flex-shrink:0;cursor:pointer" onclick="setView('feed');renderFullProfile('${u.id}')">
    ${avatarHTML(u,38,{friend:true})}
  </div>
  <!-- Zone B: Text + action buttons → post -->
  <div style="flex:1;cursor:pointer" onclick="${post?`expandPost('${post.id}')`:''}"style="cursor:${post?'pointer':'default'}">
    <div style="font-size:13px;color:var(--t2);line-height:1.5">${text}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:2px">${fmtTime(n.ts)}</div>
    ${actionBtns}
  </div>
  ${followBackBtn}
  <!-- Zone C: Post thumbnail → lightbox -->
  ${post?`<div style="width:42px;height:42px;border-radius:7px;overflow:hidden;flex-shrink:0;background:${postBg};cursor:pointer" onclick="expandPost('${post.id}')">${postImg?`<img src="${postImg}" style="width:100%;height:100%;object-fit:cover">`:''}</div>`:''}
</div>`;
}

function renderNotifBadge() {
  const count = NOTIFS.filter(n=>n.unread).length;
  ['nb-notif','bn-notif'].forEach(id => {
    const el = document.getElementById(id); if(!el) return;
    let b = el.querySelector('.nb');
    if (count>0) {
      if (!b) { b=document.createElement('span'); b.className='nb'; el.style.position='relative'; el.appendChild(b); }
      b.textContent = count;
    } else if (b) b.remove();
  });
}

function markRead(id, el) {
  const n=NOTIFS.find(x=>x.id===id); if(n&&n.unread){n.unread=false;el.style.background='transparent';el.querySelector('[style*="background:var(--blue)"]')?.remove();renderNotifBadge();}
}
