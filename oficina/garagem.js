// Oficina em 3D: cena montada em código e tour de câmera guiado pela rolagem.
import * as THREE from "../vendor/three.module.min.js";

const secao = document.getElementById("tour");
const canvas = document.getElementById("tour-canvas");
const paineis = [...secao.querySelectorAll(".parada")];
const pinos = document.getElementById("tour-pinos");
const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

const COR = {
  piso: 0x5d6461, parede: 0x2b3836, faixa: 0xf2c21b, vermelho: 0xd42a1f, azul: 0x1d4fa0,
  borracha: 0x141617, aro: 0x9aa3a6, metal: 0x6f7a7c, branco: 0xeef1ee, madeira: 0x8a6a48,
};

// ---------------------------------------------------------------- renderizador
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  secao.classList.add("sem-3d");
  throw e;
}
const fraco = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia("(max-width: 700px)").matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, fraco ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
cena.background = new THREE.Color(0x0f1a18);
cena.fog = new THREE.Fog(0x0f1a18, 16, 34);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);

// ---------------------------------------------------------------- texturas desenhadas em canvas
function textura(w, h, desenhar, repetir) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  desenhar(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir); }
  t.redesenhar = () => { desenhar(c.getContext("2d"), w, h); t.needsUpdate = true; };
  return t;
}
const concreto = textura(512, 512, (g, w, h) => {
  g.fillStyle = "#6a716e"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v + 4},${v + 2},${Math.random() * .35})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = "rgba(30,34,33,.55)"; g.lineWidth = 3;   // juntas de dilatação
  g.strokeRect(0, 0, w, h);
  g.fillStyle = "rgba(20,22,21,.18)";                        // manchas de óleo
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 50, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); }
}, [4, 3]);
const placa = textura(1024, 256, (g, w, h) => {
  g.fillStyle = "#f6f5ef"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#d42a1f"; g.fillRect(0, 0, w, h * .62);
  g.fillStyle = "#1d4fa0"; g.fillRect(0, h * .62, w, h * .38);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "800 112px 'Shoulders', sans-serif"; g.fillText("SERRA AZUL", w / 2, h * .33);
  g.font = "600 44px 'Shoulders', sans-serif"; g.fillText("AUTO MECÂNICA · DESDE 1998", w / 2, h * .81);
});
const painelFerramentas = textura(512, 256, (g, w, h) => {
  g.fillStyle = "#c8ccc6"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#9da29b";
  for (let x = 12; x < w; x += 20) for (let y = 12; y < h; y += 20) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  g.fillStyle = "#1c2321";                                   // silhuetas de ferramentas
  const chave = (x, y, s) => { g.save(); g.translate(x, y); g.scale(s, s); g.fillRect(-4, 0, 8, 90); g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.fillStyle = "#c8ccc6"; g.fillRect(-6, -16, 12, 14); g.fillStyle = "#1c2321"; g.restore(); };
  [40, 70, 100, 130, 160].forEach((x, i) => chave(x, 50, .7 + i * .12));
  g.fillRect(220, 40, 14, 120); g.fillRect(200, 40, 54, 26);  // martelo
  g.fillRect(300, 60, 110, 18); g.fillRect(400, 48, 30, 42);  // alicate/torquímetro
  g.fillStyle = "#d42a1f"; g.fillRect(450, 120, 40, 100);     // cabo vermelho
});
const telaScanner = textura(256, 160, (g, w, h) => {
  g.fillStyle = "#081311"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#38e08b"; g.font = "700 26px monospace"; g.fillText("P0301", 18, 42);
  g.font = "14px monospace"; g.fillStyle = "#9fdcc0";
  g.fillText("falha de ignição cil. 1", 18, 68);
  g.strokeStyle = "#38e08b"; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x < w - 36; x += 4) g.lineTo(18 + x, 125 + Math.sin(x / 9) * 14 * Math.sin(x / 41));
  g.stroke();
});

// ---------------------------------------------------------------- materiais
const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: .7, metalness: .05, ...o });
const M = {
  piso: mat(0xffffff, { map: concreto, roughness: .85 }),
  parede: mat(COR.parede, { roughness: .95 }),
  faixa: mat(COR.faixa, { roughness: .6 }),
  vermelho: mat(COR.vermelho, { roughness: .35, metalness: .2 }),
  azul: mat(COR.azul, { roughness: .4 }),
  metal: mat(COR.metal, { roughness: .35, metalness: .7 }),
  escuro: mat(0x1e2324, { roughness: .6, metalness: .3 }),
  borracha: mat(COR.borracha, { roughness: .9 }),
  aro: mat(COR.aro, { roughness: .25, metalness: .9 }),
  vidro: mat(0x0c1416, { roughness: .08, metalness: .6 }),
  branco: mat(COR.branco, { roughness: .5 }),
  luz: new THREE.MeshBasicMaterial({ color: 0xfafff6 }),
  farol: new THREE.MeshBasicMaterial({ color: 0xfff1c4 }),
  lanterna: new THREE.MeshBasicMaterial({ color: 0xff3b2e }),
  placa: mat(0xffffff, { map: placa, roughness: .5 }),
  ferramentas: mat(0xffffff, { map: painelFerramentas, roughness: .8 }),
  tela: new THREE.MeshBasicMaterial({ map: telaScanner }),
  madeira: mat(COR.madeira, { roughness: .8 }),
  papel: mat(0xfbfbf6, { roughness: .9 }),
};

function caixa(w, h, d, m, x = 0, y = 0, z = 0, pai = cena, sombra = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = sombra; o.receiveShadow = true;
  pai.add(o);
  return o;
}
function cilindro(r, h, m, x, y, z, pai = cena, seg = 24) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  o.position.set(x, y, z); o.castShadow = o.receiveShadow = true;
  pai.add(o);
  return o;
}

// ---------------------------------------------------------------- carro
function carro(cor) {
  const g = new THREE.Group();
  const lata = mat(cor, { roughness: .28, metalness: .55 });
  const perfil = new THREE.Shape();
  [[-2.1, .32], [2.1, .32], [2.18, .62], [2.05, .8], [1.25, .9], [.55, 1.36], [-.95, 1.4], [-1.65, .98], [-2.15, .9], [-2.2, .55]]
    .forEach(([x, y], i) => i ? perfil.lineTo(x, y) : perfil.moveTo(x, y));
  const corpo = new THREE.Mesh(new THREE.ExtrudeGeometry(perfil, { depth: 1.62, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 3 }), lata);
  corpo.position.z = -.81; corpo.castShadow = true; g.add(corpo);
  const janela = new THREE.Shape();
  [[1.12, .92], [.5, 1.3], [-.9, 1.33], [-1.5, .96]].forEach(([x, y], i) => i ? janela.lineTo(x, y) : janela.moveTo(x, y));
  const vidro = new THREE.Mesh(new THREE.ExtrudeGeometry(janela, { depth: 1.66, bevelEnabled: false }), M.vidro);
  vidro.position.z = -.83; g.add(vidro);
  for (const [x, z] of [[1.33, .8], [1.33, -.8], [-1.33, .8], [-1.33, -.8]]) {
    const roda = new THREE.Group();
    const pneu = new THREE.Mesh(new THREE.TorusGeometry(.26, .11, 12, 28), M.borracha);
    const aro = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .2, 20), M.aro);
    aro.rotation.x = Math.PI / 2;
    pneu.castShadow = true;
    roda.add(pneu, aro);
    roda.position.set(x, .37, z + Math.sign(z) * .02);
    g.add(roda);
  }
  caixa(.05, .12, .34, M.farol, 2.22, .7, .55, g, false); caixa(.05, .12, .34, M.farol, 2.22, .7, -.55, g, false);
  caixa(.05, .1, .3, M.lanterna, -2.24, .74, .6, g, false); caixa(.05, .1, .3, M.lanterna, -2.24, .74, -.6, g, false);
  caixa(.1, .16, 1.5, M.escuro, 2.2, .42, 0, g); caixa(.1, .16, 1.5, M.escuro, -2.22, .42, 0, g);  // para-choques
  return g;
}

// ---------------------------------------------------------------- galpão
const piso = new THREE.Mesh(new THREE.PlaneGeometry(18, 13), M.piso);
piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; cena.add(piso);
caixa(18, 5, .3, M.parede, 0, 2.5, -6.5);
caixa(.3, 5, 13, M.parede, -9, 2.5, 0);
caixa(.3, 5, 13, M.parede, 9, 2.5, 0);
caixa(18, .25, .4, M.vermelho, 0, 1.1, -6.3, cena, false);           // faixa de proteção na parede
const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), M.placa); p.position.set(3.2, 3.6, -6.33); cena.add(p);
// porta de enrolar aberta: só o batente e a lâmina enrolada no alto
caixa(.35, 5.2, .35, M.metal, -8.6, 2.6, 6.4); caixa(.35, 5.2, .35, M.metal, 8.6, 2.6, 6.4);
cilindro(.32, 17.2, M.metal, 0, 5.3, 6.4).rotation.z = Math.PI / 2;

function faixaPiso(w, d, x, z) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.faixa); f.rotation.x = -Math.PI / 2; f.position.set(x, .005, z); f.receiveShadow = true; cena.add(f); }
for (const [x, z, w, d] of [[-4, -4.2, 5.4, .1], [-4, 1.2, 5.4, .1], [-6.7, -1.5, .1, 5.4], [-1.3, -1.5, .1, 5.4],
                             [3.6, -4.2, 5, .1], [3.6, 1.2, 5, .1], [1.1, -1.5, .1, 5.4], [6.1, -1.5, .1, 5.4]]) faixaPiso(w, d, x, z);

// luminárias
for (const x of [-5, 0, 5]) for (const z of [-3, 2]) {
  caixa(2.4, .08, .3, M.escuro, x, 4.62, z, cena, false);
  caixa(2.2, .04, .14, M.luz, x, 4.56, z, cena, false);
}

// ---------------------------------------------------------------- elevador com carro
const elevador = new THREE.Group(); elevador.position.set(-4, 0, -1.5); cena.add(elevador);
for (const s of [-1, 1]) {                                            // colunas nas laterais do carro
  caixa(.36, 3.6, .36, M.vermelho, s * 1.4, 1.8, 0, elevador);
  caixa(.6, .12, .6, M.escuro, s * 1.4, .06, 0, elevador);
  caixa(.2, .2, .2, M.metal, s * 1.4, 3.55, 0, elevador);
}
caixa(3.0, .12, .12, M.metal, 0, 3.68, 0, elevador);                  // travessa superior
const plataforma = new THREE.Group(); elevador.add(plataforma);
for (const s of [-1, 1]) for (const lado of [-1, 1]) {                // braços saindo das colunas para baixo do carro
  const braco = caixa(.14, .08, 1.3, M.escuro, s * .9, .14, lado * .6, plataforma);
  braco.rotation.y = s * lado * .35;
  caixa(.2, .06, .2, M.borracha, s * .62, .2, lado * 1.15, plataforma);
}
const carroAzul = carro(0x1f5cc4); carroAzul.position.y = .22; carroAzul.rotation.y = Math.PI / 2; plataforma.add(carroAzul);

// ---------------------------------------------------------------- rampa de alinhamento
const rampa = new THREE.Group(); rampa.position.set(3.6, 0, -1.5); cena.add(rampa);
for (const s of [-1, 1]) {
  caixa(.6, .45, 5, M.escuro, s * .8, .225, 0, rampa);
  caixa(.62, .04, 5, M.faixa, s * .8, .47, 0, rampa, false);
}
const carroBranco = carro(0xe9ece8); carroBranco.position.y = .47; carroBranco.rotation.y = Math.PI / 2; rampa.add(carroBranco);
for (const [x, z] of [[1.15, 1.33], [-1.15, 1.33], [1.15, -1.33], [-1.15, -1.33]]) {      // cabeçotes de medição
  const c = caixa(.16, .2, .26, M.metal, x, .84, z, rampa);
  caixa(.02, .05, .05, M.lanterna, x + Math.sign(x) * .09, .86, z, rampa, false);
  c.rotation.y = .1;
}

// ---------------------------------------------------------------- bancada e painel de ferramentas
const bancada = new THREE.Group(); bancada.position.set(-1, 0, -5.85); cena.add(bancada);
caixa(2.6, 1, .7, M.vermelho, 0, .5, 0, bancada);
for (let i = 0; i < 4; i++) caixa(2.5, .02, .02, M.escuro, 0, .22 + i * .22, .36, bancada, false);
caixa(2.7, .06, .76, M.madeira, 0, 1.03, 0, bancada);
const painel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), M.ferramentas); painel.position.set(0, 2, -.3); bancada.add(painel);
// peça trocada na bandeja: disco de freio gasto + pastilhas
const bandeja = caixa(.6, .04, .4, M.metal, .55, 1.08, .1, bancada);
const disco = cilindro(.17, .05, mat(0x8b5a3c, { roughness: .9, metalness: .4 }), .55, 1.13, .1, bancada, 28);
caixa(.18, .04, .08, M.escuro, .3, 1.12, .18, bancada); caixa(.18, .04, .08, M.escuro, .82, 1.12, .2, bancada);
const etiqueta = caixa(.12, .002, .08, M.papel, .55, 1.16, .1, bancada, false); etiqueta.rotation.y = .3;

// ---------------------------------------------------------------- carrinho do scanner
const scanner = new THREE.Group(); scanner.position.set(.9, 0, 1.6); scanner.rotation.y = -.5; cena.add(scanner);
caixa(.7, .05, .5, M.escuro, 0, .9, 0, scanner); caixa(.7, .05, .5, M.escuro, 0, .3, 0, scanner);
for (const [x, z] of [[-.32, -.22], [.32, -.22], [-.32, .22], [.32, .22]]) caixa(.04, .9, .04, M.metal, x, .45, z, scanner);
caixa(.5, .025, .34, M.escuro, 0, .94, .02, scanner);
const tampa = new THREE.Group(); tampa.position.set(0, .95, -.15); tampa.rotation.x = -.35; scanner.add(tampa);
caixa(.5, .32, .02, M.escuro, 0, .16, 0, tampa);
const tela = new THREE.Mesh(new THREE.PlaneGeometry(.46, .28), M.tela); tela.position.set(0, .16, .012); tampa.add(tela);
const cabo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(.9, .95, 1.6), new THREE.Vector3(.2, .4, 1.2), new THREE.Vector3(-1.2, .2, .3), new THREE.Vector3(-2.2, .5, -.4)]), 40, .015, 6), mat(0x111111));
cena.add(cabo);

// ---------------------------------------------------------------- balcão
const balcao = new THREE.Group(); balcao.position.set(6.4, 0, 3.8); balcao.rotation.y = -Math.PI / 2; cena.add(balcao);
caixa(2.8, 1.05, .7, M.azul, 0, .525, 0, balcao);
caixa(2.9, .06, .8, M.madeira, 0, 1.08, 0, balcao);
const folha = caixa(.3, .004, .42, M.papel, -.4, 1.115, .05, balcao, false); folha.rotation.y = .15;
for (let i = 0; i < 6; i++) caixa(.2 - (i % 2) * .06, .002, .01, M.escuro, -.42, 1.118, -.1 + i * .05, balcao, false);
caixa(.22, .28, .02, M.escuro, .6, 1.25, -.2, balcao).rotation.x = -.2;                     // maquininha/celular de pé
cilindro(.04, .12, M.vermelho, .2, 1.17, .1, balcao);                                       // caneca

// recepção: placa, janela iluminada e banco de espera na parede direita
const placaRecepcao = textura(512, 256, (g, w, h) => {
  g.fillStyle = "#f6f5ef"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1d4fa0"; g.fillRect(0, 0, w, 70);
  g.fillStyle = "#fff"; g.font = "600 40px 'Shoulders', sans-serif"; g.textBaseline = "middle"; g.fillText("RECEPÇÃO · ORÇAMENTOS", 24, 37);
  g.fillStyle = "#1c2321"; g.font = "600 30px 'Archivo', sans-serif";
  ["Seg a sex  7h30 – 18h", "Sábado  8h – 12h", "Pix · débito · crédito"].forEach((t, i) => g.fillText(t, 24, 120 + i * 46));
});
const quadroRecepcao = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), mat(0xffffff, { map: placaRecepcao, roughness: .6 }));
quadroRecepcao.rotation.y = -Math.PI / 2; quadroRecepcao.position.set(8.83, 2.5, 2.2); cena.add(quadroRecepcao);
const janela = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ color: 0xcfe6ff }));
janela.rotation.y = -Math.PI / 2; janela.position.set(8.83, 2.6, 5.2); cena.add(janela);
for (let i = -1; i <= 1; i++) caixa(.04, 1.3, .04, M.escuro, 8.8, 2.6, 5.2 + i * .87, cena, false);
const luzJanela = new THREE.PointLight(0xcfe6ff, 10, 8, 2); luzJanela.position.set(7.6, 2.6, 5.2); cena.add(luzJanela);
const banco = new THREE.Group(); banco.position.set(8.4, 0, -.6); cena.add(banco);
caixa(.5, .08, 2.2, M.escuro, 0, .46, 0, banco); caixa(.06, .5, 2.2, M.escuro, .22, .75, 0, banco);
for (const z of [-1, 1]) caixa(.4, .44, .06, M.metal, 0, .22, z, banco);
for (const z of [-.6, .2, .8]) caixa(.42, .06, .5, M.azul, -.02, .53, z, banco);

// ---------------------------------------------------------------- cenário de fundo
for (let i = 0; i < 4; i++) {                                                               // pilha de pneus
  const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .14, 12, 28), M.borracha);
  t.rotation.x = Math.PI / 2; t.position.set(7.6, .14 + i * .27, -5.2); t.castShadow = true; cena.add(t);
}
for (const [x, z, c] of [[-8.2, -5.4, M.azul], [-7.5, -5.6, M.azul], [-8.1, -4.6, M.vermelho]]) cilindro(.3, .9, c, x, .45, z);  // tambores
caixa(1.1, 1.9, .5, M.escuro, -6.6, .95, -6.05);                                            // armário de peças
for (let i = 0; i < 4; i++) caixa(1.0, .03, .45, M.metal, -6.6, .4 + i * .45, -6.0, cena, false);
const macaco = new THREE.Group(); macaco.position.set(-1.6, 0, 3); macaco.rotation.y = .7; cena.add(macaco);
caixa(.36, .14, 1.0, M.vermelho, 0, .12, 0, macaco); cilindro(.025, 1.1, M.metal, 0, .5, .8, macaco).rotation.x = .9;

// ---------------------------------------------------------------- luz
cena.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a322a, 1.15));
const sol = new THREE.DirectionalLight(0xfff2dc, 1.6);                                      // luz entrando pela porta
sol.position.set(4, 9, 12); sol.target.position.set(-1, 0, -2); cena.add(sol, sol.target);
sol.castShadow = true;
sol.shadow.mapSize.set(fraco ? 1024 : 2048, fraco ? 1024 : 2048);
Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 30 });
sol.shadow.bias = -.0005; sol.shadow.normalBias = .02;
for (const x of [-5, 0, 5]) { const l = new THREE.PointLight(0xf4fff8, 16, 11, 2); l.position.set(x, 4.3, -.5); cena.add(l); }

// ---------------------------------------------------------------- paradas do tour
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const PARADAS = [
  { pos: v(.4, 3.9, 10.2), alvo: v(0, 1.3, -1.6), lift: 0, pino: null },
  { pos: v(-4.7, 1.25, 3.9), alvo: v(-4, 2.0, -1.5), lift: 1, pino: v(-4, 1.5, -.7) },
  { pos: v(-1.1, 2.0, -2.4), alvo: v(-1, 1.15, -5.8), lift: 1, pino: v(-.45, 1.16, -5.75) },
  { pos: v(2.9, 1.75, 3.9), alvo: v(.8, .95, 1.5), lift: .6, pino: v(.86, 1.25, 1.5) },
  { pos: v(7.4, 2.5, 3.6), alvo: v(3.6, .6, -1.5), lift: .3, pino: v(4.75, .9, -.2) },
  { pos: v(2.6, 2.1, 5.4), alvo: v(7.2, 1.4, 3.6), lift: 0, pino: v(6.35, 1.13, 4.2) },
];

// ---------------------------------------------------------------- rolagem, arrasto e laço
let alvoProgresso = 0, progresso = 0, rodando = false, visivel = false;
const olhar = { yaw: 0, pitch: 0, alvoYaw: 0, alvoPitch: 0 };
const suave = t => t * t * (3 - 2 * t);

function lerProgresso() {
  const r = secao.getBoundingClientRect();
  const total = secao.offsetHeight - innerHeight;
  const f = Math.min(1, Math.max(0, -r.top / total));
  alvoProgresso = f * (PARADAS.length - 1);
}
addEventListener("scroll", lerProgresso, { passive: true });

let arrastando = null;
canvas.addEventListener("pointerdown", e => { arrastando = { x: e.clientX, y: e.clientY, yaw: olhar.alvoYaw, pitch: olhar.alvoPitch }; });
addEventListener("pointermove", e => {
  if (!arrastando) return;
  olhar.alvoYaw = Math.max(-.6, Math.min(.6, arrastando.yaw - (e.clientX - arrastando.x) * .004));
  olhar.alvoPitch = Math.max(-.25, Math.min(.3, arrastando.pitch + (e.clientY - arrastando.y) * .002));
});
addEventListener("pointerup", () => { arrastando = null; });

function tamanho() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < .8 ? 62 : 45;                   // celular em pé: mais campo de visão
  camera.updateProjectionMatrix();
}
addEventListener("resize", tamanho);

const tmpPos = new THREE.Vector3(), tmpAlvo = new THREE.Vector3(), tmp = new THREE.Vector3();
let ativa = -1;
function quadro() {
  if (!visivel) { rodando = false; return; }
  requestAnimationFrame(quadro);
  progresso += (alvoProgresso - progresso) * (reduzido ? 1 : .085);
  if (!arrastando) { olhar.alvoYaw *= .97; olhar.alvoPitch *= .97; }   // volta devagar para o enquadramento
  olhar.yaw += (olhar.alvoYaw - olhar.yaw) * .12;
  olhar.pitch += (olhar.alvoPitch - olhar.pitch) * .12;

  const i = Math.min(PARADAS.length - 2, Math.floor(progresso));
  const a = PARADAS[i], b = PARADAS[i + 1];
  const t = suave(Math.min(1, Math.max(0, progresso - i)));
  tmpPos.lerpVectors(a.pos, b.pos, t);
  tmpAlvo.lerpVectors(a.alvo, b.alvo, t);
  // olhar em volta: gira a câmera em torno do alvo
  tmp.subVectors(tmpPos, tmpAlvo).applyAxisAngle(THREE.Object3D.DEFAULT_UP, olhar.yaw);
  tmp.y += olhar.pitch * tmp.length();
  if (camera.aspect < .8) tmp.multiplyScalar(1.35);   // celular em pé: afasta para caber o setor
  camera.position.copy(tmpAlvo).add(tmp);
  camera.lookAt(tmpAlvo);

  plataforma.position.y = THREE.MathUtils.lerp(a.lift, b.lift, t) * 1.55;

  const agora = Math.round(progresso);
  if (agora !== ativa) {
    ativa = agora;
    paineis.forEach((p, k) => p.classList.toggle("ativa", k === ativa));
    secao.dataset.parada = ativa;
  }
  const alvoPino = PARADAS[ativa].pino;
  if (alvoPino && Math.abs(progresso - ativa) < .25) {
    tmp.copy(alvoPino).project(camera);
    pinos.style.transform = `translate(${(tmp.x * .5 + .5) * canvas.clientWidth}px, ${(-tmp.y * .5 + .5) * canvas.clientHeight}px)`;
    pinos.classList.add("on");
  } else pinos.classList.remove("on");

  renderer.render(cena, camera);
}

new IntersectionObserver(([e]) => {
  visivel = e.isIntersecting;
  if (visivel && !rodando) { rodando = true; lerProgresso(); requestAnimationFrame(quadro); }
}, { rootMargin: "100px" }).observe(secao);

document.fonts.load("800 112px Shoulders").then(() => document.fonts.load("600 44px Shoulders")).then(() => document.fonts.load("600 30px Archivo")).then(() => { placa.redesenhar(); placaRecepcao.redesenhar(); });   // a placa usa a fonte da página
tamanho();
lerProgresso();
progresso = alvoProgresso;
renderer.render(cena, camera);
secao.classList.add("pronto");
