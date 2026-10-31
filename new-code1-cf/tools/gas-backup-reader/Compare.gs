/**
 * Perbandingan dua manifest (mis. backup kemarin vs hari ini) untuk mendeteksi
 * data yang hilang atau berubah drastis — tanpa membaca data pribadi.
 */

/**
 * Baris [tabel, baris A, baris B, selisih, status].
 * status: `sama` | `berubah` | `hilang` (ada di A, tidak ada di B) | `baru`.
 */
function compareManifests(a, b) {
  var countsA = (a && a.counts) || {};
  var countsB = (b && b.counts) || {};
  var tables = Object.keys(countsA);
  Object.keys(countsB).forEach(function (table) {
    if (tables.indexOf(table) === -1) tables.push(table);
  });
  tables.sort();

  return tables.map(function (table) {
    var inA = Object.prototype.hasOwnProperty.call(countsA, table);
    var inB = Object.prototype.hasOwnProperty.call(countsB, table);
    var barisA = inA ? asNumber(countsA[table]) : '';
    var barisB = inB ? asNumber(countsB[table]) : '';
    var selisih = (inA && inB) ? barisA - barisB : '';
    var status = !inB ? 'hilang' : (!inA ? 'baru' : (barisA === barisB ? 'sama' : 'berubah'));
    return [table, barisA, barisB, selisih, status];
  });
}

/** Ringkasan singkat hasil perbandingan untuk pesan dialog. */
function compareVerdict(rows) {
  var out = { hilang: 0, baru: 0, berubah: 0, sama: 0, totalBarisA: 0, totalBarisB: 0 };
  (rows || []).forEach(function (row) {
    if (out[row[4]] === undefined) out[row[4]] = 0;
    out[row[4]] += 1;
    out.totalBarisA += asNumber(row[1]);
    out.totalBarisB += asNumber(row[2]);
  });
  out.selisihBaris = out.totalBarisA - out.totalBarisB;
  return out;
}

function showCompare() {
  var ui = SpreadsheetApp.getUi();
  var first = ui.prompt('Bandingkan backup', 'fileId manifest LAMA (backup pembanding):', ui.ButtonSet.OK_CANCEL);
  if (first.getSelectedButton() !== ui.Button.OK) return;
  var second = ui.prompt('Bandingkan backup', 'fileId manifest BARU:', ui.ButtonSet.OK_CANCEL);
  if (second.getSelectedButton() !== ui.Button.OK) return;

  var a = manifestFromDrive(first.getResponseText());
  var b = manifestFromDrive(second.getResponseText());
  var rows = compareManifests(a, b);
  var verdict = compareVerdict(rows);

  writeTable(SHEET_COMPARE,
    ['Tabel', 'Baris A (' + a.label + ')', 'Baris B (' + b.label + ')', 'Selisih', 'Status'],
    rows,
    'Selisih = A - B. Status "hilang" berarti tabel ada di A tetapi tidak di B.');

  ui.alert('Perbandingan selesai',
    'Tabel hilang: ' + verdict.hilang + '\nTabel baru: ' + verdict.baru +
    '\nTabel berubah: ' + verdict.berubah + '\nSelisih baris total: ' + verdict.selisihBaris,
    ui.ButtonSet.OK);
}
