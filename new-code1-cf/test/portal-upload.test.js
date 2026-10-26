import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { uploadBuktiFiles } from '../src/portal.js';

afterEach(() => { vi.unstubAllGlobals(); });

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
const pdfData = btoa('%PDF-1.4 fake portal receipt');
const buktiFile = { data: pdfData, mimeType: 'application/pdf', name: 'bukti.pdf' };

async function seedPengajuan(status = 'ACC', withBukti = '') {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,status,link_bukti_bayar) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah',?1,?2)"
  ).bind(status, withBukti).run();
}

describe('portal upload bukti-only', () => {
  it('validates the pengajuan id', async () => {
    const a = await uploadBuktiFiles(env.DB, {}, driveEnv);
    expect(a.success).toBe(false);
    const b = await uploadBuktiFiles(env.DB, { idPengajuan: 'NOPE' }, driveEnv);
    expect(b.success).toBe(false);
    expect(b.message).toContain('tidak ditemukan');
  });

  it('rejects an upload when the npm does not own the pengajuan', async () => {
    await seedPengajuan('ACC');
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201099999', buktiFile }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toContain('NPM tidak cocok');
    const row = await env.DB.prepare('SELECT link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_bukti_bayar).toBe('');
  });

  it('menolak unggah saat status bukan ACC', async () => {
    await seedPengajuan('Menunggu');
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/ACC/);
  });

  it('rejects a non-PDF bukti in strict mode', async () => {
    await seedPengajuan('ACC');
    const res = await uploadBuktiFiles(env.DB, {
      idPengajuan: 'INHAL-1',
      npm: '2201010001',
      buktiFile: { data: btoa('not a pdf'), mimeType: 'application/pdf', name: 'bukti.pdf' }
    }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toContain('bukan PDF');
  });

  it('rejects when no file is provided', async () => {
    await seedPengajuan('ACC');
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001' }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Tidak ada file');
  });

  it('reports an error when the drive bridge is not configured', async () => {
    await seedPengajuan('ACC');
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, {});
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum dikonfigurasi');
  });

  it('menerima unggah bukti tanpa file ACC', async () => {
    await seedPengajuan('ACC');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890/view' }),
      { status: 200 }
    )));
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, driveEnv);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_bukti_bayar).toContain('BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890');

    const log = await env.DB.prepare('SELECT * FROM log_upload WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(log).toBeTruthy();
    expect(log.npm).toBe('2201010001');
    expect(log.link_bukti_bayar).toContain('BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890');
  });

  it('sends an upload receipt email to the student', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,status) VALUES ('2026-09-10T08:00:00','INHAL-9','2201010009','Budi','budi@contoh.com','ACC')"
    ).run();
    const bodies = [];
    const f = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      if (body.action === 'saveFile') {
        return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view' }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', f);

    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-9', npm: '2201010009', buktiFile }, driveEnv);
    expect(res.success).toBe(true);
    const receipt = bodies.find((b) => b.action === 'sendReceiptEmail');
    expect(receipt).toBeTruthy();
    expect(receipt.data.recipient).toBe('budi@contoh.com');
    expect(receipt.data.buktiUrl).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
  });

  it('clears the upload reset flag after a successful re-upload', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,status,upload_reset_at,upload_reset_by,upload_reset_note) VALUES ('2026-09-10T08:00:00','INHAL-7','2201010007','Citra','citra@contoh.com','ACC','2026-09-30T00:00:00','Admin','perbaiki')"
    ).run();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view' }),
      { status: 200 }
    )));

    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-7', npm: '2201010007', buktiFile }, driveEnv);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-7').first();
    expect(row.upload_reset_at).toBe('');
    expect(row.upload_reset_by).toBe('');
    expect(row.upload_reset_note).toBe('');
  });

  it('menandai status pembayaran menjadi menunggu setelah unggah bukti', async () => {
    await seedPengajuan('ACC');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890/view' }),
      { status: 200 }
    )));
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, driveEnv);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT status_pembayaran FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_pembayaran).toBe('menunggu');
  });

  it('mempertahankan status gratis saat unggah bukti', async () => {
    await seedPengajuan('ACC');
    await env.DB.prepare("UPDATE pengajuan SET status_pembayaran = 'gratis' WHERE id_pengajuan = 'INHAL-1'").run();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890/view' }),
      { status: 200 }
    )));
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, driveEnv);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT status_pembayaran FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_pembayaran).toBe('gratis');
  });

  it('menolak unggah saat status pembayaran sudah valid', async () => {
    await seedPengajuan('ACC', 'https://drive.example/bukti.pdf');
    await env.DB.prepare("UPDATE pengajuan SET status_pembayaran = 'valid' WHERE id_pengajuan = 'INHAL-1'").run();
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '2201010001', buktiFile }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/valid/i);
  });
});
