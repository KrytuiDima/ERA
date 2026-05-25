// js/lang.js — Translation utility & language switcher

const LANGUAGES = [
  { code:'uk', flag:'🇺🇦', name:'Ukrainian',  native:'Українська' },
  { code:'ru', flag:'🇷🇺', name:'Russian',    native:'Русский'    },
  { code:'en', flag:'🇬🇧', name:'English',    native:'English'    },
];

// Load saved language (runs before DOM is ready, after lang files)
(function initLang() {
  const saved = localStorage.getItem('era_lang') || 'uk';
  window.ERA_STRINGS = (window.ERA_LANG && window.ERA_LANG[saved])
    ? window.ERA_LANG[saved]
    : (window.ERA_LANG && window.ERA_LANG.uk) || {};
})();

// t('some.key', { var: 'value' }) — translate a key with optional interpolation
function t(key, vars = {}) {
  const parts = key.split('.');
  let val = window.ERA_STRINGS;
  for (const p of parts) {
    if (val == null) return key;
    val = val[p];
  }
  if (typeof val !== 'string') return key;
  return val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Switch language and re-render current view
function switchLang(code) {
  if (!window.ERA_LANG || !window.ERA_LANG[code]) return;
  window.ERA_STRINGS = window.ERA_LANG[code];
  localStorage.setItem('era_lang', code);
  _refreshStaticUI();
  // Re-render current view
  if (typeof APP !== 'undefined' && APP.user) {
    if (typeof setView === 'function') setView(APP.view || 'feed');
  }
  const lang = LANGUAGES.find(l => l.code === code);
  if (lang) showToast(`${lang.flag} ${lang.native}`);
}

// Update HTML elements that have data-i18n attributes
function _refreshStaticUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}

// Show language picker overlay
function showLangPicker() {
  document.getElementById('lang-picker')?.remove();
  const currentCode = localStorage.getItem('era_lang') || 'uk';
  const el = document.createElement('div');
  el.id = 'lang-picker';
  el.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.75);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .18s ease';
  el.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--b2);border-radius:20px;padding:22px 20px;width:100%;max-width:320px;box-shadow:0 24px 60px rgba(0,0,0,.6)">
      <div style="font-size:15px;font-weight:700;text-align:center;margin-bottom:18px;color:var(--t1)">🌐 Language / Мова</div>
      ${LANGUAGES.map(l => {
        const active = l.code === currentCode;
        return `<button onclick="switchLang('${l.code}');document.getElementById('lang-picker').remove()"
          style="display:flex;align-items:center;gap:14px;width:100%;padding:13px 16px;border-radius:12px;
                 border:${active?'1.5px solid #00c6ff':'1px solid var(--b1)'};
                 background:${active?'rgba(0,198,255,.08)':'transparent'};
                 cursor:pointer;margin-bottom:8px;transition:all .15s;text-align:left"
          onmouseover="this.style.background='${active?'rgba(0,198,255,.12)':'var(--s2)'}'"
          onmouseout="this.style.background='${active?'rgba(0,198,255,.08)':'transparent'}'">
          <span style="font-size:28px;line-height:1">${l.flag}</span>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--t1)">${l.name}</div>
            <div style="font-size:12px;color:var(--t2)">${l.native}</div>
          </div>
          ${active?`<span style="color:#00c6ff;font-size:18px;flex-shrink:0">✓</span>`:''}
        </button>`;
      }).join('')}
      <button onclick="document.getElementById('lang-picker').remove()"
        style="width:100%;padding:11px;border-radius:10px;background:var(--s2);border:1px solid var(--b1);color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;margin-top:4px;transition:background .14s"
        onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='var(--s2)'">
        ${t('lang.cancel')}
      </button>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}

// getCurrentLangMeta — returns current language object
function getCurrentLang() {
  const code = localStorage.getItem('era_lang') || 'uk';
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}
