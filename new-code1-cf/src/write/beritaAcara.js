import { requireAdmin, requireBagianSession } from '../session.js';
import { getBagianBaStatuses } from '../read/common.js';
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

async function nextBaId(db, table) {
  const year = new Date().getFullYear();
  const prefix = 'BA-' + year + '-';
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

async function persistBa(db, table, pesertaTable, payload, { baId, bagian, fileName, fileUrl }) {
  const ts = nowIso();
  const stmts = [
    db.prepare(
      `INSERT INTO ${table} (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jumlah_peserta, file_name, file_url, catatan, sumber) ` +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)'
    ).bind(
      ts, baId, bagian, str(payload.blok), str(payload.namaKegiatan), str(payload.tanggalPelaksanaan),
      payload.__jumlah, fileName, fileUrl, str(payload.catatan), payload.__sumber
    )
  ];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
      ).bind(ts, baId, p.npm, p.namaLengkap, p.blok, bagian, p.statusPengajuan)
    );
  }
  await db.batch(stmts);
}

export async function saveBeritaAcaraAdmin(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const p = payload || {};
  const baId = await nextBaId(db, 'berita_acara_admin');
  const bagian = str(p.bagian) || 'Admin';

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
  await persistBa(db, 'berita_acara_admin', 'berita_acara_admin_peserta', p, { baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl });

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
  await persistBa(db, 'berita_acara', 'berita_acara_peserta', p, { baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl });

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
}
