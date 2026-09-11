import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  buildEnhanced, formatIndonesianDate, resolveBagianEmail,
  processStatusNotification, sendStatusNotificationEmail,
  sendFinalEmail, sendAccFinalToBagian
} from '../src/write/email.js';

afterEach(() => { vi.unstubAllGlobals(); });

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), session: null, env: driveEnv };
}

async function seedPengajuan(extra = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status,link_acc_inhal) " +
    "VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','aisyah@contoh.com','0812','A','Praktikum','Diterima',?1)"
  ).bind(extra.linkAcc || '').run();
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

  it('returns an empty bagian email when nothing matches', async () => {
    const match = await resolveBagianEmail(env.DB, { blok: 'Z', jenis_kegiatan: 'SGD' }, [{ pilihan: 'SGD 9', detail: 'X' }]);
    expect(match.email).toBe('');
  });
});

describe('processStatusNotification', () => {
  it('renders, stores the attachment link and marks success', async () => {
    await seedPengajuan();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: 'https://drive.google.com/file/d/NOTIF1234567890/view' }));
    const res = await processStatusNotification(env.DB, 'INHAL-1', 'Diterima', driveEnv);
    expect(res.ok).toBe(true);
    expect(calls[0].action).toBe('sendStatusEmail');
    expect(calls[0].recipient).toBe('aisyah@contoh.com');
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Berhasil');
    expect(row.lampiran_email).toContain('NOTIF1234567890');
    expect(row.notifikasi_terkirim_pada).toBeTruthy();
  });

  it('marks failure when the recipient email is missing', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010009','Tanpa Email','Ditolak')").run();
    const res = await processStatusNotification(env.DB, 'INHAL-2', 'Ditolak', driveEnv);
    expect(res.ok).toBe(false);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-2').first();
    expect(row.status_notifikasi_email).toBe('Gagal');
    expect(row.error_notifikasi_email).toContain('tidak ditemukan');
  });

  it('marks failure when the bridge errors', async () => {
    await seedPengajuan();
    stubBridge(() => ({ success: false, message: 'boom' }));
    const res = await processStatusNotification(env.DB, 'INHAL-1', 'Diterima', driveEnv);
    expect(res.ok).toBe(false);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Gagal');
    expect(row.error_notifikasi_email).toBe('boom');
  });
});

describe('sendStatusNotificationEmail', () => {
  it('requires admin', async () => {
    await expect(sendStatusNotificationEmail(env.DB, 'INHAL-1', {})).rejects.toThrow();
  });

  it('rejects statuses other than Diterima/Ditolak', async () => {
    await seedPengajuan();
    await env.DB.prepare("UPDATE pengajuan SET status = 'ACC' WHERE id_pengajuan = 'INHAL-1'").run();
    const ctx = await adminCtx();
    const res = await sendStatusNotificationEmail(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Diterima/Ditolak');
  });
});

describe('sendFinalEmail', () => {
  it('refuses when ACC INHAL has not been uploaded', async () => {
    await seedPengajuan();
    await seedDetail();
    const ctx = await adminCtx();
    const res = await sendFinalEmail(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ACC INHAL belum diunggah');
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
    const hist = await env.DB.prepare("SELECT * FROM status_history WHERE id_pengajuan = 'INHAL-1' AND status = 'ACC'").all();
    expect(hist.results).toHaveLength(1);
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
