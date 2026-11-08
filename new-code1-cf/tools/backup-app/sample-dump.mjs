import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Membuat dump SQL contoh (skema + data uji) untuk mencoba aplikasi lokal
 * tanpa akses Cloudflare.
 *
 * Hasilnya kompatibel dengan `tools/backup-app/start.mjs` dan
 * `npm run app:local -- --dump=<berkas>`.
 *
 * Contoh:
 *   node tools/backup-app/sample-dump.mjs --out=/Users/anda/inhal-contoh.sql
 *   node tools/backup-app/sample-dump.mjs            # default: local-data/contoh/inhal-contoh.sql
 */

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(here, '..', '..');
const SCHEMA_PATH = join(PROJECT_DIR, 'schema.sql');
const DEFAULT_OUT = join(PROJECT_DIR, 'local-data', 'contoh', 'inhal-contoh.sql');

function argOf(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(argv, name) {
  return argv.includes('--' + name);
}

/** Tanggal ISO mundur N hari/jam dari sekarang (UTC). */
function ago(days, hours) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days || 0));
  d.setUTCHours(d.getUTCHours() - (hours || 0));
  return d.toISOString();
}

/** Tanggal saja (YYYY-MM-DD) mundur N hari. */
function dayAgo(days) {
  return ago(days, 0).slice(0, 10);
}

const DEMO_PENGAJUAN = [
  {
    id: 'DEMO-0001', npm: '2201010001', nama: 'Aisyah Putri', email: 'aisyah@contoh.com', hp: '081200000001',
    blok: 'A', jenis: 'SGD', status: 'Menunggu', hari: 2,
    detail: [
      { jenis: 'SGD', pilihan: 'SGD 1', detail: 'Materi A', bagian: 'SGD' }
    ]
  },
  {
    id: 'DEMO-0002', npm: '2201010002', nama: 'Budi Santoso', email: 'budi@contoh.com', hp: '081200000002',
    blok: 'B', jenis: 'KKD', status: 'ACC', hari: 5,
    detail: [
      { jenis: 'KKD', pilihan: 'KKD 1', detail: 'Materi B', bagian: 'KKD' }
    ]
  },
  {
    id: 'DEMO-0003', npm: '2201010003', nama: 'Citra Dewi', email: 'citra@contoh.com', hp: '081200000003',
    blok: 'A', jenis: 'Ujian', status: 'Ditolak', hari: 8,
    detail: [
      { jenis: 'Ujian', pilihan: 'UTS', detail: '', bagian: 'Ujian' }
    ]
  },
  {
    id: 'DEMO-0004', npm: '2201010001', nama: 'Aisyah Putri', email: 'aisyah@contoh.com', hp: '081200000001',
    blok: 'A', jenis: 'Praktikum', status: 'Menunggu', hari: 1,
    detail: [
      { jenis: 'Praktikum', pilihan: 'Lab Anatomi', detail: 'Praktikum 1', bagian: 'Anatomi' }
    ]
  }
];

const DEMO_BA = [
  {
    baId: 'BA-DEMO-01', bagian: 'SGD', blok: 'A', nama: 'SGD 1 - Materi A', jenis: 'SGD',
    tanggal: dayAgo(3), jam: '08:00 - 10:00', dosen: 'dr. Andi', peserta: ['DEMO-0001']
  }
];

export function buildSampleDump(options) {
  const opts = options || {};
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(schema);

  const insert = {
    admin: db.prepare('INSERT INTO admin (id, password, nama) VALUES (?1, ?2, ?3)'),
    mahasiswa: db.prepare('INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES (?1, ?2, ?3, ?4, ?5)'),
    pengajuan: db.prepare(
      'INSERT INTO pengajuan (timestamp, id_pengajuan, form_key, npm, nama_lengkap, email, no_hp_wa, blok, ' +
      'jenis_kegiatan, status, keterangan, updated_at, sumber, status_pembayaran) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)'
    ),
    detail: db.prepare(
      'INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ),
    history: db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
    ),
    biaya: db.prepare('INSERT INTO master_biaya (kegiatan, biaya) VALUES (?1, ?2)'),
    ba: db.prepare(
      'INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, ' +
      'jumlah_peserta, file_name, file_url, catatan, sumber, kegiatan_key, label, jadwal_id) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)'
    ),
    baPeserta: db.prepare(
      'INSERT INTO berita_acara_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
    ),
    logUpload: db.prepare(
      'INSERT INTO log_upload (timestamp, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan, detail, tanggal, ' +
      'link_acc_inhal, link_bukti_bayar) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)'
    ),
    audit: db.prepare(
      'INSERT INTO audit_log (timestamp, actor_email, aksi, target, detail, alasan) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
    )
  };

  const password = opts.password || 'admin123';
  insert.admin.run(1, password, opts.adminName || 'Admin Demo');

  // Tiga mahasiswa sudah disemai oleh schema.sql; jangan ditambah lagi karena
  // npm adalah PRIMARY KEY.

  const biaya = [
    ['SGD', '50000'], ['KKD', '75000'], ['Ujian', '60000'], ['Praktikum', '100000'],
    ['SGD 1 - Materi A', '50000'], ['KKD 1 - Materi B', '75000'], ['UTS', '60000']
  ];
  for (const b of biaya) insert.biaya.run(b[0], b[1]);

  const idpengajuan = [];
  let seq = 1;
  for (const p of DEMO_PENGAJUAN) {
    const ts = ago(p.hari, 3);
    insert.pengajuan.run(
      ts, p.id, 'demo-' + seq, p.npm, p.nama, p.email, p.hp, p.blok,
      p.jenis, p.status, 'Data contoh untuk uji lokal', ts, 'portal',
      p.status === 'ACC' ? 'terverifikasi' : 'belum'
    );
    for (const d of p.detail) {
      insert.detail.run(ts, p.id, d.jenis, d.pilihan, d.detail, dayAgo(p.hari + 2), d.bagian);
    }
    insert.history.run(ts, p.id, p.status, 'Data contoh', 'admin@contoh.com');
    idpengajuan.push(p);
    seq += 1;
  }

  for (const b of DEMO_BA) {
    const peserta = idpengajuan.filter((p) => b.peserta.indexOf(p.id) !== -1);
    insert.ba.run(
      ago(3, 1), b.baId, b.bagian, b.blok, b.nama, b.tanggal, b.jam, b.dosen,
      String(peserta.length), '', '', 'BA contoh', 'Bagian',
      (b.bagian + '|' + b.blok + '|' + b.nama).toLowerCase(), '', ''
    );
    for (const p of peserta) {
      insert.baPeserta.run(ago(3, 1), b.baId, p.id, p.npm, p.nama, p.blok, b.bagian, p.status);
    }
  }

  insert.logUpload.run(
    ago(0, 4), 'DEMO-0002', '2201010002', 'Budi Santoso', 'B', 'KKD',
    'Unggah bukti bayar', dayAgo(1), '', 'https://drive.google.com/contoh/bukti-bayar'
  );

  const auditRows = [
    [ago(2, 2), 'admin@contoh.com', 'VERIFY', 'DEMO-0002', JSON.stringify({ status: 'ACC' }), 'Berkas lengkap'],
    [ago(2, 1), 'admin@contoh.com', 'DENY', 'DEMO-0003', JSON.stringify({ alasan: 'Bukti tidak jelas' }), 'Bukti tidak jelas'],
    [ago(0, 5), 'admin@contoh.com', 'UPLOAD_BUKTI_ADMIN', 'DEMO-0002', JSON.stringify({ blok: 'B' }), ''],
    [ago(1, 2), 'admin@contoh.com', 'BA_CREATE', 'BA-DEMO-01', JSON.stringify({ judul: 'BA SGD 1' }), '']
  ];
  for (const a of auditRows) insert.audit.run(a[0], a[1], a[2], a[3], a[4], a[5]);

  const dump = exportDatabase(db);
  db.close();
  return dump;
}

/** Tulis dump lewat API SQLite agar escaping otomatis benar. */
function exportDatabase(db) {
  const lines = [];
  const tables = db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY rowid"
  ).all();
  const indexes = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY rowid"
  ).all();

  lines.push('PRAGMA defer_foreign_keys=TRUE;');
  for (const t of tables) {
    lines.push(t.sql + ';');
    const rows = db.prepare('SELECT * FROM "' + t.name.replace(/"/g, '""') + '"').all();
    for (const row of rows) {
      const cols = Object.keys(row);
      const colSql = cols.map((c) => '"' + c.replace(/"/g, '""') + '"').join(',');
      const valSql = cols.map((c) => sqlLiteral(row[c])).join(',');
      lines.push('INSERT INTO "' + t.name.replace(/"/g, '""') + '" (' + colSql + ') VALUES (' + valSql + ');');
    }
  }
  for (const i of indexes) lines.push(i.sql + ';');
  return lines.join('\n') + '\n';
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Uint8Array) return "X'" + Buffer.from(value).toString('hex') + "'";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function main() {
  const argv = process.argv.slice(2);
  const out = resolve(argOf(argv, 'out', DEFAULT_OUT));
  const password = argOf(argv, 'password', 'admin123');

  try {
    const sql = buildSampleDump({ password, adminName: argOf(argv, 'admin', 'Admin Demo') });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, sql);
    const counts = [
      'pengajuan=4', 'detail_kegiatan=4', 'berita_acara=1',
      'mahasiswa=3', 'audit_log=4', 'log_upload=1'
    ];
    console.log(JSON.stringify({
      ok: true,
      out: out,
      bytes: sql.length,
      login: { admin: argOf(argv, 'admin', 'Admin Demo'), password: password },
      data: counts
    }, null, 2));
    console.log('\nLangkah berikutnya:');
    console.log('  node tools/backup-app/start.mjs --dump=' + out);
    if (hasFlag(argv, 'quiet')) return;
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String((err && err.message) || err) }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { exportDatabase, sqlLiteral };
