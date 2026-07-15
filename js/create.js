// js/create.js — Post creation

function openCreatePost() {
  POST_IMGS = [];
  document.getElementById('post-file').value = '';
  document.getElementById('upload-ph').classList.remove('hidden');
  document.getElementById('upload-grid').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('has-imgs');
  document.getElementById('desc-ta').value = '';
  document.getElementById('desc-cnt').textContent = '0/300';
  openModal('modal-create');
}

// Обробка вибраних фото для поста
// Використовує кропер з пропорціями 4:5 для забезпечення естетики стрічки
async function onPostFile(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  e.target.value = '';

  const readFile = f => new Promise(res => {
    const r = new FileReader();
    r.onload = ev => res(ev.target.result);
    r.readAsDataURL(f);
  });

  // Для першого фото завжди відкриваємо професійне Студіо 4:5
  const firstSrc = await readFile(files[0]);
  
  openStudio(firstSrc, async (cropped) => {
    if (files.length > 1) {
      // Якщо вибрано кілька фото — інші додаються автоматично
      const rest = await Promise.all(files.slice(1).map(readFile));
      POST_IMGS = [...POST_IMGS, cropped, ...rest].slice(0, 10);
    } else {
      POST_IMGS = [...POST_IMGS, cropped].slice(0, 10);
    }
    renderUploadGrid();
  }, { ratio: 4/5 });
}

function renderUploadGrid() {
  const ph   = document.getElementById('upload-ph');
  const grid = document.getElementById('upload-grid');
  const zone = document.getElementById('upload-zone');
  if (!POST_IMGS.length) {
    ph.classList.remove('hidden'); grid.classList.add('hidden'); zone.classList.remove('has-imgs');
    return;
  }
  ph.classList.add('hidden'); zone.classList.add('has-imgs'); grid.classList.remove('hidden');
  grid.innerHTML = POST_IMGS.map((img,i) => `
    <div class="upload-thumb">
      <img src="${img}" alt="">
      <button class="upload-thumb-rm" onclick="removePhoto(${i});event.stopPropagation()">×</button>
      ${i===0?`<div style="position:absolute;bottom:3px;left:3px;background:rgba(0,0,0,.6);color:#fff;font-size:9px;padding:1px 6px;border-radius:4px;font-family:var(--mono)">${t('post.cover')}</div>`:''}
    </div>`).join('')
  + (POST_IMGS.length<10
    ? `<div class="upload-add-more" onclick="document.getElementById('post-file').click()">+<span style="font-size:10px;color:var(--t3)">${t('post.addMore')}</span></div>`
    : '');
}

function removePhoto(idx) {
  POST_IMGS.splice(idx,1);
  renderUploadGrid();
}

function updateDescCnt() {
  const len = document.getElementById('desc-ta').value.length;
  const el  = document.getElementById('desc-cnt');
  el.textContent = `${len}/300`;
  el.style.color = len>270 ? 'var(--red)' : 'var(--t3)';
}

// Публікація нового поста
async function submitPost() {
  const desc = document.getElementById('desc-ta')?.value.trim() || '';
  if (!POST_IMGS.length && !desc) {
    showToast(t('errors.fillDesc'));
    return;
  }

  const np = {
    id: 'p_' + Date.now(),
    userId: APP.user.id,
    desc,
    images: POST_IMGS.length ? [...POST_IMGS] : null,
    ts: Date.now(),
    likes: 0,
    liked: false,
    myReaction: null,
    reactions: { '😂': 0, '🔥': 0, '😢': 0, '😮': 0, '👏': 0 },
    views: 0,
    pinned: false,
    comments: [],
  };

  // Додаємо в локальний масив та імітуємо збереження в БД
  POSTS.unshift(np);
  
  const saved = JSON.parse(localStorage.getItem('era_posts') || '[]');
  saved.unshift(np);
  localStorage.setItem('era_posts', JSON.stringify(saved.slice(0, 30)));

  // Закриваємо модалку та оновлюємо стрічку
  closeModal('modal-create');
  showToast(t('post.published'));
  
  setTimeout(() => {
    if (APP.view === 'feed') {
      setFeed(APP.feed);
    } else {
      setView('feed');
    }
  }, 300);
}
