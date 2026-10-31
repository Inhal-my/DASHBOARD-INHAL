/**
 * Definisi menu add-on.
 *
 * `menuSpec()` dipisah dari `installMenu()` supaya daftar menu bisa diuji tanpa
 * memanggil API Google.
 */

function menuSpec() {
  return [
    { name: 'Ringkasan Backup…', fn: 'showSummary' },
    { name: 'Bandingkan Dua Backup…', fn: 'showCompare' },
    { separator: true },
    { name: 'Runbook Restore (Checklist)', fn: 'ensureChecklist' },
    { name: 'Catat Drill…', fn: 'recordDrill' },
    { separator: true },
    { name: 'Tentang & Akses', fn: 'showAbout' }
  ];
}

function installMenu(ui) {
  var menu = ui.createMenu(MENU_TITLE);
  menuSpec().forEach(function (item) {
    if (item.separator) menu.addSeparator();
    else menu.addItem(item.name, item.fn);
  });
  menu.addToUi();
}

/** Daftar nama fungsi yang dipanggil menu — dipakai uji agar tidak ada salah ketik. */
function menuFunctionNames() {
  return menuSpec()
    .filter(function (item) { return !item.separator; })
    .map(function (item) { return item.fn; });
}
