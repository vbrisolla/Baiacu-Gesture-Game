(() => {
'use strict';

/* ============================================================
   Ajustes do jogo: tudo o que vale a pena calibrar está aqui.
   ============================================================ */
const CFG = {
  H: 540, MIN_W: 520, FLOOR: 498,
  R_MIN: 13, R_MAX: 54,        // raio do baiacu murcho / inflado
  HIT: 0.88,                   // fração do raio que conta para colisão
  V_MAX: 250,                  // velocidade vertical máxima (px/s)
  V_RESP: 6,                   // rapidez com que a velocidade responde
  DEAD: 0.07,                  // zona morta em torno de "meio aberta"
  SPEED: [165, 270],           // velocidade do cenário: início / máximo
  SPACING: [430, 330],         // distância entre corais
  GAP: [215, 170],             // altura da passagem normal
  GAP_NARROW: 100, COL_W: 74, COL_W_NARROW: 46,
  LEVEL_SCORE: 60,             // pontos para chegar na dificuldade máxima
  LIVES: 3, INV: 1.6,
  HAND_LOST: 0.45,             // segundos sem mão até pausar
  HAND_BACK: 0.35,             // segundos com mão até retomar
  RATIO_LO: 1.0, RATIO_HI: 1.75, // faixa da razão dedos/palma (fechada..aberta)
  SMOOTH_CAM: 16, SMOOTH_KEYS: 30,
};
const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const C = {
  top: '#3fb6c2', bottom: '#0c3f63', ray: 'rgba(255,255,255,.07)',
  kelp: 'rgba(8,52,78,.55)', kelpNear: 'rgba(6,40,62,.75)',
  sand: '#e7d3a1', sandDark: '#cdb67f',
  coral: '#ef6f4f', coralDark: '#c44f33', narrow: '#d4508c', narrowDark: '#a5346a',
  body: '#f4c653', belly: '#fff3cf', spot: '#b98524', spike: '#d99f2e', fin: '#e8a93a',
  ink: '#0a2a40', paper: '#fff7e3', pearl: '#fff3d6',
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- canvas ---------- */
const stage = $('stage'), canvas = $('game'), ctx = canvas.getContext('2d');
let W = 960, scale = 1;
function resize() {
  const cw = stage.clientWidth || 960, ch = stage.clientHeight || 540;
  scale = Math.min(ch / CFG.H, cw / CFG.MIN_W);
  W = cw / scale;
  const cssH = CFG.H * scale;
  canvas.style.width = cw + 'px';
  canvas.style.height = cssH + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  fish.x = W * 0.28;
}

/* ============================================================
   Entrada: a mão (ou o teclado) vira um número de 0 a 1.
   ============================================================ */
const input = {
  mode: 'none',        // 'cam' | 'keys'
  present: false,      // há mão no quadro?
  missing: 0, seen: 0, // segundos sem / com mão
  raw: 0, rawS: 1.4,   // razão dedos/palma, bruta e suavizada
  lo: CFG.RATIO_LO, hi: CFG.RATIO_HI,
  target: 0.5, open: 0.5,
  held: false, lm: null,
};
const video = $('video'), camOverlay = $('camOverlay'), camCtx = camOverlay.getContext('2d');
let landmarker = null, lastVideoTime = -1;

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
/* Razão entre a distância média das pontas dos dedos ao pulso e o tamanho da palma.
   Mão fechada fica perto de 0,8; mão aberta, perto de 1,8. Não depende da distância à câmera. */
function handRatio(w) {
  const palm = dist3(w[0], w[9]) || 1e-6;
  return (dist3(w[8], w[0]) + dist3(w[12], w[0]) + dist3(w[16], w[0]) + dist3(w[20], w[0])) / (4 * palm);
}

async function startCamera(onStatus) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('no-media'); e.name = 'NoMediaDevices'; throw e;
  }
  onStatus('Pedindo acesso à câmera…');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (video.videoWidth) $('camBox').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;

  onStatus('Carregando o detector de mão (alguns MB na primeira vez)…');
  try {
    const { FilesetResolver, HandLandmarker } = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { landmarker = await make('GPU'); } catch (_) { landmarker = await make('CPU'); }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    const e = new Error('detector'); e.name = 'DetectorLoad'; e.cause = err; throw e;
  }
}

function detect(now) {
  if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  let res;
  try { res = landmarker.detectForVideo(video, now); } catch (_) { return; }
  const lm = res && res.landmarks && res.landmarks[0];
  const wl = res && res.worldLandmarks && res.worldLandmarks[0];
  if (lm && wl) {
    input.present = true; input.lm = lm;
    input.raw = handRatio(wl);
    input.rawS += (input.raw - input.rawS) * 0.35;
    input.target = clamp((input.raw - input.lo) / (input.hi - input.lo), 0, 1);
  } else {
    input.present = false; input.lm = null;
  }
}

function updateInput(dt, now) {
  if (input.mode === 'cam') {
    detect(now);
    if (input.present) { input.seen += dt; input.missing = 0; }
    else { input.missing += dt; input.seen = 0; }
    input.open += (input.target - input.open) * (1 - Math.exp(-dt * CFG.SMOOTH_CAM));
  } else {
    input.present = true; input.seen = 9; input.missing = 0;
    input.target = clamp(input.target + (input.held ? 1 : -1) * 2.4 * dt, 0, 1);
    input.open += (input.target - input.open) * (1 - Math.exp(-dt * CFG.SMOOTH_KEYS));
  }
}

const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function drawCam() {
  const w = camOverlay.width, h = camOverlay.height;
  camCtx.clearRect(0, 0, w, h);
  const lost = !input.present;
  $('camBox').classList.toggle('lost', lost);
  const pct = Math.round(input.open * 100);
  $('camBar').style.width = pct + '%';
  $('camPct').textContent = pct + '%';
  if (!input.lm) return;
  camCtx.lineWidth = 4; camCtx.lineCap = 'round'; camCtx.strokeStyle = C.body;
  camCtx.beginPath();
  for (const [a, b] of BONES) {
    camCtx.moveTo(input.lm[a].x * w, input.lm[a].y * h);
    camCtx.lineTo(input.lm[b].x * w, input.lm[b].y * h);
  }
  camCtx.stroke();
  camCtx.fillStyle = C.paper;
  for (const p of input.lm) { camCtx.beginPath(); camCtx.arc(p.x * w, p.y * h, 4.5, 0, 6.283); camCtx.fill(); }
}

/* ============================================================
   Estado do jogo
   ============================================================ */
const fish = { x: 260, y: CFG.H / 2, vy: 0, r: 30 };
const game = {
  state: 'start',      // start | tutorial | countdown | playing | paused | over
  t: 0, dist: 0, score: 0, best: 0, lives: CFG.LIVES, passed: 0,
  inv: 0, shake: 0, count: 0, nextCol: 0, lastGapY: CFG.H / 2,
  cols: [], pearls: [], puffs: [], pauseReason: null,
};
const level = () => clamp(game.score / CFG.LEVEL_SCORE, 0, 1);
const speed = () => lerp(CFG.SPEED[0], CFG.SPEED[1], level());

function resetRun() {
  Object.assign(game, { dist: 0, score: 0, lives: CFG.LIVES, passed: 0, inv: 0, shake: 0,
    cols: [], pearls: [], puffs: [], lastGapY: CFG.H / 2 });
  game.nextCol = W + 120;
  fish.y = CFG.H / 2; fish.vy = 0;
}

function spawnCol(x) {
  const lv = level();
  const narrow = game.cols.length + game.passed >= 4 && Math.random() < 0.14 + 0.24 * lv;
  const gapH = narrow ? CFG.GAP_NARROW : lerp(CFG.GAP[0], CFG.GAP[1], lv);
  const lo = 64 + gapH / 2, hi = CFG.FLOOR - 44 - gapH / 2;
  let cy = clamp(rand(lo, hi), game.lastGapY - 170, game.lastGapY + 170);
  cy = clamp(cy, lo, hi);
  game.lastGapY = cy;
  const w = narrow ? CFG.COL_W_NARROW : CFG.COL_W;
  game.cols.push({ x, w, cy, gapH, narrow, done: false, hit: false, seed: Math.random() * 1000 });
  const spacing = lerp(CFG.SPACING[0], CFG.SPACING[1], lv);
  if (Math.random() < 0.65) {
    game.pearls.push({ x: x + w / 2 + spacing / 2, y: rand(90, CFG.FLOOR - 70), r: 11, ph: rand(0, 6.28) });
  }
  return spacing;
}

function stepFish(dt) {
  const o = input.open;
  fish.r = lerp(CFG.R_MIN, CFG.R_MAX, o);
  let d = o - 0.5;
  d = Math.abs(d) < CFG.DEAD ? 0 : (d - Math.sign(d) * CFG.DEAD) / (0.5 - CFG.DEAD);
  const vyTarget = -d * CFG.V_MAX;                     // aberta sobe, fechada desce
  fish.vy += (vyTarget - fish.vy) * Math.min(1, CFG.V_RESP * dt);
  fish.y += fish.vy * dt;
  const top = 26 + fish.r * 0.5, bot = CFG.FLOOR - fish.r * 0.8;
  if (fish.y < top) { fish.y = top; fish.vy = Math.max(0, fish.vy); }
  if (fish.y > bot) { fish.y = bot; fish.vy = Math.min(0, fish.vy); }
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
}

function puff(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.283), s = rand(40, 170);
    game.puffs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.4, 0.8), r: rand(2, 6), color });
  }
}

function stepWorld(dt) {
  const v = speed();
  game.dist += v * dt;
  for (const c of game.cols) c.x -= v * dt;
  for (const p of game.pearls) p.x -= v * dt;
  game.nextCol -= v * dt;
  if (game.nextCol <= W + 120) game.nextCol += spawnCol(game.nextCol);
  game.cols = game.cols.filter((c) => c.x + c.w > -80);
  game.pearls = game.pearls.filter((p) => p.x > -40 && !p.got);
  if (game.inv > 0) game.inv -= dt;

  const cr = fish.r * CFG.HIT;
  for (const c of game.cols) {
    const topH = c.cy - c.gapH / 2, botY = c.cy + c.gapH / 2;
    if (game.inv <= 0 && !c.hit &&
        (circleRect(fish.x, fish.y, cr, c.x, -50, c.w, topH + 50) ||
         circleRect(fish.x, fish.y, cr, c.x, botY, c.w, CFG.H - botY))) {
      c.hit = true; game.lives -= 1; game.inv = CFG.INV; game.shake = 0.3;
      puff(fish.x, fish.y, 14, C.paper);
      if (game.lives <= 0) return gameOver();
    }
    if (!c.done && c.x + c.w < fish.x - fish.r) {
      c.done = true; game.passed += 1;
      if (!c.hit) game.score += c.narrow ? 3 : 1;
    }
  }
  for (const p of game.pearls) {
    if (Math.hypot(p.x - fish.x, p.y - fish.y) < fish.r + p.r) {
      p.got = true; game.score += 2; puff(p.x, p.y, 8, C.pearl);
    }
  }
}

function stepPuffs(dt) {
  for (const p of game.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 60 * dt; p.life -= dt; }
  game.puffs = game.puffs.filter((p) => p.life > 0);
}

/* ============================================================
   Tutorial
   ============================================================ */
const BAND = 58;
const STEPS = [
  { id: 'show', need: 1.0, title: 'Mostre a mão para a câmera',
    hint: 'Deixe a mão inteira visível, a uns dois palmos da tela.', ok: () => input.present },
  { id: 'open', need: 1.2, title: 'Abra bem a mão',
    hint: 'O baiacu infla e sobe.', keys: ['Segure a barra de espaço', 'Segurar também vale com o clique ou o dedo na tela. O baiacu infla e sobe.'],
    ok: () => input.open > 0.7 },
  { id: 'close', need: 1.2, title: 'Agora feche a mão',
    hint: 'Ele murcha e afunda.', keys: ['Solte a barra de espaço', 'Ele murcha e afunda.'],
    ok: () => input.open < 0.3 },
  { id: 'hover', need: 2.0, keep: true, title: 'Deixe a mão meio aberta',
    hint: 'Mantenha o baiacu dentro da faixa clara. Nesse tamanho ele passa nas fendas estreitas.',
    keys: ['Dê toques curtos na barra', 'Mantenha o baiacu dentro da faixa clara. Nesse tamanho ele passa nas fendas estreitas.'],
    ok: () => Math.abs(fish.y - CFG.H / 2) < BAND - fish.r * 0.3 },
];
const tut = { list: [], i: 0, prog: 0, stuck: 0, maxRaw: 0, minRaw: 9 };

function startTutorial() {
  tut.list = STEPS.filter((s) => input.mode === 'cam' || s.id !== 'show');
  tut.i = 0; tut.prog = 0; tut.stuck = 0; tut.maxRaw = 0; tut.minRaw = 9;
  resetRun();
  setState('tutorial');
  showTutStep();
}
function showTutStep() {
  const s = tut.list[tut.i], final = !s;
  $('tutGesture').hidden = final; $('tutFinal').hidden = !final;
  $('tutBarWrap').hidden = final; $('tutGo').hidden = !final;
  $('tutSkip').hidden = final;
  $('tutPauseTip').hidden = input.mode !== 'cam';
  if (final) return;
  const k = input.mode === 'keys' && s.keys;
  $('tutStep').textContent = `Passo ${tut.i + 1} de ${tut.list.length}`;
  $('tutTitle').textContent = k ? s.keys[0] : s.title;
  $('tutHint').textContent = k ? s.keys[1] : s.hint;
  $('tutBar').style.width = '0%';
}
function updateTutorial(dt) {
  stepFish(dt);
  const s = tut.list[tut.i];
  if (!s) return;
  $('tutWarn').hidden = !(input.mode === 'cam' && s.id !== 'show' && input.missing > 0.6);
  const ok = s.ok() && (input.mode !== 'cam' || input.present);
  if (ok) tut.prog += dt; else if (!s.keep) tut.prog = Math.max(0, tut.prog - dt * 0.8);

  if (input.mode === 'cam' && input.present) {
    if (s.id === 'open') tut.maxRaw = Math.max(tut.maxRaw, input.rawS);
    if (s.id === 'close') tut.minRaw = Math.min(tut.minRaw, input.rawS);
    // Socorro: se a pessoa está tentando há um tempo e o limite padrão não serve para a mão dela, ajusta.
    tut.stuck = ok ? 0 : tut.stuck + dt;
    if (tut.stuck > 4) {
      if (s.id === 'open' && tut.maxRaw > input.lo + 0.3) input.hi = tut.maxRaw * 0.95;
      if (s.id === 'close' && tut.minRaw < input.hi - 0.3) input.lo = tut.minRaw * 1.06;
      tut.stuck = 0;
    }
  }
  $('tutBar').style.width = clamp(tut.prog / s.need, 0, 1) * 100 + '%';
  if (tut.prog >= s.need) {
    if (input.mode === 'cam') {   // calibra a faixa com a mão de quem está jogando
      if (s.id === 'open' && tut.maxRaw > input.lo + 0.35) input.hi = tut.maxRaw * 0.94;
      if (s.id === 'close' && tut.minRaw < input.hi - 0.35) input.lo = tut.minRaw * 1.08;
    }
    tut.i += 1; tut.prog = 0; tut.stuck = 0;
    showTutStep();
  }
}

/* ============================================================
   Fluxo de telas
   ============================================================ */
function setState(s) {
  game.state = s;
  $('screenStart').hidden = s !== 'start';
  $('tutorial').hidden = s !== 'tutorial';
  $('screenPause').hidden = s !== 'paused';
  $('screenOver').hidden = s !== 'over';
  $('pauseBtn').hidden = !(s === 'playing' || s === 'countdown');
  $('cam').hidden = input.mode !== 'cam';
}
function startGame() { resetRun(); beginCountdown(); }
function beginCountdown() { game.count = 3; setState('countdown'); }
function pause(reason) {
  if (game.state !== 'playing' && game.state !== 'countdown') return;
  game.pauseReason = reason;
  const hand = reason === 'hand';
  $('pauseTitle').textContent = hand ? 'Cadê a mão?' : 'Jogo pausado';
  $('pauseText').textContent = hand
    ? 'Mostre a mão para a câmera. O jogo volta sozinho, com uma contagem de 3 segundos.'
    : 'Seus pontos estão guardados. Continue quando quiser.';
  $('btnResume').hidden = hand;
  $('btnToKeys').hidden = input.mode !== 'cam';
  setState('paused');
}
function gameOver() {
  game.best = Math.max(game.best, game.score);
  $('overScore').textContent = game.score;
  $('overBest').textContent = game.best;
  setState('over');
}

const CAM_ERRORS = {
  NotAllowedError: 'A câmera foi bloqueada. Libere o acesso no ícone ao lado do endereço da página, ou jogue com o teclado.',
  NotFoundError: 'Não encontrei nenhuma câmera neste computador. Dá para jogar com o teclado.',
  NotReadableError: 'Outro programa está usando a câmera. Feche-o e tente de novo.',
  NoMediaDevices: 'Aqui dentro a câmera não pode ser usada. Abra o arquivo direto no Chrome ou no Edge, ou jogue com o teclado.',
  DetectorLoad: 'Não consegui baixar o detector de mão. Confira a internet e tente de novo.',
};
$('btnCam').addEventListener('click', async () => {
  const st = $('startStatus'), btn = $('btnCam');
  btn.disabled = true; st.classList.add('ok');
  try {
    await startCamera((msg) => { st.textContent = msg; });
    input.mode = 'cam'; st.textContent = '';
    startTutorial();
  } catch (err) {
    st.classList.remove('ok');
    st.textContent = CAM_ERRORS[err.name] || CAM_ERRORS.NoMediaDevices;
    console.warn('[baiacu] câmera indisponível:', err.name, err.cause || err.message);
  } finally { btn.disabled = false; }
});
$('btnKeys').addEventListener('click', () => { input.mode = 'keys'; input.target = 0.5; startTutorial(); });
$('tutSkip').addEventListener('click', startGame);
$('tutGo').addEventListener('click', startGame);
$('btnAgain').addEventListener('click', startGame);
$('btnTutAgain').addEventListener('click', startTutorial);
$('btnResume').addEventListener('click', beginCountdown);
$('pauseBtn').addEventListener('click', () => pause('manual'));
$('btnToKeys').addEventListener('click', () => { input.mode = 'keys'; input.target = input.open; beginCountdown(); });

const HOLD_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
addEventListener('keydown', (e) => {
  if (HOLD_KEYS.has(e.code)) {
    if (e.target instanceof HTMLButtonElement && e.code === 'Space') return; // deixa o botão focado responder
    input.held = true; e.preventDefault();
  }
  if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    const b = [...document.querySelectorAll('button.primary')].find((el) => el.offsetParent !== null && !el.disabled);
    if (b && b.id !== 'btnCam') b.click();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.state === 'paused' && game.pauseReason !== 'hand') beginCountdown();
    else pause('manual');
  }
});
addEventListener('keyup', (e) => { if (HOLD_KEYS.has(e.code)) input.held = false; });
canvas.addEventListener('pointerdown', () => { input.held = true; });
addEventListener('pointerup', () => { input.held = false; });
addEventListener('pointercancel', () => { input.held = false; });
addEventListener('blur', () => { input.held = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause('manual'); });
addEventListener('resize', resize);

/* ============================================================
   Desenho
   ============================================================ */
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
  g.addColorStop(0, C.top); g.addColorStop(1, C.bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, CFG.H);

  ctx.fillStyle = C.ray;                                  // raios de luz
  for (let i = 0; i < 5; i++) {
    const x = ((i * 310 - game.dist * 0.05) % (W + 400) + W + 400) % (W + 400) - 200;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x - 90, CFG.H); ctx.lineTo(x - 220, CFG.H); ctx.fill();
  }
  kelpLayer(0.25, 150, C.kelp, 0.7, t, 11);               // algas ao fundo
  kelpLayer(0.5, 210, C.kelpNear, 1, t, 29);

  ctx.fillStyle = 'rgba(255,255,255,.22)';                // bolhas soltas
  for (let i = 0; i < 16; i++) {
    const bx = ((hash(i + 3) * 1600 - game.dist * 0.6) % (W + 60) + W + 60) % (W + 60) - 30;
    const by = CFG.FLOOR - ((t * (18 + hash(i) * 30) + hash(i + 9) * CFG.FLOOR) % CFG.FLOOR);
    ctx.beginPath(); ctx.arc(bx + Math.sin(t * 1.3 + i) * 5, by, 2 + hash(i + 5) * 4, 0, 6.283); ctx.fill();
  }
}
function kelpLayer(par, period, color, size, t, seed) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const off = (game.dist * par) % period;
  for (let x = -off - period, n = Math.floor((game.dist * par) / period); x < W + period; x += period, n++) {
    const hgt = (90 + hash(n + seed) * 190) * size, sway = Math.sin(t * 0.9 + n) * 14;
    ctx.lineWidth = (10 + hash(n * 2 + seed) * 10) * size;
    ctx.beginPath(); ctx.moveTo(x, CFG.FLOOR + 10);
    ctx.bezierCurveTo(x + 16, CFG.FLOOR - hgt * 0.4, x - 16 + sway, CFG.FLOOR - hgt * 0.7, x + sway, CFG.FLOOR - hgt);
    ctx.stroke();
  }
}
function drawFloor() {
  ctx.fillStyle = C.sandDark; ctx.fillRect(0, CFG.FLOOR, W, CFG.H - CFG.FLOOR);
  ctx.fillStyle = C.sand;
  ctx.beginPath(); ctx.moveTo(0, CFG.H);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, CFG.FLOOR + 6 + Math.sin((x + game.dist) * 0.02) * 5);
  ctx.lineTo(W + 40, CFG.H); ctx.fill();
}

function drawRock(x, y, w, h, tipDown, color, dark, seed) {
  const lip = 20, ex = 7;
  ctx.fillStyle = color; rr(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = dark;                                   // poros
  for (let i = 0, yy = y + 30; yy < y + h - 30; i++, yy += 36) {
    ctx.beginPath();
    ctx.arc(x + w * (0.25 + hash(seed + i) * 0.5), yy + hash(seed + i * 3) * 14, 3 + hash(seed + i * 7) * 4, 0, 6.283);
    ctx.fill();
  }
  ctx.fillStyle = color;                                  // borda da passagem
  rr(x - ex, tipDown ? y + h - lip : y, w + ex * 2, lip, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  rr(x - ex + 5, (tipDown ? y + h - lip : y) + 4, w + ex * 2 - 10, 5, 3); ctx.fill();
}
function drawCols() {
  for (const c of game.cols) {
    const topH = c.cy - c.gapH / 2, botY = c.cy + c.gapH / 2;
    const col = c.narrow ? C.narrow : C.coral, dark = c.narrow ? C.narrowDark : C.coralDark;
    drawRock(c.x, -30, c.w, topH + 30, true, col, dark, c.seed);
    drawRock(c.x, botY, c.w, CFG.FLOOR - botY + 30, false, col, dark, c.seed + 50);
  }
}
function drawPearls(t) {
  for (const p of game.pearls) {
    const y = p.y + Math.sin(t * 2.4 + p.ph) * 5;
    ctx.fillStyle = 'rgba(255,243,214,.25)'; ctx.beginPath(); ctx.arc(p.x, y, p.r + 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = C.pearl; ctx.beginPath(); ctx.arc(p.x, y, p.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - 3.5, y - 3.5, 3, 0, 6.283); ctx.fill();
  }
}

function drawFish(x, y, r, o, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(clamp(fish.vy / 700, -0.3, 0.3));
  const wag = Math.sin(t * 9) * 0.3;

  ctx.fillStyle = C.fin;                                  // cauda
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(-r * 1.25 - 12, -r * 0.3 - 8 + wag * 9);
  ctx.lineTo(-r * 1.1 - 8, wag * 5);
  ctx.lineTo(-r * 1.25 - 12, r * 0.3 + 8 + wag * 9);
  ctx.closePath(); ctx.fill();

  const n = 20, sl = 2 + o * o * r * 0.3;                 // espinhos crescem com a abertura
  ctx.fillStyle = C.spike;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + 0.16;
    if (Math.abs(a - 6.283) < 0.5 || a < 0.5) continue;   // deixa a cara livre
    const ca = Math.cos(a), sa = Math.sin(a), bw = 0.11;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - bw) * r * 0.97, Math.sin(a - bw) * r * 0.97);
    ctx.lineTo(ca * (r + sl), sa * (r + sl));
    ctx.lineTo(Math.cos(a + bw) * r * 0.97, Math.sin(a + bw) * r * 0.97);
    ctx.fill();
  }

  ctx.fillStyle = C.body; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.clip();
  ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.95, r * 1.15, r * 0.75, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = C.spot;
  for (const [sx, sy, sr] of [[-0.45, -0.5, 0.11], [-0.1, -0.68, 0.09], [-0.62, -0.12, 0.08], [0.18, -0.42, 0.07]]) {
    ctx.beginPath(); ctx.arc(sx * r, sy * r, Math.max(1.5, sr * r), 0, 6.283); ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = C.fin;                                  // nadadeira lateral
  ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.22, r * 0.3, r * 0.17, 0.5 + wag * 0.6, 0, 6.283); ctx.fill();

  const er = Math.max(4.5, r * 0.2);                      // olho
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.25, er, 0, 6.283); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(r * 0.45 + er * 0.25, -r * 0.25, er * 0.55, 0, 6.283); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.lineCap = 'round';  // boca
  ctx.beginPath(); ctx.arc(r * 0.82, r * 0.12, Math.max(2, r * 0.09), 0, 6.283); ctx.stroke();
  ctx.restore();
}

function drawHud() {
  ctx.textBaseline = 'top';
  ctx.font = '800 44px "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(6,34,54,.35)'; ctx.fillText(game.score, W / 2 + 2, 15);
  ctx.fillStyle = C.paper; ctx.fillText(game.score, W / 2, 12);
  for (let i = 0; i < CFG.LIVES; i++) {                    // vidas como pequenos baiacus
    const x = 30 + i * 30, y = 34, alive = i < game.lives;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.283);
    if (alive) { ctx.fillStyle = C.body; ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x + 4, y - 3, 2, 0, 6.283); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,247,227,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  if (game.best > 0) {
    ctx.font = '600 13px "Figtree", system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,247,227,.8)'; ctx.fillText('Recorde ' + game.best, 20, 54);
  }
}

function render(t) {
  ctx.save();
  if (game.shake > 0 && !reducedMotion) ctx.translate(rand(-5, 5) * game.shake * 3, rand(-5, 5) * game.shake * 3);
  drawBackground(t);
  if (game.state === 'tutorial' && tut.list[tut.i] && tut.list[tut.i].id === 'hover') {
    ctx.fillStyle = 'rgba(255,247,227,.22)'; ctx.fillRect(0, CFG.H / 2 - BAND, W, BAND * 2);
    ctx.strokeStyle = 'rgba(255,247,227,.7)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ctx.strokeRect(-4, CFG.H / 2 - BAND, W + 8, BAND * 2); ctx.setLineDash([]);
  }
  drawPearls(t);
  drawCols();
  drawFloor();
  const blink = game.inv > 0 && Math.floor(t * 12) % 2 === 0;
  const idle = game.state === 'start' || game.state === 'over';
  if (!blink) {
    drawFish(fish.x, fish.y + (idle ? Math.sin(t * 1.6) * 10 : 0),
      idle ? lerp(CFG.R_MIN, CFG.R_MAX, 0.55 + Math.sin(t * 1.1) * 0.3) : fish.r,
      idle ? 0.55 + Math.sin(t * 1.1) * 0.3 : input.open, t);
  }
  for (const p of game.puffs) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (game.state !== 'start' && game.state !== 'tutorial') drawHud();
  if (game.state === 'countdown') {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 150px "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
    const n = Math.ceil(game.count);
    ctx.fillStyle = 'rgba(6,34,54,.35)'; ctx.fillText(n, W / 2 + 4, CFG.H / 2 + 6);
    ctx.fillStyle = C.paper; ctx.fillText(n, W / 2, CFG.H / 2);
  }
}

/* ============================================================
   Laço principal
   ============================================================ */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  game.t += dt;
  if (input.mode !== 'none') updateInput(dt, now);
  if (game.shake > 0) game.shake -= dt;

  const camLost = input.mode === 'cam' && input.missing > CFG.HAND_LOST;
  switch (game.state) {
    case 'tutorial': updateTutorial(dt); break;
    case 'countdown':
      if (camLost) { pause('hand'); break; }
      fish.r = lerp(CFG.R_MIN, CFG.R_MAX, input.open);
      game.count -= dt;
      if (game.count <= 0) setState('playing');
      break;
    case 'playing':
      if (camLost) { pause('hand'); break; }
      stepFish(dt); stepWorld(dt);
      break;
    case 'paused':
      // A pausa por falta de mão se desfaz sozinha quando a mão volta.
      if (game.pauseReason === 'hand' && input.mode === 'cam' && input.seen > CFG.HAND_BACK) beginCountdown();
      break;
  }
  stepPuffs(dt);
  render(game.t);
  if (input.mode === 'cam') drawCam();
  requestAnimationFrame(frame);
}

resize();
setState('start');
requestAnimationFrame(frame);
window.__baiacu = { game, input, fish, CFG };   // para depurar no console
})();
