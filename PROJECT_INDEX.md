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

## Módulo Iluminação (novo — Lighting)

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `lighting-model.html` | 2.5 KB | Fonte da verdade do sistema de iluminação: arrays `walls[]`, `lights[]`, `fogs[]`. Usa unidades de grid para raios e fornece `_save()`/_load() com fallback para `localStorage` e integração com GAS via `saveLightingState`/`getLightingState`. |
| `lighting-render.html` | 6.0 KB | Renderização do fog of war usando Visibility Polygon (raycasting por vértices) e overlay `#lighting-overlay-canvas`. Inclui um spatial index (quadtree-like) para acelerar interseções. Pipeline: escuridão → penumbra (cinza) → luz (revelado) → fog manual → explored (acumulado). |
| `lighting-control.html` | 2.0 KB | API pública: criar/editar/remover luzes e paredes em unidades de grid, `toggleTokenLight(tokenId)`, `attachTokenMovementPolling()` para sincronizar lights vinculadas a tokens sem depender de eventos externos. |
| `lighting-ui.html` | 1.2 KB | Painel administrativo leve: criar luz no centro, listar/remover luzes. Modo de edição (criar parede e criar luz por clique) disponível para mestre. |

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
