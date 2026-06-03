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
