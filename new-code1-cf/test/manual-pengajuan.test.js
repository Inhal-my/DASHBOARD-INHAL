import { describe, it, expect, vi, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { registerManualPengajuan } from '../src/pengajuan.js';
import { uploadBuktiAdmin } from '../src/write/pengajuanAdmin.js';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';

afterEach(() => { vi.unstubAllGlobals(); });

async function adminToken() {
  await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
  const sess = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
  return sess.token;
}

const manualBody = {
  npm: '2201010001', namaLengkap: 'Aisyah Putri', blok: 'A',
  jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20'
};

describe('registerManualPengajuan', () => {
  it('saves without email/noHp, marks sumber Manual, status Menunggu by default', async () => {
    const res = await registerManualPengajuan(env.DB, { ...manualBody }, {});
    expect(res.success).toBe(true);
    expect(res.sumber).toBe('Manual');
    expect(res.status).toBe('Menunggu');

    const p = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(res.idPengajuan).first();
    expect(p.sumber).toBe('Manual');
    expect(p.status).toBe('Menunggu');
    expect(p.email).toBe('');

    const h = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind(res.idPengajuan).first();
    expect(h.status).toBe('Menunggu');
    expect(h.catatan).toBe('Pengajuan dibuat manual oleh admin.');
  });

  it('allows initial status Diterima', async () => {
    const res = await registerManualPengajuan(env.DB, { ...manualBody, status: 'Diterima' }, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('Diterima');
    const p = await env.DB.prepare('SELECT status FROM pengajuan WHERE id_pengajuan = ?1').bind(res.idPengajuan).first();
    expect(p.status).toBe('Diterima');
  });

  it('falls back to Menunggu for an unsupported status', async () => {
    const res = await registerManualPengajuan(env.DB, { ...manualBody, status: 'ACC' }, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('Menunggu');
  });

  it('still requires NPM and Nama', async () => {
    const res = await registerManualPengajuan(env.DB, { ...manualBody, namaLengkap: '' }, {});
    expect(res.success).toBe(false);
    expect(res.message).toBe('NPM dan Nama Lengkap wajib diisi.');
  });

  it('still rejects identical duplicates', async () => {
    await registerManualPengajuan(env.DB, { ...manualBody }, {});
    const res = await registerManualPengajuan(env.DB, { ...manualBody }, {});
    expect(res.success).toBe(false);
    expect(res.message).toContain('Data identik sudah pernah diajukan');
  });
});

describe('public /api/pengajuan stays strict', () => {
  it('does not honor manual flag from the body', async () => {
    const res = await SELF.fetch('http://example.com/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...manualBody, manual: true, status: 'Diterima' })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Email aktif wajib diisi dengan format yang benar.');
  });
});

describe('manual RPCs', () => {
  it('requires an admin session', async () => {
    const denied = await dispatchRpc(env.DB, 'registerManualPengajuan', [{ ...manualBody }]);
    expect(denied.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
    const deniedOpts = await dispatchRpc(env.DB, 'getRegistrationOptions', []);
    expect(deniedOpts.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });

  it('creates a manual pengajuan through RPC', async () => {
    const token = await adminToken();
    const res = await dispatchRpc(env.DB, 'registerManualPengajuan', [{ ...manualBody, status: 'Diterima' }, token]);
    expect(res.success).toBe(true);
    expect(res.sumber).toBe('Manual');
    expect(res.status).toBe('Diterima');
  });

  it('returns registration options', async () => {
    const token = await adminToken();
    const res = await dispatchRpc(env.DB, 'getRegistrationOptions', [token]);
    expect(Array.isArray(res.blok)).toBe(true);
    expect(res.blok).toContain('A');
    expect(res.ujian).toContain('UAS');
  });
});

describe('admin upload bukti bayar', () => {
  it('rejects non-admin sessions', async () => {
    const file = { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'bukti.pdf' };
    await expect(uploadBuktiAdmin(env.DB, 'INHAL-x', file, {})).rejects.toThrow();
  });

  it('stores the bukti bayar link for a manual pengajuan', async () => {
    const created = await registerManualPengajuan(env.DB, { ...manualBody }, {});
    const token = await adminToken();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BUKTI1234567890ABCDEF/view' }),
      { status: 200 }
    )));
    const res = await uploadBuktiAdmin(env.DB, created.idPengajuan, { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'bukti.pdf' }, { token, env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' } });
    expect(res.success).toBe(true);
    const p = await env.DB.prepare('SELECT link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind(created.idPengajuan).first();
    expect(p.link_bukti_bayar).toContain('BUKTI1234567890ABCDEF');
  });

  it('rejects unsupported file types', async () => {
    const created = await registerManualPengajuan(env.DB, { ...manualBody }, {});
    const token = await adminToken();
    const res = await uploadBuktiAdmin(env.DB, created.idPengajuan, { data: 'aGVsbG8=', mimeType: 'text/plain', name: 'note.txt' }, { token, env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' } });
    expect(res.success).toBe(false);
  });
});
