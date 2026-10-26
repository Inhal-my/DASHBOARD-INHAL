import { requireAdmin, requireBagianSession } from '../session.js';
import { getBagianBaStatuses, kegiatanKey, getMasterOptions, resolveBagian12 } from '../read/common.js';
import { nextIdNumber } from '../sequence.js';
import { saveDriveFile, trashDriveFile, parseDriveFileId } from '../drive.js';
import { validateBaCreateInput, validateBaUpdateInput } from '../validation.js';
import { writeAuditLog } from '../audit.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function lowsp(v) {
  return str(v).toLowerCase().replace(/\s+/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const BA_ID_CODE = { berita_acara: 'PEL', berita_acara_admin: 'PEN' };

async function auditBa(db, ctx, action, baId, detail) {
  try {
    await writeAuditLog(db, {
      actor: str(ctx && ctx.session && ctx.session.nama) || 'Sistem',
      action: action,
      target: baId,
      detail: JSON.stringify(detail || {}),
      alasan: ''
    });
  } catch {
    // Audit BA bersifat best-effort; kegagalan sudah dicatat oleh writeAuditLog.
  }
}

export async function nextBaId(db, table) {
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
  const n = await nextIdNumber(db, 'ba:' + prefix, max);
  return prefix + String(n).padStart(4, '0');
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

export async function validateBaPesertaStatus(db, peserta) {
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

async function validateBaPesertaKegiatan(db, peserta, bagian, blok, namaKegiatan) {
  const key = kegiatanKey(bagian, str(blok), str(namaKegiatan));
  const pengajuan = (await db.prepare('SELECT id_pengajuan, blok FROM pengajuan').all()).results || [];
  const pMap = {};
  for (const p of pengajuan) pMap[str(p.id_pengajuan)] = p;
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const detailMap = {};
  for (const d of details) {
    const pid = str(d.id_pengajuan);
    if (!pid) continue;
    if (!detailMap[pid]) detailMap[pid] = [];
    detailMap[pid].push(d);
  }
  const labs = await getMasterOptions(db, 'Lab');
  const problems = [];
  const seen = new Set();
  for (const p of peserta) {
    const pid = str(p.idPengajuan);
    const label = str(p.namaLengkap) || str(p.npm) || pid || '(tanpa identitas)';
    if (!pid) { problems.push(label + ' (ID pengajuan kosong)'); continue; }
    if (!pMap[pid]) { problems.push(label + ' (tidak ditemukan)'); continue; }
    if (seen.has(pid)) { problems.push(label + ' (duplikat)'); continue; }
    seen.add(pid);
    if (str(pMap[pid].blok).replace(/\s+/g, ' ') !== str(blok).replace(/\s+/g, ' ')) {
      problems.push(label + ' (blok tidak sesuai)');
      continue;
    }
    let matches = false;
    for (const d of detailMap[pid] || []) {
      const jenis = str(d.jenis_kegiatan);
      const nama = str(d.pilihan) + (str(d.detail) ? ' - ' + str(d.detail) : '');
      const dBagian = lowsp(jenis) === 'praktikum'
        ? (resolveBagian12('Praktikum', str(d.pilihan), nama, labs) || 'Praktikum')
        : jenis;
      if (kegiatanKey(dBagian, str(blok), nama) === key) { matches = true; break; }
    }
    if (!matches) problems.push(label + ' (kegiatan tidak sesuai)');
  }
  return problems;
}

function buildPersistBaStmts(db, table, pesertaTable, payload, meta) {
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
  if (meta.withLabel) cols.label = str(payload.label);
  if (meta.withJadwal) cols.jadwal_id = str(payload.jadwalId);
  const keys = Object.keys(cols);
  const placeholders = keys.map((_, i) => '?' + (i + 1)).join(', ');
  const key = meta.allowMultiple ? '' : str(meta.kegiatanKey);
  const insertBa = key
    ? db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) SELECT ${placeholders} ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE kegiatan_key = ?${keys.length + 1})`
    ).bind(...keys.map((k) => cols[k]), key)
    : db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((k) => cols[k]));
  const stmts = [insertBa];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        `SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM ${table} WHERE ba_id = ?2)`
      ).bind(ts, meta.baId, str(p.idPengajuan), p.npm, p.namaLengkap, p.blok, meta.bagian, p.statusPengajuan)
    );
  }
  return stmts;
}

async function persistBa(db, table, pesertaTable, payload, meta) {
  await db.batch(buildPersistBaStmts(db, table, pesertaTable, payload, meta));
}

function pelaksanaanValue(tanggal, jam) {
  const tgl = str(tanggal);
  const j = str(jam);
  return tgl && j ? (tgl + 'T' + j) : tgl;
}

function buildSyncStmts(db, peserta, dosen, tanggal, jam) {
  const value = pelaksanaanValue(tanggal, jam);
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
  return stmts;
}

async function syncPengajuanPelaksanaan(db, peserta, dosen, tanggal, jam) {
  const stmts = buildSyncStmts(db, peserta, dosen, tanggal, jam);
  if (stmts.length) await db.batch(stmts);
}

const MAX_BA_SESI = 50;

// Satu BA Pelaksanaan boleh mencakup beberapa sesi jadwal. Klien mengirim
// `jadwalIds` (array); `jadwalId` tunggal tetap diterima untuk kompatibilitas.
export function normalizeJadwalIds(payload) {
  const p = payload || {};
  const raw = Array.isArray(p.jadwalIds) ? p.jadwalIds.slice() : [];
  if (!raw.length && p.jadwalId) raw.push(p.jadwalId);
  const out = [];
  for (const value of raw) {
    const id = str(value);
    if (!id || out.indexOf(id) !== -1) continue;
    out.push(id);
  }
  return out;
}

function sesiTanggal(jd) {
  return str(jd && jd.tanggal).slice(0, 10);
}

function compareSesi(a, b) {
  return sesiTanggal(a).localeCompare(sesiTanggal(b))
    || str(a && a.jam).localeCompare(str(b && b.jam))
    || str(a && a.jadwal_id).localeCompare(str(b && b.jadwal_id));
}

export function sesiLabel(sesi) {
  return (sesi || []).map((jd) => {
    const tgl = sesiTanggal(jd) || '(tanpa tanggal)';
    const jam = str(jd && jd.jam);
    return jam ? tgl + ' ' + jam : tgl;
  }).join(', ');
}

async function findSesiLink(db, jadwalId, excludeBaId) {
  const excluded = str(excludeBaId);
  const { results } = await db.prepare(
    'SELECT ba_id, jadwal_id FROM berita_acara_sesi WHERE jadwal_id = ?1 ' +
    'UNION ALL SELECT ba_id, jadwal_id FROM berita_acara WHERE jadwal_id = ?1'
  ).bind(jadwalId).all();
  for (const row of results || []) {
    const baId = str(row.ba_id);
    if (!baId || baId === excluded) continue;
    return baId;
  }
  return '';
}

async function resolveBaSesi(db, options) {
  const ids = options.jadwalIds || [];
  if (!ids.length) return { ok: true, sesi: [] };
  if (ids.length > MAX_BA_SESI) {
    return { ok: false, message: 'Sesi maksimal ' + MAX_BA_SESI + ' jadwal per berita acara.' };
  }
  const key = str(options.kegiatanKey);
  const sesi = [];
  for (const id of ids) {
    const jd = await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(id).first();
    if (!jd || Number(jd.active) !== 1) {
      return { ok: false, message: 'Jadwal pelaksanaan tidak ditemukan atau sudah dibatalkan.' };
    }
    const jadwalKey = str(jd.kegiatan_key) || kegiatanKey(str(jd.bagian), str(jd.blok), str(jd.nama_kegiatan));
    if (jadwalKey !== key) {
      return { ok: false, message: 'Jadwal pelaksanaan tidak sesuai dengan kegiatan berita acara.' };
    }
    const linked = await findSesiLink(db, id, options.excludeBaId);
    if (linked) {
      return { ok: false, message: 'Berita acara untuk jadwal ini sudah ada (' + linked + ').' };
    }
    sesi.push(jd);
  }
  sesi.sort(compareSesi);

  const tanggal = str(options.tanggal).slice(0, 10);
  const firstTanggal = sesiTanggal(sesi[0]);
  if (tanggal && firstTanggal && tanggal !== firstTanggal) {
    return {
      ok: false,
      message: 'Tanggal BA harus sama dengan tanggal sesi paling awal (' + sesiLabel(sesi.slice(0, 1)) + ').'
    };
  }
  return { ok: true, sesi: sesi };
}

function buildBaSesiStmts(db, baId, sesi) {
  const ts = nowIso();
  return (sesi || []).map((jd, index) => db.prepare(
    'INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES (?1, ?2, ?3, ?4)'
  ).bind(ts, baId, str(jd.jadwal_id), index + 1));
}

// Sesi tersimpan untuk satu BA; fallback ke kolom lama berita_acara.jadwal_id
// agar BA yang dibuat sebelum migrasi tetap terbaca.
async function loadBaSesiRows(db, baId) {
  const { results } = await db.prepare(
    'SELECT jadwal_id FROM berita_acara_sesi WHERE ba_id = ?1 ORDER BY urutan, id'
  ).bind(baId).all();
  const ids = (results || []).map((r) => str(r.jadwal_id)).filter(Boolean);
  if (!ids.length) {
    const ba = await db.prepare('SELECT jadwal_id FROM berita_acara WHERE ba_id = ?1').bind(baId).first();
    const legacy = str(ba && ba.jadwal_id);
    if (legacy) ids.push(legacy);
  }
  const sesi = [];
  for (const jadwalId of ids) {
    const jd = await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(jadwalId).first();
    if (jd) sesi.push(jd);
  }
  sesi.sort(compareSesi);
  return sesi;
}

// Sinkronisasi pengajuan memakai nilai sesi masing-masing peserta agar BA
// multi-sesi tidak menimpa tanggal/jam sesi lain dengan nilai BA.
async function buildSesiSyncStmts(db, peserta, sesi, fallback) {
  const list = sesi || [];
  if (!list.length) {
    return buildSyncStmts(db, peserta, fallback.dosen, fallback.tanggal, fallback.jam);
  }
  const order = {};
  list.forEach((jd, index) => { order[str(jd.jadwal_id)] = index; });
  const byJadwal = {};
  for (const jd of list) byJadwal[str(jd.jadwal_id)] = jd;

  const rows = (await db.prepare('SELECT jadwal_id, id_pengajuan FROM jadwal_peserta').all()).results || [];
  const sesiOfPeserta = {};
  for (const row of rows) {
    const jid = str(row.jadwal_id);
    const pid = str(row.id_pengajuan);
    if (!pid || order[jid] === undefined) continue;
    if (sesiOfPeserta[pid] === undefined || order[jid] < order[sesiOfPeserta[pid]]) {
      sesiOfPeserta[pid] = jid;
    }
  }

  const stmts = [];
  for (const p of peserta || []) {
    const pid = str(p.idPengajuan);
    if (!pid) continue;
    const jd = byJadwal[sesiOfPeserta[pid]] || null;
    const dosen = jd ? (str(jd.dosen) || fallback.dosen) : fallback.dosen;
    const tanggal = jd ? str(jd.tanggal) : fallback.tanggal;
    const jam = jd ? str(jd.jam) : fallback.jam;
    stmts.push(...buildSyncStmts(db, [p], dosen, tanggal, jam));
  }
  return stmts;
}

export async function saveBeritaAcaraAdmin(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const input = validateBaCreateInput(p);
  if (!input.ok) return { success: false, message: input.message };
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
  await auditBa(db, ctx, 'BA_CREATE', baId, { jenis: 'Pendukung', bagian: bagian, jumlahPeserta: peserta.length });

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
}

async function resolveBaPesertaByIds(db, ids) {
  const list = Array.from(new Set((ids || []).map(str).filter(Boolean)));
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const pMap = {};
  for (const p of pengajuan) pMap[str(p.id_pengajuan)] = p;
  const peserta = [];
  const missing = [];
  for (const id of list) {
    const p = pMap[id];
    if (!p) { missing.push(id); continue; }
    peserta.push({
      idPengajuan: id,
      npm: str(p.npm),
      namaLengkap: str(p.nama_lengkap),
      blok: str(p.blok),
      statusPengajuan: str(p.status)
    });
  }
  return { peserta, missing };
}

async function buildRestorePengajuanStmts(db, ids, excludeBaId) {
  const ts = nowIso();
  const stmts = [];
  for (const pid of ids) {
    const next = await db.prepare(
      'SELECT a.dosen, a.tanggal_pelaksanaan, a.jam FROM berita_acara_peserta p ' +
      'JOIN berita_acara a ON a.ba_id = p.ba_id ' +
      'WHERE p.id_pengajuan = ?1 AND p.ba_id <> ?2 ' +
      'ORDER BY a.timestamp DESC, a.ba_id DESC LIMIT 1'
    ).bind(pid, excludeBaId).first();
    stmts.push(
      db.prepare('UPDATE pengajuan SET dosen = ?1, tanggal_pelaksanaan = ?2, updated_at = ?3 WHERE id_pengajuan = ?4')
        .bind(next ? str(next.dosen) : '', next ? pelaksanaanValue(next.tanggal_pelaksanaan, next.jam) : '', ts, pid)
    );
  }
  return stmts;
}

export async function deleteBeritaAcaraAdmin(db, baId, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT ba_id, file_url, base_file_url FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const berkas = (await db.prepare('SELECT file_url FROM berita_acara_admin_berkas WHERE ba_id = ?1').bind(id).all()).results || [];
  await db.batch([
    db.prepare('DELETE FROM berita_acara_admin_berkas WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara_admin WHERE ba_id = ?1').bind(id)
  ]);

  const fileIds = [];
  for (const url of [existing.file_url, existing.base_file_url].concat(berkas.map((r) => r.file_url))) {
    const fileId = parseDriveFileId(url);
    if (fileId && fileIds.indexOf(fileId) === -1) fileIds.push(fileId);
  }
  for (const fileId of fileIds) await trashDriveFile(ctx.env, fileId);
  await auditBa(db, ctx, 'BA_DELETE', id, { jenis: 'Pendukung' });

  return { success: true, message: 'Berita acara berhasil dihapus.' };
}

export async function updateBeritaAcaraAdmin(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const p = payload || {};
  const input = validateBaUpdateInput(p);
  if (!input.ok) return { success: false, message: input.message };
  const existing = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };

  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan)
  ];
  await db.prepare('UPDATE berita_acara_admin SET tanggal_pelaksanaan = ?1, jam = ?2, catatan = ?3 WHERE ba_id = ?4').bind(...vals, id).run();
  await auditBa(db, ctx, 'BA_UPDATE', id, { jenis: 'Pendukung', tanggal: tanggal, jam: vals[1] });
  return { success: true, message: 'Berita acara pendukung diperbarui.' };
}

export async function deleteBeritaAcaraBagian(db, baId, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT ba_id, file_url FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const ids = Array.from(new Set(peserta.map((r) => str(r.id_pengajuan)).filter(Boolean)));
  const syncs = await buildRestorePengajuanStmts(db, ids, id);

  await db.batch([
    ...syncs,
    db.prepare('DELETE FROM berita_acara_sesi WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara_peserta WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara WHERE ba_id = ?1').bind(id)
  ]);

  const fileId = parseDriveFileId(existing.file_url);
  if (fileId) await trashDriveFile(ctx.env, fileId);
  await auditBa(db, ctx, 'BA_DELETE', id, { jenis: 'Pelaksanaan' });

  return { success: true, message: 'Berita acara berhasil dihapus.' };
}

export async function saveBeritaAcaraBagian(db, payload, kategori, ctx) {
  const p = payload || {};
  await requireBagianSession(db, kategori, p.bagian, ctx.token, ctx.session);
  const input = validateBaCreateInput(p);
  if (!input.ok) return { success: false, message: input.message };
  const bagian = str(p.bagian) || str(kategori);

  const peserta = normalizeBaPeserta(p);
  if (!peserta.length) {
    return { success: false, message: 'Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.' };
  }

  const invalidPeserta = await validateBaPesertaKegiatan(db, peserta, bagian, p.blok, p.namaKegiatan);
  if (invalidPeserta.length) {
    return {
      success: false,
      message: 'Upload dibatalkan: peserta tidak sesuai dengan kegiatan BA — ' + invalidPeserta.join(', ') + '. Muat ulang data terlebih dahulu.'
    };
  }

  const blocked = await validateBaPesertaStatus(db, peserta);
  if (blocked.length) {
    const allowed = await getBagianBaStatuses(db);
    return {
      success: false,
      message: 'Upload dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '. Muat ulang data terlebih dahulu.'
    };
  }

  const baKey = kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan));
  const sesiResult = await resolveBaSesi(db, {
    jadwalIds: normalizeJadwalIds(p),
    kegiatanKey: baKey,
    tanggal: p.tanggalPelaksanaan
  });
  if (!sesiResult.ok) return { success: false, message: sesiResult.message };
  const sesi = sesiResult.sesi;

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
  // Kolom jam & dosen BA tetap terisi (dipakai penanda "selesai" dan export);
  // untuk multi-sesi nilainya diambil dari sesi paling awal.
  if (sesi.length) {
    if (!str(p.jam)) p.jam = str(sesi[0].jam);
    if (!str(p.dosen)) p.dosen = str(sesi[0].dosen);
    p.jadwalId = str(sesi[0].jadwal_id);
  }
  const syncStmts = await buildSesiSyncStmts(db, peserta, sesi, {
    dosen: str(p.dosen), tanggal: str(p.tanggalPelaksanaan), jam: str(p.jam)
  });
  await db.batch([
    ...buildPersistBaStmts(db, 'berita_acara', 'berita_acara_peserta', p, {
      baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
      kegiatanKey: baKey, withDosen: true, withLabel: true, allowMultiple: true, withJadwal: true
    }),
    ...buildBaSesiStmts(db, baId, sesi),
    ...syncStmts
  ]);
  await auditBa(db, ctx, 'BA_CREATE', baId, {
    jenis: 'Pelaksanaan', bagian: bagian, jumlahPeserta: peserta.length,
    jumlahSesi: sesi.length, jadwalIds: sesi.map((jd) => str(jd.jadwal_id))
  });

  return { success: true, baId: baId, jumlahSesi: sesi.length, message: 'Berita acara berhasil diunggah.' };
}

export async function updateBeritaAcaraBagian(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const p = payload || {};
  const input = validateBaUpdateInput(p);
  if (!input.ok) return { success: false, message: input.message };
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };
  const jam = p.jam !== undefined ? str(p.jam) : str(existing.jam);
  const dosen = p.dosen !== undefined ? str(p.dosen) : str(existing.dosen);
  const catatan = p.catatan !== undefined ? str(p.catatan) : str(existing.catatan);
  const label = p.label !== undefined ? str(p.label) : str(existing.label);

  const current = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const currentIds = current.map((r) => str(r.id_pengajuan)).filter(Boolean);

  let sesi = await loadBaSesiRows(db, id);
  let remapSesi = false;
  if (p.jadwalIds !== undefined || p.jadwalId !== undefined) {
    const resolvedSesi = await resolveBaSesi(db, {
      jadwalIds: normalizeJadwalIds(p),
      kegiatanKey: str(existing.kegiatan_key) || kegiatanKey(existing.bagian, existing.blok, existing.nama_kegiatan),
      tanggal: tanggal,
      excludeBaId: id
    });
    if (!resolvedSesi.ok) return { success: false, message: resolvedSesi.message };
    sesi = resolvedSesi.sesi;
    remapSesi = true;
  }

  let pesertaIds = null;
  let pesertaBaru = [];
  if (p.pesertaIds !== undefined) {
    if (!Array.isArray(p.pesertaIds)) return { success: false, message: 'Daftar peserta tidak valid.' };
    pesertaIds = Array.from(new Set(p.pesertaIds.map(str).filter(Boolean)));
    if (!pesertaIds.length) return { success: false, message: 'Pilih minimal satu peserta.' };

    const resolved = await resolveBaPesertaByIds(db, pesertaIds);
    if (resolved.missing.length) {
      return { success: false, message: 'Peserta tidak ditemukan: ' + resolved.missing.join(', ') + '.' };
    }
    pesertaBaru = resolved.peserta;
    const problems = await validateBaPesertaKegiatan(db, pesertaBaru, existing.bagian, existing.blok, existing.nama_kegiatan);
    if (problems.length) {
      return { success: false, message: 'Peserta tidak sesuai dengan kegiatan BA — ' + problems.join(', ') + '.' };
    }
    const blocked = await validateBaPesertaStatus(db, pesertaBaru);
    if (blocked.length) {
      const allowed = await getBagianBaStatuses(db);
      return { success: false, message: 'Peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '.' };
    }
  }

  const stmts = [
    db.prepare('UPDATE berita_acara SET tanggal_pelaksanaan = ?1, jam = ?2, dosen = ?3, catatan = ?4, label = ?5 WHERE ba_id = ?6')
      .bind(tanggal, jam, dosen, catatan, label, id)
  ];

  if (remapSesi) {
    stmts.push(db.prepare('DELETE FROM berita_acara_sesi WHERE ba_id = ?1').bind(id));
    stmts.push(...buildBaSesiStmts(db, id, sesi));
    stmts.push(
      db.prepare('UPDATE berita_acara SET jadwal_id = ?1 WHERE ba_id = ?2')
        .bind(sesi.length ? str(sesi[0].jadwal_id) : '', id)
    );
  }

  if (pesertaIds) {
    const baruSet = new Set(pesertaIds);
    const removed = currentIds.filter((pid) => !baruSet.has(pid));
    const ts = nowIso();
    stmts.push(db.prepare('DELETE FROM berita_acara_peserta WHERE ba_id = ?1').bind(id));
    for (const peserta of pesertaBaru) {
      stmts.push(
        db.prepare(
          'INSERT INTO berita_acara_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ' +
          'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
        ).bind(ts, id, peserta.idPengajuan, peserta.npm, peserta.namaLengkap, peserta.blok, existing.bagian, peserta.statusPengajuan)
      );
    }
    stmts.push(db.prepare('UPDATE berita_acara SET jumlah_peserta = ?1 WHERE ba_id = ?2').bind(pesertaIds.length, id));
    stmts.push(...await buildRestorePengajuanStmts(db, removed, id));
    stmts.push(...await buildSesiSyncStmts(db, pesertaBaru, sesi, { dosen: dosen, tanggal: tanggal, jam: jam }));
  } else {
    stmts.push(...await buildSesiSyncStmts(db, currentIds.map((pid) => ({ idPengajuan: pid })), sesi, { dosen: dosen, tanggal: tanggal, jam: jam }));
  }

  await db.batch(stmts);
  await auditBa(db, ctx, 'BA_UPDATE', id, {
    jenis: 'Pelaksanaan',
    jumlahPeserta: pesertaIds ? pesertaIds.length : currentIds.length,
    jumlahSesi: sesi.length
  });
  return {
    success: true,
    message: 'Berita acara diperbarui.',
    jumlahPeserta: pesertaIds ? pesertaIds.length : currentIds.length
  };
}

export async function lengkapiBeritaAcaraBagian(db, baId, payload, kategori, ctx) {
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);

  const p = payload || {};
  const input = validateBaUpdateInput(p);
  if (!input.ok) return { success: false, message: input.message };
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  const jam = p.jam !== undefined ? str(p.jam) : str(existing.jam);
  const dosen = p.dosen !== undefined ? str(p.dosen) : str(existing.dosen);
  const catatan = p.catatan !== undefined ? str(p.catatan) : str(existing.catatan);
  const label = p.label !== undefined ? str(p.label) : str(existing.label);

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const sesi = await loadBaSesiRows(db, id);
  const syncStmts = await buildSesiSyncStmts(
    db,
    peserta.map((r) => ({ idPengajuan: r.id_pengajuan })),
    sesi,
    { dosen: dosen, tanggal: tanggal, jam: jam }
  );
  await db.batch([
    db.prepare('UPDATE berita_acara SET tanggal_pelaksanaan=?1, jam=?2, dosen=?3, catatan=?4, label=?5 WHERE ba_id=?6')
      .bind(tanggal, jam, dosen, catatan, label, id),
    ...syncStmts
  ]);
  await auditBa(db, ctx, 'BA_UPDATE', id, { jenis: 'Pelaksanaan', lengkapi: true, jumlahSesi: sesi.length });
  return { success: true, message: 'Berita acara dilengkapi.' };
}
