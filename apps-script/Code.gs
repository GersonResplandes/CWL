function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({
    ok: true,
    name: 'Central CWL Sheets API',
    version: 5,
    supportsDailyCwlId: true,
    timestamp: new Date().toISOString()
  });
}

function doPost(event) {
  try {
    var request = JSON.parse(event.postData.contents || '{}');
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');

    if (!expectedSecret || request.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Acesso não autorizado.' });
    }

    var actions = {
      setupYear: function () {
        return setupYear(request.payload.year);
      },
      saveCwl: function () {
        return saveCwl(request.payload);
      },
      listCwls: function () {
        return listCwls();
      },
      getCwl: function () {
        return getCwl(request.payload.cwlId);
      },
      saveAdjustment: function () {
        return saveAdjustment(request.payload);
      }
    };

    if (!actions[request.action]) {
      return jsonResponse({ ok: false, error: 'Ação desconhecida.' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      return jsonResponse({ ok: true, data: actions[request.action]() });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || 'Falha interna no Apps Script.' });
  }
}
