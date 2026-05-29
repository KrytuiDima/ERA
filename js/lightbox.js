// js/lightbox.js — Лайтбокс з фізикою жесту та переходами

/**
 * Відкриває пост у повноекранному режимі (Лайтбокс)
 */
function expandPost(pid, ctx) {
  const p = POSTS.find(x => x.id === pid);
  if (p && !SESSION_VIEWS.has('lb-' + pid)) {
    SESSION_VIEWS.add('lb-' + pid);
    p.views = (p.views || 0) + 1;
  }

  // Визначаємо список постів для гортання (всі пости або лише пости користувача)
  if (ctx === 'profile' && APP.profileUid) {
    LB_LIST = POSTS.filter(p => p.userId === APP.profileUid).sort((a, b) => b.ts - a.ts);
  } else {
    const feed = getFeedPosts();
    LB_LIST = feed.length ? feed : [...POSTS].sort((a, b) => b.ts - a.ts);
  }

  LB_IDX = LB_LIST.findIndex(p => p.id === pid);
  if (LB_IDX < 0) LB_IDX = 0;

  lockScroll();
  eraPush('lightbox');
  buildLightbox();
}

/**
 * Внутрішня функція закриття з анімацією
 */
function _closeLightboxInternal(fromPopState = false) {
  const pid = LB_LIST[LB_IDX]?.id;
  const lb = document.getElementById('lightbox'); if (!lb) return;

  lb.style.transition = 'opacity .2s ease';
  lb.style.opacity = '0';

  setTimeout(() => {
    lb.remove();
    unlockScroll();
    if (pid) syncFeedToPost(pid);
    if (!fromPopState && _histDepth > 0) { _histDepth--; history.back(); }
  }, 190);
}

function closeLightbox() {
  _closeLightboxInternal();
}

/**
 * Прокручує стрічку до поста, який був відкритий в лайтбоксі
 */
function syncFeedToPost(pid) {
  if (APP.view !== 'feed') return;
  const card = document.getElementById('post-' + pid);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Перехід між постами в лайтбоксі
 */
function lbNav(dir) {
  const next = LB_IDX + dir;
  if (next < 0 || next >= LB_LIST.length) {
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.classList.add(dir > 0 ? 'anim-spring-l' : 'anim-spring-r');
      setTimeout(() => lb.classList.remove('anim-spring-l', 'anim-spring-r'), 400);
    }
    return;
  }
  LB_IDX = next;
  buildLightbox(dir);
  setTimeout(() => syncFeedToPost(LB_LIST[LB_IDX]?.id), 0);
}

/**
 * Побудова DOM структури лайтбоксу
 */
function buildLightbox(dir = 0) {
  document.getElementById('lightbox')?.remove();
  const p = LB_LIST[LB_IDX]; if (!p) return;

  const u = getUser(p.userId);
  const own = APP.user && p.userId === APP.user.id;
  const bg = postGrad(u);
  const imgs = getPostImages(p);
  const hasMulti = imgs && imgs.length > 1;

  lbCarState.idx = 0;
  lbCarState.total = hasMulti ? imgs.length : 1;

  let imgHTML = '';
  if (!imgs || imgs.length === 0) {
    imgHTML = `<div class="lb-img-abs" style="background:${bg}"></div>`;
  } else if (imgs.length === 1) {
    imgHTML = `<img src="${imgs[0]}" alt="" draggable="false">`;
  } else {
    imgHTML = `<div class="carousel-track" id="lb-ct-${p.id}" style="height:100%">${imgs.map(i => `<div class="carousel-slide"><img src="${i}" alt="" draggable="false"></div>`).join('')}</div><div class="carousel-dots" id="lb-cd-${p.id}">${imgs.map((_, i) => `<div class="c-dot${i === 0 ? ' on' : ''}"></div>`).join('')}</div>`;
  }

  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.innerHTML = `
    <button class="lb-close" onclick="closeLightbox()">×</button>
    <div class="lb-wrap" id="lb-wrap-${p.id}" style="will-change: transform, opacity">
      <div class="lb-img-area" id="lb-img-${p.id}">${imgHTML}</div>
      <div class="lb-meta">
        <div style="width:34px;height:34px;border-radius:50%;overflow:hidden;cursor:pointer" onclick="closeLightbox();${own ? `setView('profile')` : `openUserCard('${u.id}')`}">${avatarHTML(u, 34, { friend: true })}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;cursor:pointer" onclick="closeLightbox();${own ? `setView('profile')` : `openUserCard('${u.id}')`}">@${esc(u.username)}</div>
          <div style="font-size:10px;color:var(--t2)">${fmtTime(p.ts)}</div>
        </div>
        ${p.views ? `<span style="font-size:10px;color:var(--t3);display:flex;align-items:center;gap:2px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${fmtN(p.views)}</span>` : ''}
      </div>
      ${p.desc ? `<div class="lb-desc">${tags(esc(p.desc))}</div>` : ''}
      <div class="lb-reactions">
        <div class="reactions-row" style="padding:8px 0 4px">
          <button class="like-btn${p.liked ? ' liked' : ''}" id="lb-lb-${p.id}" onclick="toggleLike('${p.id}')">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="${p.liked ? 'currentColor' : 'none'}" style="width:19px;height:19px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${own ? `<span class="like-cnt">${fmtN(p.likes) || 0}</span>` : ''}
          </button>
          <div id="lb-rr-${p.id}" style="display:contents">${buildReacts(p)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;padding:4px 0">
          <button class="post-act" onclick="closeLightbox();openCmts('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${p.comments.length}</span>
          </button>
          <div style="flex:1"></div>
          <button class="post-act" onclick="sharePost('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="lb-nav-hint">← → свайп • scroll між постами</div>`;

  if (dir !== 0) lb.querySelector('.lb-wrap')?.classList.add(dir > 0 ? 'anim-sl' : 'anim-sr');

  // Гортання колесом миші
  lb.addEventListener('wheel', e => { e.preventDefault(); lbNav(e.deltaY > 0 ? 1 : -1); }, { passive: false });

  if (hasMulti) {
    setTimeout(() => initCarousel(p.id, imgs.length, true), 0);
  }

  const wrapEl = lb.querySelector('.lb-wrap');
  let vSY = 0, vDrag = false, lastDY = 0;

  // ── Жест закриття свайпом (Swipe-to-close) ─────────────────
  const onVStart = e => {
    vSY = e.touches ? e.touches[0].clientY : e.clientY;
    vDrag = true;
    wrapEl.style.transition = 'none';
  };

  const onVMove = e => {
    if (!vDrag) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - vSY;
    lastDY = dy;
    const absDy = Math.abs(dy);

    // Візуальні ефекти притягування (масштаб та прозорість)
    if (absDy > 10) {
      const scale = Math.max(0.75, 1 - absDy / 1500);
      const opacity = Math.max(0.2, 1 - absDy / 600);
      wrapEl.style.transform = `translateY(${dy}px) scale(${scale})`;
      lb.style.background = `rgba(0,0,0,${Math.max(0.4, 0.97 - absDy / 800)})`;
      if (e.cancelable) e.preventDefault();
    }
  };

  const onVEnd = e => {
    if (!vDrag) return;
    vDrag = false;
    wrapEl.style.transition = 'transform .3s cubic-bezier(.22,1,.36,1), opacity .3s, background .3s';

    // Якщо поріг пройдено — закриваємо
    if (Math.abs(lastDY) > 150) {
      wrapEl.style.transform = `translateY(${lastDY > 0 ? '100vh' : '-100vh'}) scale(0.6)`;
      lb.style.opacity = '0';
      setTimeout(() => closeLightbox(), 250);
    } else {
      // Повертаємо на місце
      wrapEl.style.transform = '';
      lb.style.background = 'rgba(0,0,0,0.97)';
      lb.style.opacity = '1';
    }
    lastDY = 0;
  };

  lb.addEventListener('touchstart', onVStart, { passive: true });
  lb.addEventListener('touchmove', onVMove, { passive: false });
  lb.addEventListener('touchend', onVEnd, { passive: true });

  lb.addEventListener('mousedown', onVStart);
  window.addEventListener('mousemove', onVMove);
  window.addEventListener('mouseup', onVEnd);

  // Дабл-тап для лайку
  const imgArea = lb.querySelector('.lb-img-area');
  let lbTapT = null, lbTapMoved = false, lbTapSX = 0, lbTapSY = 0;
  if (imgArea) {
    imgArea.addEventListener('touchstart', e => { lbTapSX = e.touches[0].clientX; lbTapSY = e.touches[0].clientY; lbTapMoved = false; }, { passive: true });
    imgArea.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientX - lbTapSX) > 12 || Math.abs(e.touches[0].clientY - lbTapSY) > 12) lbTapMoved = true; }, { passive: true });
    imgArea.addEventListener('touchend', e => {
      if (lbTapMoved) return;
      if (lbTapT) {
        clearTimeout(lbTapT); lbTapT = null;
        lbDoubleTap(p.id, imgArea);
      } else {
        lbTapT = setTimeout(() => lbTapT = null, 250);
      }
    }, { passive: true });
    imgArea.addEventListener('dblclick', () => lbDoubleTap(p.id, imgArea));
  }

  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.body.appendChild(lb);
}

/**
 * Анімація великого серця при дабл-тапі
 */
function lbDoubleTap(pid, imgArea) {
  const p = POSTS.find(x => x.id === pid); if (!p) return;
  if (!p.liked) { p.liked = true; p.likes++; refreshLikeBtn(pid); }

  const heart = document.createElement('div');
  heart.className = 'like-heart-anim';
  heart.style.fontSize = '120px'; // Більше серце для лайтбоксу
  heart.textContent = '❤️';
  imgArea.appendChild(heart);
  setTimeout(() => heart.remove(), 700);
}
