import { requireAdmin, requireBagianSession } from '../session.js';
import { getBagianBaStatuses, kegiatanKey } from '../read/common.js';
import { saveDriveFile, trashDriveFile, parseDriveFileId } from '../drive.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function lowsp(v) {
  return str(v).toLowerCase().replace(/\s+/g, ' ').trim();
}

function dateOnly(v) {
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const BA_ID_CODE = { berita_acara: 'PEL', berita_acara_admin: 'PEN' };

async function nextBaId(db, table) {
  const year = new Date().getFullYear();
  const code = BA_ID_CODE[table];
  const prefix = code ? 'BA-' + code + '-' + year + '-' : 'BA-' + year + '-';
  const { results } = await db.prepare(`SELECT ba_id FROM ${table}`).all();
  let max = 0;
  for (const r of results || []) {
    const id = str(r.ba_id);
    if (id.indexOf(prefix) !== 0) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function normalizeBaPeserta(payload) {
  const raw = payload && payload.peserta ? payload.peserta : [];
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const p of raw) {
    const npm = str(p && p.npm);
    const nama = str((p && p.namaLengkap) || (p && p.nama));
    if (npm || nama) {
      out.push({
        idPengajuan: str(p && p.idPengajuan),
        npm: npm,
        namaLengkap: nama,
        blok: str(p && p.blok),
        statusPengajuan: str((p && p.statusPengajuan) || (p && p.status))
      });
    }
  }
  return out;
}

async function resolveBaPesertaFromDetail(db, payload) {
  const jenis = lowsp(payload && payload.jenis);
  const pilihan = lowsp(payload && payload.pilihan);
  const detailText = lowsp(payload && payload.detail);
  const blok = str(payload && payload.blok).replace(/\s+/g, ' ');
  if (!jenis && !pilihan && !detailText) return [];

  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const idSet = new Set();
  for (const d of details) {
    if (lowsp(d.jenis_kegiatan) !== jenis) continue;
    if (lowsp(d.pilihan) !== pilihan) continue;
    if (lowsp(d.detail) !== detailText) continue;
    const id = str(d.id_pengajuan);
    if (id) idSet.add(id);
  }
  if (!idSet.size) return [];

  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const out = [];
  for (const p of pengajuan) {
    const id = str(p.id_pengajuan);
    if (!idSet.has(id)) continue;
    if (str(p.blok).replace(/\s+/g, ' ') !== blok) continue;
    const npm = str(p.npm);
    const nama = str(p.nama_lengkap);
    if (npm || nama) {
      out.push({ npm: npm, namaLengkap: nama, blok: str(p.blok), statusPengajuan: str(p.status) });
    }
  }
  out.sort((a, b) => a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()));
  return out;
}

async function validateBaPesertaStatus(db, peserta) {
  const allowed = await getBagianBaStatuses(db);
  const { results } = await db.prepare('SELECT id_pengajuan, status FROM pengajuan').all();
  const map = {};
  for (const r of results || []) map[str(r.id_pengajuan)] = str(r.status);
  const blocked = [];
  for (const p of peserta) {
    const pid = str(p.idPengajuan);
    const st = (pid && map[pid] !== undefined) ? map[pid] : str(p.statusPengajuan);
    if (st && allowed.indexOf(st) === -1) {
      blocked.push((p.namaLengkap || p.npm) + ' (' + st + ')');
    }
  }
  return blocked;
}

async function findDuplicateBa(db, bagian, blok, nama, tanggal) {
  const { results } = await db.prepare('SELECT ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan FROM berita_acara').all();
  for (const r of results || []) {
    if (str(r.bagian) !== bagian) continue;
    if (str(r.blok) !== blok) continue;
    if (str(r.nama_kegiatan) !== nama) continue;
    if (dateOnly(r.tanggal_pelaksanaan) !== dateOnly(tanggal)) continue;
    return {
      ba_id: str(r.ba_id), bagian: str(r.bagian), blok: str(r.blok),
      nama_kegiatan: str(r.nama_kegiatan), tanggal_pelaksanaan: str(r.tanggal_pelaksanaan)
    };
  }
  return null;
}

async function persistBa(db, table, pesertaTable, payload, meta) {
  const ts = nowIso();
  const cols = {
    timestamp: ts,
    ba_id: meta.baId,
    bagian: meta.bagian,
    blok: str(payload.blok),
    nama_kegiatan: str(payload.namaKegiatan),
    tanggal_pelaksanaan: str(payload.tanggalPelaksanaan),
    jam: str(payload.jam),
    jumlah_peserta: payload.__jumlah,
    file_name: meta.fileName,
    file_url: meta.fileUrl,
    catatan: str(payload.catatan),
    sumber: payload.__sumber,
    kegiatan_key: meta.kegiatanKey
  };
  if (meta.withDosen) cols.dosen = str(payload.dosen);
  const keys = Object.keys(cols);
  const placeholders = keys.map((_, i) => '?' + (i + 1)).join(', ');
  const stmts = [
    db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((k) => cols[k]))
  ];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
      ).bind(ts, meta.baId, str(p.idPengajuan), p.npm, p.namaLengkap, p.blok, meta.bagian, p.statusPengajuan)
    );
  }
  await db.batch(stmts);
}

async function syncPengajuanPelaksanaan(db, peserta, dosen, tanggal, jam) {
  const tgl = str(tanggal);
  const j = str(jam);
  const value = tgl && j ? (tgl + 'T' + j) : tgl;
  const ts = nowIso();
  const stmts = [];
  for (const p of peserta) {
    const id = str(p.idPengajuan);
    if (!id) continue;
    stmts.push(
      db.prepare('UPDATE pengajuan SET dosen = ?1, tanggal_pelaksanaan = ?2, updated_at = ?3 WHERE id_pengajuan = ?4')
        .bind(str(dosen), value, ts, id)
    );
  }
  if (stmts.length) await db.batch(stmts);
}

export async function saveBeritaAcaraAdmin(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const p = payload || {};
  const baId = await nextBaId(db, 'berita_acara_admin');
  const bagian = str(p.bagian) || 'Admin';

  const key = kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan));
  const dup = await db.prepare('SELECT ba_id FROM berita_acara_admin WHERE kegiatan_key = ?1').bind(key).first();
  if (dup) {
    return { success: false, message: 'Upload dibatalkan: sudah ada berita acara pendukung untuk kegiatan ini.' };
  }

  let peserta = await resolveBaPesertaFromDetail(db, p);
  if (!peserta.length) peserta = normalizeBaPeserta(p);
  if (!peserta.length) {
    return { success: false, message: 'Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.' };
  }

  let fileUrl = '';
  let fileName = '';
  if (p.file && p.file.data) {
    const up = await saveDriveFile(ctx.env, p.file, 'ba-admin-' + baId);
    if (!up.ok) return { success: false, message: up.message };
    fileUrl = up.url;
    fileName = up.name || '';
  }

  p.__peserta = peserta;
  p.__jumlah = peserta.length;
  p.__sumber = 'Admin';
  await persistBa(db, 'berita_acara_admin', 'berita_acara_admin_peserta', p, {
    baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
    kegiatanKey: key, withDosen: false
  });

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
}

export async function deleteBeritaAcaraAdmin(db, baId, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT ba_id, file_url FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  await db.batch([
    db.prepare('DELETE FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara_admin WHERE ba_id = ?1').bind(id)
  ]);

  const fileId = parseDriveFileId(existing.file_url);
  if (fileId) await trashDriveFile(ctx.env, fileId);

  return { success: true, message: 'Berita acara berhasil dihapus.' };
}

export async function updateBeritaAcaraAdmin(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const p = payload || {};
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };

  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan)
  ];
  await db.prepare('UPDATE berita_acara_admin SET tanggal_pelaksanaan = ?1, jam = ?2, catatan = ?3 WHERE ba_id = ?4').bind(...vals, id).run();
  return { success: true, message: 'Berita acara pendukung diperbarui.' };
}

export async function deleteBeritaAcaraBagian(db, baId, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT ba_id, file_url FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const ids = peserta.map((r) => str(r.id_pengajuan)).filter(Boolean);
  const ts = nowIso();
  const clears = ids.map((pid) =>
    db.prepare('UPDATE pengajuan SET dosen = \'\', tanggal_pelaksanaan = \'\', updated_at = ?1 WHERE id_pengajuan = ?2').bind(ts, pid)
  );

  await db.batch([
    ...clears,
    db.prepare('DELETE FROM berita_acara_peserta WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara WHERE ba_id = ?1').bind(id)
  ]);

  const fileId = parseDriveFileId(existing.file_url);
  if (fileId) await trashDriveFile(ctx.env, fileId);

  return { success: true, message: 'Berita acara berhasil dihapus.' };
}

export async function saveBeritaAcaraBagian(db, payload, kategori, ctx) {
  const p = payload || {};
  await requireBagianSession(db, kategori, p.bagian, ctx.token);
  const bagian = str(p.bagian) || str(kategori);

  const peserta = normalizeBaPeserta(p);
  if (!peserta.length) {
    return { success: false, message: 'Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.' };
  }

  const blocked = await validateBaPesertaStatus(db, peserta);
  if (blocked.length) {
    const allowed = await getBagianBaStatuses(db);
    return {
      success: false,
      message: 'Upload dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '. Muat ulang data terlebih dahulu.'
    };
  }

  const dup = await findDuplicateBa(db, bagian, str(p.blok), str(p.namaKegiatan), str(p.tanggalPelaksanaan));
  if (dup) {
    return {
      success: false,
      message: 'Upload dibatalkan: sudah ada berita acara untuk "' + dup.nama_kegiatan + '" (Bagian ' + dup.bagian + ', Blok ' + dup.blok + ') pada ' + dup.tanggal_pelaksanaan + '. Jika ini revisi, hubungi admin untuk menghapus BA lama.'
    };
  }

  const baId = await nextBaId(db, 'berita_acara');
  let fileUrl = '';
  let fileName = '';
  if (p.file && p.file.data) {
    const up = await saveDriveFile(ctx.env, p.file, 'ba-' + baId);
    if (!up.ok) return { success: false, message: up.message };
    fileUrl = up.url;
    fileName = up.name || '';
  }

  p.__peserta = peserta;
  p.__jumlah = peserta.length;
  p.__sumber = 'Bagian';
  await persistBa(db, 'berita_acara', 'berita_acara_peserta', p, {
    baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
    kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)), withDosen: true
  });
  await syncPengajuanPelaksanaan(db, peserta, str(p.dosen), str(p.tanggalPelaksanaan), str(p.jam));

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
}

export async function updateBeritaAcaraBagian(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const p = payload || {};
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };

  const sets = ['tanggal_pelaksanaan = ?1', 'jam = ?2', 'dosen = ?3', 'catatan = ?4'];
  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.dosen !== undefined ? str(p.dosen) : str(existing.dosen),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan)
  ];
  await db.prepare('UPDATE berita_acara SET ' + sets.join(', ') + ' WHERE ba_id = ?' + (vals.length + 1)).bind(...vals, id).run();

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  await syncPengajuanPelaksanaan(db, peserta.map((r) => ({ idPengajuan: r.id_pengajuan })), vals[2], tanggal, vals[1]);

  return { success: true, message: 'Berita acara diperbarui.' };
}
