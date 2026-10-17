import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan, updateJadwalPelaksanaan, cancelJadwalPelaksanaan } from '../src/write/jadwal.js';

async function bagianCtx(kategoris) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: kategoris || ['SGD'] }) };
}
async function seedPengajuan(status = 'ACC') {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD',?1)").bind(status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')").run();
}
const payload = {
  bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
  peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
};

describe('jadwal write', () => {
  it('requires bagian session', async () => {
    await expect(saveJadwalPelaksanaan(env.DB, payload, 'SGD', {})).rejects.toThrow();
  });

  it('menyimpan jadwal dan peserta', async () => {
    await seedPengajuan();
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', await bagianCtx(['SGD']));
    expect(res.success).toBe(true);
    expect(res.jadwalId).toMatch(/^JDW-\d{4}-0001$/);
    const j = await env.DB.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(j.dosen).toBe('dr. Andi');
    expect(j.kegiatan_key).toBe('sgd|a|sgd 1');
    expect(Number(j.active)).toBe(1);
    const p = await env.DB.prepare('SELECT * FROM jadwal_peserta WHERE jadwal_id=?1').bind(res.jadwalId).all();
    expect(p.results).toHaveLength(1);
  });

  it('menolak jadwal duplikat untuk kegiatan, waktu, dan peserta yang sama', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const first = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    expect(first.success).toBe(true);
    const dup = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    expect(dup.success).toBe(false);
    expect(dup.message).toContain('sudah ada');
    const rows = await env.DB.prepare('SELECT jadwal_id FROM jadwal_pelaksanaan WHERE active=1').all();
    expect(rows.results).toHaveLength(1);
  });

  it('menolak peserta non-ACC', async () => {
    await seedPengajuan('Menunggu');
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', await bagianCtx(['SGD']));
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum berstatus');
  });

  it('mengubah jadwal selama belum ada BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    const up = await updateJadwalPelaksanaan(env.DB, res.jadwalId, { ...payload, jam: '10:30', dosen: 'dr. Budi' }, 'SGD', ctx);
    expect(up.success).toBe(true);
    const j = await env.DB.prepare('SELECT jam, dosen FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(j.jam).toBe('10:30');
    expect(j.dosen).toBe('dr. Budi');
  });

  it('membatalkan jadwal (soft cancel)', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    const cancel = await cancelJadwalPelaksanaan(env.DB, res.jadwalId, 'SGD', ctx);
    expect(cancel.success).toBe(true);
    const j = await env.DB.prepare('SELECT active FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(Number(j.active)).toBe(0);
  });

  it('mengunci jadwal setelah BA dibuat', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,jadwal_id) VALUES ('2026-09-10T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-09-20','Bagian','sgd|a|sgd 1',?1)").bind(res.jadwalId).run();
    const up = await updateJadwalPelaksanaan(env.DB, res.jadwalId, payload, 'SGD', ctx);
    expect(up.success).toBe(false);
    const cancel = await cancelJadwalPelaksanaan(env.DB, res.jadwalId, 'SGD', ctx);
    expect(cancel.success).toBe(false);
  });
});
