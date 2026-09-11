import { requireAdmin } from '../session.js';
import { resolveBagianFor } from '../read/common.js';
import { processStatusNotification } from './email.js';
import { writeAuditLog } from '../audit.js';

const STATUS_VALID = ['Menunggu', 'Diterima', 'ACC', 'Ditolak', 'Dibatalkan'];

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function actorName(ctx) {
  return str(ctx && ctx.session && ctx.session.nama) || 'Admin';
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function getRomanMonth(month) {
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[month] || String(month);
}

async function nextSuratNumberYearly(db, type) {
  const t = str(type) || 'INHAL';
  const year = new Date().getFullYear();
  const romanMonth = getRomanMonth(new Date().getMonth() + 1);
  const ts = nowIso();
  const existing = await db.prepare('SELECT id, last_number FROM nomor_surat WHERE type = ?1 AND CAST(tahun AS TEXT) = ?2').bind(t, String(year)).first();
  let nextNum = 1;
  if (existing) {
    nextNum = (parseInt(existing.last_number, 10) || 0) + 1;
    await db.prepare('UPDATE nomor_surat SET last_number = ?1, updated_at = ?2 WHERE id = ?3').bind(nextNum, ts, existing.id).run();
  } else {
    await db.prepare('INSERT INTO nomor_surat (type, tahun, last_number, updated_at) VALUES (?1, ?2, ?3, ?4)').bind(t, year, nextNum, ts).run();
  }
  const seq = String(nextNum).padStart(3, '0');
  return seq + '/' + t + '/FKIK-UMSU/' + romanMonth + '/' + year;
}

async function findOverrideBiayaRows(db, idPengajuan) {
  const { results } = await db.prepare(
    "SELECT * FROM check_data WHERE id_pengajuan = ?1 AND detail = 'BIAYA-OVERRIDE' AND (pilihan IS NULL OR pilihan = '') AND (tanggal_pelaksanaan IS NULL OR tanggal_pelaksanaan = '')"
  ).bind(idPengajuan).all();
  return results || [];
}

async function upsertBiayaCheckData(db, idPengajuan, biaya, pengajuan) {
  const id = str(idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };
  const matches = await findOverrideBiayaRows(db, id);
  const nilai = str(biaya);

  if (!nilai) {
    if (matches.length) {
      await db.batch(matches.map((m) => db.prepare('DELETE FROM check_data WHERE id = ?1').bind(m.id)));
    }
    return { success: true, cleared: matches.length > 0, message: 'Biaya kembali ke default MasterBiaya.' };
  }

  const p = pengajuan || {};
  const found = matches[0] || null;
  const ts = nowIso();
  if (found) {
    await db.prepare(
      'UPDATE check_data SET npm = ?1, nama_lengkap = ?2, blok = ?3, jenis_kegiatan = ?4, dosen = ?5, biaya = ?6, updated_at = ?7 WHERE id = ?8'
    ).bind(str(p.npm), str(p.nama_lengkap), str(p.blok), str(p.jenis_kegiatan), str(p.dosen), nilai, ts, found.id).run();
  } else {
    await db.prepare(
      'INSERT INTO check_data (timestamp, check_id, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, dosen, hadir, catatan, updated_at, biaya) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, \'\', \'BIAYA-OVERRIDE\', \'\', ?8, \'\', \'\', ?9, ?10)'
    ).bind(ts, 'CHK-' + crypto.randomUUID(), id, str(p.npm), str(p.nama_lengkap), str(p.blok), str(p.jenis_kegiatan), str(p.dosen), ts, nilai).run();
  }

  if (matches.length > 1) {
    await db.batch(matches.slice(1).map((m) => db.prepare('DELETE FROM check_data WHERE id = ?1').bind(m.id)));
  }
  return { success: true, created: !found, message: 'Biaya pengajuan disimpan.' };
}

async function findDetailRowId(db, idPengajuan, index) {
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0) return null;
  const { results } = await db.prepare('SELECT id FROM detail_kegiatan WHERE id_pengajuan = ?1 ORDER BY id').bind(str(idPengajuan)).all();
  const rows = results || [];
  if (idx >= rows.length) return null;
  return rows[idx].id;
}

export async function updatePengajuanFields(db, idPengajuan, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const p = payload || {};
  const cols = [];
  const vals = [];
  const clientValues = {};
  const setField = (col, header, raw) => {
    const value = raw === undefined || raw === null ? '' : str(raw);
    cols.push(col);
    vals.push(value);
    clientValues[header] = value;
  };
  if (p.email !== undefined) setField('email', 'Email', p.email);
  if (p.noHp !== undefined) setField('no_hp_wa', 'No. HP/WA', p.noHp);
  if (p.namaLengkap !== undefined) setField('nama_lengkap', 'Nama Lengkap', p.namaLengkap);
  if (p.blok !== undefined) setField('blok', 'Blok', p.blok);
  if (p.dosen !== undefined) setField('dosen', 'Dosen', p.dosen);
  if (p.tanggalPelaksanaan !== undefined) setField('tanggal_pelaksanaan', 'Tanggal Pelaksanaan', p.tanggalPelaksanaan);
  if (p.finalUrl !== undefined) setField('link_final', 'Link Final', p.finalUrl);
  if (p.catatan !== undefined) setField('catatan_admin', 'Catatan Admin', p.catatan);
  if (p.keterangan !== undefined) setField('keterangan', 'Keterangan', p.keterangan);
  if (p.jenisKegiatan !== undefined) setField('jenis_kegiatan', 'Jenis Kegiatan', p.jenisKegiatan);

  if (clientValues.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientValues.Email)) {
    return { success: false, message: 'Format email tidak valid.' };
  }

  const ts = nowIso();
  if (cols.length) {
    const assignments = cols.map((c, i) => c + ' = ?' + (i + 1)).join(', ');
    vals.push(ts);
    await db.prepare('UPDATE pengajuan SET ' + assignments + ', updated_at = ?' + vals.length + ' WHERE id_pengajuan = ?' + (vals.length + 1))
      .bind(...vals, id).run();
    await writeAuditLog(db, {
      actor: actorName(ctx),
      action: 'UPDATE',
      target: 'Pengajuan',
      detail: JSON.stringify(Object.assign({ idPengajuan: id }, clientValues)),
      alasan: 'Pemeliharaan data admin'
    });
  }

  let biayaMessage = '';
  if (p.biaya !== undefined) {
    const biayaResult = await upsertBiayaCheckData(db, id, p.biaya, existing);
    if (biayaResult.success === false) return { success: false, message: biayaResult.message };
    biayaMessage = biayaResult.message || '';
    await writeAuditLog(db, {
      actor: actorName(ctx),
      action: biayaResult.cleared ? 'DELETE' : 'UPDATE',
      target: 'CheckData',
      detail: JSON.stringify({ idPengajuan: id, biaya: str(p.biaya), cleared: !!biayaResult.cleared }),
      alasan: 'Pemeliharaan biaya pengajuan'
    });
  }

  return { success: true, message: 'Data pengajuan diperbarui.', values: clientValues, biayaMessage: biayaMessage };
}

export async function updateDetailKegiatan(db, idPengajuan, index, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(idPengajuan);
  const rowId = await findDetailRowId(db, id, index);
  if (rowId === null) return { success: false, message: 'Detail kegiatan tidak ditemukan.' };

  const p = payload || {};
  const cols = [];
  const vals = [];
  const add = (col, raw) => {
    cols.push(col);
    vals.push(raw === undefined || raw === null ? '' : str(raw));
  };
  if (p.jenisKegiatan !== undefined) add('jenis_kegiatan', p.jenisKegiatan);
  if (p.pilihan !== undefined) add('pilihan', p.pilihan);
  if (p.detail !== undefined) add('detail', p.detail);
  if (p.tanggalPelaksanaan !== undefined) add('tanggal_pelaksanaan', p.tanggalPelaksanaan);
  if (p.bagian !== undefined) add('bagian', p.bagian);

  if (p.jenisKegiatan !== undefined && str(p.jenisKegiatan) === 'Praktikum') {
    const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
    const bagian = resolveBagianFor(results || [], 'Praktikum', str(p.pilihan), str(p.detail));
    if (!cols.includes('bagian')) { cols.push('bagian'); vals.push(bagian); }
  }

  if (cols.length) {
    const assignments = cols.map((c, i) => c + ' = ?' + (i + 1)).join(', ');
    await db.prepare('UPDATE detail_kegiatan SET ' + assignments + ' WHERE id = ?' + (vals.length + 1)).bind(...vals, rowId).run();
    const logged = {};
    cols.forEach((c, i) => { logged[c] = vals[i]; });
    await writeAuditLog(db, {
      actor: actorName(ctx),
      action: 'UPDATE',
      target: 'DetailKegiatan',
      detail: JSON.stringify(Object.assign({ idPengajuan: id, index: index }, logged)),
      alasan: 'Pemeliharaan data admin'
    });
  }
  return { success: true, message: 'Detail kegiatan diperbarui.' };
}

export async function deleteDetailKegiatan(db, idPengajuan, index, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(idPengajuan);
  const rowId = await findDetailRowId(db, id, index);
  if (rowId === null) return { success: false, message: 'Detail kegiatan tidak ditemukan.' };
  const row = await db.prepare('SELECT * FROM detail_kegiatan WHERE id = ?1').bind(rowId).first();
  await db.prepare('DELETE FROM detail_kegiatan WHERE id = ?1').bind(rowId).run();
  await writeAuditLog(db, {
    actor: actorName(ctx),
    action: 'DELETE',
    target: 'DetailKegiatan',
    detail: JSON.stringify(Object.assign({ idPengajuan: id, index: index }, row || {})),
    alasan: 'Pemeliharaan data admin'
  });
  return { success: true, message: 'Detail kegiatan dihapus.' };
}

export async function updatePengajuanStatus(db, idPengajuan, newStatus, catatan, actorEmail, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(idPengajuan);
  const status = str(newStatus);
  if (STATUS_VALID.indexOf(status) === -1) {
    return { success: false, message: 'Status tidak valid: ' + status };
  }
  if (!id) return { success: false, message: 'ID Pengajuan wajib diisi.' };

  const existing = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const ts = nowIso();
  const catatanVal = str(catatan);
  let nomorSurat = str(existing.nomor_surat);
  const sets = ['status = ?1', 'updated_at = ?2'];
  const vals = [status, ts];
  if (catatanVal !== '') { sets.push('catatan_admin = ?' + (vals.length + 1)); vals.push(catatanVal); }
  if (status === 'Diterima' && !nomorSurat) {
    nomorSurat = await nextSuratNumberYearly(db, 'INHAL');
    sets.push('nomor_surat = ?' + (vals.length + 1));
    vals.push(nomorSurat);
  }
  await db.prepare('UPDATE pengajuan SET ' + sets.join(', ') + ' WHERE id_pengajuan = ?' + (vals.length + 1)).bind(...vals, id).run();

  const actor = str(actorEmail) || str(ctx.session && ctx.session.nama) || 'Admin';
  await db.prepare(
    'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(ts, id, status, catatanVal, actor).run();

  let notification = null;
  if (status === 'Diterima' || status === 'Ditolak') {
    try {
      notification = await processStatusNotification(db, id, status, ctx.env);
    } catch (e) {
      notification = { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  }

  const baseMessage = 'Status diperbarui menjadi ' + status + '.';
  if (notification) {
    return {
      success: true,
      idPengajuan: id,
      nomorSurat: nomorSurat,
      notification: notification,
      message: baseMessage + (notification.ok ? ' Email notifikasi terkirim.' : ' Email notifikasi gagal: ' + notification.error)
    };
  }
  return { success: true, idPengajuan: id, nomorSurat: nomorSurat, message: baseMessage };
}

export async function deletePengajuanAdmin(db, idPengajuan, alasan, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan wajib diisi.' };
  const existing = await db.prepare('SELECT id FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const tables = ['detail_kegiatan', 'status_history', 'check_data', 'log_upload'];
  let deleted = 0;
  for (const table of tables) {
    const c = await db.prepare('SELECT COUNT(*) AS n FROM ' + table + ' WHERE id_pengajuan = ?1').bind(id).first();
    deleted += Number(c && c.n) || 0;
  }
  await db.batch([
    ...tables.map((t) => db.prepare('DELETE FROM ' + t + ' WHERE id_pengajuan = ?1').bind(id)),
    db.prepare('DELETE FROM pengajuan WHERE id_pengajuan = ?1').bind(id)
  ]);
  await writeAuditLog(db, {
    actor: actorName(ctx),
    action: 'DELETE',
    target: 'Pengajuan',
    detail: JSON.stringify({ idPengajuan: id, deleted: deleted }),
    alasan: str(alasan)
  });
  return { success: true, message: 'Pengajuan beserta data terkait berhasil dihapus (' + deleted + ' baris terkait).', deleted: deleted };
}

export async function syncLogDataToPengajuan(db, ctx) {
  await requireAdmin(db, ctx.token);
  const report = { total: 0, created: 0, skipped: 0, errors: [] };
  const { results } = await db.prepare('SELECT * FROM log_data ORDER BY id').all();
  const rows = results || [];
  if (!rows.length) {
    return { success: true, report: report, message: 'Tidak ada data LogData untuk disinkronkan.' };
  }

  const { results: existingRows } = await db.prepare('SELECT id_pengajuan FROM pengajuan').all();
  const existingIds = new Set((existingRows || []).map((r) => str(r.id_pengajuan)));

  for (const row of rows) {
    report.total++;
    let rec = null;
    try { rec = row.payload ? JSON.parse(row.payload) : null; } catch (e) { rec = null; }
    if (!rec || typeof rec !== 'object') { report.skipped++; continue; }

    const get = (name) => str(rec[name]);
    const idLama = get('ID Pengajuan');
    const npm = get('NPM');
    if (!idLama || !npm || existingIds.has(idLama)) { report.skipped++; continue; }

    try {
      const ts = str(row.timestamp) || nowIso();
      const jenis = get('Jenis Kegiatan');
      const status = get('Status') || 'Menunggu';
      await db.prepare(
        'INSERT INTO pengajuan (timestamp, id_pengajuan, npm, nama_lengkap, email, no_hp_wa, blok, jenis_kegiatan, keterangan, link_surat_keterangan, status, catatan_admin, notifikasi_terkirim_pada, nomor_surat, lampiran_email, updated_at) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)'
      ).bind(
        ts, idLama, npm, get('Nama Lengkap'), get('Email') || get('Email Address'), get('No. HP/WA'), get('Blok'),
        jenis, get('Keterangan'), get('Link Surat Keterangan'), status, get('Catatan Admin'),
        get('Notifikasi Terkirim Pada'), get('Nomor Surat'), get('Lampiran Email'), ts
      ).run();

      const detailRows = [];
      const addDetail = (pilihan, det, tgl) => {
        detailRows.push({ pilihan: str(pilihan), detail: str(det), tanggal: str(tgl) });
      };
      const jenisNorm = jenis.toLowerCase().trim();
      if (jenisNorm === 'ujian') addDetail(get('Pilihan Ujian'), '', get('Tanggal Ujian'));
      else if (jenisNorm === 'sgd') addDetail(get('Pilihan SGD'), get('Detail SGD'), get('Tanggal SGD'));
      else if (jenisNorm === 'kkd') addDetail(get('Pilihan KKD'), get('Detail KKD'), get('Tanggal KKD'));
      else if (jenisNorm === 'praktikum') {
        for (let n = 1; n <= 9; n++) {
          const pil = get('Pilihan LAB ' + n);
          const keg = get('Kegiatan LAB ' + n);
          const tgl = get('Tanggal Praktikum ' + n);
          if (pil || keg) addDetail(pil, keg, tgl);
        }
      }
      if (!detailRows.length) addDetail(jenis, '', '');

      const stmts = detailRows.map((d) =>
        db.prepare('INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
          .bind(ts, idLama, jenis, d.pilihan, d.detail, d.tanggal, '')
      );
      stmts.push(
        db.prepare('INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)')
          .bind(ts, idLama, status, 'Disinkronkan dari LogData lama.', str(ctx.session && ctx.session.nama) || 'Admin')
      );
      await db.batch(stmts);
      existingIds.add(idLama);
      report.created++;
    } catch (e) {
      report.errors.push((e && e.message) ? e.message : String(e));
    }
  }

  return {
    success: true,
    report: report,
    message: 'Sinkronisasi selesai. Dibuat: ' + report.created + ', dilewati: ' + report.skipped + ', error: ' + report.errors.length + '.'
  };
}

export async function updateCheckDataPartial(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const p = payload || {};
  const id = str(p.idPengajuan || p['ID Pengajuan']);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

  const pilihan = str(p.pilihan);
  const detail = str(p.detail);
  const tanggal = str(p.tanggalPelaksanaan);
  const ts = nowIso();
  const found = await db.prepare(
    'SELECT id FROM check_data WHERE id_pengajuan = ?1 AND pilihan = ?2 AND detail = ?3 AND tanggal_pelaksanaan = ?4 ORDER BY id LIMIT 1'
  ).bind(id, pilihan, detail, tanggal).first();

  const npm = str(p.npm);
  const namaLengkap = str(p.namaLengkap);
  const blok = str(p.blok);
  const jenisKegiatan = str(p.jenisKegiatan);
  const bagian = str(p.bagian);

  if (found) {
    const sets = ['npm = ?1', 'nama_lengkap = ?2', 'blok = ?3', 'jenis_kegiatan = ?4', 'bagian = ?5', 'updated_at = ?6'];
    const vals = [npm, namaLengkap, blok, jenisKegiatan, bagian, ts];
    if (p.dosen !== undefined) { sets.push('dosen = ?' + (vals.length + 1)); vals.push(str(p.dosen)); }
    if (p.hadir !== undefined) { sets.push('hadir = ?' + (vals.length + 1)); vals.push(str(p.hadir)); }
    if (p.catatan !== undefined) { sets.push('catatan = ?' + (vals.length + 1)); vals.push(str(p.catatan)); }
    await db.prepare('UPDATE check_data SET ' + sets.join(', ') + ' WHERE id = ?' + (vals.length + 1)).bind(...vals, found.id).run();
  } else {
    await db.prepare(
      'INSERT INTO check_data (timestamp, check_id, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian, dosen, hadir, catatan, updated_at, biaya) ' +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, '')"
    ).bind(
      ts, 'CHK-' + crypto.randomUUID(), id, npm, namaLengkap, blok, jenisKegiatan, pilihan, detail, tanggal,
      bagian, str(p.dosen), str(p.hadir), str(p.catatan), ts
    ).run();
  }

  const sets = [];
  const vals = [];
  if (p.dosen !== undefined) { sets.push('dosen = ?' + (vals.length + 1)); vals.push(str(p.dosen)); }
  if (tanggal) { sets.push('tanggal_pelaksanaan = ?' + (vals.length + 1)); vals.push(tanggal); }
  if (sets.length) {
    sets.push('updated_at = ?' + (vals.length + 1));
    vals.push(ts);
    await db.prepare('UPDATE pengajuan SET ' + sets.join(', ') + ' WHERE id_pengajuan = ?' + (vals.length + 1)).bind(...vals, id).run();
  }

  return { success: true, message: 'Data kehadiran berhasil disimpan.' };
}
