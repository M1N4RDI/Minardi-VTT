# MINARDI_ARCHITECTURE.md — Arquitetura Técnica

> Documento técnico baseado exclusivamente no código-fonte analisado. Incertezas explicitadas com ⚠️.

---

## Visão Geral

O Minardi VTT é uma **Single Page Application** hospedada como Google Apps Script Web App. Não há framework frontend — o código usa JavaScript vanilla com API Canvas do browser. A comunicação com o servidor ocorre exclusivamente via `google.script.run` (RPC assíncrono do GAS).

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │TokenPlugin│  │LightPlugin│  │   AudioPlugin    │  │
│  │  (MVC)   │  │  (MVC)   │  │     (MVC)        │  │
│  └─────┬────┘  └─────┬────┘  └────────┬─────────┘  │
│        │             │                │             │
│  ┌─────▼─────────────▼────────────────▼──────────┐  │
│  │       VTTMode + Core (javascript.html)         │  │
│  │   Grid · Medição · Mapas · Session Storage     │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │ google.script.run             │
└───────────────────────┼─────────────────────────────┘
                        │ (RPC assíncrono)
┌───────────────────────┼─────────────────────────────┐
│              Google Apps Script Server               │
│                       │                             │
│  ┌────────────────────▼───────────────────────────┐ │
│  │                  Código.js                     │ │
│  │  doGet · include · getMapsFromDrive            │ │
│  │  getTokenImagesFromDrive · ensureAudioStructure │ │
│  │  scanAudioLibrary · getAudioFolderId           │ │
│  └────────────────────┬───────────────────────────┘ │
│                       │ DriveApp                     │
└───────────────────────┼─────────────────────────────┘
                        │
                 Google Drive API
```

---

## Montagem do HTML (Template GAS)

O `index.html` é um **template scriptlet** do GAS. O servidor processa cada diretiva `<?!= include('nome'); ?>` e injeta o conteúdo bruto do arquivo correspondente antes de servir ao browser.

```
index.html (template)
│
├── <?!= include('style'); ?>         → <style>...</style>
│
├── <?!= include('token-main'); ?>    → <script>...</script>
├── <?!= include('token-model'); ?>   → <script>...</script>
├── <?!= include('token-canvas'); ?>  → <script>...</script>
├── <?!= include('token-control'); ?> → <script>...</script>
├── <?!= include('token-ui'); ?>      → <script>...</script>
│
├── <?!= include('audio-model'); ?>   → <script>...</script>
├── <?!= include('audio-drive'); ?>   → <script>...</script>
├── <?!= include('audio-player'); ?>  → <script>...</script>
├── <?!= include('audio-control'); ?> → <script>...</script>
├── <?!= include('audio-ui'); ?>      → <script>...</script>
├── <?!= include('audio-main'); ?>    → <script>...</script>
│
├── <?!= include('lighting-model'); ?>   → <script>...</script>
├── <?!= include('lighting-render'); ?>  → <script>...</script>
├── <?!= include('lighting-control'); ?> → <script>...</script>
├── <?!= include('lighting-ui'); ?>      → <script>...</script>
│
└── <?!= include('javascript'); ?>    → <script>...</script> (final, no </body>)
```

> Nota: Os módulos `*-main` são incluídos **depois** dos seus submódulos — o boot só é chamado quando todos os objetos parciais do namespace já existem no window.

---

## Gerenciador Global de Modo — `VTTMode`

Único objeto global que arbitra qual sistema está ativo. Garante que apenas um plugin capture eventos de mouse por vez.

```javascript
window.VTTMode = {
  active: "measure",  // estado inicial
  set(modeName) { ... },  // cancela estado anterior, ativa novo
  is(modeName) { ... }    // verificação usada por todos os handlers
}
```

**Estados definidos:**

| Estado | Ativado por | Quem consome |
|---|---|---|
| `"measure"` | Padrão, Escape | Core (`javascript.html`) |
| `"tokens"` | Botão na sidebar | TokenPlugin.Control |
| `"lighting"` | LightPlugin.Control | LightPlugin.{Fog, Wall, Control} |

---

## Camadas de Canvas

Todos os elementos visuais são canvas HTML sobrepostos dentro de `#map-container`. A ordem de z-index define o que aparece na frente:

```
z-index  │ Elemento              │ Criado por          │ Conteúdo
─────────┼───────────────────────┼─────────────────────┼─────────────────────────────
   —     │ #map-image / #map-video │ index.html (HTML)  │ Mapa de fundo (img ou vídeo)
   5     │ #grid-canvas          │ index.html (HTML)    │ Grid de quadrados
   8     │ #token-layer          │ token-canvas.js (din)│ Tokens, barras, nomes
   9     │ #lighting-overlay-canvas │ lighting-render.js (din)│ Fog of war + iluminação (overlay)
  10     │ #ui-canvas            │ index.html (HTML)    │ Ferramentas de medição
  11     │ #lighting-overlay-canvas │ lighting-render.js (din)│ Preview de paredes (edit)
```

> `(din)` = criado dinamicamente via JavaScript, não está no HTML original.

**Consequência importante:** O token layer (z:8) fica ABAIXO do fog (z:9), então tokens em áreas escuras são ocultados pelo fog. O `#ui-canvas` (z:10) fica acima do fog, permitindo que a régua de medição apareça sempre visível.

---

## Padrão Arquitetural dos Plugins

Todos os três plugins seguem o mesmo padrão **namespace + MVC lazy-init**:

```javascript
// 1. Namespace declarado incrementalmente (evita sobrescrever se já existir)
window.TokenPlugin = window.TokenPlugin || {};

// 2. Cada arquivo contribui com um objeto ao namespace
TokenPlugin.Model   = { ... };  // token-model.html
TokenPlugin.Canvas  = { ... };  // token-canvas.html
TokenPlugin.Control = { ... };  // token-control.html
TokenPlugin.UI      = { ... };  // token-ui.html
TokenPlugin.Tracker = { ... };  // token-model.html (junto com Model)

// 3. Boot centralizado no *-main
TokenPlugin.boot = function() {
  waitForVTT(() => {          // polling: DOM + VTTMode prontos
    TokenPlugin.Model.init();
    TokenPlugin.Canvas.init();
    TokenPlugin.Control.init();
    waitForCanvas(() => {     // polling secundário: canvas criado
      TokenPlugin.UI.init();
    });
  });
};
TokenPlugin.boot();
```

Este padrão resolve dependências de ordem de carregamento sem bundler ou módulos ES.

---

## Fluxo de Dados — TokenPlugin

```
Drive (imagens) ──→ google.script.run ──→ TokenPlugin.Model.imageLibrary[]
                                                │
                                                ▼
user: dblclick ──→ TokenPlugin.Control ──→ TokenPlugin.Model.create()
user: drag ──────→ TokenPlugin.Control ──→ token.gx, token.gy (mutação direta)
user: right-click → TokenPlugin.Control ──→ TokenPlugin.UI.show()
                                                │
                                                ├──→ edita token.appearance
                                                ├──→ edita token.bars
                                                ├──→ edita token.armor
                                                └──→ TokenPlugin.Canvas.draw()

Tracker ──→ TokenPlugin.Model.selected (Set<id>) ──→ TokenPlugin.Canvas.draw()

polling (100ms) ──→ TokenPlugin.UI (startTokenObserver) ──→ Canvas.draw() se mudou
```

### Modelo de Dados do Token

```javascript
{
  id: Number,                // auto-incremento
  gx: Number,               // posição grid X (coluna)
  gy: Number,               // posição grid Y (linha)
  cells: Number,            // tamanho em células (padrão: 1)

  appearance: {
    image: String|null,     // data URL base64 da imagem
    color: String,          // cor de fallback (ex: "red")
    name: String|null       // suporta \n para múltiplas linhas
  },

  stats: {},                // ⚠️ INCERTO: campo existe mas sem uso identificado no código

  effects: {
    ringColor: null         // ⚠️ INCERTO: campo existe mas sem renderização encontrada
  },

  light: {
    enabled: Boolean,
    radius: Number,         // raio de luz plena (em quadrados)
    dimRadius: Number       // raio de penumbra (em quadrados)
  },

  bars: {
    hp:      { enabled: Boolean, current: Number, max: Number },
    mana:    { enabled: Boolean, current: Number, max: Number },
    entropy: { enabled: Boolean, current: Number, max: Number }
  },

  initiative: Number|null,

  notes: String,

  armor: {
    head:  { cortante: {prot, mod}, contundente: {prot, mod}, perfurante: {prot, mod} },
    torso: { cortante: {prot, mod}, contundente: {prot, mod}, perfurante: {prot, mod} },
    arms:  { cortante: {prot, mod}, contundente: {prot, mod}, perfurante: {prot, mod} },
    legs:  { cortante: {prot, mod}, contundente: {prot, mod}, perfurante: {prot, mod} }
    // mod: "normal" | "vulnerable" | "resistant"
  }
}
```

### Cálculo de Dano

```
dano_bruto
  - proteção_da_armadura[região][tipo].prot
  = dano_após_armadura (mínimo 0)
  × modificador (normal=×1, vulnerable=×2, resistant=×0.5)
  = Math.ceil(resultado)
  → token.bars.hp.current -= resultado
```

---

## Fluxo de Dados — LightPlugin

```
LightPlugin.Model
  ├── darknessObjects[]   ──→ LightPlugin.Canvas._fillShape()
  ├── lightObjects[]      ──→ LightPlugin.Canvas._cutShape() ou raycasting
  ├── wallObjects[]       ──→ LightPlugin.Raycast.compute()
  └── getTokenLightSources() ← polling TokenPlugin.Model (a cada 120ms)

LightPlugin.Canvas.redraw():
  1. fillRect(fog completo)
  2. _cutShape() para cada luz tipo "cut" (sem raycasting)
  3. Para cada fonte tipo "source":
     a. LightPlugin.Raycast.compute(origem, dimRadius, walls) → _cutPolyAlpha()
     b. LightPlugin.Raycast.compute(origem, lightRadius, walls) → _cutPoly()
  4. _fillShape() escuridão manual (prioridade sobre luz)
  5. Se masterReveal: limpa canvas + overlay translúcido + linhas de parede
```

### Algoritmo de Raycasting

Implementação de **visibility polygon** por varredura angular:

```
1. Coleta todos os segmentos de parede + bounding box ao redor da origem
2. Para cada vértice de segmento:
   a. Calcula ângulo (atan2)
   b. Adiciona ângulo ± 0.0001 rad (garante acertar bordas de segmentos)
3. Para cada ângulo:
   a. Lança raio na direção (cos, sin)
   b. Encontra interseção mais próxima com qualquer segmento
   c. Registra ponto de hit { x, y, angle }
4. Ordena hits por ângulo → forma polígono de visibilidade
5. Retorna array de {x, y} pronto para ctx.lineTo()
```

Complexidade por fonte: O(A × S) onde A = ângulos (≈ 3 × vértices) e S = segmentos.

---

## Fluxo de Dados — AudioPlugin

```
google.script.run.ensureAudioStructure()
  └──→ google.script.run.scanAudioLibrary(folderId)
         └──→ AudioPlugin.Model.setLibrary(library)
                └──→ AudioPlugin.UI.renderLibrary()

AudioPlugin.Control.playCategory(cat)
  └──→ _pickTrack() [random | sequential]
         └──→ AudioPlugin.Player.playMusic(url, fade)
                ├── se fade && tocando: _crossfade() [30 steps, 3s]
                └── se não: src direto + play()

Music timeupdate → Player._attachTimeUpdate()
  └── se (duration - currentTime) ≤ 3s: Control.advancePlaylist()

Ambiências: N elementos <audio> simultâneos com loop=true
Efeitos: pool de 8 elementos <audio> reutilizáveis (procura um .paused)
```

### Estrutura da Biblioteca de Áudio

```javascript
{
  music: {
    "Combat":      [{ id, name, url: "data:audio/mp3;base64,..." }],
    "Exploration": [...],
    // ...
  },
  ambience: {
    "Rain": [...],
    // ...
  },
  effects: {
    "Magic": [...],
    // ...
  }
}
```

> Todos os arquivos de áudio são carregados como **data URLs base64** — sem streaming. O carregamento inicial pode ser lento para bibliotecas grandes.

---

## Integração Server-Client (RPC)

Todas as chamadas ao servidor usam o padrão assíncrono do GAS:

```javascript
google.script.run
  .withSuccessHandler(result => { /* processa resultado */ })
  .withFailureHandler(err => { /* trata erro */ })
  .nomeDaFuncaoServidor(argumento);
```

**Funções RPC disponíveis:**

| Função | Argumentos | Retorno | Chamada por |
|---|---|---|---|
| `getMapsFromDrive` | `folderId: String` | `[{name, dataUrl, type}]` | `javascript.html` (connectDrive) |
| `getTokenImagesFromDrive` | `folderId: String` | `[{name, dataUrl}]` | `javascript.html`, `token-ui.html` |
| `ensureAudioStructure` | — | `{audioFolderId}` ou `{error}` | `audio-drive.html` |
| `scanAudioLibrary` | `audioFolderId: String` | `{music, ambience, effects}` | `audio-drive.html` |
| `getAudioFolderId` | — | `{audioFolderId}` ou `{error}` | ⚠️ Não encontrada chamada client-side |

---

## Sistema de Grid e Calibração

O grid é desenhado no `#grid-canvas` e recalibrado sempre que configurações mudam:

```
ppi = sqrt(screenWidth² + screenHeight²) / polegadas_da_tela
squarePx = (ppi / 2.54) × tamanho_em_cm
```

O resultado `squarePx` é exposto via `window.VTTGrid = { size: squarePx }` para que todos os plugins usem a mesma unidade de referência.

**Conversão de posição token:** `pixel_x = token.gx × squarePx`

---

## Persistência e Estado

### Diagrama de Estado por Plugin

```
┌─ Core ──────────────────────────────────────────────────┐
│  localStorage: vtt_minardi_v1                           │
│  Salvo: manual (botão SALVAR)                           │
│  Lido: window.onload → loadSession()                    │
│  Contém: folderId, tokenFolderId, grid*, tela*, escala* │
└─────────────────────────────────────────────────────────┘

┌─ LightPlugin ───────────────────────────────────────────┐
│  localStorage: vtt_light_v2                             │
│  Salvo: a cada mutação (addDarkness, addWall, etc.)     │
│  Lido: LightPlugin.Model.init() → _load()               │
│  Contém: darknessObjects, lightObjects, wallObjects,    │
│          settings, _nextId                              │
└─────────────────────────────────────────────────────────┘

┌─ AudioPlugin ───────────────────────────────────────────┐
│  localStorage: vtt_audio_v1                             │
│  Salvo: ao mudar soundscapes, favoritos, volumes,       │
│         modo playlist, audioFolderId                    │
│  Lido: AudioPlugin.Model.init() → _loadFromStorage()   │
│  Contém: audioFolderId, volumes, soundscapes,           │
│          favoriteEffects, playlistMode                  │
└─────────────────────────────────────────────────────────┘

┌─ TokenPlugin ───────────────────────────────────────────┐
│  Sem persistência — dados apenas em memória (RAM)       │
│  Perdidos ao recarregar a página                        │
└─────────────────────────────────────────────────────────┘
```

---

## Sequência de Inicialização

```
1. GAS serve index.html (todos os <script> injetados em ordem)
2. Scripts são avaliados: namespaces criados, objetos definidos
3. Três boot functions são chamadas ao final de cada *-main:
   │
   ├─ TokenPlugin.boot()
   │   └─ polling até DOM + VTTMode → Model.init() → Canvas.init()
   │       → Control.init() → polling até canvas criado → UI.init()
   │
   ├─ AudioPlugin.boot()
   │   └─ polling até #sidebar + VTTMode → Model.init() → Drive.init()
   │       → Player.init() → Control.init() → UI.init()
   │       → UI._tryAutoConnect() (se audioFolderId salvo: scan automático)
   │
   └─ LightPlugin.boot()
       └─ polling até map-container + VTTMode + TokenPlugin →
           Model.init() → Canvas.init() → Fog.init() → Wall.init()
           → Control.init() → UI.init()

4. window.onload → loadSession() (restaura config do localStorage)
```

---

## Observações sobre Qualidade e Limitações

### Pontos positivos observados
- Separação de responsabilidades clara (Model / Canvas / Control / UI por plugin)
- Sem dependências externas no client (zero bibliotecas)
- Boot tolerante a race conditions via polling com `setInterval`
- Debounce de redraw via `requestAnimationFrame` (LightPlugin)
- Cache de imagens de tokens evita decode repetido

### Limitações técnicas identificadas

| Limitação | Causa | Impacto |
|---|---|---|
| Áudio e mapas como base64 | DriveApp.getBlob() + Utilities.base64Encode() | Lentidão com arquivos grandes; sem streaming |
| Tokens não persistem | Sem implementação de save | Perda de estado ao recarregar |
| Single-user | Sem PropertiesService, WebSocket ou polling server-side | Não há sincronização multi-jogador |
| Raycasting não otimizado | O(ângulos × segmentos) por frame por fonte | Performance pode degradar com muitas fontes/paredes |
| Polling de tokens para luz | setInterval a 120ms | Overhead constante mesmo sem movimento |
| `stats` e `ringColor` | Campos no modelo sem implementação de UI/render | Dead code — ⚠️ possivelmente reservados para versão futura |
| `getAudioFolderId()` | Função no servidor sem chamada client-side identificada | Possivelmente removida de um fluxo anterior ou planejada |
