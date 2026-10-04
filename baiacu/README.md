# Baiacu

Jogo de navegador controlado pela mão, via webcam. Abra a mão para o baiacu inflar e subir; feche para ele murchar e afundar.

## Como rodar

1. Abra a pasta no VS Code.
2. Instale a extensão **Live Server** e clique em "Go Live" (ou rode `npx serve` na pasta).
3. Abra o endereço `http://localhost:...` no Chrome ou Edge e libere a câmera.

Abrir o `index.html` direto do disco também costuma funcionar, mas o navegador pede a permissão da câmera toda vez.

É preciso internet: o detector de mão (MediaPipe Hand Landmarker) é baixado de uma CDN na primeira vez.

## Arquivos

- `index.html`: estrutura das telas (início, tutorial, pausa, fim de jogo).
- `style.css`: visual dos cartões e da prévia da câmera.
- `game.js`: detecção da mão, física, obstáculos, tutorial e desenho. Os ajustes de dificuldade ficam no objeto `CFG`, no topo do arquivo.

## Controles

- Câmera: mão aberta infla e sobe, mão fechada murcha e afunda, meio aberta mantém a altura.
- Teclado: segurar espaço infla, soltar murcha. `P` pausa, `Enter` confirma.

## Privacidade

O vídeo é processado no próprio navegador. Nada é gravado nem enviado.
