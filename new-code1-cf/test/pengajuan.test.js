import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

async function post(body) {
  return SELF.fetch('http://example.com/api/pengajuan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const validBody = {
  npm: '2201010001', namaLengkap: 'Aisyah Putri', email: 'aisyah@contoh.com',
  noHp: '08123456789', blok: 'A', jenisKegiatan: 'Ujian',
  detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20'
};

describe('POST /api/pengajuan', () => {
  it('rejects missing name', async () => {
    const res = await post({ npm: '1', email: 'a@b.com', noHp: '08123456789' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('NPM dan Nama Lengkap wajib diisi.');
  });

  it('rejects bad email', async () => {
    const res = await post({ ...validBody, email: 'bukan-email' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Email aktif wajib diisi dengan format yang benar.');
  });

  it('stores pengajuan, detail, and status history', async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.idPengajuan).toMatch(/^INHAL-/);

    const p = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(p.npm).toBe('2201010001');
    expect(p.status).toBe('Menunggu');
    expect(p.updated_at).toBe(p.timestamp);

    const d = await env.DB.prepare('SELECT COUNT(*) AS n FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(d.n).toBe(1);

    const h = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(h.status).toBe('Menunggu');
    expect(h.catatan).toBe('Pengajuan dibuat.');
  });

  it('rejects an identical duplicate', async () => {
    await post(validBody);
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.');
  });
});
