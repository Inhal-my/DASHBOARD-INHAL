import { requireAdmin } from '../session.js';
import { kegiatanKey } from '../read/common.js';
import { writeAuditLog } from '../audit.js';
import { validateBaPesertaKegiatan, validateBaPesertaStatus } from './beritaAcara.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function pelaksanaanValue(tanggal, jam) {
  const tgl = str(tanggal);
  const j = str(jam);
  return tgl && j ? (tgl + 'T' + j) : tgl;
}

function uniq(list) {
  const out = [];
  for (const v of list || []) {
    const s = str(v);
    if (s && out.indexOf(s) === -1) out.push(s);
  }
  return out;
}

export async function applyBaRepair(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const baId = str(p.baId);
  if (!baId) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(baId).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
  if (str(existing.archived_at)) return { success: false, message: 'BA ini berada di arsip. Pulihkan dulu sebelum diperbaiki.' };
  if (p.expectedRevision !== undefined && p.expectedRevision !== null && p.expectedRevision !== ''
    && Number(p.expectedRevision) !== (Number(existing.revision) || 0)) {
    return { success: false, message: 'Data BA sudah berubah. Muat ulang lalu ulangi.' };
  }

  const key = str(existing.kegiatan_key) || kegiatanKey(existing.bagian, existing.blok, existing.nama_kegiatan);
  const addIds = uniq(Array.isArray(p.addPesertaIds) ? p.addPesertaIds : []);
  const removeIds = uniq(Array.isArray(p.removePesertaIds) ? p.removePesertaIds : []);
  if (addIds.some((id) => removeIds.indexOf(id) !== -1)) {
    return { success: false, message: 'Peserta tidak boleh ditambahkan dan dikeluarkan pada waktu yang sama.' };
  }
  const requestedJadwalIds = uniq(Array.isArray(p.jadwalIds) ? p.jadwalIds : []);
  const move = p.moveFromJadwal !== false;

  const jadwalRows = (await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE active = 1').all()).results || [];
  const jadwalById = {};
  for (const j of jadwalRows) {
    const jKey = str(j.kegiatan_key) || kegiatanKey(j.bagian, j.blok, j.nama_kegiatan);
    if (jKey !== key) continue;
    jadwalById[str(j.jadwal_id)] = {
      jadwalId: str(j.jadwal_id),
      tanggal: str(j.tanggal),
      jam: str(j.jam),
      dosen: str(j.dosen)
    };
  }

  let targetJadwalId = str(p.targetJadwalId);
  if (!targetJadwalId && requestedJadwalIds.length === 1) targetJadwalId = requestedJadwalIds[0];
  if (targetJadwalId && !jadwalById[targetJadwalId]) {
    return { success: false, message: 'Jadwal tujuan tidak ditemukan atau bukan bagian dari kegiatan BA.' };
  }

  const linkJadwalIds = requestedJadwalIds.slice();
  if (targetJadwalId && linkJadwalIds.indexOf(targetJadwalId) === -1) linkJadwalIds.push(targetJadwalId);
  for (const id of linkJadwalIds) {
    if (!jadwalById[id]) return { success: false, message: 'Jadwal ' + id + ' tidak ditemukan atau bukan bagian dari kegiatan BA.' };
  }

  const allSesi = (await db.prepare('SELECT ba_id, jadwal_id FROM berita_acara_sesi').all()).results || [];
  const baLinkRows = (await db.prepare(
    'SELECT ba_id, jadwal_id, kegiatan_key, bagian, blok, nama_kegiatan FROM berita_acara ' +
    "WHERE COALESCE(archived_at, '') = ''"
  ).all()).results || [];
  const activeBaIds = {};
  for (const r of baLinkRows) activeBaIds[str(r.ba_id)] = true;
  const linkByJadwal = {};
  for (const r of allSesi) {
    const jid = str(r.jadwal_id);
    const bid = str(r.ba_id);
    if (jid && bid && activeBaIds[bid]) linkByJadwal[jid] = bid;
  }
  for (const r of baLinkRows) {
    const jid = str(r.jadwal_id);
    const bid = str(r.ba_id);
    if (jid && bid && !linkByJadwal[jid]) linkByJadwal[jid] = bid;
  }
  for (const id of linkJadwalIds) {
    const linked = linkByJadwal[id];
    if (linked && linked !== baId) return { success: false, message: 'Jadwal ' + id + ' sudah ditautkan ke BA ' + linked + '.' };
  }

  const pengajuanRows = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const pMap = {};
  for (const r of pengajuanRows) pMap[str(r.id_pengajuan)] = r;
  const missing = addIds.filter((id) => !pMap[id]);
  if (missing.length) return { success: false, message: 'Peserta tidak ditemukan: ' + missing.join(', ') + '.' };

  const addRows = addIds.map((id) => {
    const r = pMap[id];
    return {
      idPengajuan: id,
      npm: str(r.npm),
      namaLengkap: str(r.nama_lengkap),
      blok: str(r.blok),
      statusPengajuan: str(r.status)
    };
  });

  if (addRows.length) {
    const blocked = await validateBaPesertaStatus(db, addRows);
    if (blocked.length) return { success: false, message: 'Peserta belum memenuhi status BA — ' + blocked.join(', ') + '.' };
    const problems = await validateBaPesertaKegiatan(db, addRows, existing.bagian, existing.blok, existing.nama_kegiatan);
    if (problems.length) return { success: false, message: 'Peserta tidak sesuai dengan kegiatan BA — ' + problems.join(', ') + '.' };

    const inOtherBa = (await db.prepare(
      'SELECT p.id_pengajuan, p.ba_id FROM berita_acara_peserta p JOIN berita_acara a ON a.ba_id = p.ba_id ' +
      "WHERE p.ba_id <> ?1 AND COALESCE(a.archived_at, '') = ''"
    ).bind(baId).all()).results || [];
    const baKeyById = {};
    for (const r of baLinkRows) {
      baKeyById[str(r.ba_id)] = str(r.kegiatan_key) || kegiatanKey(r.bagian, r.blok, r.nama_kegiatan);
    }
    const otherMap = {};
    for (const r of inOtherBa) {
      const pid = str(r.id_pengajuan);
      const bid = str(r.ba_id);
      if (pid && bid && baKeyById[bid] === key) otherMap[pid] = bid;
    }
    for (const id of addIds) {
      if (otherMap[id]) return { success: false, message: 'Peserta ' + id + ' sudah tercatat di BA ' + otherMap[id] + '. Lepaskan dulu dari BA tersebut.' };
    }
  }

  const jadwalPesertaRows = (await db.prepare('SELECT jadwal_id, id_pengajuan FROM jadwal_peserta').all()).results || [];
  const sourceByPid = {};
  for (const r of jadwalPesertaRows) {
    const jid = str(r.jadwal_id);
    const pid = str(r.id_pengajuan);
    if (!jid || !pid || !jadwalById[jid]) continue;
    if (!sourceByPid[pid]) sourceByPid[pid] = [];
    if (sourceByPid[pid].indexOf(jid) === -1) sourceByPid[pid].push(jid);
  }

  if (move && addRows.length && !targetJadwalId) {
    const hasSource = addIds.some((id) => (sourceByPid[id] || []).length > 0);
    if (hasSource) return { success: false, message: 'Pilih jadwal tujuan agar peserta bisa dipindahkan dari jadwal asal.' };
  }

  const ts = nowIso();
  const stmts = [];
  const linkedSet = {};
  for (const r of allSesi) {
    if (str(r.ba_id) === baId) linkedSet[str(r.jadwal_id)] = true;
  }
  let newLinks = 0;
  for (const id of linkJadwalIds) {
    if (linkedSet[id]) continue;
    newLinks += 1;
    stmts.push(
      db.prepare('INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES (?1, ?2, ?3, ?4)')
        .bind(ts, baId, id, linkJadwalIds.indexOf(id) + 1)
    );
  }
  if (linkJadwalIds.length) {
    stmts.push(
      db.prepare("UPDATE berita_acara SET jadwal_id = CASE WHEN COALESCE(jadwal_id, '') = '' THEN ?1 ELSE jadwal_id END WHERE ba_id = ?2")
        .bind(linkJadwalIds[0], baId)
    );
  }

  const baPesertaRows = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(baId).all()).results || [];
  const inBa = {};
  for (const r of baPesertaRows) {
    const pid = str(r.id_pengajuan);
    if (pid) inBa[pid] = true;
  }
  const missingRemove = removeIds.filter((id) => !inBa[id]);
  if (missingRemove.length) {
    return { success: false, message: 'Peserta tidak ada di BA ini: ' + missingRemove.join(', ') + '.' };
  }

  const target = targetJadwalId ? jadwalById[targetJadwalId] : null;
  const dosen = target ? target.dosen : str(existing.dosen);
  const tanggal = target ? target.tanggal : str(existing.tanggal_pelaksanaan);
  const jam = target ? target.jam : str(existing.jam);
  const pelaksanaan = pelaksanaanValue(tanggal, jam);

  const moved = [];
  const removed = [];
  let addedCount = 0;
  for (const row of addRows) {
    const pid = row.idPengajuan;
    if (!inBa[pid]) {
      addedCount += 1;
      stmts.push(
        db.prepare(
          'INSERT INTO berita_acara_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ' +
          'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
        ).bind(ts, baId, pid, row.npm, row.namaLengkap, row.blok, existing.bagian, row.statusPengajuan)
      );
    }
    if (move && target) {
      for (const src of sourceByPid[pid] || []) {
        if (src === targetJadwalId) continue;
        stmts.push(db.prepare('DELETE FROM jadwal_peserta WHERE jadwal_id = ?1 AND id_pengajuan = ?2').bind(src, pid));
        moved.push(pid);
      }
      stmts.push(
        db.prepare(
          'INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) ' +
          'SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE NOT EXISTS (SELECT 1 FROM jadwal_peserta WHERE jadwal_id = ?2 AND id_pengajuan = ?3)'
        ).bind(ts, targetJadwalId, pid, row.npm, row.namaLengkap, row.blok, row.statusPengajuan)
      );
    }
    stmts.push(
      db.prepare('UPDATE pengajuan SET dosen = ?1, tanggal_pelaksanaan = ?2, updated_at = ?3 WHERE id_pengajuan = ?4')
        .bind(dosen, pelaksanaan, ts, pid)
    );
  }

  for (const id of removeIds) {
    stmts.push(db.prepare('DELETE FROM berita_acara_peserta WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(baId, id));
    removed.push(id);
  }

  if (addedCount || removed.length) {
    stmts.push(
      db.prepare('UPDATE berita_acara SET jumlah_peserta = (SELECT COUNT(*) FROM berita_acara_peserta WHERE ba_id = ?1) WHERE ba_id = ?1')
        .bind(baId)
    );
  }

  if (!stmts.length) return { success: true, message: 'Tidak ada perubahan.', added: 0, moved: 0, linked: 0, removed: 0 };

  stmts.push(
    db.prepare('UPDATE berita_acara SET revision = revision + 1, updated_at = ?1 WHERE ba_id = ?2')
      .bind(ts, baId)
  );

  await db.batch(stmts);
  try {
    await writeAuditLog(db, {
      actor: str(ctx && ctx.session && ctx.session.nama) || 'Admin',
      action: 'BA_REPAIR',
      target: baId,
      detail: JSON.stringify({
        added: addedCount,
        removed: removed.length,
        moved: uniq(moved).length,
        linked: newLinks,
        targetJadwalId: targetJadwalId,
        pesertaIds: addIds,
        removePesertaIds: removeIds
      }),
      alasan: 'Perbaikan peserta dan sesi BA'
    });
  } catch {
  }

  return {
    success: true,
    message: 'BA diperbarui: ' + addedCount + ' peserta ditambahkan, ' + removed.length + ' dikeluarkan, ' +
      uniq(moved).length + ' dipindahkan, ' + newLinks + ' sesi ditautkan.',
    added: addedCount,
    removed: removed.length,
    moved: uniq(moved).length,
    linked: newLinks
  };
}
