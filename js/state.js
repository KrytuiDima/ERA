// js/state.js — Global state & sample data

const APP = { user:null, mood:null, feed:'foryou', view:'feed', profileUid:null };

// Social state
const FOLLOWS    = new Map(); // uid → 'following'|'requested'
const FOLLOWERS  = new Map(); // uid → true
const REQUESTS   = new Map(); // uid → user object (pending incoming)

// Runtime
let OPEN_POST=null, CMT_PHOTO=null, POST_IMGS=[], regAvaData=null;
let LB_LIST=[], LB_IDX=0;
const lbCarState = { idx:0, total:0 };
const carousels  = new Map();
const SESSION_VIEWS = new Set();

const MOODS = [
  {id:'happy',      emoji:'😊', color:'#FFD60A'},
  {id:'calm',       emoji:'🌊', color:'#00C8FF'},
  {id:'creative',   emoji:'🎨', color:'#9945FF'},
  {id:'melancholic',emoji:'🌙', color:'#4466FF'},
  {id:'energetic',  emoji:'⚡', color:'#FF6B00'},
  {id:'thoughtful', emoji:'💭', color:'#00D4A8'},
  {id:'romantic',   emoji:'🌹', color:'#FF3366'},
  {id:'adventurous',emoji:'🚀', color:'#39FF14'},
];

const REACT_LIST = ['😂','🔥','😢','😮','👏'];

// ── Sample users ─────────────────────────────────────────
const SU = [
  { id:'u1', username:'xyn0',      displayName:'Xyn',       bio:'digital artist. lines over pixels.',     website:'https://xyn.art', banner:null, baseColor:'#00ffcc', avatar:null, privacy:'public' },
  { id:'u2', username:'v0id.art',  displayName:'Void',      bio:'abstract / glitch / nothing.',           website:'',                banner:null, baseColor:'#ff2d55', avatar:null, privacy:'private' },
  { id:'u3', username:'glitch_wav',displayName:'GlitchWav', bio:'sound → visual.',                        website:'',                banner:null, baseColor:'#6600ff', avatar:null, privacy:'public' },
  { id:'u4', username:'nxova',     displayName:'Nxova',     bio:'захід. скло. туман.',                    website:'',                banner:null, baseColor:'#ff9500', avatar:null, privacy:'public' },
  { id:'u5', username:'pxlr.io',   displayName:'Pxlr',      bio:'system.exe still running.',              website:'',                banner:null, baseColor:'#007aff', avatar:null, privacy:'public' },
  { id:'u6', username:'rrm_exe',   displayName:'rrm',       bio:"frequencies you can't hear.",            website:'',                banner:null, baseColor:'#cc00ff', avatar:null, privacy:'private' },
  { id:'u7', username:'coldloop',  displayName:'coldloop',  bio:'ніч. місто. тиша.',                      website:'',                banner:null, baseColor:'#30d158', avatar:null, privacy:'public' },
];

// ── Sample posts ─────────────────────────────────────────
const T = Date.now();
const mkR = (l,f,cry,wow,clap) => ({'😂':l,'🔥':f,'😢':cry,'😮':wow,'👏':clap});

let POSTS = [
  { id:'p1',userId:'u1',desc:'нова серія. форма без змісту, зміст без форми. #digital #era',    images:null,ts:T-1800000,  likes:47,  liked:false,myReaction:null,reactions:mkR(12,23,2,5,8),   views:1240,pinned:false,comments:[{id:'c1',userId:'u2',text:'просто неймовірно',ts:T-1200000},{id:'c2',userId:'u3',text:'це саме те 🔥',ts:T-600000}]},
  { id:'p2',userId:'u2',desc:'знайшла себе у відсутності форми.',                               images:null,ts:T-3900000,  likes:112, liked:false,myReaction:null,reactions:mkR(3,44,0,8,6),    views:3400,pinned:false,comments:[{id:'c3',userId:'u4',text:'воу 💫',ts:T-3200000}]},
  { id:'p3',userId:'u3',desc:'glitch as a language. not an error — an expression.',              images:null,ts:T-7200000,  likes:88,  liked:false,myReaction:null,reactions:mkR(31,62,1,14,7), views:2100,pinned:false,comments:[]},
  { id:'p4',userId:'u4',desc:'захід крізь скло. або скло крізь захід. #sunset #mood',           images:null,ts:T-11000000, likes:203, liked:false,myReaction:null,reactions:mkR(8,97,4,22,31), views:8700,pinned:false,comments:[{id:'c4',userId:'u1',text:'яскраво і тепло',ts:T-10400000},{id:'c5',userId:'u5',text:'ефект скла — топ',ts:T-9800000}]},
  { id:'p5',userId:'u5',desc:'system.exe has stopped working. or has it? #glitch',              images:null,ts:T-18000000, likes:55,  liked:false,myReaction:null,reactions:mkR(42,18,0,33,4),  views:1800,pinned:false,comments:[]},
  { id:'p6',userId:'u6',desc:'frequencies. invisible. present. always.',                         images:null,ts:T-86400000, likes:321, liked:false,myReaction:null,reactions:mkR(14,1240,6,88,52),views:14200,pinned:false,comments:[{id:'c6',userId:'u7',text:'відчуваю це 🌊',ts:T-80000000}]},
  { id:'p7',userId:'u7',desc:'ніч. місто. тиша між ударами серця. #night #city',                images:null,ts:T-172800000,likes:178, liked:false,myReaction:null,reactions:mkR(5,67,9,11,23), views:5600,pinned:false,comments:[]},
];

// ── Sample notifications ──────────────────────────────────
let NOTIFS = [
  { id:'n1',userId:'u2',type:'like',   postId:'p1',              unread:true, ts:T-420000 },
  { id:'n2',userId:'u4',type:'comment',postId:'p1',text:'🔥 неймовірно',unread:true,ts:T-1200000 },
  { id:'n3',userId:'u1',type:'follow',                          unread:true, ts:T-3600000 },
  { id:'n4',userId:'u6',type:'request',                         unread:true, ts:T-4000000 },
  { id:'n5',userId:'u6',type:'like',   postId:'p1',              unread:false,ts:T-7200000 },
  { id:'n6',userId:'u3',type:'comment',postId:'p1',text:'це саме те',unread:false,ts:T-86400000 },
];

// ── Helpers ───────────────────────────────────────────────
function getUser(id) {
  const stored = JSON.parse(localStorage.getItem('era_users')||'[]');
  return [...SU,...stored,APP.user].find(u=>u&&u.id===id)
    || { id, username:'unknown', displayName:'Unknown', baseColor:'#333', avatar:null, privacy:'public' };
}

function getPostImages(post) {
  if (post.images && post.images.length > 0) return post.images;
  if (post.imgData) return [post.imgData];
  return null;
}

// Форматування відносного часу (щойно, 5 хв тому, вчора тощо)
// Локалізація працює для UA, EN, RU через словники lang/*.js
function fmtTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return t('time.justNow');
  
  if (d < 3600000) {
    const m = Math.floor(d / 60000);
    return t('time.min', { n: m });
  }
  
  if (d < 86400000) {
    const h = Math.floor(d / 3600000);
    // Для ERA ми використовуємо "вчора" для подій попередньої доби
    return t('time.hour', { n: h });
  }
  
  const days = Math.floor(d / 86400000);
  if (days === 1) return t('time.yesterday');
  if (days < 7) return t('time.day', { n: days });
  
  // Для старого контенту — формат дати з урахуванням локалі браузера/налаштувань
  const lang = localStorage.getItem('era_lang') || 'en';
  const locale = lang === 'uk' ? 'uk-UA' : (lang === 'ru' ? 'ru-RU' : 'en-US');
  const date = new Date(ts);
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function fmtN(n) {
  if (!n||n===0) return '';
  if (n>=1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'М';
  if (n>=1000)    return (n/1000).toFixed(1).replace(/\.0$/,'')+'К';
  return String(n);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tags(txt) {
  return txt
    .replace(/(#[\wа-яёіїєґА-ЯЁІЇЄҐ]+)/g,'<span class="tag-h" onclick="goTag(\'$1\')">$1</span>')
    .replace(/(@[\w.]+)/g,'<span class="tag-m">$1</span>');
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

async function saveUserData() {
  // Майбутня інтеграція з Supabase Auth/Database
  localStorage.setItem('era_session', JSON.stringify(APP.user));
  const users = JSON.parse(localStorage.getItem('era_users')||'[]');
  const idx = users.findIndex(u=>u.id===APP.user.id);
  if (idx>=0) { users[idx]={...users[idx],...APP.user}; localStorage.setItem('era_users',JSON.stringify(users)); }
}

async function saveFollowsToStorage() {
  // Збереження підписок (майбутній Supabase)
  const data = {};
  FOLLOWS.forEach((status,uid) => data[uid]=status);
  localStorage.setItem('era_follows_'+APP.user?.id, JSON.stringify(data));
}

async function loadFollowsFromStorage() {
  if (!APP.user) return;
  const data = JSON.parse(localStorage.getItem('era_follows_'+APP.user.id)||'{}');
  Object.entries(data).forEach(([uid,status]) => FOLLOWS.set(uid,status));
}

function getFollowStatus(uid) {
  return FOLLOWS.get(uid) || null; // 'following'|'requested'|null
}

function isUserPrivate(uid) {
  const u = getUser(uid);
  return u?.privacy === 'private';
}
