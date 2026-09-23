import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { uploadBuktiFiles } from '../src/portal.js';

afterEach(() => { vi.unstubAllGlobals(); });

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
const pdfData = btoa('%PDF-1.4 fake portal receipt');

async function seedPengajuan() {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','Diterima')"
  ).run();
}

describe('portal uploadBuktiFiles', () => {
  it('validates the pengajuan id', async () => {
    const a = await uploadBuktiFiles(env.DB, {}, driveEnv);
    expect(a.success).toBe(false);
    const b = await uploadBuktiFiles(env.DB, { idPengajuan: 'NOPE' }, driveEnv);
    expect(b.success).toBe(false);
    expect(b.message).toContain('tidak ditemukan');
  });

  it('rejects a non-PDF bukti in strict mode', async () => {
    await seedPengajuan();
    const res = await uploadBuktiFiles(env.DB, {
      idPengajuan: 'INHAL-1',
      buktiFile: { data: btoa('not a pdf'), mimeType: 'application/pdf', name: 'bukti.pdf' }
    }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toContain('bukan PDF');
  });

  it('reports an error when the drive bridge is not configured', async () => {
    await seedPengajuan();
    const res = await uploadBuktiFiles(env.DB, {
      idPengajuan: 'INHAL-1',
      accFile: { data: pdfData, mimeType: 'application/pdf', name: 'acc.pdf' }
    }, {});
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum dikonfigurasi');
  });

  it('stores both files and links them on the pengajuan', async () => {
    await seedPengajuan();
    const f = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const url = 'https://drive.google.com/file/d/' + (body.prefix === 'acc-INHAL-1' ? 'AAAABBBBCCCCDDDDEEEEFFFFGGGG12345' : 'BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890') + '/view';
      return new Response(JSON.stringify({ success: true, url: url, fileId: 'x' }), { status: 200 });
    });
    vi.stubGlobal('fetch', f);

    const res = await uploadBuktiFiles(env.DB, {
      idPengajuan: 'INHAL-1',
      accFile: { data: pdfData, mimeType: 'application/pdf', name: 'acc.pdf' },
      buktiFile: { data: pdfData, mimeType: 'application/pdf', name: 'bukti.pdf' }
    }, driveEnv);
    expect(res.success).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);

    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_acc_inhal).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(row.link_bukti_bayar).toContain('BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890');
    expect(row.updated_at).toBeTruthy();

    const log = await env.DB.prepare('SELECT * FROM log_upload WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(log).toBeTruthy();
    expect(log.npm).toBe('2201010001');
    expect(log.link_acc_inhal).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(log.link_bukti_bayar).toContain('BBBBCCCCDDDDEEEEFFFFGGGGHHHH67890');
  });

  it('rejects when no file is provided', async () => {
    await seedPengajuan();
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1' }, driveEnv);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Tidak ada file');
  });

  it('sends an upload receipt email to the student', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,status) VALUES ('2026-09-10T08:00:00','INHAL-9','2201010009','Budi','budi@contoh.com','Diterima')"
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

    const res = await uploadBuktiFiles(env.DB, {
      idPengajuan: 'INHAL-9',
      buktiFile: { data: pdfData, mimeType: 'application/pdf', name: 'bukti.pdf' }
    }, driveEnv);
    expect(res.success).toBe(true);
    const receipt = bodies.find((b) => b.action === 'sendReceiptEmail');
    expect(receipt).toBeTruthy();
    expect(receipt.data.recipient).toBe('budi@contoh.com');
    expect(receipt.data.buktiUrl).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
  });
});
