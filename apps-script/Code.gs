/**
 * Bound web app for the team workbook.
 * Paste this into Extensions → Apps Script on that workbook.
 * Set Script property TEAM_PASSWORD. Do not put the password or the
 * workbook id in this file, the public site, or the Sheet.
 * Deploy: Execute as Me, Who has access: Anyone.
 * Anyone can call the URL. Rows are returned only after TEAM_PASSWORD matches.
 */

var APPROVED = {
  checkins: "Check-ins",
  relay: "Relay Desk",
  findings: "Findings and Decisions",
};

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var callback = String(params.callback || "");
  if (callback && !/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(callback)) {
    return json_({ ok: false, error: "unauthorized" });
  }
  var result = readWorkbook_(params);
  if (!callback) return json_(result);
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function readWorkbook_(params) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty("TEAM_PASSWORD") || "";
  var provided = String(params.password || "");
  if (!expected || !sameSecret_(expected, provided)) {
    return { ok: false, error: "unauthorized" };
  }

  var requested = String(params.month || "");
  var month = "";
  if (!requested) month = currentMonth_();
  else if (validMonth_(requested)) month = requested;
  else return { ok: false, error: "bad month" };

  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) return { ok: false, error: "workbook is not configured" };

  return {
    ok: true,
    source: "Google Sheet",
    month: month,
    generatedAt: new Date().toISOString(),
    tabs: {
      board: readTab_(book, "Board \u2014 " + month),
      checkins: readTab_(book, APPROVED.checkins),
      relay: readTab_(book, APPROVED.relay),
      findings: readTab_(book, APPROVED.findings),
    },
  };
}

function readTab_(book, title) {
  var sheet = book.getSheetByName(title);
  if (!sheet) return { title: title, missing: true, columns: [], rows: [] };
  var values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return { title: title, missing: false, columns: [], rows: [] };
  var columns = values[0].map(function (cell) { return String(cell || "").trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var blank = true;
    var row = {};
    for (var c = 0; c < columns.length; c++) {
      if (!columns[c]) continue;
      var cell = values[r][c] == null ? "" : String(values[r][c]).trim();
      if (cell) blank = false;
      row[columns[c]] = cell;
    }
    if (!blank) rows.push(row);
  }
  return { title: title, missing: false, columns: columns.filter(Boolean), rows: rows };
}

function sameSecret_(expected, provided) {
  if (!expected || expected.length !== provided.length) return false;
  var mismatch = 0;
  for (var i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}

function validMonth_(value) {
  var match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  var month = parseInt(match[2], 10);
  return month >= 1 && month <= 12;
}

function currentMonth_() {
  return Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
