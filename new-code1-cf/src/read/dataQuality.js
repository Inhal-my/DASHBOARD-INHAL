import { jadwalIdentity } from './jadwal.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function countOf(row) {
  return Number(row && row.n) || 0;
}

export async function auditDataQuality(db) {
  const mahasiswaBlank = await db.prepare(
    "SELECT COUNT(*) AS n FROM mahasiswa WHERE trim(coalesce(blok, '')) = ''"
  ).first();
  const mahasiswaBlankSamples = (await db.prepare(
    "SELECT npm, nama_lengkap FROM mahasiswa WHERE trim(coalesce(blok, '')) = '' ORDER BY npm LIMIT 10"
  ).all()).results || [];

  const baAdminOrphan = await db.prepare(
    'SELECT COUNT(*) AS n FROM berita_acara_admin a WHERE NOT EXISTS (' +
    'SELECT 1 FROM berita_acara_admin_peserta p WHERE p.ba_id = a.ba_id AND p.active = 1)'
  ).first();
  const baAdminOrphanSamples = (await db.prepare(
    'SELECT a.ba_id, a.bagian, a.blok, a.nama_kegiatan FROM berita_acara_admin a WHERE NOT EXISTS (' +
    'SELECT 1 FROM berita_acara_admin_peserta p WHERE p.ba_id = a.ba_id AND p.active = 1) ' +
    'ORDER BY a.timestamp DESC LIMIT 10'
  ).all()).results || [];

  const baBagianOrphan = await db.prepare(
    'SELECT COUNT(*) AS n FROM berita_acara b WHERE NOT EXISTS (' +
    'SELECT 1 FROM berita_acara_peserta p WHERE p.ba_id = b.ba_id)'
  ).first();
  const baBagianOrphanSamples = (await db.prepare(
    'SELECT b.ba_id, b.bagian, b.blok, b.nama_kegiatan FROM berita_acara b WHERE NOT EXISTS (' +
    'SELECT 1 FROM berita_acara_peserta p WHERE p.ba_id = b.ba_id) ' +
    'ORDER BY b.timestamp DESC LIMIT 10'
  ).all()).results || [];

  const jadwalRows = (await db.prepare(
    'SELECT jadwal_id, bagian, blok, nama_kegiatan, tanggal, jam, dosen FROM jadwal_pelaksanaan WHERE active = 1'
  ).all()).results || [];
  const jadwalPeserta = (await db.prepare(
    'SELECT jadwal_id, id_pengajuan, npm FROM jadwal_peserta'
  ).all()).results || [];
  const pesertaByJadwal = {};
  for (const p of jadwalPeserta) {
    const id = str(p.jadwal_id);
    if (!id) continue;
    if (!pesertaByJadwal[id]) pesertaByJadwal[id] = [];
    pesertaByJadwal[id].push({ idPengajuan: str(p.id_pengajuan), npm: str(p.npm) });
  }
  const groups = new Map();
  for (const r of jadwalRows) {
    const row = {
      JadwalID: str(r.jadwal_id),
      Bagian: str(r.bagian),
      Blok: str(r.blok),
      NamaKegiatan: str(r.nama_kegiatan),
      Tanggal: str(r.tanggal),
      Jam: str(r.jam),
      Dosen: str(r.dosen),
      peserta: pesertaByJadwal[str(r.jadwal_id)] || []
    };
    const key = jadwalIdentity(row);
    const item = groups.get(key) || { key: key, count: 0, jadwalIds: [], contoh: row };
    item.count += 1;
    if (item.jadwalIds.length < 10) item.jadwalIds.push(row.JadwalID);
    groups.set(key, item);
  }
  const jadwalDuplikat = Array.from(groups.values()).filter((g) => g.count > 1);
  const jadwalDuplikatRows = jadwalDuplikat.reduce((sum, g) => sum + (g.count - 1), 0);

  const baNeedsRegen = await db.prepare(
    'SELECT COUNT(*) AS n FROM berita_acara_admin WHERE needs_regen = 1'
  ).first();
  const baNeedsRegenSamples = (await db.prepare(
    'SELECT ba_id, bagian, blok, nama_kegiatan FROM berita_acara_admin WHERE needs_regen = 1 ORDER BY timestamp DESC LIMIT 10'
  ).all()).results || [];

  const baPesertaNonaktif = await db.prepare(
    'SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE active = 0'
  ).first();

  return {
    mahasiswaBlokKosong: {
      count: countOf(mahasiswaBlank),
      samples: mahasiswaBlankSamples
    },
    baAdminOrphan: {
      count: countOf(baAdminOrphan),
      samples: baAdminOrphanSamples
    },
    baBagianOrphan: {
      count: countOf(baBagianOrphan),
      samples: baBagianOrphanSamples
    },
    jadwalDuplikat: {
      count: jadwalDuplikatRows,
      groups: jadwalDuplikat
    },
    baNeedsRegen: {
      count: countOf(baNeedsRegen),
      samples: baNeedsRegenSamples
    },
    baPesertaNonaktif: {
      count: countOf(baPesertaNonaktif)
    },
    totals: {
      mahasiswaBlokKosong: countOf(mahasiswaBlank),
      baOrphan: countOf(baAdminOrphan) + countOf(baBagianOrphan),
      jadwalDuplikat: jadwalDuplikatRows,
      baNeedsRegen: countOf(baNeedsRegen),
      baPesertaNonaktif: countOf(baPesertaNonaktif)
    }
  };
}
