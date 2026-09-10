import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getStudentPortalData } from '../src/portal.js';

async function seedPengajuan() {
  await env.DB.prepare(
    'INSERT INTO pengajuan (timestamp, id_pengajuan, npm, nama_lengkap, email, no_hp_wa, blok, jenis_kegiatan, status, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)'
  ).bind('2026-09-10T08:00:00', 'INHAL-a', '2201010001', 'Aisyah Putri', 'aisyah@contoh.com', '08123456789', 'A', 'Ujian', 'Diterima', '2026-09-10T08:00:00').run();
  await env.DB.prepare(
    'INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) VALUES (?1,?2,?3,?4,?5,?6,?7)'
  ).bind('2026-09-10T08:00:00', 'INHAL-a', 'Ujian', 'UAS', '', '2026-09-20', '').run();
}

describe('getStudentPortalData', () => {
  it('builds history for a known npm', async () => {
    await seedPengajuan();
    const data = await getStudentPortalData(env.DB, '2201010001');
    expect(data.error).toBeUndefined();
    expect(data.nama).toBe('Aisyah Putri');
    expect(data.buktiMode).toBe('strict');
    expect(data.history).toHaveLength(1);
    const h = data.history[0];
    expect(h.idPengajuan).toBe('INHAL-a');
    expect(h.jenis).toBe('Ujian');
    expect(h.detail).toBe('UAS');
    expect(h.tanggalKegiatan).toBe('2026-09-20');
    expect(h.status).toBe('Diterima');
    expect(h.hasUpload).toBe(false);
    expect(h.linkFinal).toBe('');
  });

  it('matches npm regardless of non-digit characters', async () => {
    await seedPengajuan();
    const data = await getStudentPortalData(env.DB, ' 2201-010-001 ');
    expect(data.history).toHaveLength(1);
  });

  it('falls back to mahasiswa name when there is no pengajuan', async () => {
    const data = await getStudentPortalData(env.DB, '2201010002');
    expect(data.nama).toBe('Budi Santoso');
    expect(data.history).toEqual([]);
  });

  it('returns error for an unknown npm', async () => {
    const data = await getStudentPortalData(env.DB, '9999999999');
    expect(data.error).toContain('tidak ditemukan');
  });

  it('returns error for an empty npm', async () => {
    const data = await getStudentPortalData(env.DB, '');
    expect(data.error).toBe('NPM tidak boleh kosong');
  });
});
