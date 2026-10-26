import { requireBagianSession } from '../session.js';
import { nextIdNumber } from '../sequence.js';
import { kegiatanKey, getBagianBaStatuses } from '../read/common.js';
import { validateBaPesertaStatus } from './beritaAcara.js';
import { validateJadwalInput } from '../validation.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function normalizePeserta(payload) {
  const raw = payload && payload.peserta ? payload.peserta : [];
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const p of raw) {
    const npm = str(p && p.npm);
    const nama = str((p && p.namaLengkap) || (p && p.nama));
    if (npm || nama) {
      out.push({
        idPengajuan: str(p && p.idPengajuan), npm: npm, namaLengkap: nama,
        blok: str(p && p.blok), statusPengajuan: str((p && p.statusPengajuan) || (p && p.status))
      });
    }
  }
  return out;
}

export async function nextJadwalId(db) {
  const year = new Date().getFullYear();
  const prefix = 'JDW-' + year + '-';
  const { results } = await db.prepare('SELECT jadwal_id FROM jadwal_pelaksanaan').all();
  let max = 0;
  for (const r of results || []) {
    const id = str(r.jadwal_id);
    if (id.indexOf(prefix) !== 0) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const n = await nextIdNumber(db, 'jadwal:' + prefix, max);
  return prefix + String(n).padStart(4, '0');
}

function buildInsertStmts(db, jadwalId, payload, meta) {
  const ts = nowIso();
  const stmts = [
    db.prepare(
      'INSERT INTO jadwal_pelaksanaan (timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, catatan, active, created_by, updated_at) ' +
      'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,1,?11,?1)'
    ).bind(ts, jadwalId, meta.bagian, str(payload.blok), str(payload.namaKegiatan), meta.kegiatanKey,
      str(payload.tanggal), str(payload.jam), str(payload.dosen), str(payload.catatan), meta.createdBy)
  ];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        'INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7)'
      ).bind(ts, jadwalId, p.idPengajuan, p.npm, p.namaLengkap, p.blok, p.statusPengajuan)
    );
  }
  return stmts;
}

async function validatePayload(db, peserta, allowedMsg) {
  if (!peserta.length) {
    return { ok: false, message: allowedMsg || 'Simpan dibatalkan: pilih minimal satu peserta.' };
  }
  const blocked = await validateBaPesertaStatus(db, peserta);
  if (blocked.length) {
    const allowed = await getBagianBaStatuses(db);
    return { ok: false, message: 'Simpan dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '.' };
  }
  return { ok: true };
}

async function hasDuplicateJadwal(db, meta, peserta) {
  const { results } = await db.prepare(
    'SELECT j.jadwal_id, p.id_pengajuan, p.npm FROM jadwal_pelaksanaan j ' +
    'JOIN jadwal_peserta p ON p.jadwal_id = j.jadwal_id ' +
    'WHERE j.active = 1 AND j.kegiatan_key = ?1 AND j.tanggal = ?2 AND j.jam = ?3'
  ).bind(str(meta.kegiatanKey), str(meta.tanggal), str(meta.jam)).all();
  const ids = {};
  for (const p of peserta) {
    const id = str(p.idPengajuan);
    const npm = str(p.npm);
    if (id) ids['id:' + id] = true;
    if (npm) ids['npm:' + npm] = true;
  }
  return (results || []).some(function (r) {
    const id = str(r.id_pengajuan);
    const npm = str(r.npm);
    return (id && ids['id:' + id]) || (npm && ids['npm:' + npm]);
  });
}

export async function saveJadwalPelaksanaan(db, payload, kategori, ctx) {
  const p = payload || {};
  await requireBagianSession(db, kategori, p.bagian, ctx.token, ctx.session);
  const input = validateJadwalInput(p);
  if (!input.ok) return { success: false, message: input.message };
  const bagian = str(p.bagian) || str(kategori);
  const peserta = normalizePeserta(p);
  const check = await validatePayload(db, peserta);
  if (!check.ok) return { success: false, message: check.message };

  const key = kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan));
  const dup = await hasDuplicateJadwal(db, { kegiatanKey: key, tanggal: p.tanggal, jam: p.jam }, peserta);
  if (dup) return { success: false, message: 'Jadwal untuk kegiatan, tanggal, jam, dan peserta ini sudah ada.' };

  const jadwalId = await nextJadwalId(db);
  p.__peserta = peserta;
  await db.batch(buildInsertStmts(db, jadwalId, p, {
    bagian: bagian,
    kegiatanKey: key,
    createdBy: str(ctx.session && ctx.session.nama)
  }));
  return { success: true, jadwalId: jadwalId, message: 'Jadwal pelaksanaan berhasil disimpan.' };
}

async function findActiveJadwal(db, jadwalId) {
  const row = await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(jadwalId).first();
  if (!row || Number(row.active) !== 1) return null;
  return row;
}

async function hasBa(db, jadwalId) {
  const direct = await db.prepare('SELECT ba_id FROM berita_acara WHERE jadwal_id = ?1').bind(jadwalId).first();
  if (direct) return true;
  const sesi = await db.prepare('SELECT ba_id FROM berita_acara_sesi WHERE jadwal_id = ?1').bind(jadwalId).first();
  return !!sesi;
}

export async function updateJadwalPelaksanaan(db, jadwalId, payload, kategori, ctx) {
  const p = payload || {};
  const id = str(jadwalId);
  const existing = await findActiveJadwal(db, id);
  if (!existing) return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);
  if (await hasBa(db, id)) return { success: false, message: 'Jadwal terkunci: berita acara sudah dibuat.' };
  const input = validateJadwalInput(p);
  if (!input.ok) return { success: false, message: input.message };

  const peserta = normalizePeserta(p);
  const check = await validatePayload(db, peserta);
  if (!check.ok) return { success: false, message: check.message };

  const ts = nowIso();
  const bagian = str(p.bagian) || str(existing.bagian) || str(kategori);
  await db.batch([
    db.prepare(
      'UPDATE jadwal_pelaksanaan SET bagian=?1, blok=?2, nama_kegiatan=?3, kegiatan_key=?4, tanggal=?5, jam=?6, dosen=?7, catatan=?8, updated_at=?9 WHERE jadwal_id=?10'
    ).bind(bagian, str(p.blok), str(p.namaKegiatan), kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)),
      str(p.tanggal), str(p.jam), str(p.dosen), str(p.catatan), ts, id),
    db.prepare('DELETE FROM jadwal_peserta WHERE jadwal_id=?1').bind(id),
    ...peserta.map((pp) => db.prepare(
      'INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) VALUES (?1,?2,?3,?4,?5,?6,?7)'
    ).bind(ts, id, pp.idPengajuan, pp.npm, pp.namaLengkap, pp.blok, pp.statusPengajuan))
  ]);
  return { success: true, message: 'Jadwal pelaksanaan diperbarui.' };
}

export async function cancelJadwalPelaksanaan(db, jadwalId, kategori, ctx) {
  const id = str(jadwalId);
  const existing = await findActiveJadwal(db, id);
  if (!existing) return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);
  if (await hasBa(db, id)) return { success: false, message: 'Jadwal terkunci: berita acara sudah dibuat.' };
  await db.prepare('UPDATE jadwal_pelaksanaan SET active=0, updated_at=?1 WHERE jadwal_id=?2').bind(nowIso(), id).run();
  return { success: true, message: 'Jadwal pelaksanaan dibatalkan.' };
}
