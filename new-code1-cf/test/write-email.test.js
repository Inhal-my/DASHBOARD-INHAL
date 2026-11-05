import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  buildEnhanced, formatIndonesianDate, resolveBagianEmail,
  sendFinalPdfEmails, sendFinalEmail, sendAccFinalToBagian, sendBulkFinalEmail
} from '../src/write/email.js';

afterEach(() => { vi.unstubAllGlobals(); });

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), session: null, env: driveEnv };
}

async function seedPengajuan(extra = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status,link_acc_inhal) " +
    "VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','aisyah@contoh.com','0812','A','Praktikum',?2,?1)"
  ).bind(extra.linkAcc || '', extra.status || 'ACC').run();
}

async function seedDetail() {
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) " +
    "VALUES ('2026-09-10T08:00:00','INHAL-1','Praktikum','Lab Anatomi','Praktikum 1','2026-09-20','Anatomi')"
  ).run();
}

function stubBridge(handler) {
  const calls = [];
  const f = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return new Response(JSON.stringify(handler(body)), { status: 200 });
  });
  vi.stubGlobal('fetch', f);
  return calls;
}

describe('email helpers', () => {
  it('formats Indonesian dates', () => {
    expect(formatIndonesianDate('2026-09-20')).toBe('20 September 2026');
    expect(formatIndonesianDate('')).toBe('');
    expect(formatIndonesianDate('bukan-tanggal')).toBe('');
  });

  it('builds the template payload from a pengajuan row', () => {
    const enhanced = buildEnhanced(
      { id_pengajuan: 'INHAL-1', npm: '2201010001', nama_lengkap: 'Aisyah', nomor_surat: '001/INHAL', status: 'Menunggu', timestamp: '2026-09-10T08:00:00' },
      [{ pilihan: 'Lab Anatomi', detail: 'Praktikum 1', tanggal_pelaksanaan: '2026-09-20' }],
      'Diterima'
    );
    expect(enhanced.Status).toBe('Diterima');
    expect(enhanced.NPM).toBe('2201010001');
    expect(enhanced.DetailKegiatan).toBe('Lab Anatomi - Praktikum 1');
    expect(enhanced.TanggalKegiatan).toBe('20 September 2026');
  });

  it('resolves the bagian email from detail values', async () => {
    const match = await resolveBagianEmail(env.DB, { blok: 'A', jenis_kegiatan: 'Praktikum' }, [{ pilihan: 'Lab Anatomi', detail: 'Praktikum 1' }]);
    expect(match.email).toBe('anatomi@contoh.com');
    expect(match.name).toBe('Lab Anatomi');
  });

  it('resolves the bagian email from the staff kategori for non-lab activities', async () => {
    await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('sgd@contoh.com','SGD','Staff SGD','x')").run();
    const match = await resolveBagianEmail(env.DB, { blok: 'Z', jenis_kegiatan: 'SGD' }, [{ pilihan: 'S G D 3', detail: 'Inhal' }]);
    expect(match.email).toBe('sgd@contoh.com');
    expect(match.name).toBe('SGD');
  });

  it('maps the "Lab " staff kategori to the plain lab name', async () => {
    await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('lab@contoh.com','Lab Biokimia','Staff Biokimia','x')").run();
    const match = await resolveBagianEmail(env.DB, { jenis_kegiatan: 'Praktikum' }, [{ pilihan: 'Biokimia', detail: 'PostTest' }]);
    expect(match.email).toBe('lab@contoh.com');
  });

  it('returns an empty bagian email when nothing matches', async () => {
    const match = await resolveBagianEmail(env.DB, { blok: 'Z', jenis_kegiatan: 'SGD' }, [{ pilihan: 'SGD 9', detail: 'X' }]);
    expect(match.email).toBe('');
  });
});

describe('sendFinalPdfEmails tanpa link_acc_inhal', () => {
  it('tidak menolak hanya karena ACC INHAL kosong', async () => {
    await seedPengajuan();
    await seedDetail();
    stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const res = await sendFinalPdfEmails(env.DB, 'INHAL-1', driveEnv, 'Admin');
    const joined = (res.notes || []).join(' ');
    expect(joined).not.toContain('ACC INHAL');
    expect(res.ok).toBe(true);
  });
});

describe('sendFinalEmail', () => {
  it('sends the final pdf even without ACC INHAL', async () => {
    await seedPengajuan();
    await seedDetail();
    stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendFinalEmail(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    expect(res.linkFinal).toContain('FINAL1234567890');
  });

  it('sets ACC, stores the final link and informs bagian', async () => {
    await seedPengajuan({ linkAcc: 'https://drive.google.com/file/d/ACC1234567890/view' });
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendFinalEmail(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    expect(res.studentEmailSent).toBe(true);
    expect(res.bagianEmailSent).toBe(true);
    expect(calls[0].action).toBe('sendFinalEmail');
    expect(calls[0].bagianEmail).toBe('anatomi@contoh.com');
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('ACC');
    expect(row.link_final).toContain('FINAL1234567890');
    expect(row.status_info_bagian).toBe('Terkirim');
    expect(row.email_bagian).toBe('anatomi@contoh.com');
  });

  it('menolak pengiriman email final untuk pengajuan yang belum ACC tanpa mengubah status', async () => {
    await seedPengajuan({ status: 'Menunggu' });
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendFinalEmail(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ACC');
    expect(calls).toHaveLength(0);
    const row = await env.DB.prepare('SELECT status, link_final FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Menunggu');
    expect(row.link_final || '').toBe('');
  });
});

describe('sendAccFinalToBagian', () => {
  it('sends the final pdf to the resolved bagian email', async () => {
    await seedPengajuan({ linkAcc: 'https://drive.google.com/file/d/ACC1234567890/view' });
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view' }));
    const ctx = await adminCtx();
    const res = await sendAccFinalToBagian(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    expect(calls[0].action).toBe('sendFinalToBagian');
    expect(calls[0].bagianEmail).toBe('anatomi@contoh.com');
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_info_bagian).toBe('Terkirim');
  });

  it('fails when no bagian email can be resolved', async () => {
    await seedPengajuan();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 9','X','','')").run();
    const ctx = await adminCtx();
    const res = await sendAccFinalToBagian(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak ditemukan');
  });
});

describe('sendBulkFinalEmail', () => {
  it('requires admin', async () => {
    await expect(sendBulkFinalEmail(env.DB, [], {})).rejects.toThrow();
  });

  it('processes the provided ids and reports per-item results', async () => {
    await seedPengajuan({ linkAcc: 'https://drive.google.com/file/d/ACC1234567890/view' });
    await seedDetail();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,jenis_kegiatan,status,link_acc_inhal) " +
      "VALUES ('2026-09-10T08:00:00','INHAL-3','2201010003','Citra','citra@contoh.com','Ujian','ACC','')"
    ).run();
    const calls = stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendBulkFinalEmail(env.DB, ['INHAL-1', 'INHAL-3'], ctx);
    expect(res.success).toBe(true);
    expect(res.total).toBe(2);
    expect(res.sent).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.message).toContain('2 pengajuan');
    expect(calls.filter((c) => c.action === 'sendFinalEmail')).toHaveLength(2);
  });

  it('melewati pengajuan yang belum ACC dan tidak mengubah statusnya', async () => {
    await seedPengajuan({ linkAcc: 'https://drive.google.com/file/d/ACC1234567890/view' });
    await seedDetail();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,jenis_kegiatan,status) " +
      "VALUES ('2026-09-10T08:00:00','INHAL-5','2201010005','Eka','eka@contoh.com','Ujian','Menunggu')"
    ).run();
    const calls = stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendBulkFinalEmail(env.DB, ['INHAL-1', 'INHAL-5'], ctx);
    expect(res.total).toBe(2);
    expect(res.sent).toBe(1);
    expect(res.skipped).toBe(1);
    expect(calls.filter((c) => c.action === 'sendFinalEmail')).toHaveLength(1);
    const row = await env.DB.prepare('SELECT status, link_final FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-5').first();
    expect(row.status).toBe('Menunggu');
    expect(row.link_final || '').toBe('');
  });

  it('defaults to every ACC pengajuan when no ids are given', async () => {
    await seedPengajuan({ linkAcc: 'https://drive.google.com/file/d/ACC1234567890/view' });
    await seedDetail();
    await env.DB.prepare("UPDATE pengajuan SET status = 'ACC' WHERE id_pengajuan = 'INHAL-1'").run();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,status) VALUES ('2026-09-10T08:00:00','INHAL-4','2201010004','Dewi','Diterima')"
    ).run();
    stubBridge(() => ({ success: true, pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view', studentEmailSent: true, bagianEmailSent: true }));
    const ctx = await adminCtx();
    const res = await sendBulkFinalEmail(env.DB, [], ctx);
    expect(res.total).toBe(1);
    expect(res.details[0].idPengajuan).toBe('INHAL-1');
  });
});

describe('sendRejectionPdfEmail', () => {
  it('renders the rejection template with the admin note and records success', async () => {
    await seedPengajuan();
    await seedDetail();
    await env.DB.prepare("UPDATE pengajuan SET catatan_admin = 'Berkas kurang' WHERE id_pengajuan = 'INHAL-1'").run();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: 'https://drive.google.com/file/d/REJ1234567890/view' }));
    const { sendRejectionPdfEmail } = await import('../src/write/email.js');
    const res = await sendRejectionPdfEmail(env.DB, 'INHAL-1', 'Ditolak', driveEnv);
    expect(res.ok).toBe(true);
    expect(calls[0].action).toBe('sendStatusEmail');
    expect(calls[0].recipient).toBe('aisyah@contoh.com');
    expect(calls[0].data.AlasanPenolakan).toBe('Berkas kurang');
    expect(calls[0].data.Status).toBe('Ditolak');
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Berhasil');
    expect(row.lampiran_email).toContain('REJ1234567890');
  });

  it('uses the Ditolak template for Dibatalkan but keeps the real status in data', async () => {
    await seedPengajuan();
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: '' }));
    const { sendRejectionPdfEmail } = await import('../src/write/email.js');
    await sendRejectionPdfEmail(env.DB, 'INHAL-1', 'Dibatalkan', driveEnv);
    expect(calls[0].status).toBe('Ditolak');
    expect(calls[0].data.Status).toBe('Dibatalkan');
  });

  it('marks the notification as failed when the bridge rejects the action', async () => {
    await seedPengajuan();
    await seedDetail();
    stubBridge(() => ({ success: false, message: 'Aksi tidak dikenal: sendStatusEmail' }));
    const { sendRejectionPdfEmail } = await import('../src/write/email.js');
    const res = await sendRejectionPdfEmail(env.DB, 'INHAL-1', 'Ditolak', driveEnv);
    expect(res.ok).toBe(false);
    expect(String(res.notes.join(' '))).toContain('Aksi tidak dikenal');
    const row = await env.DB.prepare('SELECT status_notifikasi_email, error_notifikasi_email FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Gagal');
    expect(row.error_notifikasi_email).toContain('Aksi tidak dikenal');
  });

  it('fails fast when the student email is missing', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Tanpa Email','','SGD','Menunggu')"
    ).run();
    const calls = stubBridge(() => ({ success: true }));
    const { sendRejectionPdfEmail } = await import('../src/write/email.js');
    const res = await sendRejectionPdfEmail(env.DB, 'INHAL-2', 'Ditolak', driveEnv);
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
