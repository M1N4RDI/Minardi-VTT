# PROJECT_INDEX.md — VTT Minardi 3.0

> Índice completo de todos os arquivos do projeto. Baseado exclusivamente no código encontrado.

---

## Metadados do Projeto

| Campo | Valor |
|---|---|
| Nome | VTT Minardi 3.0 |
| Plataforma | Google Apps Script (GAS) Web App |
| Runtime | V8 |
| Fuso horário configurado | Etc/GMT+3 |
| Script ID | `1TwC2JOqWj9G-CjSaRCn-nvxFQYrT6fkHa-3cku3yRrM_SIdK5XaLLtSt` |
| Acesso | ANYONE (público) |
| Execução | USER_ACCESSING |
| Idioma principal | Português (pt-BR) |
| Total de arquivos | 26 |
| Tamanho total (aprox.) | 237 KB |

---

## Arquivos de Configuração

| Arquivo | Descrição |
|---|---|
| `.clasp.json` | Configuração do CLASP (CLI para GAS). Define `scriptId`, extensões reconhecidas (`.js`, `.gs`, `.html`, `.json`) e desabilita `skipSubdirectories`. |
| `appsscript.json` | Manifesto do GAS. Define runtime V8, fuso horário, logging no Stackdriver, configuração de Web App (`executeAs: USER_ACCESSING`, `access: ANYONE`) e OAuth scopes (`drive`, `script.external_request`). |

---

## Arquivo Server-Side (Google Apps Script)

| Arquivo | Descrição |
|---|---|
| `Código.js` | Único arquivo `.js` executado no servidor GAS. Contém todas as funções expostas via `google.script.run`. Ver seção detalhada abaixo. |

### Funções em `Código.js`

| Função | Propósito |
|---|---|
| `doGet()` | Entry point da Web App. Renderiza `index.html` via `HtmlService.createTemplateFromFile`. |
| `include(filename)` | Helper para incluir arquivos HTML dentro do template principal (padrão GAS). |
| `getMapsFromDrive(folderId)` | Lê uma pasta do Drive e retorna imagens e vídeos como data URLs base64. |
| `getTokenImagesFromDrive(folderId)` | Lê uma pasta do Drive e retorna apenas imagens como data URLs base64. |
| `ensureAudioStructure()` | Cria (ou encontra) a hierarquia de pastas `Minardi VTT/Audio/{Music,Ambience,Effects}/{subcategorias}`. |
| `scanAudioLibrary(audioFolderId)` | Escaneia `Minardi VTT/Audio/` e retorna biblioteca completa de áudio como base64. |
| `getAudioFolderId()` | Retorna o ID da pasta `Audio/` dentro de `Minardi VTT/`. ⚠️ Não encontrada chamada client-side no código analisado. |
| `testeCompleto()` | Função de debug: cria e descarta uma pasta `_TESTE_MINARDI_`. Não há chamada em produção. |

---

## Arquivos Client-Side — Core

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `index.html` | 6,5 KB | Template principal do GAS. Inclui todos os demais arquivos via `<?!= include('...'); ?>`. Define o HTML estrutural: sidebar, `#map-container`, `#grid-canvas`, `#ui-canvas`. |
| `style.html` | 10,7 KB | Folha de estilos global (injetada como `<style>`). Define temas Dark/Light/Rustic via CSS variables, layout da sidebar (4 posições), estilos de canvas e componentes de UI. |
| `javascript.html` | 14,9 KB | Script de orquestração central. Contém `VTTMode`, sistema de grid, ferramentas de medição (linha/raio/cone), gerenciamento de mapa (imagem/vídeo), calibração PPI, escala do mapa e saveSession/loadSession. |

---

## Módulo Token (5 arquivos)

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `token-main.html` | 1,0 KB | Boot do plugin. Define `TokenPlugin.boot()` com polling de inicialização (`waitForVTT`, `waitForCanvas`). Dispara a sequência: Model → Canvas → Control → Tracker → UI. |
| `token-model.html` | 13,5 KB | Fonte da verdade dos tokens. Gerencia array `tokens[]`, seleção (`Set`), clipboard, iniciativa. Contém também `TokenPlugin.Tracker` (gerenciador de ordem de combate com drag-and-drop). |
| `token-canvas.html` | 9,4 KB | Renderização em canvas (`#token-layer`, z-index 8). Duas passadas de desenho: (1) círculos/imagens dos tokens; (2) barras de status, nomes e rect de seleção. Cache simples de imagens. |
| `token-control.html` | 14,2 KB | Interações do usuário: dblclick (criar), drag (mover grupo), box-select, teclado (Ctrl+A/C/V, arrows, Delete, Escape), botão direito (context menu). Modo ataque com validação de alcance. |
| `token-ui.html` | 48,8 KB | Interface do usuário: context menu de token, painel de dano (com cálculo de armadura por região/tipo), galeria de imagens do Drive, drag-and-drop para o mapa, seção "Tokens" na sidebar, polling de redesenho a 100ms. |

---

## Módulo Áudio (6 arquivos)

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `audio-main.html` | 801 B | Boot do plugin. Aguarda DOM + `VTTMode` disponíveis, depois inicializa: Model → Drive → Player → Control → UI. |
| `audio-model.html` | 4,3 KB | Fonte da verdade do áudio. Armazena biblioteca Drive, estado de reprodução (música atual, ambiências ativas), volumes (master/music/ambience/effects), soundscapes salvas, favoritos de efeitos. Persistência em `localStorage` (`vtt_audio_v1`). |
| `audio-drive.html` | 2,9 KB | Comunicação com GAS. Chama `ensureAudioStructure()` e `scanAudioLibrary()` via `google.script.run`. Controla flag `_scanning` para evitar chamadas duplicadas. Auto-conecta se `audioFolderId` estiver salvo. |
| `audio-player.html` | 5,5 KB | Motor de reprodução. Gerencia elemento `<audio>` para música com crossfade (30 steps), elementos de ambiência (looping, volume individual), pool de 8 elementos para efeitos sonoros. Cálculo de volume efetivo: `master × canal`. |
| `audio-control.html` | 4,7 KB | Lógica de interação: play/pause/stop música, playlists (random/sequential/single), next/prev track, toggle de ambiências, trigger de efeitos, ativação de soundscapes, silêncio total. |
| `audio-ui.html` | 34,6 KB | Interface: seção "Áudio" na sidebar (conexão Drive, botões), painel flutuante com mixer, biblioteca de músicas (expandível por categoria), controles de ambiência e efeitos, soundscapes, favoritos, barra de progresso. |

---

## Módulo Iluminação (7 arquivos)

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `light-main.html` | 2,8 KB | Boot do plugin. Aguarda `map-container`, `VTTMode` e `TokenPlugin`. Inicializa: Model → Canvas → Fog → Wall → Control → UI. Faz patch tardio de `Canvas.drawFogPreview`. |
| `light-model.html` | 5,1 KB | Fonte da verdade do sistema de luz. Gerencia `darknessObjects[]`, `lightObjects[]`, `wallObjects[]`, `settings` globais. Método `getTokenLightSources()` converte tokens com luz em fontes sintéticas. Persistência em `localStorage` (`vtt_light_v2`). |
| `light-canvas.html` | 7,8 KB | Renderização do fog of war. Dois canvas: `#light-fog-canvas` (z:9, fog + luz) e `#light-wall-canvas` (z:11, preview de edição). Pipeline de redraw: escuridão base → cortes por objetos de luz (`destination-out`) → raycasting → escuridão manual por cima → overlay de mestre. |
| `light-raycast.html` | 4,2 KB | Algoritmo de visibilidade. Dado um ponto de origem e lista de paredes, retorna polígono de visibilidade. Implementa: construção de segmentos + bounding box, coleta de ângulos nos vértices (±0.0001 rad), ray casting com interseção raio-segmento, ordenação angular. |
| `light-fog.html` | 4,8 KB | Subsistema de objetos de escuridão manual. Suporta formas retangulares e circulares. Modos: draw (clicar e arrastar), select+move, erase. Hit-testing por ordem inversa de inserção. |
| `light-wall.html` | 5,4 KB | Subsistema de paredes. Suporta: desenhar segmento (click → click), selecionar parede, arrastar vértice individualmente, apagar por clique direito ou modo erase. Hit-testing de vértice (raio 7px) e de segmento (threshold 8px). |
| `light-control.html` | 4,7 KB | Máquina de estados do LightPlugin. State: `{ cat, fmt, fn }`. Controla integração com `VTTMode`, tecla `L` (master reveal), `Escape` (sair do modo iluminação), debounce de redraw via `requestAnimationFrame`. Observer de tokens com luz a 120ms. |
| `light-ui.html` | 24,8 KB | Interface: seção "Iluminação" na sidebar, painel flutuante com toolbar (categoria/formato/função), listas de objetos de escuridão/luz/paredes, propriedades de objetos selecionados, controles de opacity e configurações globais. Injeta item no context menu dos tokens. |

---

## Dependências Externas (CDN)

| Recurso | Origem | Uso |
|---|---|---|
| Google Fonts — Cinzel | `fonts.googleapis.com` | Fonte tipográfica para UI do sidebar |
| Google Apps Script API | `google.script.run` | Comunicação client → server |

---

## localStorage — Chaves Utilizadas

| Chave | Módulo | Conteúdo |
|---|---|---|
| `vtt_minardi_v1` | Core (`javascript.html`) | Config de sessão: folderId de mapas e tokens, grid, tela, escala, ferramenta ativa |
| `vtt_theme` | Core | Tema ativo: `dark`, `light` ou `rustic` |
| `vtt_light_v2` | LightPlugin | Objetos de escuridão, luz, paredes, settings globais, `_nextId` |
| `vtt_audio_v1` | AudioPlugin | `audioFolderId`, volumes, soundscapes, favoritos de efeitos, modo de playlist |

> ⚠️ Tokens (posições, stats, barras de HP) **não são persistidos** entre sessões — apenas as configurações de interface.
