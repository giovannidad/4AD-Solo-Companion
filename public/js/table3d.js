// Vassoio 3D dei dadi con fisica reale (la mappa è in map2d.js).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---- area di lancio = tutta la mappa visibile (1 unità = 1 dado ≈ 1,7 quadretti) ----
const B = { halfW: 16, halfH: 13 };
const DIE = 1.7;                                                       // lato del dado
const COLORS = {
  avorio: { bg: '#f1e8d2', edge: '#cdbf9c', pip: '#1a1410' },
  rosso: { bg: '#b8281f', edge: '#7e1812', pip: '#fff4e0' },
  blu: { bg: '#2557a7', edge: '#173a75', pip: '#fff4e0' },
  verde: { bg: '#2f7d46', edge: '#1d5530', pip: '#fff4e0' },
  nero: { bg: '#25211e', edge: '#0e0c0b', pip: '#f1e8d2' },
  oro: { bg: '#d8a823', edge: '#9b7410', pip: '#2a1c04' }
};

let renderer, scene, camera, world, container, key, walls = {};
const dice = [];                   // {mesh, body, value}
const dieMaterials = {};
let rollChain = Promise.resolve(), rollToken = 0;
let running = false, idleFrames = 0;
export const stats = { frames: 0 };      // fotogrammi disegnati (per misurare il carico)
export const qualita = { ombre: true, dpr: 2 };

// ---------------- inizializzazione ----------------
export function initTable(el) {
  container = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, qualita.dpr));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = qualita.ombre;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
  buildLights(); buildPhysics();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; floor.receiveShadow = true; scene.add(floor);
  new ResizeObserver(resize).observe(container);
  resize();
  draw();   // un solo fotogramma: finché non ci sono dadi la GPU resta ferma
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a3a2a, 1.05));
  key = new THREE.DirectionalLight(0xffeccc, 1.5);
  key.position.set(5, 30, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key);
}

function buildPhysics() {
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -75, 0) });
  world.allowSleep = true;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.defaultContactMaterial.friction = 0.35;
  world.defaultContactMaterial.restitution = 0.3;
  const floorMat = new CANNON.Material('floor'), dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, { friction: 0.45, restitution: 0.32 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.4 }));
  world.__dieMat = dieMat;
  const plane = (name, rot) => {
    const b = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
    b.quaternion.setFromEuler(rot[0], rot[1], rot[2]); world.addBody(b); walls[name] = b;
  };
  plane('floor', [-Math.PI / 2, 0, 0]); plane('roof', [Math.PI / 2, 0, 0]);
  plane('l', [0, Math.PI / 2, 0]); plane('r', [0, -Math.PI / 2, 0]); plane('t', [0, 0, 0]); plane('b', [0, Math.PI, 0]);
  placeWalls();
}
function placeWalls() {
  const m = 0.6;                                   // margine: i dadi restano ben visibili
  walls.floor.position.set(0, 0.02, 0); walls.roof.position.set(0, 14, 0);
  walls.l.position.set(-B.halfW + m, 0, 0); walls.r.position.set(B.halfW - m, 0, 0);
  walls.t.position.set(0, 0, -B.halfH + m); walls.b.position.set(0, 0, B.halfH - m);
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // camera quasi verticale: il piano y=0 copre esattamente la mappa visibile
  const dist = B.halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  B.halfW = B.halfH * camera.aspect;
  camera.position.set(0, dist, 0.01); camera.lookAt(0, 0, 0);
  Object.assign(key.shadow.camera, { left: -B.halfW - 2, right: B.halfW + 2, top: B.halfH + 2, bottom: -B.halfH - 2, near: 5, far: 80 });
  key.shadow.camera.updateProjectionMatrix();
  placeWalls();
  draw();
}

function draw() { stats.frames++; renderer.render(scene, camera); }

/** Il ciclo di animazione parte con un lancio e si ferma da solo quando i dadi sono fermi. */
function startLoop() { idleFrames = 0; if (!running) { running = true; requestAnimationFrame(loop); } }
function loop() {
  if (!dice.length) { running = false; draw(); return; }            // un ultimo fotogramma a tavolo vuoto
  world.step(1 / 60, 1 / 60, 3);
  let moving = false;
  for (const d of dice) {
    d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
    if (d.body.sleepState !== CANNON.Body.SLEEPING) moving = true;
  }
  idleFrames = moving ? 0 : idleFrames + 1;
  draw();
  if (idleFrames > 30) { running = false; return; }                  // dadi fermi: niente più fotogrammi
  requestAnimationFrame(loop);
}
export const setView = () => {};

// ---------------- dadi ----------------
function pipLayout(n) {
  const c = 0.5, a = 0.25, b = 0.75;
  return ({ 1: [[c, c]], 2: [[a, a], [b, b]], 3: [[a, a], [c, c], [b, b]], 4: [[a, a], [b, a], [a, b], [b, b]],
    5: [[a, a], [b, a], [c, c], [a, b], [b, b]], 6: [[a, a], [b, a], [a, c], [b, c], [a, b], [b, b]] })[n];
}
function faceTexture(n, col) {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.75);
  grad.addColorStop(0, col.bg); grad.addColorStop(1, col.edge);
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.strokeStyle = col.edge; g.lineWidth = 6; g.strokeRect(1, 1, s - 2, s - 2);
  g.fillStyle = col.pip;
  for (const [x, y] of pipLayout(n)) { g.beginPath(); g.arc(x * s, y * s, n === 1 ? s * 0.13 : s * 0.085, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// ordine facce BoxGeometry: +x -x +y -y +z -z  (somma delle opposte = 7)
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));
function materialsFor(colorName) {
  if (!dieMaterials[colorName]) {
    const col = COLORS[colorName] || COLORS.avorio;
    dieMaterials[colorName] = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({ map: faceTexture(v, col), roughness: 0.35, metalness: 0.05 }));
  }
  return dieMaterials[colorName];
}

function clearDice() {
  for (const d of dice) { scene.remove(d.mesh); d.mesh.geometry.dispose(); world.removeBody(d.body); }
  dice.length = 0;
  if (renderer && !running) draw();
}
function readTop(d) {
  let best = -2, val = 1;
  const q = new THREE.Quaternion().copy(d.body.quaternion);
  FACE_AXES.forEach((ax, i) => { const dot = ax.clone().applyQuaternion(q).y; if (dot > best) { best = dot; val = FACE_VALUES[i]; } });
  return { val, flat: best };
}
function snapFlat(d) {
  const q = new THREE.Quaternion().copy(d.body.quaternion);
  let best = -2, axis = null;
  FACE_AXES.forEach(ax => { const w = ax.clone().applyQuaternion(q); if (w.y > best) { best = w.y; axis = w; } });
  const fix = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0));
  q.premultiply(fix);
  d.body.quaternion.set(q.x, q.y, q.z, q.w);
  d.body.position.y = DIE / 2 + 0.02;
}

/** Tira dadi fisici. specs = [{colore:'rosso'}, ...]. Restituisce la lista dei valori in ordine. */
export function rollDice(specs) {
  rollChain = rollChain.then(() => doRoll(specs));
  return rollChain;
}
function doRoll(specs) {
  clearDice(); const mio = ++rollToken; startLoop();
  if (!specs.length) return Promise.resolve([]);
  const geo = new THREE.BoxGeometry(DIE, DIE, DIE);
  const shape = new CANNON.Box(new CANNON.Vec3(DIE / 2, DIE / 2, DIE / 2));
  specs.forEach((sp, i) => {
    const mesh = new THREE.Mesh(geo.clone(), materialsFor(sp.colore || 'avorio'));
    mesh.castShadow = true; scene.add(mesh);
    const body = new CANNON.Body({ mass: 1, shape, material: world.__dieMat, sleepSpeedLimit: 0.6, sleepTimeLimit: 0.45, linearDamping: 0.08, angularDamping: 0.12 });
    body.position.set(-B.halfW + 3, 5 + i * 2, (Math.random() - 0.5) * (B.halfH - 3) + (i - specs.length / 2) * 1.1);
    body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    body.velocity.set(12 + Math.random() * 9, -3, (Math.random() - 0.5) * 9);
    body.angularVelocity.set((Math.random() - 0.5) * 45, (Math.random() - 0.5) * 45, (Math.random() - 0.5) * 45);
    world.addBody(body);
    dice.push({ mesh, body });
  });
  return new Promise(resolve => {
    const t0 = performance.now(); let kicks = 0;
    const timer = setInterval(() => {
      const waited = performance.now() - t0;
      const allStill = dice.every(d => d.body.sleepState === CANNON.Body.SLEEPING || (d.body.velocity.length() < 0.6 && d.body.angularVelocity.length() < 0.8));
      if (!(allStill && waited > 900) && waited < 7000) return;
      const reads = dice.map(readTop);
      const cocked = reads.some(r => r.flat < 0.97);
      if (cocked && kicks < 2 && waited < 7000) {
        kicks++; dice.forEach((d, i) => { if (reads[i].flat < 0.97) { d.body.wakeUp(); startLoop(); d.body.applyImpulse(new CANNON.Vec3((Math.random() - .5) * 4, 3, (Math.random() - .5) * 4)); } });
        return;
      }
      clearInterval(timer);
      dice.forEach((d, i) => { if (reads[i].flat < 0.995) snapFlat(d); });
      const vals = dice.map(d => readTop(d).val);
      setTimeout(() => resolve(vals), 350);
      setTimeout(() => { if (mio === rollToken) clearDice(); }, 6500);
    }, 120);
  });
}
export const clearTable = clearDice;
export const diceColors = Object.keys(COLORS);
