# Minardi VTT 3.0

Virtual Tabletop (VTT) modular construído sobre **Google Apps Script**, acessível pelo navegador sem instalação. Projetado para sessões de RPG de mesa usando um monitor horizontal como "mesa" física.

> **Idioma do projeto:** Português (pt-BR)
> **Status:** Ativo (baseado no código analisado — sem informações externas)

---

## O que é

Minardi VTT é uma aplicação web single-page que roda como **Google Apps Script Web App**. O mestre acessa a URL gerada pelo GAS e controla a sessão; jogadores veem o monitor físico (projetor ou TV deitada).

Três sistemas principais funcionam em conjunto:

**Tokens** — fichas de personagem visuais no grid. Cada token carrega imagem (do Google Drive), nome, barras de HP/Mana/Entropia, armadura por região/tipo, iniciativa e notas. O mestre pode arrastar tokens, editar atributos pelo menu de contexto, aplicar dano com cálculo automático de armadura e gerenciar a ordem de combate.

**Iluminação** — fog of war com raycasting. O mestre desenha paredes que bloqueiam a luz e posiciona fontes de luz (ou associa luz a tokens). Jogadores só "veem" o que está iluminado. O mestre pode ativar visão total (tecla `L`) para navegar sem limitações.

**Áudio** — trilha sonora integrada com Google Drive. Suporta música (com crossfade e playlist automática), ambiências simultâneas em loop e efeitos sonoros instantâneos. Soundscapes permitem salvar e restaurar combinações de som com um clique.

---

## Pré-requisitos

- Conta Google com acesso ao Google Drive
- Google Apps Script habilitado (padrão para contas Google)
- Navegador moderno (Chrome recomendado — a app usa `canvas`, `Audio`, `ResizeObserver`)
- CLASP instalado globalmente se quiser editar e fazer push: `npm install -g @google/clasp`

---

## Deploy

### Primeira vez

1. Acesse [script.google.com](https://script.google.com) e crie um novo projeto.
2. Faça push dos arquivos via CLASP:
   ```bash
   clasp login
   clasp push
   ```
3. No editor GAS, vá em **Implantar → Nova implantação**:
   - Tipo: **Web App**
   - Executar como: **Usuário que acessa o aplicativo**
   - Acesso: **Qualquer pessoa** (ou restrinja conforme necessário)
4. Autorize os escopos solicitados (Drive + External Requests).
5. Copie a URL gerada — essa é a URL da sessão.

### Atualizações

```bash
clasp push
# No editor GAS: Implantar → Gerenciar implantações → Nova versão
```

---

## Configuração de Pastas no Drive

### Mapas e Tokens

Na sidebar da aplicação, informe o **ID** de uma pasta do Google Drive (o trecho da URL após `/folders/`). O sistema carrega imagens e vídeos diretamente, convertendo para base64.

- **Pasta de Mapas:** aceita imagens (PNG, JPG, WEBP etc.) e vídeos (MP4 etc.)
- **Pasta de Tokens:** aceita apenas imagens

### Áudio

O sistema de áudio usa uma estrutura de pastas específica criada automaticamente:

```
Minardi VTT/
└── Audio/
    ├── Music/
    │   ├── Combat/
    │   ├── Exploration/
    │   ├── Tavern/
    │   ├── Horror/
    │   └── City/
    ├── Ambience/
    │   ├── Rain/
    │   ├── Forest/
    │   ├── Sea/
    │   ├── Cave/
    │   └── Wind/
    └── Effects/
        ├── Combat/
        ├── Magic/
        ├── Monsters/
        └── Doors/
```

Clique em **"Conectar Drive"** na seção Áudio da sidebar — a estrutura é criada automaticamente se não existir. Depois, adicione arquivos de áudio (MP3, OGG, WAV etc.) nas subpastas desejadas.

---

## Modos de Operação

A aplicação possui um modo ativo por vez, controlado pelo objeto global `VTTMode`:

| Modo | Como ativar | O que faz |
|---|---|---|
| `measure` | Padrão / Escape | Ferramentas de régua, raio e cone no grid |
| `tokens` | Botão "Ativar Tokens" | Interação com fichas no canvas |
| `lighting` | Botão "Ativar Iluminação" | Edição de fog of war e paredes |

---

## Controles Principais

### Grid e Mapas

| Ação | Como |
|---|---|
| Conectar pasta de mapas | Sidebar → Arquivos → inserir ID da pasta → Conectar |
| Selecionar mapa | Clicar no nome na lista gerada |
| Ajustar grid | Sidebar → Ferramentas de Grid (tamanho em cm, cor, opacidade) |
| Calibrar para monitor físico | Sidebar → Monitor → informar polegadas da tela |
| Escalar mapa | Slider "Ajustar Mapa" (−100% a +100%) |
| Salvar configurações | Botão "SALVAR" (persiste em localStorage) |

### Ferramentas de Medição (modo `measure`)

Clicar e arrastar no mapa ativa a ferramenta selecionada na sidebar:

| Ferramenta | Resultado |
|---|---|
| Régua (linha) | Distância em quadrados e metros |
| Raio (circle) | Área circular |
| Cone | Cone com ângulo configurável |

### Tokens (modo `tokens`)

| Ação | Como |
|---|---|
| Criar token | Duplo clique no grid |
| Mover | Arrastar (move grupo se múltiplos selecionados) |
| Selecionar múltiplos | Ctrl+clique ou arrastar seleção retangular |
| Selecionar todos | Ctrl+A |
| Copiar / Colar | Ctrl+C / Ctrl+V |
| Mover por teclado | Setas direcionais |
| Deletar | Delete |
| Abrir menu | Botão direito sobre token |
| Arrastar imagem para mapa | Arrastar da galeria de tokens |

### Menu de Contexto do Token

Botão direito sobre um token abre o menu com opções:

- **➕/➖ Aumentar/Diminuir** — tamanho em células do grid
- **✏️ Nome** — editor de texto multilinha (Shift+Enter para nova linha, Enter para confirmar)
- **❤️ Vitalidade / 🔵 Mana / 💀 Entropia** — configurar barras de status (current/max/enabled)
- **⚔️ Iniciativa** — valor numérico para o tracker de combate
- **🛡️ Armadura** — proteção e modificador (normal/vulnerável/resistente) por região (cabeça, tronco, braços, pernas) e tipo (cortante, contundente, perfurante)
- **🩸 Receber Dano** — painel de cálculo com armadura aplicada automaticamente
- **🗡️ Atacar** — ativa modo de ataque com indicador de alcance
- **📝 Notas** — campo de texto livre

### Iluminação (modo `lighting`)

| Ação | Como |
|---|---|
| Ativar/desativar fog | Sidebar → Iluminação → Ativar Iluminação |
| Ver tudo (mestre) | Botão "Mostrar Tudo" ou tecla `L` |
| Abrir painel de edição | Botão "Painel de Iluminação" |
| Desenhar escuridão | Painel → Escuridão → Desenhar (rect ou circle) |
| Desenhar parede | Painel → Paredes → Desenhar (clique → clique) |
| Adicionar fonte de luz | Painel → Luz → configurar e adicionar |
| Luz de token | Menu de contexto do token → configurar luz |
| Sair do modo | Escape |

### Áudio

| Ação | Como |
|---|---|
| Conectar biblioteca | Sidebar → Áudio → Conectar Drive |
| Abrir painel | Botão "Abrir Painel de Áudio" |
| Tocar música | Painel → aba Music → categoria ou faixa |
| Ativar ambiência | Painel → aba Ambience → toggle por categoria |
| Disparar efeito | Painel → aba Effects → botão de faixa |
| Salvar soundscape | Painel → aba Soundscapes → nomear e salvar |
| Silêncio total | Sidebar → Silêncio Total |

---

## Persistência de Dados

| O que persiste | Onde | Sobrevive ao reload |
|---|---|---|
| Config de grid, tela, escala | `localStorage: vtt_minardi_v1` | ✅ |
| Tema visual | `localStorage: vtt_theme` | ✅ |
| Fog of war, paredes, fontes de luz | `localStorage: vtt_light_v2` | ✅ |
| Biblioteca de áudio, volumes, soundscapes | `localStorage: vtt_audio_v1` | ✅ |
| Tokens (posições, HP, stats) | Nenhum — só em memória | ❌ |

> ⚠️ Tokens são perdidos ao recarregar a página. Não há sincronização entre usuários — a aplicação é single-user por sessão de navegador.

---

## Estrutura de Arquivos

```
VTT Minardi 3.0/
├── .clasp.json          # Config do CLASP
├── appsscript.json      # Manifesto GAS
├── Código.js            # Backend (server-side)
├── index.html           # Template principal
├── style.html           # CSS global
├── javascript.html      # Orquestração e core
├── token-main.html      # Boot do módulo Token
├── token-model.html     # Dados dos tokens + Tracker
├── token-canvas.html    # Renderização de tokens
├── token-control.html   # Interação com tokens
├── token-ui.html        # UI de tokens (sidebar + painéis)
├── audio-main.html      # Boot do módulo Áudio
├── audio-model.html     # Dados de áudio
├── audio-drive.html     # Integração Drive para áudio
├── audio-player.html    # Motor de reprodução
├── audio-control.html   # Lógica de controle de áudio
├── audio-ui.html        # UI de áudio (sidebar + painel)
├── lighting-model.html  # Dados de luz, paredes, escuridão
├── lighting-render.html # Renderização do fog of war + visibility polygon
├── lighting-control.html# API de controle (grid units)
└── lighting-ui.html     # UI de iluminação (sidebar + painel)
```

---

## Limitações Conhecidas (observadas no código)

- **Single-user:** sem sincronização em tempo real entre múltiplos navegadores
- **Tokens não persistem:** posições e atributos são perdidos ao recarregar
- **Áudio como base64:** arquivos grandes podem causar lentidão no carregamento inicial
- **Mapas como base64:** mesma limitação para imagens/vídeos grandes
- **Sem autenticação:** qualquer pessoa com a URL pode acessar (configurável no deploy)
- **`stats` e `ringColor`:** campos existem no modelo de token mas sem UI ou renderização implementada
