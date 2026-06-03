# AI_CONTEXT.md — Contexto para Assistentes de IA

> Este arquivo é destinado a ser incluído como contexto em conversas com modelos de linguagem (Claude, GPT, Gemini, etc.) para auxiliar no desenvolvimento e manutenção do Minardi VTT. Baseado exclusivamente no código analisado — incertezas marcadas com ⚠️.

---

## O que é este projeto

**Minardi VTT 3.0** é um Virtual Tabletop (VTT) single-player para RPG de mesa, escrito em JavaScript vanilla sem frameworks, hospedado como **Google Apps Script Web App**. Toda a lógica roda no browser; o servidor GAS só serve o HTML inicial e acessa o Google Drive para buscar arquivos.

O código é inteiramente em **português brasileiro** (variáveis, comentários, textos de UI, nomes de pasta no Drive).

---

## Estrutura de Arquivos Crítica

```
Código.js         ← ÚNICO arquivo server-side (GAS). Nunca tem acesso ao DOM.
index.html        ← Template GAS. Inclui todos os outros via <?!= include('...'); ?>
javascript.html   ← Core: VTTMode, grid, medição, mapas, save/load
style.html        ← CSS global (temas Dark/Light/Rustic)

token-main.html   ← Boot do TokenPlugin (dispara os outros)
token-model.html  ← Dados dos tokens + TokenPlugin.Tracker
token-canvas.html ← Renderização no canvas
token-control.html← Eventos de mouse/teclado
token-ui.html     ← Context menu, painel de dano, sidebar, galeria

audio-main.html   ← Boot do AudioPlugin
audio-model.html  ← Estado e persistência de áudio
audio-drive.html  ← google.script.run para Drive
audio-player.html ← Motor de reprodução (<audio>)
audio-control.html← Lógica de playlists e controle
audio-ui.html     ← Sidebar e painel flutuante de áudio

light-main.html   ← Boot do LightPlugin
light-model.html  ← Dados: escuridão, luz, paredes, settings
light-canvas.html ← Fog of war (destination-out rendering)
light-raycast.html← Algoritmo de visibilidade (visibility polygon)
light-fog.html    ← Objetos de escuridão manual
light-wall.html   ← Sistema de paredes
light-control.html← Máquina de estados (cat/fmt/fn)
light-ui.html     ← Painel e sidebar de iluminação
```

---

## Convenções do Código

### Namespaces

Cada plugin usa um objeto global como namespace. Objetos são adicionados incrementalmente — nunca sobrescreva o namespace inteiro:

```javascript
// ✅ CORRETO
window.TokenPlugin = window.TokenPlugin || {};
TokenPlugin.NovoModulo = { ... };

// ❌ ERRADO — apaga módulos já carregados
window.TokenPlugin = { NovoModulo: { ... } };
```

### Comunicação com Servidor

Toda chamada ao servidor usa `google.script.run`. Nunca use `fetch` ou `XMLHttpRequest` — GAS não suporta chamadas diretas ao próprio script dessa forma:

```javascript
// ✅ CORRETO
google.script.run
  .withSuccessHandler(result => { /* ... */ })
  .withFailureHandler(err => { /* ... */ })
  .nomeDaFuncao(args);

// ❌ ERRADO — não funciona no GAS
fetch('/api/endpoint');
```

### Canvas e Renderização

Não use `requestAnimationFrame` em loop contínuo — o projeto usa **redraw sob demanda**. Acione `Canvas.draw()` / `Canvas.redraw()` apenas quando o estado mudar:

```javascript
// ✅ CORRETO — redraw só quando necessário
TokenPlugin.Model.moveSelected(dx, dy);
TokenPlugin.Canvas.draw();  // explícito

// ❌ EVITAR — loop contínuo desnecessário
function animate() {
  requestAnimationFrame(animate);
  Canvas.draw(); // redesenha mesmo sem mudança
}
```

### Polling de Inicialização

Use o padrão de polling com `setInterval` para aguardar dependências — não use `DOMContentLoaded` isolado, pois os scripts são carregados como parte do `<head>` injetado:

```javascript
function waitForXxx(cb) {
  const t = setInterval(() => {
    if (condição_de_dependência) {
      clearInterval(t);
      cb();
    }
  }, 100);
}
```

### Acesso ao Grid

O tamanho do grid em pixels é exposto globalmente após calibração:

```javascript
const size = window.VTTGrid?.size || 50;  // 50px como fallback seguro
```

Nunca hardcode tamanhos de célula — sempre use `VTTGrid.size`.

### VTTMode

Antes de processar qualquer evento de mouse/teclado em um plugin, verifique o modo ativo:

```javascript
canvas.addEventListener("mousedown", (e) => {
  if (!VTTMode.is("tokens")) return;  // ← sempre primeiro
  // ... lógica do plugin
});
```

---

## Modelo de Dados Relevante

### Token (objeto completo)

```javascript
{
  id: Number,           // auto-incremento, começa em 1
  gx: Number,          // coluna no grid (0-based)
  gy: Number,          // linha no grid (0-based)
  cells: Number,       // tamanho (1 = 1 célula, 2 = 2×2 células)

  appearance: {
    image: String|null,  // data:image/...;base64,... (vem do Drive)
    color: String,       // CSS color string, ex: "red", "#c0392b"
    name: String|null    // suporta \n para linha dupla no canvas
  },

  stats: {},           // ⚠️ INCERTO: existe mas sem uso identificado

  effects: {
    ringColor: null    // ⚠️ INCERTO: existe mas sem renderização encontrada
  },

  light: {
    enabled: Boolean,
    radius: Number,    // luz plena, em quadrados de grid
    dimRadius: Number  // penumbra, em quadrados de grid
  },

  bars: {
    hp:      { enabled: Boolean, current: Number, max: Number },
    mana:    { enabled: Boolean, current: Number, max: Number },
    entropy: { enabled: Boolean, current: Number, max: Number }
  },

  initiative: Number|null,

  notes: String,

  armor: {
    // regiões: head, torso, arms, legs
    // tipos: cortante, contundente, perfurante
    // mod: "normal" | "vulnerable" | "resistant"
    head: {
      cortante:    { prot: Number, mod: String },
      contundente: { prot: Number, mod: String },
      perfurante:  { prot: Number, mod: String }
    },
    // torso, arms, legs — mesma estrutura
  }
}
```

### Posição no Canvas

```javascript
// Centro do token em pixels
const centerX = token.gx * size + (token.cells * size) / 2;
const centerY = token.gy * size + (token.cells * size) / 2;
const radius  = (token.cells * size) / 2;
```

### Objeto de Luz (LightPlugin.Model.lightObjects)

```javascript
{
  id: Number,
  name: String,
  type: "rect" | "circle" | "source",
  x: Number, y: Number,        // posição em pixels
  w: Number, h: Number,        // para type="rect"
  r: Number,                   // para type="circle"
  lightType: "cut" | "source", // "cut" = sem raycasting, "source" = com raycasting
  lightRadius: Number,         // raio de luz plena em QUADRADOS
  dimRadius: Number,           // raio de penumbra em QUADRADOS
  tokenId: null | Number       // se associado a token
}
```

### Objeto de Parede (LightPlugin.Model.wallObjects)

```javascript
{
  id: Number,
  name: String,
  points: [{ x: Number, y: Number }, { x: Number, y: Number }]
  // Atualmente sempre 2 pontos (segmento de linha simples)
}
```

---

## APIs Públicas dos Plugins

### TokenPlugin

```javascript
TokenPlugin.Model.create(gx, gy)              // cria token, retorna objeto
TokenPlugin.Model.all()                        // retorna array de todos tokens
TokenPlugin.Model.getById(id)                  // retorna token por id
TokenPlugin.Model.selectOnly(id)               // seleciona apenas este
TokenPlugin.Model.addToSelection(id)           // adiciona à seleção
TokenPlugin.Model.getSelected()                // retorna array dos selecionados
TokenPlugin.Model.clearSelection()
TokenPlugin.Model.deleteSelected()
TokenPlugin.Model.moveSelected(dx, dy)         // dx/dy em células
TokenPlugin.Model.changeSize(tokenId, delta)   // delta: +1 ou -1
TokenPlugin.Model.copySelected()
TokenPlugin.Model.pasteClipboard(offsetX, offsetY)
TokenPlugin.Model.setImageLibrary(images)      // [{name, dataUrl}]
TokenPlugin.Model.getImageLibrary()

TokenPlugin.Canvas.draw()                      // redesenha tokens
TokenPlugin.Canvas.forceResize()               // sync com tamanho do mapa

TokenPlugin.Control.startAttack(attackerId, config)  // config: {type, subtype, idealRange, maxRange}
TokenPlugin.Control.cancelAttack()
TokenPlugin.Control.getAttackLabel(attackerId, targetGx, targetGy) // retorna {label, color}

TokenPlugin.Tracker.buildList()    // monta fila por iniciativa
TokenPlugin.Tracker.start()
TokenPlugin.Tracker.next()
TokenPlugin.Tracker.prev()
TokenPlugin.Tracker.pause()
TokenPlugin.Tracker.reset()
TokenPlugin.Tracker.syncWithModel() // remove tokens deletados da fila

TokenPlugin.UI.show(x, y, tokenId)  // abre context menu
TokenPlugin.UI.hide()
TokenPlugin.UI.openDamagePanel(token)
```

### LightPlugin

```javascript
LightPlugin.Model.addDarkness(props)    // props: {type, x, y, w?, h?, r?}
LightPlugin.Model.removeDarkness(id)
LightPlugin.Model.updateDarkness(id, props)

LightPlugin.Model.addLight(props)       // props: {type, x, y, lightType, lightRadius, dimRadius, tokenId?}
LightPlugin.Model.removeLight(id)
LightPlugin.Model.updateLight(id, props)

LightPlugin.Model.addWall(points, name) // points: [{x,y},{x,y}]
LightPlugin.Model.removeWall(id)
LightPlugin.Model.updateWallPoint(wallId, pointIndex, x, y)
LightPlugin.Model.getTokenLightSources() // fontes sintéticas dos tokens

LightPlugin.Canvas.redraw()

LightPlugin.Control.requestRedraw()     // debounced via rAF
LightPlugin.Control.toggleLighting()
LightPlugin.Control.toggleMasterReveal()
LightPlugin.Control.setState({ cat, fmt, fn })

LightPlugin.UI.refreshLists()
LightPlugin.UI.updateToolbar()
LightPlugin.UI.togglePanel()
```

### AudioPlugin

```javascript
AudioPlugin.Model.setLibrary(library)
AudioPlugin.Model.getCategories(type)       // type: "music"|"ambience"|"effects"
AudioPlugin.Model.getTracks(type, category)
AudioPlugin.Model.setVolume(channel, value) // channel: "master"|"music"|"ambience"|"effects"
AudioPlugin.Model.saveSoundscape(name)
AudioPlugin.Model.deleteSoundscape(name)
AudioPlugin.Model.toggleFavoriteEffect(category, track)
AudioPlugin.Model.isFavoriteEffect(category, trackName)

AudioPlugin.Drive.connect(onSuccess, onError)
AudioPlugin.Drive.scanLibrary(onSuccess, onError)
AudioPlugin.Drive.rescanLibrary()

AudioPlugin.Player.playMusic(url, fade)
AudioPlugin.Player.pauseMusic()
AudioPlugin.Player.stopMusic()
AudioPlugin.Player.seekTo(ratio)            // ratio: 0.0 a 1.0
AudioPlugin.Player.startAmbience(category, url, volume)
AudioPlugin.Player.stopAmbience(category)
AudioPlugin.Player.stopAllAmbiences()
AudioPlugin.Player.playEffect(url)
AudioPlugin.Player.applyVolumes()
AudioPlugin.Player.isPaused()
AudioPlugin.Player.getCurrentTime()
AudioPlugin.Player.getDuration()

AudioPlugin.Control.playCategory(category, fade)
AudioPlugin.Control.playTrack(category, track, fade)
AudioPlugin.Control.nextTrack()
AudioPlugin.Control.prevTrack()
AudioPlugin.Control.toggleAmbience(category)
AudioPlugin.Control.stopAllAmbiences()
AudioPlugin.Control.triggerEffect(url)
AudioPlugin.Control.activateSoundscape(sc)
AudioPlugin.Control.silence()
AudioPlugin.Control.setVolume(channel, value)
AudioPlugin.Control.advancePlaylist()
```

---

## Como Adicionar um Novo Módulo ao Plugin de Tokens

Exemplo: adicionar `TokenPlugin.Logger` para log de eventos de combate.

**1. Criar `token-logger.html`:**
```html
<script>
console.log("token-logger carregado");

window.TokenPlugin = window.TokenPlugin || {};

TokenPlugin.Logger = {
  _log: [],

  init() {
    console.log("TokenPlugin.Logger INIT");
  },

  record(message) {
    const entry = { ts: Date.now(), msg: message };
    this._log.push(entry);
    // atualizar UI, etc.
  },

  getAll() {
    return this._log;
  }
};
</script>
```

**2. Incluir em `index.html` antes de `token-main`:**
```html
<?!= include('token-logger'); ?>
<?!= include('token-main'); ?>
```

**3. Inicializar em `token-main.html`:**
```javascript
TokenPlugin.boot = function () {
  waitForVTT(() => {
    TokenPlugin.Model.init();
    TokenPlugin.Canvas.init();
    TokenPlugin.Control.init();
    TokenPlugin.Logger.init();  // ← adicionar aqui
    // ...
  });
};
```

---

## Como Adicionar uma Função Server-Side

**Em `Código.js`:**
```javascript
function minhaNovaFuncao(parametro) {
  try {
    // lógica usando DriveApp, etc.
    return { resultado: valor };
  } catch(e) {
    return { error: e.toString() };
  }
}
```

**No client-side:**
```javascript
google.script.run
  .withSuccessHandler(result => {
    if (result.error) { console.error(result.error); return; }
    // usa result.resultado
  })
  .withFailureHandler(err => {
    console.error("Falha RPC:", err.message);
  })
  .minhaNovaFuncao(argumento);
```

> Sempre retorne `{ error: string }` em caso de exceção e verifique no client.

---

## Armadilhas Conhecidas

### 1. Escopo do `google.script.run`
Só funciona no contexto de uma página servida pelo GAS. Em testes locais com CLASP (`clasp run`), não está disponível.

### 2. `token.light.radius` vs pixels
O `radius` nos tokens está em **quadrados de grid**, não em pixels. A conversão é feita em `getTokenLightSources()`:
```javascript
lightRadius: (t.light.radius || 6) * size,   // size = VTTGrid.size (pixels)
```
Ao ler/escrever `token.light.radius`, use quadrados. Ao passar para o raycasting, converta para pixels.

### 3. Canvas não existe antes de `Canvas.init()`
O `#token-layer` é criado dinamicamente por `TokenPlugin.Canvas.createLayer()`. Não tente acessar `document.getElementById("token-layer")` antes do boot.

### 4. `VTTGrid` pode ser undefined
Durante o boot inicial, `VTTGrid` ainda não foi definido. Sempre use `window.VTTGrid?.size || 50` como fallback.

### 5. Tokens não têm coordenadas pixel — têm grid
`token.gx` e `token.gy` são coordenadas de **célula do grid**, não pixels. Sempre converta:
```javascript
const px = token.gx * (window.VTTGrid?.size || 50);
```

### 6. Armadura — `mod` afeta APÓS proteção
O modificador (vulnerável/resistente) é aplicado sobre o valor **depois** de subtrair a proteção, não sobre o valor bruto:
```
final = Math.ceil(Math.max(0, bruto - prot) × multiplicador)
```

### 7. Playlist de áudio — modo "single" não avança
`Control.advancePlaylist()` retorna cedo se `playlist.mode === "single"`. Se implementar um modo novo, adicionar o check lá.

### 8. Fog de war — escuridão manual TEM PRIORIDADE sobre fontes de luz
O pipeline de `Canvas.redraw()` aplica escuridão manual **depois** de cortar a luz (passo 4 depois do 3). Se uma área de escuridão manual cobre uma fonte de luz, a escuridão vence.

### 9. `stats` e `ringColor` — não implementados
Os campos `token.stats` (objeto vazio) e `token.effects.ringColor` existem no modelo mas não têm UI nem renderização. Não os remova (podem quebrar saves futuros), mas não dependa deles funcionando.

---

## Campos de localStorage — Schema

### `vtt_minardi_v1`
```json
{
  "folderId": "string",
  "tokenFolderId": "string",
  "gridColor": "#ffffff",
  "gridOpacity": "0.4",
  "gridCm": "2.5",
  "screenInches": "24",
  "mapFit": "original|width|height|stretch",
  "scale": "1.5",
  "coneAngle": "60",
  "toolMode": "line|circle|cone",
  "mapScale": "0"
}
```

### `vtt_light_v2`
```json
{
  "darknessObjects": [],
  "lightObjects": [],
  "wallObjects": [],
  "settings": {
    "enabled": false,
    "masterReveal": false,
    "showWalls": true,
    "fogOpacity": 0.92,
    "dimOpacity": 0.45
  },
  "_nextId": 1
}
```

### `vtt_audio_v1`
```json
{
  "audioFolderId": "string",
  "volumes": { "master": 80, "music": 70, "ambience": 60, "effects": 80 },
  "soundscapes": [],
  "favoriteEffects": [],
  "playlistMode": "random|sequential|single"
}
```

---

## O que NÃO existe neste projeto

Para evitar sugestões baseadas em suposições incorretas:

- ❌ Sem React, Vue, Angular ou qualquer framework JS
- ❌ Sem bundler (Webpack, Vite, Rollup)
- ❌ Sem TypeScript
- ❌ Sem testes automatizados identificados
- ❌ Sem sistema de módulos ES (`import`/`export`) — tudo em `window.*`
- ❌ Sem WebSockets ou SSE — sem real-time multi-usuário
- ❌ Sem banco de dados — apenas Drive + localStorage
- ❌ Sem autenticação de usuários na app (GAS gerencia isso no deploy)
- ❌ Sem roteamento de URL — sempre a mesma página
- ❌ Sem sistema de plugins dinâmicos — tudo carregado no boot
