import { requireAdmin } from '../session.js';
import { kegiatanKey } from '../read/common.js';
import { writeAuditLog } from '../audit.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function rowKey(row) {
  return str(row && row.kegiatan_key) || kegiatanKey(str(row && row.bagian), str(row && row.blok), str(row && row.nama_kegiatan));
}

function actorOf(ctx) {
  return str(ctx && ctx.session && ctx.session.nama) || 'Admin';
}

function revisionMatches(existing, expected) {
  if (expected === undefined || expected === null || expected === '') return true;
  return Number(expected) === (Number(existing && existing.revision) || 0);
}

function validateReason(reason) {
  return str(reason).length >= 10;
}

async function loadBa(db, baId) {
  return await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(str(baId)).first();
}

async function audit(db, ctx, action, target, detail) {
  try {
    await writeAuditLog(db, {
      actor: actorOf(ctx),
      action,
      target,
      detail: JSON.stringify(detail || {}),
      alasan: str(detail && detail.alasan) || action
    });
  } catch {
  }
}

export async function archiveBeritaAcara(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const baId = str(p.baId);
  if (!baId) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await loadBa(db, baId);
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
  if (str(existing.archived_at)) return { success: false, message: 'BA sudah berada di arsip.' };
  if (!validateReason(p.reason)) return { success: false, message: 'Alasan arsip minimal 10 karakter.' };
  if (p.hardcopyAck !== true) return { success: false, message: 'Centang konfirmasi hardcopy sebelum mengarsipkan BA.' };
  if (!revisionMatches(existing, p.expectedRevision)) {
    return { success: false, message: 'Data BA sudah berubah. Muat ulang lalu ulangi.' };
  }

  const ts = nowIso();
  const res = await db.prepare(
    'UPDATE berita_acara SET archived_at = ?1, archived_by = ?2, archive_reason = ?3, merged_into = \'\', ' +
    'updated_at = ?1, revision = revision + 1 WHERE ba_id = ?4 AND revision = ?5'
  ).bind(ts, actorOf(ctx), str(p.reason), baId, Number(existing.revision) || 0).run();
  if (!res.meta || !res.meta.changes) {
    return { success: false, message: 'Data BA sudah berubah. Muat ulang lalu ulangi.' };
  }

  await audit(db, ctx, 'BA_ARCHIVE', baId, {
    alasan: str(p.reason),
    revision: (Number(existing.revision) || 0) + 1,
    hardcopyAck: true
  });
  return {
    success: true,
    message: 'BA ' + baId + ' diarsipkan. Hardcopy tetap tersimpan.',
    revision: (Number(existing.revision) || 0) + 1
  };
}

export async function mergeBeritaAcara(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const sourceId = str(p.sourceBaId);
  const targetId = str(p.targetBaId);
  if (!sourceId || !targetId) return { success: false, message: 'BA sumber dan BA tujuan wajib dipilih.' };
  if (sourceId === targetId) return { success: false, message: 'BA sumber dan BA tujuan tidak boleh sama.' };
  const source = await loadBa(db, sourceId);
  const target = await loadBa(db, targetId);
  if (!source) return { success: false, message: 'BA sumber tidak ditemukan.' };
  if (!target) return { success: false, message: 'BA tujuan tidak ditemukan.' };
  if (str(source.archived_at)) return { success: false, message: 'BA sumber sudah berada di arsip.' };
  if (str(target.archived_at)) return { success: false, message: 'BA tujuan berada di arsip dan tidak bisa menerima peserta.' };
  if (rowKey(source) !== rowKey(target)) {
    return { success: false, message: 'Penggabungan hanya boleh untuk BA dengan kegiatan yang sama.' };
  }
  if (!validateReason(p.reason)) return { success: false, message: 'Alasan penggabungan minimal 10 karakter.' };
  if (p.hardcopyAck !== true) return { success: false, message: 'Centang konfirmasi hardcopy sebelum menggabungkan BA.' };
  if (!revisionMatches(source, p.expectedSourceRevision)) {
    return { success: false, message: 'Data BA sumber sudah berubah. Muat ulang lalu ulangi.' };
  }
  if (!revisionMatches(target, p.expectedTargetRevision)) {
    return { success: false, message: 'Data BA tujuan sudah berubah. Muat ulang lalu ulangi.' };
  }

  const sourcePeserta = (await db.prepare(
    'SELECT * FROM berita_acara_peserta WHERE ba_id = ?1 ORDER BY id'
  ).bind(sourceId).all()).results || [];
  const targetPeserta = (await db.prepare(
    'SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1'
  ).bind(targetId).all()).results || [];
  const targetIds = new Set(targetPeserta.map((r) => str(r.id_pengajuan)).filter(Boolean));
  const ts = nowIso();
  const stmts = [];
  let moved = 0;
  for (const row of sourcePeserta) {
    const pid = str(row.id_pengajuan);
    if (!pid || targetIds.has(pid)) continue;
    targetIds.add(pid);
    moved += 1;
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
      ).bind(ts, targetId, pid, str(row.npm), str(row.nama_lengkap), str(row.blok), str(target.bagian), str(row.status_pengajuan))
    );
  }

  if (moved) {
    stmts.push(
      db.prepare(
        'UPDATE berita_acara SET jumlah_peserta = (SELECT COUNT(*) FROM berita_acara_peserta WHERE ba_id = ?1), ' +
        'updated_at = ?2, revision = revision + 1 WHERE ba_id = ?1 AND revision = ?3'
      ).bind(targetId, ts, Number(target.revision) || 0)
    );
  }
  stmts.push(
    db.prepare(
      'UPDATE berita_acara SET archived_at = ?1, archived_by = ?2, archive_reason = ?3, merged_into = ?4, ' +
      'updated_at = ?1, revision = revision + 1 WHERE ba_id = ?5 AND revision = ?6'
    ).bind(ts, actorOf(ctx), str(p.reason), targetId, sourceId, Number(source.revision) || 0)
  );

  await db.batch(stmts);
  await audit(db, ctx, 'BA_MERGE', sourceId, {
    alasan: str(p.reason),
    targetBaId: targetId,
    moved,
    skipped: sourcePeserta.length - moved,
    hardcopyAck: true
  });
  return {
    success: true,
    message: 'BA ' + sourceId + ' digabungkan ke ' + targetId + ': ' + moved + ' peserta dipindahkan, ' + (sourcePeserta.length - moved) + ' sudah ada.',
    moved,
    skipped: sourcePeserta.length - moved,
    targetBaId: targetId
  };
}

export async function restoreBeritaAcara(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const baId = str(p.baId);
  if (!baId) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await loadBa(db, baId);
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
  if (!str(existing.archived_at)) return { success: true, message: 'BA tidak berada di arsip.', revision: Number(existing.revision) || 0 };
  if (!revisionMatches(existing, p.expectedRevision)) {
    return { success: false, message: 'Data BA sudah berubah. Muat ulang lalu ulangi.' };
  }

  const key = rowKey(existing);
  const activeHeaders = (await db.prepare(
    'SELECT ba_id, kegiatan_key, bagian, blok, nama_kegiatan, jadwal_id FROM berita_acara ' +
    "WHERE COALESCE(archived_at, '') = ''"
  ).all()).results || [];
  const activeKeyById = {};
  for (const row of activeHeaders) activeKeyById[str(row.ba_id)] = rowKey(row);

  const sourcePeserta = (await db.prepare(
    'SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1'
  ).bind(baId).all()).results || [];
  const sourceIds = new Set(sourcePeserta.map((r) => str(r.id_pengajuan)).filter(Boolean));
  const conflicts = [];
  if (sourceIds.size) {
    const allPeserta = (await db.prepare('SELECT ba_id, id_pengajuan FROM berita_acara_peserta').all()).results || [];
    const bentrok = new Set();
    for (const row of allPeserta) {
      const otherBa = str(row.ba_id);
      const pid = str(row.id_pengajuan);
      if (!pid || !sourceIds.has(pid) || otherBa === baId) continue;
      if (activeKeyById[otherBa] === key) bentrok.add(pid);
    }
    for (const pid of bentrok) conflicts.push('peserta ' + pid);
  }

  const sourceSesi = (await db.prepare(
    'SELECT jadwal_id FROM berita_acara_sesi WHERE ba_id = ?1'
  ).bind(baId).all()).results || [];
  const sourceJadwal = new Set(sourceSesi.map((r) => str(r.jadwal_id)).filter(Boolean));
  const legacyJadwal = str(existing.jadwal_id);
  if (legacyJadwal) sourceJadwal.add(legacyJadwal);
  if (sourceJadwal.size) {
    const activeSesi = (await db.prepare(
      'SELECT s.ba_id, s.jadwal_id FROM berita_acara_sesi s ' +
      'JOIN berita_acara a ON a.ba_id = s.ba_id ' +
      "WHERE COALESCE(a.archived_at, '') = '' AND s.ba_id <> ?1"
    ).bind(baId).all()).results || [];
    const bentrok = new Set();
    for (const row of activeSesi) {
      const jid = str(row.jadwal_id);
      if (jid && sourceJadwal.has(jid)) bentrok.add(jid);
    }
    for (const row of activeHeaders) {
      const jid = str(row.jadwal_id);
      if (jid && sourceJadwal.has(jid) && str(row.ba_id) !== baId) bentrok.add(jid);
    }
    for (const jid of bentrok) conflicts.push('sesi ' + jid);
  }

  if (conflicts.length) {
    return {
      success: false,
      message: 'BA tidak bisa dipulihkan karena bentrok: ' + conflicts.slice(0, 5).join(', ') +
        (conflicts.length > 5 ? ', dan lainnya' : '') + '. Lepaskan dulu dari BA aktif.'
    };
  }

  const ts = nowIso();
  const res = await db.prepare(
    'UPDATE berita_acara SET archived_at = \'\', archived_by = \'\', archive_reason = \'\', merged_into = \'\', ' +
    'updated_at = ?1, revision = revision + 1 WHERE ba_id = ?2 AND revision = ?3'
  ).bind(ts, baId, Number(existing.revision) || 0).run();
  if (!res.meta || !res.meta.changes) {
    return { success: false, message: 'Data BA sudah berubah. Muat ulang lalu ulangi.' };
  }

  await audit(db, ctx, 'BA_RESTORE', baId, {
    revision: (Number(existing.revision) || 0) + 1,
    mergedInto: str(existing.merged_into)
  });
  return {
    success: true,
    message: 'BA ' + baId + ' dipulihkan. Periksa kembali tautan sesi jadwalnya.',
    revision: (Number(existing.revision) || 0) + 1
  };
}
