# Katana Motion 🥷

Jogo de corte de frutas controlado pela webcam ou pelo mouse, criado com React, TypeScript, Canvas e MediaPipe Hand Landmarker.

**Sua mão é a lâmina.** Use a ponta do indicador para cortar frutas, encadear combos e evitar bombas. O jogo suporta até duas mãos simultaneamente.

## Como rodar

Requisitos: Node.js 22+ e um navegador moderno (Chrome ou Edge recomendados).

```bash
npm install
npm run dev
```

Na instalação, o script `postinstall` copia o runtime WebAssembly da dependência
`@mediapipe/tasks-vision` e baixa o modelo oficial de reconhecimento de mãos
para `public/`. Assim, os arquivos de IA (~30 MB) não precisam ficar no Git.
Para preparar os arquivos novamente, execute `node scripts/prepare-assets.mjs`.

Abra o endereço local exibido pelo Vite. No navegador, clique em **Começar a jogar** e autorize a webcam, ou selecione o modo mouse.

O acesso à webcam exige **HTTPS ou localhost**. A câmera não é enviada a servidor: o reconhecimento é feito localmente pelo MediaPipe. Os recordes e as estatísticas ficam em `localStorage` no próprio navegador.

## Principais recursos

- Reconhecimento de até duas mãos via MediaPipe e modelo de IA local (`public/models/hand_landmarker.task`).
- Rastreamento da ponta do indicador com compensação de espelhamento e proporção de vídeo.
- Modo mouse (clique + arraste) para jogar sem câmera.
- Física de frutas, colisão de trajetórias, partículas e animações de corte.
- Bombas, corações para recuperar vidas, pontuação, combos e cinco vidas.
- Partida livre e desafio diário com sequência determinística.
- Ranking local, histórico de partidas e estatísticas de precisão.
- Ajustes para exibir ou ocultar vídeo, rastreamento, efeitos e áudio.
- Interface responsiva para desktop e dispositivos móveis.

## Comandos

```bash
npm run dev        # Desenvolvimento
npm run typecheck  # Verificação de tipos
npm test           # Testes de colisão e aleatoriedade
npm run build      # Versão otimizada para produção (dist/)
npm run preview    # Pré-visualização da build
```

## Estrutura

```text
src/
  App.tsx                  Telas, controles e estatísticas
  components/GameArena.tsx Webcam, IA, canvas e eventos de mouse
  game/engine.ts           Física, frutas, colisões e efeitos
  game/math.ts             Geometria e números aleatórios
  game/types.ts            Tipos e configuração
  styles.css               Interface e responsividade
public/
  models/hand_landmarker.task  Modelo do MediaPipe (gerado na instalação)
  wasm/                        Runtime WebAssembly (copiado na instalação)
scripts/
  prepare-assets.mjs          Prepara os arquivos de IA locais
```

## Privacidade e dependências

O jogo não possui backend, autenticação nem armazenamento de vídeo. O navegador obtém os quadros da câmera e o MediaPipe os processa localmente. Após `npm install`, o modelo e o runtime WASM ficam em `public/`, portanto não dependem de CDNs durante a partida. A instalação precisa de internet para baixar o modelo oficial.

O aplicativo utiliza as fontes Barlow Condensed e DM Sans do Google Fonts; caso indisponíveis, utiliza fontes locais equivalentes.

## Créditos

Projeto independente de **Hiago Martins**, inspirado no gênero de jogos de corte de frutas controlados por movimentos.
