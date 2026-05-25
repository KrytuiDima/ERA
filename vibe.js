// js/vibe.js — Vibe Code Engine

function srand(s) { const x = Math.sin(s + 1.618) * 99991; return x - Math.floor(x); }
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h; }

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let h,s, l = (mx+mn)/2;
  if (mx===mn) { h=s=0; } else {
    const d = mx-mn; s = l>.5 ? d/(2-mx-mn) : d/(mx+mn);
    switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
  }
  return { h:h*360, s:s*100, l:l*100 };
}

function hslToHex(h, s, l) {
  h=((h%360)+360)%360; s=Math.min(100,Math.max(0,s))/100; l=Math.min(100,Math.max(0,l))/100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r,g,b;
  if(h<60)[r,g,b]=[c,x,0]; else if(h<120)[r,g,b]=[x,c,0]; else if(h<180)[r,g,b]=[0,c,x];
  else if(h<240)[r,g,b]=[0,x,c]; else if(h<300)[r,g,b]=[x,0,c]; else [r,g,b]=[c,0,x];
  const hx = v => Math.round((v+m)*255).toString(16).padStart(2,'0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function vibeColors(baseHex, seed) {
  const {h,s,l} = hexToHsl(baseHex);
  const S = Math.max(s,60), L = Math.min(Math.max(l,40),68);
  return [
    hslToHex(h, S, L),
    hslToHex((h+24+srand(seed)*18)%360, S, L+6),
    hslToHex((h+56+srand(seed+7)*22)%360, S-10, L+16),
  ];
}

function makeVibeCode(baseHex, uid, w=100, h=100) {
  const seed = hashStr(String(uid)), cols = vibeColors(baseHex, seed), gid = 'vc'+seed;
  const N = 9+Math.floor(srand(seed)*7);
  const ws = Array.from({length:N}, (_,i) => .4+srand(seed+i*7+1)*2.2);
  const tw = ws.reduce((a,b)=>a+b,0);
  let bars='', x=0;
  for (let i=0;i<N;i++) {
    const bw=(ws[i]/tw)*100, yo=srand(seed+i*3+2)*18, bh=100-yo-srand(seed+i*4+3)*14;
    const ci=Math.floor(srand(seed+i*5+4)*3), ug=srand(seed+i*11+5)>.44;
    const op=(0.62+srand(seed+i*13+6)*.38).toFixed(2);
    bars+=`<rect x="${x.toFixed(2)}" y="${yo.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" fill="${ug?`url(#${gid})`:cols[ci]}" opacity="${op}"/>`;
    x+=bw;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="display:block"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${cols[0]}"/><stop offset="50%" stop-color="${cols[1]}"/><stop offset="100%" stop-color="${cols[2]}"/></linearGradient></defs><rect width="100" height="100" fill="#090909"/>${bars}<rect width="100" height="100" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".5"/></svg>`;
}

function postGrad(user) {
  const seed = hashStr(user.id), cols = vibeColors(user.baseColor, seed);
  const angle = 30+srand(seed+99)*120, tp = Math.floor(srand(seed+77)*3);
  if (tp===0) return `radial-gradient(ellipse at ${(20+srand(seed+1)*60).toFixed()}% ${(20+srand(seed+2)*60).toFixed()}%,${cols[0]}66 0%,transparent 58%),radial-gradient(ellipse at ${(40+srand(seed+3)*40).toFixed()}% ${(40+srand(seed+4)*40).toFixed()}%,${cols[1]}55 0%,transparent 52%),linear-gradient(${angle.toFixed()}deg,${cols[2]}28,#000)`;
  if (tp===1) return `conic-gradient(from ${angle.toFixed()}deg at 50% 50%,${cols[0]}44,${cols[1]}44,${cols[2]}33,${cols[0]}44)`;
  return `linear-gradient(${angle.toFixed()}deg,${cols[0]}66,${cols[1]}55 50%,${cols[2]}44)`;
}

// Vibe drift (mood history shifts hue over time)
function currentVibeColor(user) {
  if (!user) return '#888';
  if (!APP.user || user.id !== APP.user.id) return user.baseColor;
  const hist = JSON.parse(localStorage.getItem('era_mhist_'+user.id)||'[]');
  if (!hist.length) return user.baseColor;
  const recent = hist.slice(-14), baseH = hexToHsl(user.baseColor);
  let wDH=0, tW=0;
  recent.forEach((e,i) => {
    const m = MOODS.find(x=>x.id===e.id); if(!m) return;
    let d = hexToHsl(m.color).h - baseH.h;
    if(d>180)d-=360; if(d<-180)d+=360;
    const w=i+1; wDH+=d*w; tW+=w;
  });
  if (!tW) return user.baseColor;
  const drift = Math.min(Math.max((wDH/tW)*.35,-30),30);
  return hslToHex(((baseH.h+drift)%360+360)%360, baseH.s, baseH.l);
}

function saveMoodHist(id) {
  if (!APP.user) return;
  const k = 'era_mhist_'+APP.user.id;
  const hist = JSON.parse(localStorage.getItem(k)||'[]');
  const today = todayKey();
  const filtered = hist.filter(e=>e.day!==today);
  filtered.push({id, day:today, ts:Date.now()});
  localStorage.setItem(k, JSON.stringify(filtered.slice(-30)));
}

// Avatar: photo or colored initials with optional friend-ring
function avatarHTML(user, size=38, opts={}) {
  const vibe = currentVibeColor(user);
  const cols = vibeColors(vibe, hashStr(user.id));
  const isFrnd = opts.friend && isFriend(user.id);
  const border = isFrnd
    ? `3px solid ${cols[0]}` // friend neon ring
    : `2.5px solid ${cols[0]}55`;
  const glow = isFrnd ? `box-shadow:0 0 8px ${cols[0]}88;` : '';
  const cls = isFrnd ? ' ava-friend' : '';

  if (user.avatar) {
    return `<img src="${user.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;border:${border};${glow}" class="era-ava${cls}">`;
  }
  const init = (user.displayName||user.username||'?').slice(0,2).toUpperCase();
  return `<div class="era-ava${cls}" style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${cols[0]},${cols[1]});display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*.36)}px;font-weight:700;color:#fff;flex-shrink:0;border:${border};${glow}">${init}</div>`;
}
