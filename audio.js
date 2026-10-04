/* ============================================================
   Som do Baiacu: tudo sintetizado com a Web Audio API, sem arquivos de áudio.
   Expõe window.BaiacuSom. O AudioContext só é criado depois do primeiro
   gesto do jogador, porque os navegadores bloqueiam áudio antes disso.
   ============================================================ */
(() => {
'use strict';

/* Ajustes de som: volumes de 0 a 1, frequências em Hz, tempos em segundos. */
const SOM = {
  MASTER: 0.7,
  FADE: 0.06,                // tempo para silenciar ou voltar (pausa, aba sem foco, botão)
  TOM_VOL: 0.05,             // tom contínuo: bem baixo, para não cansar
  TOM_FREQ: [110, 247],      // altura do tom: murcho .. inflado
  TOM_FILTRO: 650,           // passa-baixa que tira o brilho do tom
  TOM_SUAVE: 0.05,           // quão rápido a altura segue a mão
  TOM_VIBRATO: [4.5, 2.5],   // velocidade (Hz) e profundidade (Hz) de um vibrato leve
  PEROLA_VOL: 0.22,
  BATIDA_VOL: 0.55,
  FENDA_VOL: 0.14,
  BIPE_VOL: 0.14,
  FIM_VOL: 0.16,
  RECORDE_VOL: 0.15,
};

let ac = null, master = null, sfx = null, tomOsc = null, tomGain = null, ruidoBuf = null;
let ligado = true, quieto = false;

function volumeMaster() { return ligado && !quieto ? SOM.MASTER : 0; }
function aplicarMaster() {
  if (master) master.gain.setTargetAtTime(volumeMaster(), ac.currentTime, SOM.FADE);
}

function criar() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = volumeMaster();
  master.connect(ac.destination);
  sfx = ac.createGain();
  sfx.connect(master);

  // Tom contínuo: triângulo -> passa-baixa -> volume. Fica sempre ligado, só o volume muda.
  tomOsc = ac.createOscillator();
  tomOsc.type = 'triangle';
  tomOsc.frequency.value = SOM.TOM_FREQ[0];
  const lfo = ac.createOscillator(), lfoGanho = ac.createGain();
  lfo.frequency.value = SOM.TOM_VIBRATO[0];
  lfoGanho.gain.value = SOM.TOM_VIBRATO[1];
  lfo.connect(lfoGanho).connect(tomOsc.frequency);
  const filtro = ac.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = SOM.TOM_FILTRO;
  tomGain = ac.createGain();
  tomGain.gain.value = 0;
  tomOsc.connect(filtro).connect(tomGain).connect(master);
  tomOsc.start(); lfo.start();

  ruidoBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/* Desbloqueia o áudio no primeiro gesto. Chamado a cada clique ou tecla, mas só age uma vez. */
function desbloquear() {
  if (!ac) criar();
  if (ac && ac.state === 'suspended') ac.resume();
}

/* ---------- blocos de construção dos efeitos ---------- */
function nota(freq, ini, dur, vol, { tipo = 'sine', freqFim = null, ataque = 0.006 } = {}) {
  const t = ac.currentTime + ini;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (freqFim) osc.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(sfx);
  osc.start(t); osc.stop(t + dur + 0.03);
}
function ruido(ini, dur, vol, corte) {
  const t = ac.currentTime + ini;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = ruidoBuf;
  f.type = 'lowpass'; f.frequency.value = corte;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfx);
  src.start(t); src.stop(t + dur + 0.03);
}

/* ---------- efeitos ---------- */
const EFEITOS = {
  // "Ploc": um blip curto que sobe rápido.
  perola() {
    nota(420, 0, 0.11, SOM.PEROLA_VOL, { freqFim: 1150 });
    nota(1700, 0.045, 0.06, SOM.PEROLA_VOL * 0.35);
  },
  // Batida grave com um sopro de ruído.
  batida() {
    nota(150, 0, 0.3, SOM.BATIDA_VOL, { freqFim: 42 });
    ruido(0, 0.16, SOM.BATIDA_VOL * 0.45, 500);
  },
  // Subida brilhante ao passar pela fenda estreita.
  fenda() {
    nota(330, 0, 0.28, SOM.FENDA_VOL, { tipo: 'triangle', freqFim: 1320, ataque: 0.02 });
    [784, 988, 1319].forEach((f, i) => nota(f, 0.12 + i * 0.06, 0.14, SOM.FENDA_VOL * 0.8, { tipo: 'triangle' }));
  },
  // Contagem regressiva: o último número soa mais agudo.
  bipe(n) {
    nota(n === 1 ? 880 : 587, 0, 0.12, SOM.BIPE_VOL, { tipo: 'square', ataque: 0.004 });
  },
  // Fim de jogo: quatro notas descendo.
  fim() {
    [523, 440, 349, 262].forEach((f, i) =>
      nota(f, 0.18 + i * 0.16, i === 3 ? 0.55 : 0.18, SOM.FIM_VOL, { tipo: 'triangle' }));
  },
  // Recorde: arpejo subindo e um acorde final.
  recorde() {
    [523, 659, 784, 1047].forEach((f, i) => nota(f, 0.18 + i * 0.1, 0.16, SOM.RECORDE_VOL, { tipo: 'triangle' }));
    [1047, 1319, 1568].forEach((f) => nota(f, 0.62, 0.7, SOM.RECORDE_VOL * 0.7, { tipo: 'triangle', ataque: 0.02 }));
  },
};

window.BaiacuSom = {
  desbloquear,
  /* Preferência do jogador (botão de som). */
  setLigado(v) { ligado = !!v; aplicarMaster(); },
  /* Silêncio temporário: pausa ou aba sem foco. */
  setQuieto(v) { quieto = !!v; aplicarMaster(); },
  /* Chamado a cada quadro. A altura segue a abertura; o volume só existe enquanto "ativo". */
  tom(abertura, ativo) {
    if (!ac) return;
    const t = ac.currentTime;
    const [f0, f1] = SOM.TOM_FREQ;
    tomOsc.frequency.setTargetAtTime(f0 * Math.pow(f1 / f0, abertura), t, SOM.TOM_SUAVE);
    tomGain.gain.setTargetAtTime(ativo ? SOM.TOM_VOL : 0, t, ativo ? 0.15 : SOM.FADE);
  },
  tocar(nome, ...args) {
    if (!ac || !EFEITOS[nome] || volumeMaster() === 0) return;
    EFEITOS[nome](...args);
  },
};

// Qualquer clique, toque ou tecla serve de gesto para liberar o áudio.
addEventListener('pointerdown', desbloquear, true);
addEventListener('keydown', desbloquear, true);
})();
