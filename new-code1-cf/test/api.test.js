import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('scaffold', () => {
  it('responds ok on health', async () => {
    const res = await SELF.fetch('http://example.com/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('applies schema and seed to D1', async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM mahasiswa').first();
    expect(row.n).toBe(3);
  });
});

describe('read endpoints', () => {
  it('returns registration options', async () => {
    const res = await SELF.fetch('http://example.com/api/registration-options');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ujian).toEqual(['UAS', 'UTS']);
    expect(body.lab).toEqual(['Lab Anatomi']);
    expect(body.buktiMode).toBe('strict');
    expect(body).toHaveProperty('detailSgd');
    expect(body).toHaveProperty('detailKkd');
    expect(body).toHaveProperty('dosen');
  });

  it('returns student name as a JSON string', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/2201010001');
    expect(res.status).toBe(200);
    expect(await res.json()).toBe('Aisyah Putri');
  });

  it('returns empty string for unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/999');
    expect(await res.json()).toBe('');
  });
});

describe('portal endpoints', () => {
  it('returns portal data for a known npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/2201010001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nama).toBe('Aisyah Putri');
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.buktiMode).toBe('strict');
  });

  it('returns an error object for an unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/9999999999');
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).error).toBe('string');
  });

  it('rejects an upload without an id pengajuan', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('ID Pengajuan');
  });
});

describe('surat keterangan upload', () => {
  const suratBody = {
    npm: '2201010002', namaLengkap: 'Budi Santoso', email: 'budi@contoh.com',
    noHp: '08123456789', blok: 'B', jenisKegiatan: 'Ujian',
    detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-21',
    fileSurat: { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'surat.pdf' }
  };

  it('stores the surat upload and serves it back', async () => {
    const res = await SELF.fetch('http://example.com/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suratBody)
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const p = await env.DB.prepare('SELECT link_surat_keterangan FROM pengajuan WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(p.link_surat_keterangan).toMatch(/^\/api\/files\/UPL-/);

    const fileRes = await SELF.fetch('http://example.com' + p.link_surat_keterangan);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('content-type')).toBe('application/pdf');
    expect(await fileRes.text()).toBe('hello');
  });

  it('rejects an oversize surat upload and stores nothing', async () => {
    const res = await SELF.fetch('http://example.com/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...suratBody, fileSurat: { data: 'A'.repeat(1_500_000), mimeType: 'application/pdf', name: 'big.pdf' } })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('maksimal');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM pengajuan WHERE npm = ?1').bind('2201010002').first();
    expect(n.n).toBe(0);
  });

  it('returns 404 for an unknown file id', async () => {
    const res = await SELF.fetch('http://example.com/api/files/UPL-nope');
    expect(res.status).toBe(404);
  });
});
