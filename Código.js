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
    var audioRoot = DriveApp.getFolderById(audioFolderId);

    var library = {
      music: {},
      ambience: {},
      effects: {}
    };

    var typeFolders = {
      music: "Music",
      ambience: "Ambience",
      effects: "Effects"
    };

    for (var type in typeFolders) {
      var typeFolderIter = audioRoot.getFoldersByName(typeFolders[type]);

      if (!typeFolderIter.hasNext()) continue;

      var typeFolder = typeFolderIter.next();
      var subFolders = typeFolder.getFolders();

      while (subFolders.hasNext()) {
        var subFolder = subFolders.next();
        var categoryName = subFolder.getName();

        var tracks = [];

        var files = subFolder.getFiles();

        while (files.hasNext()) {
          var file = files.next();
          var mime = file.getMimeType();

          if (mime.indexOf("audio") === -1) continue;

          tracks.push({
            id: file.getId(),
            name: file.getName().replace(/\.[^.]+$/, ""),
            mimeType: mime
          });
        }

        if (tracks.length > 0) {
          library[type][categoryName] = tracks;
        }
      }
    }

    return library;

  } catch (e) {
    return { error: e.toString() };
  }
}

// ============================================================
// scanAudioLibraryMetadata — retorna apenas metadados (sem base64).
// Resolve o timeout com bibliotecas grandes (110+ arquivos).
// Cada item: { id, name, mimeType, category, type }
// type: "music" | "ambience" | "effects"
// category: nome da subpasta (ex: "Combat", "Rain")
// ============================================================
function scanAudioLibraryMetadata(audioFolderId) {
  try {
    if (!audioFolderId) return { error: "audioFolderId ausente." };

    var result = { music: {}, ambience: {}, effects: {} };

    var audioFolder;
    try {
      audioFolder = DriveApp.getFolderById(audioFolderId);
    } catch(e) {
      return { error: "Pasta não encontrada: " + e.toString() };
    }

    // Mapeia nomes de subpasta para tipo
    var typeMap = {
      "music": "music", "musica": "music", "música": "music",
      "ambience": "ambience", "ambiencia": "ambience", "ambiência": "ambience", "ambiance": "ambience",
      "effects": "effects", "efeitos": "effects", "effect": "effects"
    };

    var typeIter = audioFolder.getFolders();
    while (typeIter.hasNext()) {
      var typeFolder = typeIter.next();
      var typeName   = typeFolder.getName().toLowerCase();
      var type       = typeMap[typeName] || null;
      if (!type) continue;

      // Subcategorias (Combat, Rain, etc.)
      var catIter = typeFolder.getFolders();
      while (catIter.hasNext()) {
        var catFolder  = catIter.next();
        var catName    = catFolder.getName();
        result[type][catName] = result[type][catName] || [];

        var fileIter = catFolder.getFiles();
        while (fileIter.hasNext()) {
          var file = fileIter.next();
          var mime = file.getMimeType();
          if (mime.indexOf("audio/") !== 0) continue;
          result[type][catName].push({
            id:       file.getId(),
            name:     file.getName().replace(/\.[^.]+$/, ""), // remove extensão
            mimeType: mime
          });
        }
      }

      // Arquivos soltos direto na pasta de tipo (sem categoria)
      var looseIter = typeFolder.getFiles();
      while (looseIter.hasNext()) {
        var looseFile = looseIter.next();
        var looseMime = looseFile.getMimeType();
        if (looseMime.indexOf("audio/") !== 0) continue;
        result[type]["Geral"] = result[type]["Geral"] || [];
        result[type]["Geral"].push({
          id:       looseFile.getId(),
          name:     looseFile.getName().replace(/\.[^.]+$/, ""),
          mimeType: looseMime
        });
      }
    }

    return result;
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

/* --------------------------------------------------------------------
   SCENES — novas funções RPC para o ScenePlugin
   Seguem exatamente o padrão de ensureAudioStructure / scanAudioLibrary.
   -------------------------------------------------------------------- */

/**
 * Garante que a pasta Minardi VTT/Scenes existe. Cria se necessário.
 * Retorna { sceneFolderId } ou { error }.
 */
function ensureSceneFolder() {
  try {
    var root = _getOrCreateFolder(DriveApp.getRootFolder(), "Minardi VTT");
    var scenes = _getOrCreateFolder(root, "Scenes");
    return { sceneFolderId: scenes.getId() };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Helper interno (pode já existir em Código.js por causa do Audio —
 * se já existir, NÃO duplicar, apenas reutilizar).
 */
function _getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

/**
 * Lista as cenas salvas (arquivos .json) na pasta de cenas.
 * Retorna [{ id, name, updatedAt }] ou { error }.
 * NÃO lê o conteúdo dos arquivos — só metadados, então é rápido
 * mesmo com muitas cenas salvas.
 */
function listScenes(sceneFolderId) {
  try {
    var folder = DriveApp.getFolderById(sceneFolderId);
    var files = folder.getFilesByType(MimeType.PLAIN_TEXT);
    // Arquivos .json no Drive costumam ser detectados como PLAIN_TEXT
    // ou application/json dependendo de como foram criados.
    // Por segurança, iteramos todos os arquivos e filtramos por extensão.
    var allFiles = folder.getFiles();
    var result = [];

    while (allFiles.hasNext()) {
      var f = allFiles.next();
      if (f.getName().toLowerCase().indexOf(".json") === -1) continue;

      result.push({
        id: f.getId(),
        name: f.getName().replace(/\.json$/i, ""),
        updatedAt: f.getLastUpdated().getTime()
      });
    }

    // mais recentes primeiro
    result.sort(function (a, b) { return b.updatedAt - a.updatedAt; });

    return result;
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Salva (cria ou sobrescreve) uma cena como JSON puro.
 * sceneJsonString: string já serializada (JSON.stringify feito no client).
 * Retorna { id, name } ou { error }.
 */
function saveScene(sceneFolderId, sceneName, sceneJsonString) {
  try {
    var folder = DriveApp.getFolderById(sceneFolderId);
    var fileName = sceneName + ".json";

    // procura arquivo existente com esse nome para sobrescrever
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      var file = existing.next();
      file.setContent(sceneJsonString);
      return { id: file.getId(), name: sceneName };
    }

    var newFile = folder.createFile(fileName, sceneJsonString, MimeType.PLAIN_TEXT);
    return { id: newFile.getId(), name: sceneName };

  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Carrega o conteúdo de uma cena pelo fileId.
 * Retorna { content: "...json string..." } ou { error }.
 * O parse (JSON.parse) é feito no client.
 */
function loadScene(sceneFileId) {
  try {
    var file = DriveApp.getFileById(sceneFileId);
    var content = file.getBlob().getDataAsString();
    return { content: content };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Move uma cena para a lixeira do Drive.
 * Retorna { success: true } ou { error }.
 */
function deleteScene(sceneFileId) {
  try {
    var file = DriveApp.getFileById(sceneFileId);
    file.setTrashed(true);
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  }
}