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

  const jadwalId = str(p.jadwalId);
  if (jadwalId) {
    const jd = await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(jadwalId).first();
    if (!jd || Number(jd.active) !== 1) {
      return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan atau sudah dibatalkan.' };
    }
    const key = kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan));
    const jadwalKey = str(jd.kegiatan_key) || kegiatanKey(str(jd.bagian), str(jd.blok), str(jd.nama_kegiatan));
    if (jadwalKey !== key) {
      return { success: false, message: 'Jadwal pelaksanaan tidak sesuai dengan kegiatan berita acara.' };
    }
    const jadwalTanggal = str(jd.tanggal).slice(0, 10);
    const baTanggal = str(p.tanggalPelaksanaan).slice(0, 10);
    if (jadwalTanggal && baTanggal && jadwalTanggal !== baTanggal) {
      return { success: false, message: 'Tanggal BA tidak sesuai dengan tanggal jadwal pelaksanaan.' };
    }
    const dup = await db.prepare('SELECT ba_id FROM berita_acara WHERE jadwal_id = ?1').bind(jadwalId).first();
    if (dup) return { success: false, message: 'Berita acara untuk jadwal ini sudah ada.' };
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
  await db.batch([
    ...buildPersistBaStmts(db, 'berita_acara', 'berita_acara_peserta', p, {
      baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
      kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)), withDosen: true, withLabel: true, allowMultiple: true, withJadwal: true
    }),
    ...buildSyncStmts(db, peserta, str(p.dosen), str(p.tanggalPelaksanaan), str(p.jam))
  ]);
  await auditBa(db, ctx, 'BA_CREATE', baId, { jenis: 'Pelaksanaan', bagian: bagian, jumlahPeserta: peserta.length });

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
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
    stmts.push(...buildSyncStmts(db, pesertaBaru, dosen, tanggal, jam));
  } else {
    stmts.push(...buildSyncStmts(db, currentIds.map((pid) => ({ idPengajuan: pid })), dosen, tanggal, jam));
  }

  await db.batch(stmts);
  await auditBa(db, ctx, 'BA_UPDATE', id, { jenis: 'Pelaksanaan', jumlahPeserta: pesertaIds ? pesertaIds.length : currentIds.length });
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
  await db.batch([
    db.prepare('UPDATE berita_acara SET tanggal_pelaksanaan=?1, jam=?2, dosen=?3, catatan=?4, label=?5 WHERE ba_id=?6')
      .bind(tanggal, jam, dosen, catatan, label, id),
    ...buildSyncStmts(db, peserta.map((r) => ({ idPengajuan: r.id_pengajuan })), dosen, tanggal, jam)
  ]);
  await auditBa(db, ctx, 'BA_UPDATE', id, { jenis: 'Pelaksanaan', lengkapi: true });
  return { success: true, message: 'Berita acara dilengkapi.' };
}
