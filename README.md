# Katana Motion 🥷

### Sua mão é a lâmina. Corte, combine e sobreviva.

**Katana Motion** é um jogo interativo de corte de frutas desenvolvido para navegadores, com controle por **webcam e visão computacional**, além de uma alternativa por **mouse**. Os movimentos da ponta do dedo indicador são convertidos em golpes, permitindo jogar com **as duas mãos simultaneamente**.

**Projeto de portfólio de [Hiago Martins](https://github.com/Mart1nsHiago)** · [Meu portfólio](https://mart1nshiago.github.io/) · [Direitos autorais e uso](COPYRIGHT.md)

`React` · `TypeScript` · `Vite` · `MediaPipe` · `Canvas 2D` · `WebAssembly`

---

## Sobre o projeto

O objetivo foi combinar interfaces web, reconhecimento de mãos em tempo real e lógica de jogos em uma experiência que funciona diretamente no navegador, **sem backend**.

### Funcionalidades

- **Controle por webcam:** reconhecimento e rastreamento de até **duas mãos** com MediaPipe Hand Landmarker.
- **Cortes com os dedos:** movimentação rápida da ponta do indicador como trajetória da lâmina.
- **Modo mouse:** clique e arraste para jogar sem webcam.
- **Mecânicas de jogo:** frutas, bombas, recuperação de vidas, pontuação, combos e efeitos visuais.
- **Dois modos:** partida livre e desafio diário com sequência reproduzível.
- **Histórico e ranking locais:** partidas, recordes, precisão e evolução da pontuação.
- **Configurações:** espelhamento, visualização dos pontos das mãos, rastros, som e redução de efeitos.
- **Interface responsiva:** adaptação para diferentes tamanhos de tela.

## Como funciona tecnicamente

O jogo possui três partes principais:

| Camada | Responsabilidade | Arquivos |
| --- | --- | --- |
| **Interface** | Telas, HUD, modos, configurações, ranking e estatísticas | `src/App.tsx`, `src/styles.css` |
| **Rastreamento e renderização** | Acesso à câmera, MediaPipe, coordenadas das mãos e desenho no Canvas | `src/components/GameArena.tsx` |
| **Motor do jogo** | Física, trajetórias, colisões, pontuação, efeitos e dificuldade | `src/game/engine.ts`, `src/game/math.ts`, `src/game/types.ts` |

### Fluxo de controle por webcam

1. O navegador solicita permissão para acessar a câmera usando `getUserMedia`.
2. O **MediaPipe Hand Landmarker** analisa os quadros do vídeo localmente.
3. A posição do **indicador** de cada mão detectada é transformada em coordenadas da área do jogo, considerando espelhamento e enquadramento.
4. Os deslocamentos entre posições formam trajetórias de corte.
5. O motor calcula a interseção das trajetórias com os objetos em movimento e atualiza vidas, pontos e combos.
6. O **Canvas 2D** desenha frutas, partículas, trilhas e o rastreamento das mãos.

O rastreamento usa um modelo de visão computacional executado no navegador com suporte a **WebAssembly**. Não há processamento de vídeo em um servidor do projeto.

### Decisões técnicas

- **Separação de responsabilidades:** a UI React fica isolada da lógica de física e colisão.
- **Geometria de trajetórias:** a detecção de acerto considera o caminho percorrido pelo dedo, não apenas sua posição final.
- **Modelo local:** os arquivos de IA e WASM são preparados durante a instalação e servidos com o aplicativo.
- **Persistência no navegador:** preferências e estatísticas são guardadas em `localStorage`, sem login.
- **Testabilidade:** os cálculos de colisão e a geração de sequências do desafio diário têm testes automatizados.

## Rodando localmente

**Pré-requisitos:** Node.js **22+**, npm e um navegador moderno (Chrome ou Edge recomendados).

```bash
git clone https://github.com/Mart1nsHiago/katana-motion.git
cd katana-motion
npm install
npm run dev
```

Abra o endereço informado pelo Vite. Escolha **Webcam** para jogar com as mãos e autorize o acesso à câmera; se preferir, escolha **Mouse**.

> **Importante:** navegadores exigem **HTTPS ou localhost** para acessar a webcam. Na primeira instalação, o script `postinstall` baixa o modelo oficial do MediaPipe e copia o runtime WASM para `public/`. Por isso, é necessária conexão com a internet na instalação.

Caso precise reconstruir os arquivos locais de IA:

```bash
node scripts/prepare-assets.mjs
```

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Executar o ambiente de desenvolvimento |
| `npm run typecheck` | Verificar os tipos TypeScript |
| `npm test` | Executar testes de colisão e geração determinística |
| `npm run build` | Compilar para produção em `dist/` |
| `npm run preview` | Pré-visualizar a versão de produção |

## Estrutura do repositório

```text
src/
├── App.tsx                    # Telas, controles e estatísticas
├── components/
│   └── GameArena.tsx          # Webcam, rastreamento e Canvas
├── game/
│   ├── engine.ts              # Motor do jogo e colisões
│   ├── math.ts                # Geometria e funções aleatórias
│   └── types.ts               # Tipos e configurações
├── main.tsx                   # Entrada da aplicação
└── styles.css                 # Layout e responsividade
public/
└── favicon.svg                # Identidade visual
scripts/
└── prepare-assets.mjs         # Preparação de modelo e WASM
test/
└── game-math.test.mjs         # Testes automatizados
```

Os arquivos gerados em `public/models/` e `public/wasm/` não são versionados porque somam aproximadamente 30 MB.

## Privacidade

- O acesso à câmera depende de autorização explícita no navegador.
- O vídeo é processado **localmente**; o projeto não envia nem armazena imagens da webcam.
- Não há backend ou cadastro de usuários.
- Recordes, histórico e preferências ficam apenas no armazenamento do navegador.
- As fontes de interface podem ser carregadas do Google Fonts, com fontes alternativas locais caso o serviço esteja indisponível.

## Autoria e créditos

**Hiago Martins** — responsável pelo projeto Katana Motion, sua apresentação e manutenção.

- GitHub: [@Mart1nsHiago](https://github.com/Mart1nsHiago)
- Portfólio: [mart1nshiago.github.io](https://mart1nshiago.github.io/)

Projeto independente inspirado no gênero de jogos de corte de frutas, desenvolvido com tecnologias web e bibliotecas de terceiros. As dependências utilizadas mantêm suas próprias licenças.

## Direitos autorais e reutilização

**© 2026 Hiago Martins. Todos os direitos reservados sobre os componentes originais.**

O código está público para **consulta e avaliação técnica**, mas **não foi disponibilizado sob uma licença de código aberto**. A publicação não concede autorização geral para redistribuir, comercializar ou incorporar o código original em outros projetos. Continuam válidos os direitos previstos na legislação e os recursos de visualização e *fork* permitidos pelos termos do GitHub.

Leia as condições completas em **[COPYRIGHT.md](COPYRIGHT.md)**.
