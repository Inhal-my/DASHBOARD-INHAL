import { requireAdmin } from '../session.js';
import { norm } from '../read/common.js';
import { callDriveBridge } from '../drive.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function formatIndonesianDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + MONTHS_ID[d.getMonth()] + ' ' + d.getFullYear();
}

async function getPengajuan(db, idPengajuan) {
  return await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(str(idPengajuan)).first();
}

async function getDetailRows(db, idPengajuan) {
  const { results } = await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1 ORDER BY id').bind(str(idPengajuan)).all();
  return results || [];
}

export function buildEnhanced(pengajuan, details, status) {
  const p = pengajuan || {};
  const rows = details || [];
  const detailParts = [];
  let tanggal = '';
  for (const d of rows) {
    const pil = str(d.pilihan);
    const det = str(d.detail);
    const tgl = str(d.tanggal_pelaksanaan);
    if (pil || det) detailParts.push([pil, det].filter(Boolean).join(' - '));
    if (!tanggal && tgl) tanggal = tgl;
  }
  return {
    IDPengajuan: str(p.id_pengajuan),
    NomorSurat: str(p.nomor_surat),
    NPM: str(p.npm),
    'Nama Lengkap': str(p.nama_lengkap),
    Email: str(p.email),
    'No. HP/WA': str(p.no_hp_wa),
    Blok: str(p.blok),
    'Jenis Kegiatan': str(p.jenis_kegiatan),
    Status: str(status) || str(p.status),
    'Catatan Admin': str(p.catatan_admin),
    Keterangan: str(p.keterangan),
    TanggalPengajuan: formatIndonesianDate(p.timestamp),
    TanggalSurat: formatIndonesianDate(new Date()),
    DetailKegiatan: detailParts.filter(Boolean).join('; '),
    TanggalKegiatan: tanggal ? formatIndonesianDate(tanggal) : '',
    Dosen: str(p.dosen),
    TanggalPelaksanaan: formatIndonesianDate(p.tanggal_pelaksanaan)
  };
}

export async function resolveBagianEmail(db, pengajuan, details) {
  const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian, email FROM master_bagian').all();
  const map = {};
  for (const r of results || []) {
    const email = str(r.email);
    if (!email) continue;
    for (const field of [r.lab, r.kegiatan_lab, r.bagian]) {
      const k = norm(field);
      if (k) map[k] = email;
    }
  }
  const candidates = [];
  const added = {};
  const push = (v) => {
    const raw = str(v);
    const k = norm(raw);
    if (raw && k && !added[k]) { added[k] = true; candidates.push(raw); }
  };
  push(pengajuan && pengajuan.blok);
  for (const d of details || []) {
    push(d.bagian);
    push(d.pilihan);
    push(d.detail);
  }
  push(pengajuan && pengajuan.jenis_kegiatan);
  for (const c of candidates) {
    const email = map[norm(c)];
    if (email) return { name: c, email: email };
  }
  return { name: candidates.length ? candidates[0] : '', email: '' };
}

async function updateNotifikasiColumns(db, idPengajuan, status, sentAt, error) {
  await db.prepare(
    'UPDATE pengajuan SET status_notifikasi_email = ?1, notifikasi_terkirim_pada = ?2, error_notifikasi_email = ?3, updated_at = ?4 WHERE id_pengajuan = ?5'
  ).bind(str(status), str(sentAt), str(error), nowIso(), str(idPengajuan)).run();
}

async function updateStatusInfoBagian(db, idPengajuan, status, email, message) {
  await db.prepare(
    'UPDATE pengajuan SET status_info_bagian = ?1, waktu_info_bagian = ?2, email_bagian = ?3, catatan_info_bagian = ?4, updated_at = ?5 WHERE id_pengajuan = ?6'
  ).bind(str(status), nowIso(), str(email), str(message), nowIso(), str(idPengajuan)).run();
}

export async function processStatusNotification(db, idPengajuan, status, env) {
  const pengajuan = await getPengajuan(db, idPengajuan);
  if (!pengajuan) return { ok: false, error: 'Pengajuan tidak ditemukan.' };
  const recipient = str(pengajuan.email);
  if (!recipient) {
    await updateNotifikasiColumns(db, idPengajuan, 'Gagal', '', 'Email mahasiswa tidak ditemukan.');
    return { ok: false, error: 'Email mahasiswa tidak ditemukan.' };
  }

  const details = await getDetailRows(db, idPengajuan);
  const enhanced = buildEnhanced(pengajuan, details, status);
  const res = await callDriveBridge(env, {
    action: 'sendStatusEmail', data: enhanced, status: status, recipient: recipient
  });
  if (!res.ok) {
    await updateNotifikasiColumns(db, idPengajuan, 'Gagal', '', res.message);
    return { ok: false, error: res.message };
  }

  const attachmentUrl = str(res.data && res.data.attachmentUrl);
  if (attachmentUrl) {
    await db.prepare('UPDATE pengajuan SET lampiran_email = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
      .bind(attachmentUrl, nowIso(), str(idPengajuan)).run();
  }
  await updateNotifikasiColumns(db, idPengajuan, 'Berhasil', nowIso(), '');
  return { ok: true, lampiranEmail: attachmentUrl };
}

export async function sendStatusNotificationEmail(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = await getPengajuan(db, idPengajuan);
  if (!pengajuan) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  const status = str(pengajuan.status);
  if (status !== 'Diterima' && status !== 'Ditolak') {
    return { success: false, message: 'Email notifikasi hanya untuk status Diterima/Ditolak. Status saat ini: ' + (status || '-') };
  }
  const result = await processStatusNotification(db, idPengajuan, status, ctx.env);
  return result.ok
    ? { success: true, message: 'Email notifikasi berhasil dikirim.' }
    : { success: false, message: 'Email notifikasi gagal: ' + result.error };
}

export async function sendFinalPdfEmails(db, idPengajuan, env) {
  const pengajuan = await getPengajuan(db, idPengajuan);
  if (!pengajuan) return { ok: false, pdfUrl: '', studentEmailSent: false, bagianEmailSent: false, bagianEmail: '', bagianName: '', notes: ['Pengajuan tidak ditemukan.'] };

  const details = await getDetailRows(db, idPengajuan);
  const accInhal = str(pengajuan.link_acc_inhal);
  const bagian = await resolveBagianEmail(db, pengajuan, details);
  const nama = str(pengajuan.nama_lengkap);
  const npm = str(pengajuan.npm);
  const studentEmail = str(pengajuan.email);

  if (!accInhal) {
    return {
      ok: false, pdfUrl: '', studentEmailSent: false, bagianEmailSent: false,
      bagianEmail: bagian.email, bagianName: bagian.name,
      notes: ['Berkas ACC INHAL belum diunggah. Upload ACC INHAL terlebih dahulu sebelum mengirim PDF final.']
    };
  }

  if (str(pengajuan.status) !== 'ACC') {
    await db.prepare('UPDATE pengajuan SET status = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
      .bind('ACC', nowIso(), str(idPengajuan)).run();
    await db.prepare('INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(nowIso(), str(idPengajuan), 'ACC', '', str(env && env.actor) || 'Admin').run();
    pengajuan.status = 'ACC';
  }

  const enhanced = buildEnhanced(pengajuan, details, 'Final');
  const bridge = await callDriveBridge(env, {
    action: 'sendFinalEmail',
    data: enhanced,
    idPengajuan: str(idPengajuan),
    studentEmail: studentEmail,
    studentName: nama,
    npm: npm,
    bagianEmail: bagian.email,
    bagianName: bagian.name
  });

  let pdfUrl = '';
  let studentSent = false;
  let bagianSent = false;
  const notes = [];
  if (!bridge.ok) {
    notes.push(bridge.message || 'Gagal mengirim email final.');
    if (!studentEmail) notes.push('Email mahasiswa tidak terkirim.');
  } else {
    pdfUrl = str(bridge.data && bridge.data.pdfUrl);
    studentSent = !!(bridge.data && bridge.data.studentEmailSent);
    bagianSent = !!(bridge.data && bridge.data.bagianEmailSent);
    if (pdfUrl) {
      await db.prepare('UPDATE pengajuan SET link_final = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
        .bind(pdfUrl, nowIso(), str(idPengajuan)).run();
    }
    if (!studentSent) notes.push('Email mahasiswa tidak terkirim.');
    if (!bagianSent) notes.push("Email untuk Bagian '" + (bagian.name || '-') + "' tidak terkirim / tidak ditemukan.");
  }

  await updateStatusInfoBagian(
    db, idPengajuan,
    bagianSent ? 'Terkirim' : (bagian.email ? 'Gagal' : 'Belum dikirim'),
    bagian.email,
    (!bagianSent ? ("Email untuk Bagian '" + (bagian.name || '-') + "' tidak terkirim / tidak ditemukan.") : '')
  );

  return { ok: true, pdfUrl: pdfUrl, studentEmailSent: studentSent, bagianEmailSent: bagianSent, bagianEmail: bagian.email, bagianName: bagian.name, notes: notes };
}

export async function sendFinalEmail(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token);
  try {
    const result = await sendFinalPdfEmails(db, idPengajuan, ctx.env);
    return {
      success: result.ok,
      linkFinal: result.pdfUrl,
      message: (result.notes && result.notes.length) ? result.notes.join(' ') : 'Email final berhasil dikirim.',
      emailSent: result.studentEmailSent || result.bagianEmailSent,
      studentEmailSent: result.studentEmailSent,
      bagianEmailSent: result.bagianEmailSent
    };
  } catch (e) {
    return { success: false, message: (e && e.message) ? e.message : String(e) };
  }
}

export async function sendAccFinalToBagian(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token);
  try {
    const pengajuan = await getPengajuan(db, idPengajuan);
    if (!pengajuan) return { success: false, message: 'Pengajuan tidak ditemukan.' };
    const details = await getDetailRows(db, idPengajuan);
    const bagian = await resolveBagianEmail(db, pengajuan, details);
    const nama = str(pengajuan.nama_lengkap);
    const npm = str(pengajuan.npm);
    if (!bagian.email) {
      return { success: false, message: "Email Bagian untuk '" + (bagian.name || '-') + "' tidak ditemukan. Cek Master Bagian / Master Data." };
    }

    const enhanced = buildEnhanced(pengajuan, details, 'Final');
    const bridge = await callDriveBridge(ctx.env, {
      action: 'sendFinalToBagian',
      data: enhanced,
      idPengajuan: str(idPengajuan),
      studentName: nama,
      npm: npm,
      bagianEmail: bagian.email,
      bagianName: bagian.name
    });

    if (!bridge.ok) {
      await updateStatusInfoBagian(db, idPengajuan, 'Gagal', bagian.email, bridge.message || '');
      return { success: false, message: 'Gagal mengirim email: ' + (bridge.message || '') };
    }

    await updateStatusInfoBagian(db, idPengajuan, 'Terkirim', bagian.email, 'Dikirim ulang khusus ke Bagian oleh Admin');
    return { success: true, message: "Email final terkirim ke Bagian '" + (bagian.name || '') + "' (" + bagian.email + ').', linkFinal: str(bridge.data && bridge.data.pdfUrl) };
  } catch (e) {
    return { success: false, message: (e && e.message) ? e.message : String(e) };
  }
}

export async function sendReceiptEmail(db, idPengajuan, accUrl, buktiUrl, env) {
  try {
    const pengajuan = await getPengajuan(db, idPengajuan);
    if (!pengajuan) return { ok: false };
    const recipient = str(pengajuan.email);
    if (!recipient) return { ok: false };
    const details = await getDetailRows(db, idPengajuan);
    const detailParts = [];
    let tanggal = '';
    for (const d of details) {
      const line = [str(d.pilihan), str(d.detail)].filter(Boolean).join(' - ');
      if (line) detailParts.push(line);
      if (!tanggal && str(d.tanggal_pelaksanaan)) tanggal = str(d.tanggal_pelaksanaan);
    }
    const res = await callDriveBridge(env, {
      action: 'sendReceiptEmail',
      data: {
        recipient: recipient,
        nama: str(pengajuan.nama_lengkap),
        npm: str(pengajuan.npm),
        blok: str(pengajuan.blok),
        jenis: str(pengajuan.jenis_kegiatan),
        detail: detailParts.join('; '),
        tanggal: tanggal,
        accUrl: str(accUrl),
        buktiUrl: str(buktiUrl)
      }
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false };
  }
}
