/**
 * Pencatatan bukti drill restore ke sheet `bk_audit`.
 *
 * Format baris dibuat sama dengan catatan drill pada `docs/ops/backup-restore.md`
 * agar mudah disalin ke dokumentasi.
 */

/** [tanggal, label, hasil, tabel cocok, catatan] */
function drillRow(entry) {
  var e = entry || {};
  var tanggal = String(e.tanggal || '').trim() || new Date().toISOString().slice(0, 10);
  var hasil = String(e.hasil || '').trim();
  if (!hasil) throw new Error('Hasil drill wajib diisi (mis. LULUS / GAGAL).');
  return [
    tanggal,
    String(e.label || '').trim(),
    hasil,
    String(e.tabelCocok || '').trim(),
    String(e.catatan || '').trim()
  ];
}

function recordDrill() {
  var ui = SpreadsheetApp.getUi();
  var label = ui.prompt('Catat drill restore', 'Label backup yang dipakai (mis. 20261031-0100):', ui.ButtonSet.OK_CANCEL);
  if (label.getSelectedButton() !== ui.Button.OK) return;
  var hasil = ui.prompt('Catat drill restore', 'Hasil drill (LULUS / GAGAL + alasan):', ui.ButtonSet.OK_CANCEL);
  if (hasil.getSelectedButton() !== ui.Button.OK) return;
  var cocok = ui.prompt('Catat drill restore', 'Jumlah tabel inti yang cocok (mis. 5/5):', ui.ButtonSet.OK_CANCEL);
  if (cocok.getSelectedButton() !== ui.Button.OK) return;
  var catatan = ui.prompt('Catat drill restore', 'Catatan tambahan (opsional):', ui.ButtonSet.OK_CANCEL);
  if (catatan.getSelectedButton() !== ui.Button.OK) return;

  var row = drillRow({
    label: label.getResponseText(),
    hasil: hasil.getResponseText(),
    tabelCocok: cocok.getResponseText(),
    catatan: catatan.getResponseText()
  });

  var sheet = ensureSheet(SHEET_AUDIT, ['Tanggal', 'Label', 'Hasil', 'Tabel cocok', 'Catatan', 'Dicatat oleh']);
  sheet.appendRow(row.concat([currentUserEmail()]));
  ui.alert('Tercatat', 'Bukti drill ditambahkan ke sheet ' + SHEET_AUDIT + '.', ui.ButtonSet.OK);
}

/** Baris audit dari beberapa drill (dipakai untuk rekap/uji). */
function drillSummaryRows(entries) {
  return (entries || []).map(function (entry) { return drillRow(entry); });
}
