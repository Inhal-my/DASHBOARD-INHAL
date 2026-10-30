import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession, AUTH_ERROR } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';
import { computeKalenderJadwal, getKalenderBagianPelaksanaan } from '../src/read/kalender.js';

async function bagianToken(kategoris = ['SGD', 'KKD', 'Ujian', 'Praktikum']) {
  return await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: 'SGD', subBagian: '', kategoris });
}

function jadwal(values) {
  return env.DB.prepare(
    'INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES (?,?,?,?,?,?,?,?,?,"",?)'
  ).bind(...values).run();
}

function peserta(jadwalId, npm, nama) {
  return env.DB.prepare(
    'INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES (?,?,?,?,?,?,"ACC")'
  ).bind('2026-09-10T08:00:00', jadwalId, 'INHAL-' + npm, npm, nama, 'A').run();
}

async function seed() {
  // SGD: 1 peserta
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-A', 'SGD', 'A', 'SGD 1', 'sgd|a|sgd 1', '2026-10-20', '08:00', 'dr. Andi', 1]);
  await peserta('JDW-KAL-A', '2201010001', 'Aisyah');
  // KKD: 2 peserta
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-B', 'KKD', 'B', 'KKD 2', 'kkd|b|kkd 2', '2026-10-20', '09:00', 'dr. Budi', 1]);
  await peserta('JDW-KAL-B', '2201010002', 'Budi');
  await peserta('JDW-KAL-B', '2201010003', 'Cici');
  // Ujian: tanpa peserta
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-C', 'Ujian', 'A', 'UAS', 'ujian|a|uas', '2026-10-21', '10:00', 'dr. Citra', 1]);
  // Lab: bulan lain (tetap ikut agregasi)
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-D', 'Lab Farmasi', 'C', 'Praktikum Farmasi', 'praktikum|c|farmasi', '2026-09-30', '13:00', 'dr. Dedi', 1]);
  await peserta('JDW-KAL-D', '2201010004', 'Dewi');
  // Jadwal dibatalkan (active = 0) harus diabaikan
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-E', 'SGD', 'A', 'SGD Batal', 'sgd|a|batal', '2026-10-22', '14:00', 'dr. Eka', 0]);
  // Tanpa tanggal juga diabaikan
  await jadwal(['2026-09-10T08:00:00', 'JDW-KAL-F', 'KKD', 'B', 'KKD Tanpa Tanggal', 'kkd|b|tanpa', '', '07:00', '', 1]);
  // BA untuk JDW-KAL-A
  await env.DB.prepare(
    "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,sumber,kegiatan_key,jadwal_id) VALUES ('2026-10-20T08:00:00','BA-KAL-1','SGD','A','SGD 1','2026-10-20','08:00','dr. Andi','1','https://drive/ba-kal','Bagian','sgd|a|sgd 1','JDW-KAL-A')"
  ).run();
}

describe('kalender pelaksanaan lintas bagian', () => {
  it('menolak sesi yang tidak valid dan peran selain bagian', async () => {
    await seed();
    const tanpaSesi = await getKalenderBagianPelaksanaan(env.DB, { token: '' });
    expect(tanpaSesi.ok).toBe(false);
    expect(tanpaSesi.message).toBe(AUTH_ERROR);
    expect(tanpaSesi.entries).toEqual([]);

    const adminToken = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const admin = await getKalenderBagianPelaksanaan(env.DB, { token: adminToken });
    expect(admin.ok).toBe(false);
    expect(admin.message).toBe(AUTH_ERROR);
    expect(admin.entries).toEqual([]);
  });

  it('menggabungkan SGD, KKD, Ujian, dan Lab dalam satu daftar terurut', async () => {
    await seed();
    const res = await getKalenderBagianPelaksanaan(env.DB, { token: await bagianToken() });
    expect(res.ok).toBe(true);
    expect(res.readOnly).toBe(true);
    expect(res.entries.map((e) => e.JadwalID)).toEqual(['JDW-KAL-D', 'JDW-KAL-A', 'JDW-KAL-B', 'JDW-KAL-C']);
    expect(res.entries.map((e) => e.Bagian)).toEqual(['Lab Farmasi', 'SGD', 'KKD', 'Ujian']);
    expect(res.entries.every((e) => e.readOnly === true)).toBe(true);
  });

  it('mengabaikan jadwal nonaktif dan tanggal kosong', async () => {
    await seed();
    const list = await computeKalenderJadwal(env.DB);
    const ids = list.map((e) => e.JadwalID);
    expect(ids).not.toContain('JDW-KAL-E');
    expect(ids).not.toContain('JDW-KAL-F');
    expect(list.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.Tanggal))).toBe(true);
  });

  it('tidak membocorkan data peserta ke kalender', async () => {
    await seed();
    const list = await computeKalenderJadwal(env.DB);
    const a = list.find((e) => e.JadwalID === 'JDW-KAL-A');
    const b = list.find((e) => e.JadwalID === 'JDW-KAL-B');
    const c = list.find((e) => e.JadwalID === 'JDW-KAL-C');
    expect(a.jumlahPeserta).toBe(1);
    expect(b.jumlahPeserta).toBe(2);
    expect(c.jumlahPeserta).toBe(0);
    expect(a.punyaBa).toBe(true);
    expect(a.baId).toBe('BA-KAL-1');
    expect(b.punyaBa).toBe(false);

    const dump = JSON.stringify(list);
    expect(dump).not.toContain('2201010001');
    expect(dump).not.toContain('Aisyah');
    expect(dump).not.toContain('"npm"');
    expect(list.some((e) => Object.prototype.hasOwnProperty.call(e, 'peserta'))).toBe(false);
  });

  it('terdaftar pada dispatchRpc dan tetap menolak tanpa token', async () => {
    await seed();
    const token = await bagianToken();
    const ok = await dispatchRpc(env.DB, 'getKalenderBagianPelaksanaan', [token], 'local', env);
    expect(ok.ok).toBe(true);
    expect(ok.entries.length).toBe(4);

    const rejected = await dispatchRpc(env.DB, 'getKalenderBagianPelaksanaan', [], 'local', env);
    expect(rejected.ok).toBe(false);
    expect(rejected.message).toBe(AUTH_ERROR);
  });
});