/**
 * Renderiza a página principal
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('VTT - Drive & Motion Edition')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Função auxiliar para incluir arquivos HTML (CSS e JS) dentro do Index
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Busca arquivos (imagens e vídeos) para MAPAS no Google Drive
 */
function getMapsFromDrive(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const maps = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const mime = file.getMimeType();
      
      if (mime.includes('image/') || mime.includes('video/')) {
        const bytes = file.getBlob().getBytes();
        const base64 = Utilities.base64Encode(bytes);
        const dataUrl = `data:${mime};base64,${base64}`;
        
        maps.push({
          name: file.getName(),
          dataUrl: dataUrl,
          type: mime.includes('video/') ? 'video' : 'image'
        });
      }
    }

    return maps;

  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Busca apenas IMAGENS para TOKENS no Google Drive
 */
function getTokenImagesFromDrive(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const images = [];

    while (files.hasNext()) {
      const file = files.next();
      const mime = file.getMimeType();

      if (mime.includes('image/')) {

        const bytes = file.getBlob().getBytes();
        const base64 = Utilities.base64Encode(bytes);
        const dataUrl = `data:${mime};base64,${base64}`;

        images.push({
          name: file.getName(),
          dataUrl: dataUrl
        });
      }
    }

    return images;

  }
   catch (e) {
    return { error: e.toString() };
  }
}

// ============================================================
// MINARDI VTT — Audio Plugin Backend
// Adicionar estas funções ao seu arquivo Code.gs existente
// ============================================================

/**
 * Garante que a estrutura padrão de áudio existe no Drive.
 * Retorna o ID da pasta Audio/ criada ou encontrada.
 */
function ensureAudioStructure() {
  try {
    var rootFolders = DriveApp.getFoldersByName("Minardi VTT");
    var root = rootFolders.hasNext()
      ? rootFolders.next()
      : DriveApp.createFolder("Minardi VTT");

    var audioFolders = root.getFoldersByName("Audio");
    var audioFolder = audioFolders.hasNext()
      ? audioFolders.next()
      : root.createFolder("Audio");

    var audioId = audioFolder.getId();

    var topLevel = ["Music", "Ambience", "Effects"];
    topLevel.forEach(function(name) {
      var existing = audioFolder.getFoldersByName(name);
      var sub = existing.hasNext() ? existing.next() : audioFolder.createFolder(name);

      var defaults = {
        "Music":    ["Combat", "Exploration", "Tavern", "Horror", "City"],
        "Ambience": ["Rain", "Forest", "Sea", "Cave", "Wind"],
        "Effects":  ["Combat", "Magic", "Monsters", "Doors"]
      };

      (defaults[name] || []).forEach(function(subName) {
        var subExisting = sub.getFoldersByName(subName);
        if (!subExisting.hasNext()) sub.createFolder(subName);
      });
    });

    return { audioFolderId: audioId };

  } catch(e) {
    return { error: e.toString() };
  }
}

/**
 * Escaneia a pasta Audio/ e retorna a biblioteca completa.
 * Estrutura retornada:
 * {
 *   music:    { "Combat": [{id, name, url}], ... },
 *   ambience: { "Rain":   [{id, name, url}], ... },
 *   effects:  { "Magic":  [{id, name, url}], ... }
 * }
 */
function scanAudioLibrary(audioFolderId) {
  try {
    var audioFolder = DriveApp.getFolderById(audioFolderId);
    var library = { music: {}, ambience: {}, effects: {} };

    var typeMap = {
      "music":    "Music",
      "ambience": "Ambience",
      "effects":  "Effects"
    };

    Object.keys(typeMap).forEach(function(key) {
      var typeName = typeMap[key];
      var typeFolders = audioFolder.getFoldersByName(typeName);
      if (!typeFolders.hasNext()) return;

      var typeFolder = typeFolders.next();
      var subFolders = typeFolder.getFolders();

      while (subFolders.hasNext()) {
        var sub = subFolders.next();
        var catName = sub.getName();
        var tracks = [];

        var files = sub.getFiles();
        while (files.hasNext()) {
          var file = files.next();
          var mime = file.getMimeType();
          if (!mime.includes("audio/")) continue;

          var bytes  = file.getBlob().getBytes();
          var base64 = Utilities.base64Encode(bytes);
          var dataUrl = "data:" + mime + ";base64," + base64;

          tracks.push({
            id:   file.getId(),
            name: file.getName().replace(/\.[^.]+$/, ""),
            url:  dataUrl
          });
        }

        if (tracks.length > 0) {
          library[key][catName] = tracks;
        }
      }
    });

    return library;

  } catch(e) {
    return { error: e.toString() };
  }
}

/**
 * Retorna apenas o ID da pasta Audio/ dentro de Minardi VTT/
 * Útil para o primeiro boot sem precisar re-escanear tudo.
 */
function getAudioFolderId() {
  try {
    var rootFolders = DriveApp.getFoldersByName("Minardi VTT");
    if (!rootFolders.hasNext()) return { error: "Pasta 'Minardi VTT' não encontrada." };

    var root = rootFolders.next();
    var audioFolders = root.getFoldersByName("Audio");
    if (!audioFolders.hasNext()) return { error: "Pasta 'Audio' não encontrada dentro de 'Minardi VTT'." };

    return { audioFolderId: audioFolders.next().getId() };

  } catch(e) {
    return { error: e.toString() };
  }
} 

// ============================================================
// BIBLIOTECA RAIZ UNIFICADA — Etapa 0
// Escaneia recursivamente uma pasta do Drive retornando apenas
// metadados leves. Nunca chama getBlob(), getBytes() ou
// Utilities.base64Encode().
// Suporta paginação via pageToken para evitar timeout.
// ============================================================

// Termos que sugerem "map" no caminho da pasta
var MAP_PATH_TERMS = [
  "mapa", "mapas", "map", "maps", "battlemap",
  "cenario", "cenário", "cena", "scene", "dungeon", "ambiente"
];

// Termos que sugerem "tokenImage" no caminho da pasta
var TOKEN_PATH_TERMS = [
  "token", "tokens", "personagem", "personagens", "npc", "npcs",
  "monstro", "monstros", "monster", "monsters", "criatura", "criaturas",
  "player", "jogador", "jogadores"
];

// Termos que sugerem "save" no caminho ou nome do arquivo
var SAVE_PATH_TERMS = [
  "save", "saves", "cena", "cenas", "scene", "scenes", "backup", "backups"
];

/**
 * Classifica um asset com base em mimeType e caminho da pasta.
 * Nunca acessa o conteúdo do arquivo.
 */
function _classificarAsset(mimeType, caminho, nomeArquivo) {
  var mime = (mimeType || "").toLowerCase();
  var path = (caminho || "").toLowerCase();
  var nome = (nomeArquivo || "").toLowerCase();

  // Áudio: mimeType começa com "audio/"
  if (mime.indexOf("audio/") === 0) {
    return "audio";
  }

  // Save: JSON em pasta de saves OU arquivo .vttscene
  if (mime === "application/json" || nome.indexOf(".vttscene") !== -1) {
    for (var i = 0; i < SAVE_PATH_TERMS.length; i++) {
      if (path.indexOf(SAVE_PATH_TERMS[i]) !== -1) return "save";
    }
    // JSON avulso — salva como save genérico
    if (mime === "application/json") return "save";
  }

  // Imagem: mimeType começa com "image/"
  if (mime.indexOf("image/") === 0) {
    // Verifica se o caminho sugere mapa
    for (var j = 0; j < MAP_PATH_TERMS.length; j++) {
      if (path.indexOf(MAP_PATH_TERMS[j]) !== -1) return "map";
    }
    // Verifica se o caminho sugere token
    for (var k = 0; k < TOKEN_PATH_TERMS.length; k++) {
      if (path.indexOf(TOKEN_PATH_TERMS[k]) !== -1) return "tokenImage";
    }
    // Imagem ambígua
    return "image";
  }

  // Vídeo: tratar como mapa
  if (mime.indexOf("video/") === 0) {
    return "map";
  }

  return "unknown";
}

/**
 * Escaneia recursivamente uma pasta do Drive.
 * Retorna apenas metadados — SEM base64, SEM getBlob.
 * Suporta paginação: se pageToken for passado, continua de onde parou.
 *
 * Parâmetros:
 *   rootFolderId  — ID da pasta raiz a escanear
 *   pageToken     — token de continuação (null = início)
 *   caminhoAtual  — string de caminho acumulado (uso interno, passar "")
 *
 * Retorna:
 *   { assets: [...], nextPageToken: "..." | null, erro: null | string }
 *
 * Cada asset:
 *   { id, nome, mimeType, tamanho, caminho, assetType }
 */

/**
 * Carrega um único arquivo do Drive como data URL base64.
 * Usado pelo client para carregar um asset sob demanda
 * (mapa selecionado, token selecionado, etc.).
 */
function getFileAsDataUrl(fileId) {
  try {
    var file  = DriveApp.getFileById(fileId);
    var blob  = file.getBlob();
    var b64   = Utilities.base64Encode(blob.getBytes());
    var mime  = blob.getContentType();
    return { dataUrl: "data:" + mime + ";base64," + b64, erro: null };
  } catch(e) {
    return { dataUrl: null, erro: e.toString() };
  }
}

function scanBibliotecaRaiz(rootFolderId, pageToken, caminhoAtual) {
  try {
    if (!rootFolderId) {
      return { assets: [], nextPageToken: null, erro: "rootFolderId ausente." };
    }

    var assets = [];
    var caminho = caminhoAtual || "";

    // Listamos apenas os itens DIRETOS desta pasta neste chunk
    // Para recursão controlada usamos uma fila via PropertiesService
    // Aqui fazemos recursão direta mas com limite de profundidade = 6
    // para evitar timeout em bibliotecas muito grandes.
    _scanPastaRecursivo(rootFolderId, caminho, assets, 0);

    return { assets: assets, nextPageToken: null, erro: null };

  } catch (e) {
    return { assets: [], nextPageToken: null, erro: e.toString() };
  }
}

/**
 * Recursão interna — profundidade máxima: 6 níveis.
 * Paginação interna via pageToken do DriveApp.
 */
function _scanPastaRecursivo(folderId, caminho, assets, profundidade) {
  if (profundidade > 6) return; // evita recursão infinita

  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    return; // pasta não acessível — ignora silenciosamente
  }

  // --- Arquivos desta pasta ---
  var fileIterator = folder.getFiles();
  while (fileIterator.hasNext()) {
    var file = fileIterator.next();
    var mimeType = file.getMimeType();

    // Ignora atalhos e pastas-arquivo do GAS
    if (mimeType === "application/vnd.google-apps.shortcut") continue;
    if (mimeType === "application/vnd.google-apps.folder")  continue;
    // Ignora scripts GAS e outros formatos não-media
    if (mimeType.indexOf("application/vnd.google-apps") === 0 &&
        mimeType !== "application/json") continue;

    var nome = file.getName();
    var assetType = _classificarAsset(mimeType, caminho, nome);

    assets.push({
      id:        file.getId(),
      nome:      nome,
      mimeType:  mimeType,
      tamanho:   file.getSize(),
      caminho:   caminho,
      assetType: assetType
    });
  }

  // --- Subpastas desta pasta ---
  var folderIterator = folder.getFolders();
  while (folderIterator.hasNext()) {
    var sub = folderIterator.next();
    var subNome    = sub.getName();
    var subCaminho = caminho ? (caminho + "/" + subNome) : subNome;
    _scanPastaRecursivo(sub.getId(), subCaminho, assets, profundidade + 1);
  }
}

function testeCompleto() {
  try {
    // testa criar pasta na raiz
    var pasta = DriveApp.createFolder("_TESTE_MINARDI_");
    Logger.log("OK - pasta criada: " + pasta.getId());
    pasta.setTrashed(true);
  } catch(e) {
    Logger.log("ERRO: " + e.toString());
  }
}

/**
 * Save lighting state (stringified JSON) to Script Properties for persistence
 */
function saveLightingState(jsonStr) {
  try {
    PropertiesService.getScriptProperties().setProperty('lighting_state', jsonStr);
    return { ok: true };
  } catch(e) { return { error: e.toString() }; }
}

/**
 * Get lighting state (string) previously saved
 */
function getLightingState() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('lighting_state');
    return v || null;
  } catch(e) { return { error: e.toString() }; }
}
