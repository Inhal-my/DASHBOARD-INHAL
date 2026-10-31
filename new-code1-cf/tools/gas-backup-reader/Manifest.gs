/**
 * Pembacaan dan validasi `manifest.json` hasil `scripts/backup-snapshot.mjs`.
 *
 * Semua fungsi di berkas ini murni (tanpa API Google) kecuali yang berakhiran
 * `FromDrive`/`InFolder`, supaya bisa diuji dengan Node.
 */

var MANIFEST_NAME_PATTERN = /-manifest\.json$/;

function isManifestFileName(name) {
  return MANIFEST_NAME_PATTERN.test(String(name || ''));
}

/** Label `YYYYMMDD-HHmm` dari nama berkas, mis. `20261031-0100-manifest.json`. */
function labelFromFileName(name) {
  var match = String(name || '').match(/(\d{8}-\d{4})/);
  return match ? match[1] : '';
}

function asNumber(value) {
  var n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mengubah teks manifest menjadi objek ternormalisasi.
 * Melempar Error dengan pesan jelas bila manifest tidak bisa dipakai, supaya
 * pengguna tahu arsipnya rusak/versi lama — bukan diam-diam menampilkan nol.
 */
function parseManifest(text) {
  var raw;
  try {
    raw = JSON.parse(String(text || ''));
  } catch (err) {
    throw new Error('manifest.json tidak dapat dibaca sebagai JSON.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('manifest.json tidak berisi objek.');
  }
  if (!raw.label) throw new Error('manifest.json tidak memuat "label".');
  if (!raw.counts || typeof raw.counts !== 'object' || Array.isArray(raw.counts)) {
    throw new Error('manifest.json tidak memuat "counts" per tabel.');
  }

  var counts = {};
  var totalRows = 0;
  Object.keys(raw.counts).forEach(function (table) {
    var rows = asNumber(raw.counts[table]);
    counts[table] = rows;
    totalRows += rows;
  });

  var verification = raw.verification || {};
  var size = raw.size || {};
  var plan = raw.plan || {};
  var source = raw.source || {};
  var csv = raw.csv || null;
  var warnings = [];

  if (!verification.integrity) warnings.push('manifest tidak memuat hasil integrity_check.');
  else if (String(verification.integrity) !== 'ok') warnings.push('integrity_check: ' + verification.integrity);
  if (verification.missingCoreTables && verification.missingCoreTables.length) {
    warnings.push('tabel inti hilang: ' + verification.missingCoreTables.join(', '));
  }
  if (!csv || !csv.tables) warnings.push('arsip ini belum memuat CSV (backup sebelum perubahan generator).');
  if (raw.excludedColumns && Object.keys(raw.excludedColumns).length) {
    warnings.push('kolom besar dikecualikan: ' + Object.keys(raw.excludedColumns).join(', '));
  }

  return {
    label: String(raw.label),
    database: String(raw.database || ''),
    generatedAt: String(raw.generatedAt || ''),
    schemaVersion: asNumber(raw.schemaVersion),
    planLabel: String(plan.label || plan.name || ''),
    integrity: String(verification.integrity || ''),
    verificationOk: verification.ok === true,
    missingCoreTables: (verification.missingCoreTables || []).slice(),
    counts: counts,
    totalRows: totalRows,
    dumpBytes: asNumber(source.bytes),
    dumpSha256: String(source.sha256 || ''),
    estimatedBytes: asNumber(size.estimatedBytes),
    estimatedHuman: String(size.estimatedHuman || ''),
    sizeStatus: String(size.status || ''),
    csv: csv ? {
      dir: String(csv.dir || ''),
      tables: (csv.tables || []).map(function (t) {
        return {
          table: String(t.table || ''),
          file: String(t.file || ''),
          rows: asNumber(t.rows),
          columns: asNumber(t.columns),
          bytes: asNumber(t.bytes),
          sha256: String(t.sha256 || '')
        };
      }),
      totalRows: asNumber(csv.totalRows),
      totalBytes: asNumber(csv.totalBytes)
    } : null,
    warnings: warnings
  };
}

/** Baris [kunci, nilai] untuk sheet ringkasan. */
function manifestSummaryRows(manifest) {
  var m = manifest || {};
  var csv = m.csv;
  return [
    ['Label', m.label || '-'],
    ['Database', m.database || '-'],
    ['Dibuat', m.generatedAt || '-'],
    ['Paket Cloudflare', m.planLabel || '-'],
    ['Integritas', m.integrity || '-'],
    ['Verifikasi inti', m.verificationOk ? 'LULUS' : 'PERIKSA'],
    ['Tabel inti hilang', (m.missingCoreTables && m.missingCoreTables.length) ? m.missingCoreTables.join(', ') : '-'],
    ['Jumlah tabel', String(Object.keys(m.counts || {}).length)],
    ['Total baris', String(asNumber(m.totalRows))],
    ['Ukuran data', m.estimatedHuman || '-'],
    ['Status ambang', m.sizeStatus || '-'],
    ['Dump SQL', formatBytes(m.dumpBytes)],
    ['sha256 dump', m.dumpSha256 ? String(m.dumpSha256).slice(0, 16) + '…' : '-'],
    ['Artefak CSV', csv ? (csv.tables.length + ' tabel · ' + formatBytes(csv.totalBytes)) : 'tidak ada'],
    ['Peringatan', (m.warnings && m.warnings.length) ? m.warnings.join('; ') : '-']
  ];
}

/** Baris [tabel, baris, kolom, ukuran, ketersediaan CSV] terurut per nama tabel. */
function manifestTableRows(manifest) {
  var m = manifest || {};
  var counts = m.counts || {};
  var csvByTable = {};
  if (m.csv && m.csv.tables) {
    m.csv.tables.forEach(function (t) { csvByTable[t.table] = t; });
  }
  return Object.keys(counts).sort().map(function (table) {
    var entry = csvByTable[table];
    return [
      table,
      asNumber(counts[table]),
      entry ? entry.columns : '',
      entry ? formatBytes(entry.bytes) : '',
      entry ? 'ada CSV' : 'hanya dump'
    ];
  });
}

function formatBytes(bytes) {
  var n = asNumber(bytes);
  if (n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function manifestFromDrive(fileId) {
  var id = String(fileId || '').trim();
  if (!id) throw new Error('fileId manifest kosong.');
  var file = DriveApp.getFileById(id);
  return parseManifest(file.getBlob().getDataAsString());
}

/** Daftar berkas manifest di sebuah folder Drive (urut nama menurun = terbaru dulu). */
function manifestFilesInFolder(folderId) {
  var folder = DriveApp.getFolderById(String(folderId || '').trim());
  var files = folder.getFiles();
  var out = [];
  while (files.hasNext()) {
    var file = files.next();
    if (!isManifestFileName(file.getName())) continue;
    out.push({ id: file.getId(), name: file.getName(), updated: String(file.getLastUpdated()) });
  }
  out.sort(function (a, b) { return a.name < b.name ? 1 : -1; });
  return out;
}

