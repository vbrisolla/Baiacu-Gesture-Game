# Baiacu

Jogo de navegador em que você controla um baiacu com a mão, pela webcam. Abra a mão e ele infla e sobe. Feche e ele murcha e afunda. O objetivo é atravessar o recife desviando dos corais e pegando pérolas pelo caminho.

Também dá para jogar só com o teclado, o mouse ou o toque na tela.

---

## Sumário

1. [Como rodar](#como-rodar)
2. [Como jogar](#como-jogar)
3. [Controles](#controles)
4. [O baiacu: tamanho e movimento](#o-baiacu-tamanho-e-movimento)
5. [Obstáculos, pérolas e pontuação](#obstáculos-pérolas-e-pontuação)
6. [Vidas e dano](#vidas-e-dano)
7. [Dificuldade progressiva](#dificuldade-progressiva)
8. [Telas e fluxo do jogo](#telas-e-fluxo-do-jogo)
9. [Tutorial e calibração da mão](#tutorial-e-calibração-da-mão)
10. [Pausa](#pausa)
11. [Como a mão é detectada](#como-a-mão-é-detectada)
12. [Problemas comuns](#problemas-comuns)
13. [Estrutura do código](#estrutura-do-código)
14. [Ajustando o jogo (`CFG`)](#ajustando-o-jogo-cfg)
15. [Depuração](#depuração)
16. [Privacidade](#privacidade)

---

## Como rodar

Não há instalação nem etapa de build: são só três arquivos estáticos (`index.html`, `style.css`, `game.js`).

1. Abra a pasta no VS Code.
2. Instale a extensão **Live Server** e clique em **Go Live**. Outra opção é rodar `npx serve` dentro da pasta.
3. Abra o endereço `http://localhost:...` no **Chrome** ou no **Edge** e libere a câmera quando o navegador pedir.

Abrir o `index.html` direto do disco também costuma funcionar, mas aí o navegador pede a permissão da câmera toda vez.

### Requisitos

- Navegador moderno com suporte a `getUserMedia` e módulos ES (Chrome, Edge, Firefox recentes).
- A câmera só funciona em **contexto seguro**: `localhost`, `https://` ou arquivo local. Num endereço `http://` comum de outra máquina, ela é bloqueada.
- **Internet** na primeira vez. O detector de mão ([MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker), versão `0.10.14`) é baixado do jsDelivr, e o modelo vem do Google Storage. São alguns MB. As fontes (Baloo 2 e Figtree) vêm do Google Fonts.
- No modo teclado, a câmera e o detector não são necessários.

---

## Como jogar

O cenário rola sozinho da direita para a esquerda. O baiacu fica sempre na mesma posição horizontal; você só controla **a altura e o tamanho** dele.

- Passe pelas aberturas entre os corais sem encostar neles.
- Pegue as pérolas para ganhar pontos extras.
- Nas **fendas estreitas** (corais rosa) o baiacu só passa se estiver pequeno.
- Você tem **3 vidas**. Quando acabarem, o jogo termina e mostra sua pontuação e o recorde da sessão.

O truque do jogo está no fato de que **tamanho e movimento são a mesma coisa**: para subir, o baiacu precisa inflar (e fica grande); para ficar pequeno, ele murcha (e afunda). Passar numa fenda estreita exige deixar a mão meio aberta, com o peixe num tamanho médio e parado na altura certa.

---

## Controles

### Com a câmera

| Gesto | Efeito |
|---|---|
| Mão bem aberta | Infla e sobe |
| Mão meio aberta | Mantém a altura (tamanho médio) |
| Mão fechada | Murcha e afunda |
| Tirar a mão da câmera | Pausa o jogo automaticamente |

A prévia da câmera aparece no canto da tela, com o esqueleto da mão desenhado por cima e uma barra de **Abertura** de 0% a 100%. Se a mão some, a prévia fica destacada.

Dicas: deixe a mão inteira visível, a uns dois palmos da tela, com a palma voltada para a câmera e boa iluminação.

### Com teclado, mouse ou toque

| Tecla / ação | Efeito |
|---|---|
| Segurar **Espaço**, **↑** ou **W** | Infla e sobe |
| Soltar | Murcha e afunda |
| Toques curtos | Mantêm a altura |
| Segurar o clique ou o dedo na tela do jogo | Mesmo que segurar o espaço |
| **P** ou **Esc** | Pausa / retoma |
| **Enter** | Aciona o botão principal da tela atual (Começar, Jogar de novo, Continuar) |

No teclado, a abertura não muda de uma vez: ela sobe gradualmente enquanto a tecla está pressionada e desce quando é solta, levando cerca de 0,4 s para ir de murcho a totalmente inflado.

Dá para trocar da câmera para o teclado no meio da partida, pelo botão **Trocar para o teclado** na tela de pausa.

---

## O baiacu: tamanho e movimento

Toda a entrada (mão ou teclado) vira um único número, a **abertura**, que vai de 0 (murcho) a 1 (inflado).

**Tamanho.** O raio do baiacu vai de 13 px (murcho) a 54 px (inflado), proporcional à abertura. Os espinhos crescem conforme ele infla, mas são só visuais: para a colisão conta apenas o corpo, com 88% do raio.

**Movimento vertical.**

- Abertura em **0,5** é o ponto neutro: o peixe fica parado.
- Há uma **zona morta** de ±0,07 ao redor do neutro (de 0,43 a 0,57), para a mão não precisar ficar perfeitamente imóvel.
- Acima disso ele sobe; abaixo, desce. Quanto mais longe do neutro, mais rápido, até 250 px/s.
- A velocidade não muda instantaneamente: ela acompanha o alvo com uma leve inércia, e o peixe se inclina na direção em que está indo.

**Limites.** O teto e o fundo de areia não causam dano. O baiacu simplesmente para ao encostar neles.

---

## Obstáculos, pérolas e pontuação

### Corais

Cada obstáculo é um par de rochas de coral (uma descendo do teto, outra subindo do fundo) com uma passagem entre elas.

| Tipo | Cor | Altura da passagem | Largura | Pontos ao passar sem bater |
|---|---|---|---|---|
| Normal | Laranja | 215 px no início, até 170 px | 74 px | **1** |
| Fenda estreita | Rosa | 100 px | 46 px | **3** |

- A altura da passagem varia de um coral para o próximo, mas nunca mais que 170 px, para que o caminho seja sempre possível.
- As fendas estreitas só começam a aparecer depois dos 4 primeiros corais.
- Inflado ao máximo, o corpo do baiacu tem cerca de 95 px de diâmetro para colisão, quase a altura inteira da fenda estreita. Na prática, é preciso atravessá-las meio aberto ou menor.
- Se você bate num coral, ele **não dá ponto**, mesmo que você termine de atravessar.

### Pérolas

- Cerca de 65% dos corais vêm acompanhados de uma pérola, posicionada no meio do caminho até o próximo coral, numa altura aleatória.
- Cada pérola vale **2 pontos**. Ela é coletada ao encostar no baiacu, então um baiacu inflado alcança pérolas mais facilmente.

### Resumo da pontuação

| Evento | Pontos |
|---|---|
| Passar por coral normal sem bater | +1 |
| Passar por fenda estreita sem bater | +3 |
| Pegar uma pérola | +2 |

O placar fica no alto, ao centro. O **recorde** vale para a sessão: ele some quando a página é recarregada.

---

## Vidas e dano

- Você começa com **3 vidas**, mostradas como pequenos baiacus no canto superior esquerdo.
- Encostar num coral tira uma vida. A tela treme, e o baiacu pisca e fica **invencível por 1,6 s**.
- Cada coral só pode tirar uma vida, mesmo que o peixe continue encostado nele.
- Com 0 vidas, aparece a tela de **Fim de jogo**.

---

## Dificuldade progressiva

A dificuldade depende da **pontuação**, não do tempo. Ela cresce em linha reta de 0 a 60 pontos e, a partir daí, fica no máximo.

| Parâmetro | Com 0 pontos | Com 60 pontos ou mais |
|---|---|---|
| Velocidade do cenário | 165 px/s | 270 px/s |
| Distância entre corais | 430 px | 330 px |
| Altura da passagem normal | 215 px | 170 px |
| Chance de fenda estreita | 14% | 38% |

Como as fendas estreitas e as pérolas dão mais pontos, arriscar acelera a dificuldade.

---

## Telas e fluxo do jogo

```
Início ──► Tutorial ──► Contagem (3, 2, 1) ──► Jogando ──► Fim de jogo
               │                                 │  ▲            │
               └── Pular tutorial ───────────────┘  │            ├── Jogar de novo ──► Contagem
                                                Pausa            └── Rever tutorial ──► Tutorial
```

1. **Início.** Escolha **Jogar com a câmera** ou **Jogar com o teclado**. Ao escolher a câmera, o jogo pede permissão, liga o vídeo e baixa o detector. As mensagens de progresso e de erro aparecem logo abaixo dos botões.
2. **Tutorial.** Ensina os gestos passo a passo (veja abaixo). Pode ser pulado.
3. **Contagem.** 3 segundos antes de o cenário começar a andar. O baiacu já responde à mão, para você se posicionar.
4. **Jogando.** O botão **Pausar** fica no canto da tela.
5. **Fim de jogo.** Mostra pontos e recorde, com as opções **Jogar de novo** ou **Rever tutorial**.

O jogo se adapta ao tamanho da janela: a altura lógica é sempre 540 px, e a largura visível acompanha a proporção da tela (com no mínimo 520 px lógicos). Em telas mais largas, você enxerga mais corais à frente.

---

## Tutorial e calibração da mão

O tutorial tem **4 passos com a câmera** e **3 com o teclado** (o primeiro é exclusivo da câmera). Cada passo tem uma barra de progresso, que só enche enquanto você mantém o gesto certo.

| Passo | Câmera | Teclado | Condição | Tempo |
|---|---|---|---|---|
| 1 | Mostre a mão para a câmera | — | Mão detectada | 1,0 s |
| 2 | Abra bem a mão | Segure a barra de espaço | Abertura acima de 70% | 1,2 s |
| 3 | Agora feche a mão | Solte a barra de espaço | Abertura abaixo de 30% | 1,2 s |
| 4 | Deixe a mão meio aberta | Dê toques curtos na barra | Baiacu dentro da faixa clara no meio da tela | 2,0 s |

- Nos passos 1 a 3, se você sai do gesto, a barra esvazia aos poucos. No passo 4 ela só pausa, sem perder o progresso.
- Se a mão some por mais de 0,6 s durante o tutorial, aparece um aviso pedindo para trazê-la de volta.
- No fim, um cartão resume as regras (corais, fendas, pérolas, vidas) e mostra o botão **Começar**.

### Calibração automática

Cada mão é diferente: algumas não abrem tanto, outras não fecham tanto. Durante o tutorial com câmera, o jogo **ajusta a faixa de abertura à sua mão**:

- No passo "Abra bem a mão", ele guarda o quanto sua mão consegue abrir e usa esse valor (um pouco reduzido) como 100%.
- No passo "Agora feche a mão", ele guarda o quanto ela fecha e usa esse valor (um pouco aumentado) como 0%.
- **Ajuda automática:** se você ficar 4 segundos tentando sem conseguir completar um desses passos, o jogo afrouxa o limite com base no que sua mão já mostrou, para você não ficar preso.

Se você pular o tutorial, a faixa padrão é usada. Se o controle parecer difícil, use **Rever tutorial** na tela de fim de jogo para recalibrar.

---

## Pausa

O jogo pausa em três situações:

| Motivo | Como volta |
|---|---|
| A mão sumiu da câmera por mais de 0,45 s | Sozinho: basta mostrar a mão por 0,35 s. Uma nova contagem de 3 s começa. |
| Botão **Pausar**, tecla **P** ou **Esc** | Botão **Continuar**, **P**, **Esc** ou **Enter**, com contagem de 3 s. |
| Você trocou de aba ou minimizou o navegador | Igual à pausa manual. |

A pontuação e as vidas ficam guardadas durante a pausa. A pausa por falta de mão também pode acontecer durante a contagem.

---

## Como a mão é detectada

1. O vídeo da webcam (640×480 de preferência, câmera frontal) é passado quadro a quadro para o **MediaPipe Hand Landmarker**, que roda no próprio navegador. Ele tenta usar a GPU e, se não conseguir, usa a CPU. Só uma mão é rastreada.
2. O detector devolve 21 pontos da mão em coordenadas 3D reais (em metros).
3. O jogo calcula uma **razão de abertura**: a distância média das pontas dos dedos indicador, médio, anelar e mínimo até o pulso, dividida pelo tamanho da palma (pulso até a base do dedo médio).
   - Mão fechada: razão perto de 0,8 a 1,0.
   - Mão aberta: razão perto de 1,8.
   - Por ser uma razão, ela **não depende da distância da mão à câmera**.
4. A razão é convertida para a abertura de 0 a 1 usando a faixa de 1,0 a 1,75 (ou a faixa calibrada no tutorial).
5. A abertura passa por uma suavização exponencial, que tira os tremores do rastreamento sem deixar o controle lento.

O polegar não entra na conta, então a posição dele não importa muito.

---

## Problemas comuns

| Mensagem ou sintoma | O que fazer |
|---|---|
| "A câmera foi bloqueada…" | Clique no ícone de câmera ao lado do endereço da página e libere o acesso. Depois tente de novo. |
| "Não encontrei nenhuma câmera…" | Conecte uma webcam ou jogue com o teclado. |
| "Outro programa está usando a câmera…" | Feche Zoom, Teams, OBS ou outra aba que esteja usando a câmera. |
| "Aqui dentro a câmera não pode ser usada…" | A página está num contexto sem acesso à câmera (por exemplo, dentro de uma prévia embutida ou num `http://` que não é `localhost`). Abra no Chrome ou Edge pelo Live Server. |
| "Não consegui baixar o detector de mão…" | Confira a conexão com a internet. Firewalls corporativos às vezes bloqueiam o jsDelivr ou o Google Storage. |
| O baiacu não sobe o suficiente | Abra mais os dedos e afaste-os entre si, ou refaça o tutorial para recalibrar. |
| O baiacu não desce | Feche bem o punho, ou refaça o tutorial. |
| O jogo pausa toda hora | Melhore a iluminação, afaste um pouco a mão para ela caber inteira no quadro e evite fundos com muita pele ou cor parecida. |
| Controle tremido ou atrasado | Feche outras abas pesadas. Em computadores sem GPU, o detector roda na CPU e é mais lento. |

Detalhes técnicos dos erros aparecem no console do navegador, com o prefixo `[baiacu]`.

---

## Estrutura do código

```
baiacu/
├── index.html   Estrutura das telas: início, tutorial, pausa, fim de jogo, prévia da câmera
├── style.css    Visual dos cartões, botões e da prévia da câmera
├── game.js      Toda a lógica do jogo
└── README.md
```

Não há dependências locais nem build. O MediaPipe é importado dinamicamente de CDN só quando você escolhe jogar com a câmera.

### Organização do `game.js`

O arquivo é um único módulo dentro de uma função autoexecutável, dividido em seções:

| Seção | O que faz |
|---|---|
| `CFG` | Todos os números ajustáveis do jogo (veja abaixo). |
| Constantes `C` | Paleta de cores do cenário, dos corais e do baiacu. |
| Canvas (`resize`) | Escala o canvas para a janela, respeitando a densidade de pixels da tela. |
| Entrada (`input`, `handRatio`, `startCamera`, `detect`, `updateInput`, `drawCam`) | Liga a câmera, carrega o detector, transforma a mão ou o teclado na abertura de 0 a 1 e desenha a prévia. |
| Estado do jogo (`fish`, `game`, `spawnCol`, `stepFish`, `stepWorld`) | Física do baiacu, geração de corais e pérolas, colisões, pontos e vidas. |
| Tutorial (`STEPS`, `updateTutorial`) | Passos do tutorial e calibração automática. |
| Fluxo de telas (`setState`, `pause`, `gameOver`, eventos) | Troca de telas, botões e atalhos de teclado. |
| Desenho (`drawBackground`, `drawCols`, `drawFish`, `drawHud`, `render`) | Todo o visual, desenhado em canvas 2D, sem imagens externas. |
| Laço principal (`frame`) | Roda a cada quadro com `requestAnimationFrame`, com passo de tempo limitado a 50 ms. |

Os estados possíveis do jogo são `start`, `tutorial`, `countdown`, `playing`, `paused` e `over`.

### Acessibilidade

- Se o sistema estiver com **reduzir movimento** ativado (`prefers-reduced-motion`), a tela não treme ao bater.
- O tutorial usa `aria-live` e as mensagens de status usam `role="status"`, para serem lidos por leitores de tela.
- Todo o jogo pode ser jogado só com o teclado.

---

## Ajustando o jogo (`CFG`)

Tudo o que vale a pena calibrar fica no objeto `CFG`, no topo do `game.js`:

| Chave | Padrão | Significado |
|---|---|---|
| `H` | 540 | Altura lógica da tela, em px |
| `MIN_W` | 520 | Largura lógica mínima visível |
| `FLOOR` | 498 | Altura onde começa a areia |
| `R_MIN`, `R_MAX` | 13, 54 | Raio do baiacu murcho e inflado |
| `HIT` | 0.88 | Fração do raio que conta para colisão com corais |
| `V_MAX` | 250 | Velocidade vertical máxima (px/s) |
| `V_RESP` | 6 | Rapidez com que a velocidade responde (maior = menos inércia) |
| `DEAD` | 0.07 | Zona morta em torno da abertura 0,5 |
| `SPEED` | [165, 270] | Velocidade do cenário no início e no máximo |
| `SPACING` | [430, 330] | Distância entre corais no início e no máximo |
| `GAP` | [215, 170] | Altura da passagem normal no início e no máximo |
| `GAP_NARROW` | 100 | Altura da fenda estreita |
| `COL_W`, `COL_W_NARROW` | 74, 46 | Largura do coral normal e do estreito |
| `LEVEL_SCORE` | 60 | Pontos para chegar à dificuldade máxima |
| `LIVES` | 3 | Vidas por partida |
| `INV` | 1.6 | Segundos de invencibilidade depois de bater |
| `HAND_LOST` | 0.45 | Segundos sem mão até pausar |
| `HAND_BACK` | 0.35 | Segundos com a mão de volta até retomar |
| `RATIO_LO`, `RATIO_HI` | 1.0, 1.75 | Faixa padrão da razão dedos/palma (fechada a aberta) |
| `SMOOTH_CAM`, `SMOOTH_KEYS` | 16, 30 | Suavização da abertura na câmera e no teclado (maior = mais rápido) |

Exemplos:

- **Jogo mais fácil:** aumente `GAP`, `SPACING` e `LIVES`, ou diminua `SPEED`.
- **Fendas mais fáceis:** aumente `GAP_NARROW`.
- **Controle menos sensível:** aumente `DEAD` ou diminua `V_MAX`.
- **Câmera com tremedeira:** diminua `SMOOTH_CAM` (fica mais suave, porém com mais atraso).

---

## Depuração

O jogo expõe seu estado no console do navegador:

```js
__baiacu.game    // estado, pontos, vidas, corais e pérolas na tela
__baiacu.input   // modo, mão presente, razão bruta, faixa calibrada (lo/hi), abertura
__baiacu.fish    // posição, velocidade e raio do baiacu
__baiacu.CFG     // ajustes, que podem ser alterados em tempo real
```

Por exemplo, `__baiacu.game.lives = 99` para testar sem perder, ou `__baiacu.input.raw` para ver a razão da sua mão enquanto abre e fecha.

---

## Privacidade

O vídeo da câmera é processado **só no seu navegador**. Nenhuma imagem é gravada nem enviada a lugar nenhum. A internet é usada apenas para baixar o código do detector, o modelo e as fontes.
