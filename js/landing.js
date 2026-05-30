// js/landing.js — 3D Landing Page logic with Three.js (Optimized)

let landingScene, landingCamera, landingRenderer, landingAnimId;
let landingMouse3D = new THREE.Vector3();
let landingRaycaster = new THREE.Raycaster();
let landingMouse2 = new THREE.Vector2();
let landingPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
let landingGroups = [];
let landingPointLights = [];

const PALS = [[0x00ffcc,0x00c6ff,0x0095f6],[0x9945ff,0x6600ff,0xcc00ff],[0xff2d55,0xff6b6b,0xff9500],[0x30d158,0x34c759,0x00c6ff],[0xffd60a,0xff9500,0xff6b00],[0x007aff,0x00c6ff,0x9945ff],[0xff3366,0xcc00ff,0x9945ff],[0x39ff14,0x00c6ff,0x30d158]];

class VGroup {
  constructor(hx,hy,hz,pal,seed){
    this.home=new THREE.Vector3(hx,hy,hz);
    this.pos=new THREE.Vector3(hx+(srand(seed)-.5)*2,hy+(srand(seed+1)-.5)*2,hz);
    this.vel=new THREE.Vector3();
    this.seed=seed;
    this.rotSpd=(.003+srand(seed+9)*.005)*(srand(seed+8)>.5?1:-1);
    this.group=new THREE.Group();
    this.group.rotation.y=srand(seed+44)*Math.PI*2;
    this.group.rotation.x=(srand(seed+55)-.5)*.5;
    landingScene.add(this.group);
    const N=7+Math.floor(srand(seed)*6);
    const tw=N*.18;
    for(let i=0;i<N;i++){
      const h=.2+srand(seed+i*7+1)*1.5,w=.07+srand(seed+i*3+2)*.1,d=w*(.5+srand(seed+i*5+3)*.5);
      const col=new THREE.Color(pal[Math.floor(srand(seed+i*11+4)*pal.length)]);
      const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.4+srand(seed+i*13+5)*.3,roughness:.25,metalness:.75});
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      mesh.position.x=(i/(N-1)-.5)*tw*2.4;
      mesh.position.y=(srand(seed+i*17+6)-.5)*.35;
      this.group.add(mesh);
    }
  }
  update(m3,t){
    const spring=this.home.clone().sub(this.pos).multiplyScalar(.033);
    const tm=this.pos.clone().sub(m3);const d=tm.length();
    if(d<3.8)this.vel.add(tm.normalize().multiplyScalar((3.8-d)*.16));
    this.vel.add(spring);this.vel.multiplyScalar(.87);this.pos.add(this.vel);
    this.group.position.copy(this.pos);
    this.group.rotation.y+=this.rotSpd;
    this.group.rotation.x=Math.sin(t*.0007+this.seed*9)*.12;
    this.group.rotation.z=Math.cos(t*.0005+this.seed*7)*.06;
  }
  destroy() {
    this.group.children.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    landingScene.remove(this.group);
  }
}

function initLanding3D() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  landingRenderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  landingRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  landingRenderer.setClearColor(0x000000, 0);

  landingScene = new THREE.Scene();
  landingScene.fog = new THREE.FogExp2(0x000000, .05);

  landingCamera = new THREE.PerspectiveCamera(55, 2, 0.1, 100);
  landingCamera.position.set(0, 0, 10);

  landingScene.add(new THREE.AmbientLight(0x111111));

  const p1=new THREE.PointLight(0x00c6ff, 4, 20); p1.position.set(-4,3,5);
  const p2=new THREE.PointLight(0x9945ff, 4, 20); p2.position.set(4,-2,5);
  const p3=new THREE.PointLight(0xff2d55, 2, 14); p3.position.set(0,5,-3);
  landingPointLights = [p1, p2, p3];
  landingScene.add(p1, p2, p3);

  const SPOTS=[[3.5,1.5,-1],[-3.5,1.0,-1],[0,2.5,-2],[4.0,-1.5,0],[-4.0,-1.5,0],[0,-2.0,-2],[1.8,0.5,1],[-1.8,-0.5,1]];
  landingGroups = SPOTS.map((p,i)=>new VGroup(...p, PALS[i%PALS.length], hashStr('g'+i)));

  // Particle field
  const pc=180, pp=new Float32Array(pc*3);
  for(let i=0; i<pc; i++){pp[i*3]=(Math.random()-.5)*26; pp[i*3+1]=(Math.random()-.5)*18; pp[i*3+2]=(Math.random()-.5)*12-3;}
  const pGeo=new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pp,3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({color:0x223344, size:.04, transparent:true, opacity:.5}));
  landingScene.add(particles);

  window.addEventListener('mousemove', onLandingMouseMove);
  window.addEventListener('resize', onLandingResize);

  function animate() {
    landingAnimId = requestAnimationFrame(animate);
    const t = Date.now();
    if (landingPointLights[0]) {
      landingPointLights[0].position.x = Math.sin(t*.0007)*5;
      landingPointLights[0].position.y = Math.cos(t*.0005)*3;
    }
    if (landingPointLights[1]) {
      landingPointLights[1].position.x = Math.cos(t*.0009)*5;
      landingPointLights[1].position.y = Math.sin(t*.0006)*3;
    }
    landingGroups.forEach(g => g.update(landingMouse3D, t));
    landingRenderer.render(landingScene, landingCamera);
  }
  animate();
  onLandingResize();
}

function onLandingMouseMove(e) {
  landingMouse2.x = (e.clientX / innerWidth) * 2 - 1;
  landingMouse2.y = -(e.clientY / innerHeight) * 2 + 1;
  landingRaycaster.setFromCamera(landingMouse2, landingCamera);
  landingRaycaster.ray.intersectPlane(landingPlane, landingMouse3D);
}

function onLandingResize() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || !landingRenderer) return;
  const w = innerWidth, h = innerHeight;
  landingRenderer.setSize(w, h, false);
  landingCamera.aspect = w / h;
  landingCamera.updateProjectionMatrix();
}

function destroyLanding3D() {
  if (landingAnimId) cancelAnimationFrame(landingAnimId);
  window.removeEventListener('mousemove', onLandingMouseMove);
  window.removeEventListener('resize', onLandingResize);

  if (landingGroups) {
    landingGroups.forEach(g => g.destroy());
  }
  if (landingRenderer) {
    landingRenderer.dispose();
  }
  landingGroups = [];
  landingScene = null;
  landingCamera = null;
  landingRenderer = null;
}

function showLanding() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('landing-screen').classList.remove('hidden');
  initLanding3D();
}

function showAuth(tab) {
  destroyLanding3D();
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  authTab(tab);
}
