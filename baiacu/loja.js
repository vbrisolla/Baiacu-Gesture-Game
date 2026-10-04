/* ============================================================
   Loja do Baiacu: catálogo de cores e roupas, desenho das roupas e a tela da loja.
   Expõe window.BaiacuLoja. A tela usa o mesmo drawFish do jogo, recebido em montar().
   ============================================================ */
(() => {
'use strict';

/* ---------- catálogo: preços e cores ficam todos aqui ---------- */
// Cada cor troca juntos corpo, barriga, pintas, espinhos e nadadeiras.
// "contorno" claro nas cores escuras mantém o peixe visível no fundo escuro.
const CORES = [
  { id: 'amarelo', nome: 'Amarelo clássico', preco: 0,
    body: '#f4c653', belly: '#fff3cf', spot: '#b98524', spike: '#d99f2e', fin: '#e8a93a' },
  { id: 'coral', nome: 'Coral', preco: 40,
    body: '#f58f6e', belly: '#ffe7dc', spot: '#b8503a', spike: '#d9654a', fin: '#ea7457' },
  { id: 'menta', nome: 'Menta', preco: 60,
    body: '#8fdcc0', belly: '#effcf5', spot: '#3c977a', spike: '#4fae8e', fin: '#66c3a2' },
  { id: 'lilas', nome: 'Lilás', preco: 90,
    body: '#c4a6ea', belly: '#f6efff', spot: '#7a58ae', spike: '#9877cb', fin: '#a786d6' },
  { id: 'marinho', nome: 'Azul-marinho', preco: 140,
    body: '#2f5192', belly: '#cfdcf3', spot: '#172d58', spike: '#1f3b72', fin: '#4169b0',
    contorno: 'rgba(255,247,227,.7)' },
  { id: 'dourado', nome: 'Dourado', preco: 400,
    body: '#ebb92f', belly: '#fff1b8', spot: '#9a6a0a', spike: '#c98f12', fin: '#f4d35e', brilho: true },
];

const SLOTS = [
  { id: 'cabeca', nome: 'Cabeça' },
  { id: 'rosto', nome: 'Rosto' },
  { id: 'pescoco', nome: 'Pescoço' },
];
const ROUPAS = [
  { id: 'palha', slot: 'cabeca', nome: 'Chapéu de palha', preco: 50 },
  { id: 'bone', slot: 'cabeca', nome: 'Boné', preco: 80 },
  { id: 'cartola', slot: 'cabeca', nome: 'Cartola', preco: 150 },
  { id: 'coroa', slot: 'cabeca', nome: 'Coroa', preco: 300 },
  { id: 'oculos', slot: 'rosto', nome: 'Óculos escuros', preco: 70 },
  { id: 'monoculo', slot: 'rosto', nome: 'Monóculo', preco: 120 },
  { id: 'gravata', slot: 'pescoco', nome: 'Gravata-borboleta', preco: 60 },
  { id: 'cachecol', slot: 'pescoco', nome: 'Cachecol', preco: 100 },
];

const TAU = Math.PI * 2;
const THUMB = 72;   // lado da miniatura, em pixels de CSS

/* ============================================================
   Desenho das roupas. Tudo acontece dentro do save/translate/rotate do drawFish:
   origem no centro do peixe, olhando para a direita, medidas em múltiplos de r.
   f = { r, o, t, wag, er, ex, ey }  (er, ex, ey: raio e centro do olho)
   camada "corpo": logo depois do corpo; camada "frente": por cima do olho e da boca.
   ============================================================ */
function rrect(g, x, y, w, h, rad) {
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, rad) : g.rect(x, y, w, h);
}

const DESENHO = {
  palha: { camada: 'frente', desenhar(g, { r }) {
    g.save(); g.translate(r * 0.1, -r * 0.84); g.rotate(0.2);
    g.strokeStyle = 'rgba(120,80,20,.45)'; g.lineWidth = r * 0.03;
    g.fillStyle = '#e3c06a';                              // aba
    g.beginPath(); g.ellipse(0, 0, r * 0.82, r * 0.16, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#efcf7e';                              // copa
    g.beginPath(); g.moveTo(-r * 0.4, 0);
    g.quadraticCurveTo(-r * 0.42, -r * 0.56, 0, -r * 0.56);
    g.quadraticCurveTo(r * 0.42, -r * 0.56, r * 0.4, 0);
    g.closePath(); g.fill(); g.stroke();
    g.clip();
    g.fillStyle = '#c4473a'; g.fillRect(-r * 0.5, -r * 0.2, r, r * 0.12);   // fita
    g.restore();
  } },

  bone: { camada: 'frente', desenhar(g, { r }) {
    g.save(); g.translate(r * 0.12, -r * 0.82); g.rotate(0.25);
    g.fillStyle = '#a8302a';                              // pala para a frente
    g.beginPath(); g.ellipse(r * 0.44, r * 0.02, r * 0.44, r * 0.1, 0.05, 0, TAU); g.fill();
    g.fillStyle = '#d9473f';                              // copa
    g.beginPath(); g.ellipse(0, 0, r * 0.52, r * 0.44, 0, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = r * 0.035;
    g.beginPath(); g.moveTo(0, -r * 0.44); g.quadraticCurveTo(r * 0.2, -r * 0.22, r * 0.14, 0); g.stroke();
    g.fillStyle = '#a8302a'; g.beginPath(); g.arc(0, -r * 0.45, r * 0.06, 0, TAU); g.fill();
    g.restore();
  } },

  cartola: { camada: 'frente', desenhar(g, { r }) {
    g.save(); g.translate(r * 0.1, -r * 0.86); g.rotate(0.18);
    g.fillStyle = '#23262f';
    g.beginPath(); g.ellipse(0, 0, r * 0.64, r * 0.13, 0, 0, TAU); g.fill();
    rrect(g, -r * 0.36, -r * 0.9, r * 0.72, r * 0.92, r * 0.06); g.fill();
    g.fillStyle = '#b8344a'; g.fillRect(-r * 0.36, -r * 0.24, r * 0.72, r * 0.15);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-r * 0.26, -r * 0.84, r * 0.08, r * 0.56);
    g.restore();
  } },

  coroa: { camada: 'frente', desenhar(g, { r, t }) {
    g.save(); g.translate(r * 0.08, -r * 0.86); g.rotate(0.15);
    const w = r * 0.48, h = r * 0.52;
    g.fillStyle = '#f5c542'; g.strokeStyle = '#b07d0c'; g.lineWidth = r * 0.035; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-w, 0); g.lineTo(-w, -h); g.lineTo(-w * 0.5, -h * 0.45); g.lineTo(0, -h * 1.1);
    g.lineTo(w * 0.5, -h * 0.45); g.lineTo(w, -h); g.lineTo(w, 0); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#e0a92a'; g.fillRect(-w, -h * 0.28, w * 2, h * 0.28);
    g.fillStyle = '#d23a4b'; g.beginPath(); g.arc(0, -h * 0.14, r * 0.07, 0, TAU); g.fill();
    g.fillStyle = '#3d7fd9';
    for (const sx of [-0.6, 0.6]) { g.beginPath(); g.arc(sx * w, -h * 0.14, r * 0.05, 0, TAU); g.fill(); }
    g.fillStyle = '#fff6d0';                              // pontas com bolinhas que piscam
    const pisca = 0.75 + 0.25 * Math.sin(t * 4);
    for (const [px, py] of [[-w, -h], [0, -h * 1.1], [w, -h]]) {
      g.beginPath(); g.arc(px, py, r * 0.055 * pisca, 0, TAU); g.fill();
    }
    g.restore();
  } },

  // O olho tem tamanho mínimo (er nunca fica menor que 4,5 px), então o que cobre o olho segue er.
  oculos: { camada: 'frente', desenhar(g, { r, er, ex, ey }) {
    const w = er * 2.9, h = er * 2.1;
    g.strokeStyle = '#1b1f27'; g.lineCap = 'round';
    g.lineWidth = Math.max(1, er * 0.3);
    g.beginPath(); g.moveTo(ex - w * 0.45, ey - h * 0.15); g.lineTo(-r * 0.12, ey - r * 0.1); g.stroke();   // haste
    g.beginPath(); g.moveTo(ex + w * 0.48, ey - h * 0.2); g.lineTo(ex + w * 0.48 + er * 0.6, ey - h * 0.26); g.stroke();
    g.fillStyle = '#1b1f27'; rrect(g, ex - w / 2, ey - h / 2, w, h, h * 0.45); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, er * 0.18);
    g.beginPath(); g.moveTo(ex - w * 0.25, ey - h * 0.12); g.lineTo(ex - w * 0.05, ey - h * 0.3); g.stroke();
  } },

  monoculo: { camada: 'frente', desenhar(g, { r, er, ex, ey }) {
    const R = er * 1.4;
    g.fillStyle = 'rgba(210,235,255,.3)'; g.beginPath(); g.arc(ex, ey, R, 0, TAU); g.fill();
    g.strokeStyle = '#d4a017'; g.lineWidth = Math.max(1.2, er * 0.25); g.stroke();
    g.lineWidth = Math.max(0.8, er * 0.12);               // corrente
    g.beginPath(); g.moveTo(ex - R * 0.3, ey + R * 0.95);
    g.quadraticCurveTo(ex - r * 0.15, ey + r * 0.65, r * 0.02, r * 0.55); g.stroke();
  } },

  gravata: { camada: 'frente', desenhar(g, { r }) {
    g.save(); g.translate(r * 0.58, r * 0.7); g.rotate(-0.7);   // deitada na borda do corpo, sob a boca
    const s = r * 0.3;
    g.fillStyle = '#d23a4b'; g.strokeStyle = '#8f1f2c'; g.lineWidth = r * 0.03; g.lineJoin = 'round';
    for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0); g.lineTo(d * s, -s * 0.62); g.lineTo(d * s, s * 0.62); g.closePath();
      g.fill(); g.stroke();
    }
    g.beginPath(); g.ellipse(0, 0, s * 0.28, s * 0.36, 0, 0, TAU); g.fill(); g.stroke();
    g.restore();
  } },

  // Faixa em volta do "pescoço" (logo atrás da cabeça) e duas pontas que balançam com a cauda.
  cachecol: { camada: 'corpo', desenhar(g, { r, wag }) {
    const A = '#3b7dd8', B = '#f2f5fa';
    g.save();
    g.fillStyle = A;
    for (const [dy, k] of [[0, 1], [r * 0.14, 0.78]]) {
      const sw = wag * r * 0.3;
      g.beginPath();
      g.moveTo(-r * 0.24, r * 0.7 + dy);
      g.quadraticCurveTo(-r * 0.6, r * 0.9 + dy + sw * 0.5, -r * k, r * 0.8 + dy + sw);
      g.lineTo(-r * k + r * 0.04, r * 1.0 + dy + sw);
      g.quadraticCurveTo(-r * 0.55, r * 1.08 + dy + sw * 0.5, -r * 0.06, r * 0.86 + dy);
      g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(0, 0, r * 1.02, 0, TAU); g.clip();
    g.beginPath();
    g.moveTo(-r * 0.32, -r * 1.1); g.quadraticCurveTo(-r * 0.12, 0, -r * 0.32, r * 1.1);
    g.lineTo(-r * 0.02, r * 1.1); g.quadraticCurveTo(r * 0.18, 0, -r * 0.02, -r * 1.1);
    g.closePath(); g.fill();
    g.clip();
    g.fillStyle = B;
    for (let y = -r; y < r; y += r * 0.32) g.fillRect(-r * 0.4, y, r * 0.7, r * 0.1);
    g.restore();
  } },
};
const ORDEM = ['pescoco', 'rosto', 'cabeca'];   // ordem de desenho: o chapéu fica por cima de tudo

/* ---------- consultas ---------- */
const acharCor = (id) => CORES.find((c) => c.id === id);
const acharRoupa = (id) => ROUPAS.find((r) => r.id === id);
const acharItem = (id) => acharCor(id) || acharRoupa(id);

/* O visual do peixe a partir do que está equipado: { cor, roupas }. */
function visual(eq) {
  return {
    cor: acharCor(eq.cor) || CORES[0],
    roupas: ORDEM.map((slot) => acharRoupa(eq[slot])).filter((it) => it && it.slot && eq[it.slot] === it.id),
  };
}
function desenharRoupas(g, look, f, camada) {
  for (const it of look.roupas) if (DESENHO[it.id].camada === camada) DESENHO[it.id].desenhar(g, f);
}

/* Corrige o que veio do localStorage: só itens que existem, equipados só se comprados e no lugar certo. */
function validar(save) {
  save.owned = save.owned.filter((id) => acharItem(id));
  if (!save.owned.includes(CORES[0].id)) save.owned.unshift(CORES[0].id);
  const cor = acharCor(save.equipped.cor);
  if (!cor || !save.owned.includes(cor.id)) save.equipped.cor = CORES[0].id;
  for (const s of SLOTS) {
    const it = acharRoupa(save.equipped[s.id]);
    if (!it || it.slot !== s.id || !save.owned.includes(it.id)) save.equipped[s.id] = null;
  }
  return save;
}

/* ============================================================
   Tela da loja: mouse, toque e teclado (não pela mão).
   ============================================================ */
let deps = null, aba = 'cores';
const $ = (id) => document.getElementById(id);

function estado(item) {
  const { save } = deps;
  const tem = save.owned.includes(item.id);
  const usando = item.slot ? save.equipped[item.slot] === item.id : save.equipped.cor === item.id;
  if (!tem) {
    const falta = item.preco - save.coins;
    return falta > 0
      ? { texto: `Faltam ${falta}`, classe: 'falta', off: true }
      : { texto: 'Comprar', classe: 'comprar', off: false };
  }
  if (usando) {
    return item.slot
      ? { texto: 'Tirar', classe: 'tirar', off: false, equipado: true }
      : { texto: 'Equipado', classe: 'equipado', off: true, equipado: true };
  }
  return { texto: 'Equipar', classe: 'equipar', off: false };
}

function agir(id) {
  const { save, persist } = deps;
  const item = acharItem(id);
  if (!item) return;
  const tem = save.owned.includes(item.id);
  if (!tem) {
    if (save.coins < item.preco) return;
    save.coins -= item.preco;
    save.owned.push(item.id);
  }
  const lugar = item.slot || 'cor';
  if (item.slot && tem && save.equipped[lugar] === item.id) save.equipped[lugar] = null;   // tirar
  else save.equipped[lugar] = item.id;                                                       // comprar ou equipar
  persist();
  render(id);
}

function miniatura(item) {
  const cv = document.createElement('canvas');
  cv.className = 'thumb'; cv.width = cv.height = THUMB * 2;
  cv.setAttribute('aria-hidden', 'true');
  const g = cv.getContext('2d');
  g.setTransform(2, 0, 0, 2, 0, 0);
  const eq = deps.save.equipped;
  const look = item.slot
    ? { cor: acharCor(eq.cor) || CORES[0], roupas: [item] }
    : { cor: item, roupas: [] };
  deps.drawFish(g, THUMB * 0.6, THUMB * 0.58, THUMB * 0.27, 0.45, 0.3, 0, look);
  return cv;
}

function cartao(item) {
  const st = estado(item);
  const el = document.createElement('div');
  el.className = 'item' + (st.equipado ? ' is-on' : '');
  el.appendChild(miniatura(item));
  const info = document.createElement('div');
  info.className = 'item-info';
  const nome = document.createElement('b'); nome.textContent = item.nome;
  const preco = document.createElement('span'); preco.className = 'price';
  if (item.preco) { preco.innerHTML = '<i class="coin" aria-hidden="true"></i>'; preco.append(String(item.preco)); }
  else preco.textContent = 'Grátis';
  info.append(nome, preco);
  if (st.equipado) {
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Equipado';
    info.appendChild(tag);
  }
  const btn = document.createElement('button');
  btn.className = 'buy ' + st.classe; btn.dataset.id = item.id;
  btn.textContent = st.texto; btn.disabled = st.off;
  btn.setAttribute('aria-label', `${st.texto}: ${item.nome}`);
  el.append(info, btn);
  return el;
}

function grade(itens) {
  const g = document.createElement('div');
  g.className = 'grid';
  itens.forEach((it) => g.appendChild(cartao(it)));
  return g;
}

/* Redesenha a lista. Se "foco" for um id, devolve o foco a esse botão (ou à aba, se ele ficou desabilitado). */
function render(foco) {
  const lista = $('shopList');
  lista.textContent = '';
  if (aba === 'cores') lista.appendChild(grade(CORES));
  else {
    for (const s of SLOTS) {
      const h = document.createElement('h3'); h.textContent = s.nome;
      lista.append(h, grade(ROUPAS.filter((r) => r.slot === s.id)));
    }
  }
  $('tabCores').setAttribute('aria-selected', String(aba === 'cores'));
  $('tabRoupas').setAttribute('aria-selected', String(aba === 'roupas'));
  $('tabCores').tabIndex = aba === 'cores' ? 0 : -1;
  $('tabRoupas').tabIndex = aba === 'roupas' ? 0 : -1;
  $('shopCoins').textContent = deps.save.coins;
  if (foco) {
    const b = lista.querySelector(`button[data-id="${foco}"]`);
    (b && !b.disabled ? b : $(aba === 'cores' ? 'tabCores' : 'tabRoupas')).focus();
  }
}

function trocarAba(nova) { aba = nova; render(); $('shopList').scrollTop = 0; }

function montar(d) {
  deps = d;
  $('tabCores').addEventListener('click', () => trocarAba('cores'));
  $('tabRoupas').addEventListener('click', () => trocarAba('roupas'));
  $('shopTabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    trocarAba(aba === 'cores' ? 'roupas' : 'cores');
    $(aba === 'cores' ? 'tabCores' : 'tabRoupas').focus();
  });
  $('shopList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) agir(b.dataset.id);
  });
}

function abrir() {
  aba = 'cores';
  render();
  $('shopList').scrollTop = 0;
  $('tabCores').focus();
}

/* Prévia animada do peixe com tudo o que está equipado. Chamada a cada quadro com a loja aberta. */
function animar(t) {
  const cv = $('shopPreview');
  const g = cv.getContext('2d');
  const s = cv.width / 2;   // o canvas tem o dobro da resolução do CSS
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.setTransform(2, 0, 0, 2, 0, 0);
  const o = 0.55 + Math.sin(t * 1.1) * 0.25;
  deps.drawFish(g, s * 0.56, s * 0.6 + Math.sin(t * 1.6) * 4, s * 0.25, o, t, 0, visual(deps.save.equipped));
}

window.BaiacuLoja = { CORES, ROUPAS, SLOTS, visual, desenharRoupas, validar, montar, abrir, animar };
})();
