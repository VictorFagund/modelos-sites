// Ateliê 3D: a peça é desenhada como no torno (um contorno girado em volta do eixo),
// com esmalte, pé de barro cru e pintinhas de ferro. O cliente gira, troca forma e esmalte e encomenda.
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.getElementById("peca3d");
const palco = canvas.parentElement;
const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (e) {
  palco.classList.add("sem-3d");
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, .1, 30);
camera.position.set(0, 1.05, 3.4);
const alvo = new THREE.Vector3(0, .42, 0);
const camAlvo = camera.position.clone();
const olhar = alvo.clone();

// ---------------------------------------------------------------- estúdio de luz (reflexo no esmalte)
{
  const est = new THREE.Scene();
  est.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x8a8984, side: THREE.BackSide })));
  const caixa = (w, h, x, y, z, ry, forca) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(forca, forca, forca * .97) }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); est.add(m);
  };
  caixa(4, 3, -3.5, 2.5, 2, 0, 6);    // softbox principal
  caixa(2, 4, 3.8, 1.5, -1, 0, 2.5);  // recorte
  caixa(6, 1, 0, 4.8, 0, 0, 3);       // teto
  const pm = new THREE.PMREMGenerator(renderer);
  cena.environment = pm.fromScene(est, .04).texture;
}
const sol = new THREE.DirectionalLight(0xfff4e6, 2.2);
sol.position.set(-2.2, 4, 2.6); sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: .5, far: 10 });
sol.shadow.radius = 6; sol.shadow.bias = -.0004;
cena.add(sol);

// ---------------------------------------------------------------- texturas pintadas em canvas
function textura(desenhar, w = 1024, h = 512) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); desenhar(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
const pintas = (g, w, h, n, cores, rmax) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cores[Math.random() * cores.length | 0];
    const r = Math.random() ** 3 * rmax + .6;
    g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r * 1.6, r, 0, 0, 7); g.fill();
  }
};
const TEX = {
  ferro: textura((g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); pintas(g, w, h, 900, ["rgba(70,45,30,.55)", "rgba(90,60,40,.35)"], 2.2); }),
  respingo: textura((g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); pintas(g, w, h, 500, ["rgba(70,45,30,.5)"], 2); pintas(g, w, h, 260, ["#2d5ac4", "#3d6fd6", "#1f47a8"], 7); }),
  confete: textura((g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); pintas(g, w, h, 400, ["rgba(70,45,30,.45)"], 2); pintas(g, w, h, 300, ["#e2574c", "#f0a43a", "#3d6fd6", "#e77fa3"], 6); }),
  barro: textura((g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); pintas(g, w, h, 4000, ["rgba(80,55,35,.35)", "rgba(255,255,255,.4)", "rgba(60,40,25,.5)"], 1.6); }),
};
const sombra = textura((g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(30,28,25,.55)"); r.addColorStop(.5, "rgba(30,28,25,.18)"); r.addColorStop(1, "rgba(30,28,25,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
}, 256, 256);

// ---------------------------------------------------------------- esmaltes
export const ESMALTES3D = {
  neve:     { nome: "Neve",      cor: 0xf2f0ea, brilho: true,  tex: "ferro",    css: "#efeee9" },
  areia:    { nome: "Areia",     cor: 0xd2bd9c, brilho: false, tex: "ferro",    css: "#cdb99b" },
  respingo: { nome: "Respingo",  cor: 0xf3f1ea, brilho: true,  tex: "respingo", css: "radial-gradient(circle at 30% 35%,#3a63c9 0 14%,transparent 15%),radial-gradient(circle at 65% 60%,#3a63c9 0 10%,transparent 11%),#eeece4" },
  confete:  { nome: "Confete",   cor: 0xf3f1ea, brilho: true,  tex: "confete",  css: "radial-gradient(circle at 30% 35%,#e2574c 0 13%,transparent 14%),radial-gradient(circle at 66% 62%,#3d6fd6 0 11%,transparent 12%),radial-gradient(circle at 60% 25%,#f0a43a 0 9%,transparent 10%),#eeece4" },
  rosa:     { nome: "Rosa",      cor: 0xe9c8be, brilho: true,  tex: "ferro",    css: "#e9cfc6" },
  mar:      { nome: "Mar",       cor: 0x8fb8aa, brilho: true,  tex: "ferro",    css: "#9fbcb2" },
  musgo:    { nome: "Musgo",     cor: 0x5f7046, brilho: true,  tex: "ferro",    css: "#5f7046" },
  cobalto:  { nome: "Cobalto",   cor: 0x2848b4, brilho: true,  tex: "ferro",    css: "#2443b0" },
};
const vidrado = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: TEX.ferro, roughness: .22, clearcoat: 1, clearcoatRoughness: .12, side: THREE.DoubleSide });
const cru = new THREE.MeshStandardMaterial({ color: 0xc4a582, map: TEX.barro, roughness: .96 });

// ---------------------------------------------------------------- formas (contorno de fora em função da altura)
export const FORMAS3D = {
  caneca: { nome: "Caneca", H: .92, alca: true, r: t => .37 + .035 * t + .012 * Math.sin(Math.PI * t), ml: "350 ml", med: "11 × 9 cm", preco: 129 },
  copo:   { nome: "Copo",   H: .74, alca: false, r: t => .31 + .07 * t + .035 * Math.sin(Math.PI * t * .9), ml: "250 ml", med: "9 × 8 cm", preco: 89 },
  tigela: { nome: "Tigela", H: .42, alca: false, r: t => .2 + .45 * Math.pow(t, .55), ml: "500 ml", med: "15 × 7 cm", preco: 119 },
  vaso:   { nome: "Vaso",   H: 1.08, alca: false, r: t => t < .82 ? .19 + .27 * Math.sin(Math.PI * t / .82) ** .85 : .19 + (t - .82) * .28, ml: "para flor", med: "22 × 18 cm", preco: 219 },
};
const PE = .085;          // altura do pé sem esmalte
const PAREDE = .028;

function contorno(f) {
  const N = 48, pts = [new THREE.Vector2(0, 0), new THREE.Vector2(f.r(0) - .03, 0), new THREE.Vector2(f.r(0) - .005, .012)];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(f.r(t), .02 + t * (f.H - .02))); }
  const rt = f.r(1);
  pts.push(new THREE.Vector2(rt - PAREDE * .25, f.H + .012), new THREE.Vector2(rt - PAREDE * .75, f.H + .01), new THREE.Vector2(rt - PAREDE, f.H));
  for (let i = N; i >= 0; i--) { const t = i / N, y = .02 + t * (f.H - .02); if (y < .07) break; pts.push(new THREE.Vector2(Math.max(.01, f.r(t) - PAREDE), y)); }
  pts.push(new THREE.Vector2(0, .07));
  return pts;
}
function construir(nome) {
  const f = FORMAS3D[nome], g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.LatheGeometry(contorno(f), 96), vidrado);
  corpo.castShadow = true; corpo.receiveShadow = true; g.add(corpo);
  // pé de barro cru: um anel por fora, do chão até a linha do esmalte
  const pe = [];
  for (let i = 0; i <= 8; i++) { const y = i / 8 * PE, t = Math.max(0, (y - .02) / (f.H - .02)); pe.push(new THREE.Vector2((y < .012 ? f.r(0) - .03 + y * 2 : f.r(t)) + .0025, y)); }
  const anel = new THREE.Mesh(new THREE.LatheGeometry(pe, 96), cru); anel.castShadow = true; g.add(anel);
  const fundo = new THREE.Mesh(new THREE.CircleGeometry(f.r(0) - .028, 64), cru); fundo.rotation.x = Math.PI / 2; fundo.position.y = .001; g.add(fundo);
  if (f.alca) {
    const meio = f.H * .52, rx = f.r(.52);
    const alca = new THREE.Mesh(new THREE.TorusGeometry(.2, .034, 18, 48, Math.PI * 1.18), vidrado);
    alca.rotation.z = -Math.PI * .59; alca.scale.set(1, 1.18, 1.1);
    alca.position.set(rx + .07, meio, 0); alca.castShadow = true; g.add(alca);
  }
  return g;
}

// ---------------------------------------------------------------- mesa
const chao = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: .16 }));
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; cena.add(chao);
const mancha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sombra, transparent: true, depthWrite: false }));
mancha.rotation.x = -Math.PI / 2; mancha.position.y = .002; cena.add(mancha);

// ---------------------------------------------------------------- estado
const giro = new THREE.Group(); cena.add(giro);
let peca = null, forma = "caneca", esmalte = "respingo";
let subir = 1;                       // 0 → 1: a peça "sobe" no torno quando a forma muda
const corAlvo = new THREE.Color();

function aplicarEsmalte(nome, instantaneo) {
  const e = ESMALTES3D[nome];
  corAlvo.setHex(e.cor);
  if (instantaneo) vidrado.color.copy(corAlvo);
  vidrado.map = TEX[e.tex]; vidrado.roughness = e.brilho ? .22 : .78; vidrado.clearcoat = e.brilho ? 1 : 0;
  vidrado.needsUpdate = true;
}
function trocarForma(nome) {
  if (peca) { giro.remove(peca); peca.traverse(o => o.geometry?.dispose()); }
  forma = nome; peca = construir(nome); giro.add(peca);
  const r = Math.max(...[0, .25, .5, .75, 1].map(FORMAS3D[nome].r));
  mancha.scale.setScalar(r * 3.4);
  alvo.y = FORMAS3D[nome].H * .48;
  camAlvo.set(0, alvo.y + .62, 2.35 + FORMAS3D[nome].H * 1.15);
  subir = reduzido ? 1 : 0;
}

// ---------------------------------------------------------------- girar com o dedo
let yaw = -.5, vel = 0, pitch = 0, arrasto = null, parado = 0;
canvas.addEventListener("pointerdown", e => { arrasto = { x: e.clientX, y: e.clientY, t: performance.now() }; canvas.setPointerCapture(e.pointerId); palco.classList.add("tocou"); });
canvas.addEventListener("pointermove", e => {
  if (!arrasto) return;
  const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y, dt = Math.max(1, performance.now() - arrasto.t);
  yaw += dx * .012; vel = dx * .012 / dt * 16;
  pitch = Math.max(-.22, Math.min(.35, pitch + dy * .004));
  arrasto = { x: e.clientX, y: e.clientY, t: performance.now() };
});
const soltar = () => { arrasto = null; parado = performance.now(); };
canvas.addEventListener("pointerup", soltar); canvas.addEventListener("pointercancel", soltar);
canvas.addEventListener("keydown", e => { if (e.key === "ArrowLeft") vel -= .06; if (e.key === "ArrowRight") vel += .06; });

// ---------------------------------------------------------------- laço
function tamanho() {
  const w = palco.clientWidth, h = palco.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < .9 ? 34 : 28; camera.updateProjectionMatrix();
}
addEventListener("resize", tamanho);
const easeBack = t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
let visivel = false, anterior = performance.now();
function quadro(agora) {
  if (!visivel) return;
  requestAnimationFrame(quadro);
  const dt = Math.min(.05, (agora - anterior) / 1000); anterior = agora;
  if (!arrasto) {
    vel *= .94;
    const ocioso = performance.now() - parado > 2500;
    if (ocioso && !reduzido) vel += (.35 * dt - vel) * .02;     // volta a girar devagar sozinha
    yaw += vel;
    pitch *= .96;
  }
  if (subir < 1) { subir = Math.min(1, subir + dt * 1.6); yaw += (1 - subir) * .25; }
  const k = easeBack(subir);
  giro.scale.set(1 + (1 - k) * .25, Math.max(.02, k), 1 + (1 - k) * .25);
  giro.rotation.y = yaw; giro.rotation.x = pitch * .5;
  vidrado.color.lerp(corAlvo, .12);
  camera.position.lerp(camAlvo, .08); olhar.lerp(alvo, .08);
  camera.lookAt(olhar);
  renderer.render(cena, camera);
}
new IntersectionObserver(([e]) => {
  const era = visivel; visivel = e.isIntersecting;
  if (visivel && !era) { anterior = performance.now(); requestAnimationFrame(quadro); }
}).observe(palco);

// ---------------------------------------------------------------- foto da peça para a sacola
export function foto() {
  vidrado.color.copy(corAlvo); subir = 1; giro.scale.set(1, 1, 1);   // foto sempre da peça pronta
  camera.position.copy(camAlvo); olhar.copy(alvo); camera.lookAt(olhar);
  renderer.render(cena, camera);
  const c = document.createElement("canvas"), s = 220; c.width = s; c.height = s * 1.22;
  const g = c.getContext("2d"); g.fillStyle = "#d6d5d0"; g.fillRect(0, 0, c.width, c.height);
  const src = renderer.domElement, lado = Math.min(src.width, src.height * .82);
  g.drawImage(src, (src.width - lado) / 2, (src.height - lado / .82) / 2, lado, lado / .82, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .82);
}

export const peca3d = {
  forma: () => forma, esmalte: () => esmalte,
  setForma(n) { trocarForma(n); },
  setEsmalte(n) { esmalte = n; aplicarEsmalte(n); },
};

tamanho();
aplicarEsmalte(esmalte, true);
trocarForma(forma);
subir = 1;
camera.position.copy(camAlvo); olhar.copy(alvo); camera.lookAt(olhar);
renderer.render(cena, camera);
palco.classList.add("pronto");
