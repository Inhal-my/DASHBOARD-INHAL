/**
 * Pembatasan akses add-on.
 *
 * Pola allowlist disimpan di Script Properties dengan kunci `ALLOWLIST`
 * (dipisah koma atau baris baru). Dukungan wildcard domain: `*@umsu.ac.id`.
 * Bila allowlist kosong, add-on menolak berjalan agar arsip tidak terbuka
 * untuk siapa pun yang menempelkan skrip ini ke spreadsheet baru.
 */

var ALLOWLIST_KEY = 'ALLOWLIST';

function parseAllowlist(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map(function (item) { return item.trim().toLowerCase(); })
    .filter(function (item) { return item.length > 0; });
}

function isAllowedEmail(email, allowlist) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return false;
  var list = Array.isArray(allowlist) ? allowlist : parseAllowlist(allowlist);
  if (!list.length) return false;
  for (var i = 0; i < list.length; i++) {
    var pattern = String(list[i] || '').trim().toLowerCase();
    if (!pattern) continue;
    if (pattern === target) return true;
    if (pattern.indexOf('*@') === 0 && target.slice(-(pattern.length - 1)) === pattern.slice(1)) return true;
  }
  return false;
}

function allowlistPatterns() {
  try {
    return parseAllowlist(PropertiesService.getScriptProperties().getProperty(ALLOWLIST_KEY));
  } catch (err) {
    return [];
  }
}

/** Melempar Error bila pengguna saat ini tidak masuk allowlist. */
function assertAllowed() {
  var email = currentUserEmail();
  var allowlist = allowlistPatterns();
  if (!allowlist.length) {
    throw new Error('ALLOWLIST belum diisi. Buka Project Settings > Script Properties dan isi ALLOWLIST dengan email pengelola.');
  }
  if (!isAllowedEmail(email, allowlist)) {
    throw new Error('Akun ' + (email || '(tanpa email)') + ' tidak terdaftar pada ALLOWLIST add-on ini.');
  }
  return email;
}

/** Baris [kunci, nilai] untuk dialog Tentang & Akses. */
function aboutRows(info) {
  var i = info || {};
  var allowlist = Array.isArray(i.allowlist) ? i.allowlist : [];
  return [
    ['Versi reader', i.version || READER_VERSION],
    ['Pengguna', i.email || '(tidak diketahui)'],
    ['Allowlist', allowlist.length ? allowlist.join(', ') : '(belum diisi)'],
    ['Cakupan', 'Tahap 1: hanya manifest.json (jumlah baris, hash, ukuran)'],
    ['Data pribadi', 'Tidak dibaca dan tidak disimpan'],
    ['Restore', 'Tidak dilakukan dari Apps Script'],
    ['Manifest terakhir', i.manifestFile || '-']
  ];
}
