var CWL_HEADERS = [
  'RODADA',
  'WAR_TAG',
  'ESTADO',
  'PLAYER_TAG',
  'JOGADOR',
  'CV',
  'ESCALADO',
  'STATUS',
  'CV_ALVO',
  'ESTRELAS_OFICIAIS',
  'DESTRUICAO_OFICIAL',
  'CV_ATACANTE',
  'ESTRELAS_SOFRIDAS_OFICIAIS',
  'AJUSTE_ESTRELAS',
  'AJUSTE_DESTRUICAO',
  'AJUSTE_DEFESA',
  'MOTIVO_AJUSTE',
  'PONTUACAO',
  'ATUALIZADO_EM'
];

var CWL_TABLE_ROW = 11;

function spreadsheetProperty(year) {
  return 'SPREADSHEET_' + year + '_ID';
}

function spreadsheetForYear(year) {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty(spreadsheetProperty(year));
  if (!id) return setupYear(year);
  return SpreadsheetApp.openById(id);
}

function setupYear(year) {
  year = Number(year);
  if (!year || year < 2026 || year > 2100) throw new Error('Ano inválido.');

  var properties = PropertiesService.getScriptProperties();
  var key = spreadsheetProperty(year);
  var existingId = properties.getProperty(key);
  var spreadsheet = existingId
    ? SpreadsheetApp.openById(existingId)
    : SpreadsheetApp.create('CWL - Dark Gyn - ' + year);

  properties.setProperty(key, spreadsheet.getId());
  ensureConfigSheet(spreadsheet, year);

  for (var month = 1; month <= 12; month += 1) {
    ensureCwlSheet(spreadsheet, cwlSheetName(year + '-' + pad2(month)));
  }

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    year: year
  };
}

function ensureConfigSheet(spreadsheet, year) {
  var sheet = spreadsheet.getSheetByName('CONFIG') || spreadsheet.insertSheet('CONFIG', 0);
  var rows = [
    ['CAMPO', 'VALOR'],
    ['ANO', year],
    ['TAG_CLAN', '#2UL0RLRQ'],
    ['NOME_CLAN', 'Dark Gyn'],
    ['VERSAO_MODELO', 2],
    ['ATUALIZADO_EM', new Date()]
  ];
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 2).setBackground('#FFD43B').setFontColor('#241600').setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
}

function ensureCwlSheet(spreadsheet, name) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  sheet.setFrozenRows(CWL_TABLE_ROW - 1);
  sheet.getRange(CWL_TABLE_ROW - 1, 1, 1, CWL_HEADERS.length)
    .setValues([CWL_HEADERS])
    .setBackground('#143942')
    .setFontColor('#FFF8DF')
    .setFontWeight('bold');
  return sheet;
}

function cwlSheetName(cwlId) {
  var normalized = normalizeCwlId(cwlId);
  return 'CWL_' + normalized.replace(/-/g, '_');
}

function normalizeCwlId(cwlId) {
  var normalized = cwlIdToText(cwlId);
  if (!/^\d{4}-(0[1-9]|1[0-2])(-([0-2][0-9]|3[01]))?$/.test(normalized)) {
    throw new Error('O identificador da CWL deve usar o formato AAAA-MM ou AAAA-MM-DD.');
  }
  return normalized;
}

function cwlIdToText(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var text = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])(-([0-2][0-9]|3[01]))?T/.test(text)) {
    return text.slice(0, 10);
  }
  return text;
}

function isCwlSheet(sheet) {
  return /^CWL_\d{4}_(0[1-9]|1[0-2])(_([0-2][0-9]|3[01]))?$/.test(sheet.getName());
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function saveCwl(cwl) {
  if (!cwl || !cwl.cwlId || !cwl.season) throw new Error('CWL inválida.');

  var cwlId = normalizeCwlId(cwl.cwlId);
  var season = normalizeCwlId(cwl.season);
  if (cwlId !== season) throw new Error('A temporada não corresponde ao identificador da CWL.');

  var year = Number(season.slice(0, 4));
  var spreadsheet = spreadsheetForYear(year);
  var sheet = ensureCwlSheet(spreadsheet, cwlSheetName(cwlId));
  var adjustments = readAdjustments(sheet);
  var rows = [];

  cwl.players.forEach(function (player) {
    player.wars.forEach(function (entry, index) {
      var key = String(entry.warTag || 'ROUND-' + (index + 1)) + '|' + player.tag;
      var saved = adjustments[key] || ['', '', '', ''];
      rows.push([
        index + 1,
        entry.warTag || '',
        cwl.rounds[index] ? cwl.rounds[index].state : '',
        player.tag,
        player.name,
        player.th,
        entry.selected ? 'SIM' : 'NAO',
        entry.status,
        entry.targetTh || '',
        entry.stars,
        entry.destruction,
        entry.enemyTh || '',
        entry.defenseStars,
        saved[0],
        saved[1],
        saved[2],
        saved[3],
        entry.score || 0,
        new Date(cwl.fetchedAt)
      ]);
    });
  });

  writeMetadata(sheet, cwl);
  var maxRows = Math.max(sheet.getLastRow() - CWL_TABLE_ROW, 0);
  if (maxRows > 0) {
    sheet.getRange(CWL_TABLE_ROW + 1, 1, maxRows, CWL_HEADERS.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(CWL_TABLE_ROW + 1, 1, rows.length, CWL_HEADERS.length).setValues(rows);
  }
  formatCwlSheet(sheet, rows.length);

  return {
    cwlId: cwlId,
    sheetName: sheet.getName(),
    rows: rows.length,
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function writeMetadata(sheet, cwl) {
  var metadata = [
    ['ID_CWL', cwl.cwlId],
    ['GROUP_TAG', cwl.groupTag || ''],
    ['TEMPORADA', cwl.season],
    ['LIGA', cwl.config.league],
    ['FORMATO', cwl.config.format],
    ['ESTADO', cwl.groupState],
    ['ATUALIZADO_EM', new Date(cwl.fetchedAt)]
  ];
  sheet.getRange(1, 2).setNumberFormat('@');
  sheet.getRange(3, 2).setNumberFormat('@');
  sheet.getRange(1, 1, metadata.length, 2).setValues(metadata);
  sheet.getRange(1, 1, metadata.length, 1).setFontWeight('bold').setFontColor('#143942');
}

function readAdjustments(sheet) {
  var result = {};
  var count = sheet.getLastRow() - CWL_TABLE_ROW;
  if (count <= 0) return result;

  var values = sheet.getRange(CWL_TABLE_ROW + 1, 1, count, CWL_HEADERS.length).getValues();
  values.forEach(function (row) {
    var key = String(row[1] || 'ROUND-' + row[0]) + '|' + row[3];
    result[key] = [row[13], row[14], row[15], row[16]];
  });
  return result;
}

function formatCwlSheet(sheet, rowCount) {
  sheet.setFrozenRows(CWL_TABLE_ROW);
  sheet.getRange(CWL_TABLE_ROW - 1, 1, 1, CWL_HEADERS.length)
    .setBackground('#143942')
    .setFontColor('#FFF8DF')
    .setFontWeight('bold');
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(17, 220);
  sheet.autoResizeColumns(1, 4);
  sheet.autoResizeColumns(6, 11);
  sheet.autoResizeColumns(18, 2);
  if (rowCount > 0) {
    sheet.getRange(CWL_TABLE_ROW + 1, 1, rowCount, CWL_HEADERS.length)
      .setBackground('#F7FBF9')
      .setFontColor('#102A31');
  }
}

function listCwls() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var result = [];

  Object.keys(properties)
    .filter(function (key) { return /^SPREADSHEET_\d{4}_ID$/.test(key); })
    .forEach(function (key) {
      var spreadsheet = SpreadsheetApp.openById(properties[key]);
      spreadsheet.getSheets()
        .filter(isCwlSheet)
        .forEach(function (sheet) {
          var values = sheet.getRange(1, 1, 7, 2).getValues();
          var metadata = {};
          values.forEach(function (row) { metadata[row[0]] = row[1]; });
          if (!metadata.ID_CWL) return;
          var cwlId = normalizeCwlId(metadata.ID_CWL);
          var season = normalizeCwlId(metadata.TEMPORADA || metadata.ID_CWL);
          result.push({
            cwlId: cwlId,
            season: season,
            league: metadata.LIGA,
            format: metadata.FORMATO,
            state: metadata.ESTADO,
            updatedAt: metadata.ATUALIZADO_EM,
            sheetName: sheet.getName()
          });
        });
    });

  return result.sort(function (a, b) {
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

function getCwl(cwlId) {
  cwlId = normalizeCwlId(cwlId);
  var year = Number(cwlId.slice(0, 4));
  var spreadsheet = spreadsheetForYear(year);
  var sheet = spreadsheet.getSheetByName(cwlSheetName(cwlId));
  if (!sheet) throw new Error('CWL não encontrada.');

  var metadataValues = sheet.getRange(1, 1, 7, 2).getValues();
  var metadata = {};
  metadataValues.forEach(function (row) { metadata[row[0]] = row[1]; });

  var count = sheet.getLastRow() - CWL_TABLE_ROW;
  var rows = count > 0
    ? sheet.getRange(CWL_TABLE_ROW + 1, 1, count, CWL_HEADERS.length).getValues()
    : [];

  return { metadata: metadata, headers: CWL_HEADERS, rows: rows };
}

function saveAdjustment(payload) {
  payload.cwlId = normalizeCwlId(payload.cwlId);
  var year = Number(payload.cwlId.slice(0, 4));
  var spreadsheet = spreadsheetForYear(year);
  var sheet = spreadsheet.getSheetByName(cwlSheetName(payload.cwlId));
  if (!sheet) throw new Error('CWL não encontrada.');

  var count = sheet.getLastRow() - CWL_TABLE_ROW;
  if (count <= 0) throw new Error('A CWL não possui jogadores salvos.');

  var values = sheet.getRange(CWL_TABLE_ROW + 1, 1, count, CWL_HEADERS.length).getValues();
  for (var index = 0; index < values.length; index += 1) {
    var row = values[index];
    if (row[1] === payload.warTag && row[3] === payload.playerTag) {
      var targetRow = CWL_TABLE_ROW + 1 + index;
      if (payload.stars !== undefined) sheet.getRange(targetRow, 14).setValue(payload.stars);
      if (payload.destruction !== undefined) sheet.getRange(targetRow, 15).setValue(payload.destruction);
      if (payload.defenseStars !== undefined) sheet.getRange(targetRow, 16).setValue(payload.defenseStars);
      sheet.getRange(targetRow, 17).setValue(payload.reason);
      return { updated: true };
    }
  }

  throw new Error('Jogador ou guerra não encontrados.');
}
