/**
 * Runbook restore berbentuk sheet. Isinya mengikuti `docs/ops/backup-restore.md`
 * (prosedur A–D). Skrip ini hanya menyiapkan daftar periksa — pelaksanaan
 * restore tetap di mesin yang punya `wrangler` dan akses Cloudflare.
 */

function checklistRows() {
  return [
    ['A. Time Travel', 'Catat bookmark sebelum perubahan', 'npx wrangler d1 time-travel info inhal-poc', 'bookmark'],
    ['A. Time Travel', 'Restore ke bookmark pilihan', 'npx wrangler d1 time-travel restore inhal-poc --bookmark=<bookmark>', 'keluaran perintah'],
    ['A. Time Travel', 'Simpan bookmark undo hasil restore', 'catat bookmark undo yang dicetak', 'bookmark undo'],
    ['A. Time Travel', 'Periksa aplikasi', 'GET /api/health + login admin + jumlah pengajuan', 'screenshot'],
    ['B. Artefak GitHub', 'Unduh artefak terbaru', 'gh run download <run-id> -n d1-backup-<label> -D ./restore', 'isi folder'],
    ['B. Artefak GitHub', 'Verifikasi dump sebelum menyentuh DB', 'node scripts/verify-backup.mjs ../restore/inhal-poc.sql', 'verify.json'],
    ['B. Artefak GitHub', 'Buat database tujuan (jangan in-place)', 'npx wrangler d1 create inhal-poc-restore', 'database_id baru'],
    ['B. Artefak GitHub', 'Impor dump', 'npx wrangler d1 execute inhal-poc-restore --remote --file=../restore/inhal-poc.sql', 'jumlah perintah'],
    ['B. Artefak GitHub', 'Ekspor ulang + verifikasi', 'npx wrangler d1 export inhal-poc-restore --remote --output=../restore/restored.sql && node scripts/verify-backup.mjs ../restore/restored.sql', 'verify.json kedua'],
    ['B. Artefak GitHub', 'Bandingkan jumlah tabel inti dengan manifest', 'bandingkan dengan sheet bk_ringkasan / bk_banding', 'tabel cocok'],
    ['B. Artefak GitHub', 'Ganti database_id, deploy, smoke test', '/api/health, /api/registration-options, /portal', 'screenshot'],
    ['C. Arsip Drive', 'Unduh arsip .enc + manifest', 'Drive: inhal-<label>-database.sql.enc', 'berkas'],
    ['C. Arsip Drive', 'Dekripsi dengan passphrase', 'node scripts/decrypt-backup.mjs <arsip.enc> --out=inhal-restore.sql --passphrase="<BACKUP_PASSPHRASE>"', 'sha256 cocok'],
    ['C. Arsip Drive', 'Lanjutkan prosedur B langkah 2', 'verify-backup -> create -> execute -> export', 'verify.json'],
    ['D. Drill lokal', 'Siapkan D1 lokal dari dump', 'npx wrangler d1 execute inhal-poc-restore-drill --local --file=<dump>', 'jumlah perintah'],
    ['D. Drill lokal', 'Jalankan aplikasi lokal & periksa', 'npm run dev lalu buka /api/health', 'screenshot'],
    ['D. Drill lokal', 'Catat bukti drill', 'menu Catat Drill pada add-on ini', 'baris bk_audit']
  ];
}

function ensureChecklist() {
  var rows = checklistRows().map(function (row) {
    return [row[0], row[1], row[2], '', '', row[3], ''];
  });
  writeTable(SHEET_CHECKLIST,
    ['Tahap', 'Langkah', 'Perintah', 'Selesai', 'PIC', 'Bukti', 'Catatan'],
    rows,
    'Tandai kolom Selesai (✓) setelah langkah benar-benar dijalankan. Restore tidak pernah dilakukan in-place ke inhal-poc.');
}
