import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from '../src/read/bagian.js';

async function bagianCtx(kategoris = ['*']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: '', subBagian: '', kategoris }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,sumber) VALUES ('2026-09-10T09:00:00','BA-2026-0001','Ujian','A','UAS','2026-09-20','1','Bagian')").run();
  await env.DB.prepare("INSERT INTO berita_acara_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-10T09:00:00','BA-2026-0001','2201010001','Aisyah','A')").run();
}

describe('bagian read', () => {
  it('requires a bagian session for config', async () => {
    await expect(getBaginaConfig(env.DB, {})).rejects.toThrow();
    const cfg = await getBaginaConfig(env.DB, await bagianCtx());
    expect(cfg.categories).toEqual(['SGD', 'KKD', 'Ujian', 'Praktikum']);
    expect(Array.isArray(cfg.labOptions)).toBe(true);
  });
  it('returns bootstrap for a valid session', async () => {
    await seed();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.ok).toBe(true);
    expect(boot.rows).toHaveLength(1);
    expect(boot.rows[0].idPengajuan).toBe('INHAL-1');
    expect(boot.baList).toHaveLength(1);
    expect(boot.baList[0].peserta).toHaveLength(1);
  });
  it('menyertakan BA Pendukung admin untuk bagian terkait', async () => {
    await seed();
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,sumber) VALUES ('2026-09-11T08:00:00','BA-PEN-2026-0001','Ujian','A','UAS','2026-09-20','1','https://example.com/pen.pdf','Admin')").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-PEN-2026-0001','2201010001','Aisyah','A')").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,sumber) VALUES ('2026-09-11T09:00:00','BA-PEN-2026-0002','SGD','B','SGD 1','2026-09-21','1','Admin')").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.baPendukungList).toHaveLength(1);
    expect(boot.baPendukungList[0]['BA ID']).toBe('BA-PEN-2026-0001');
    expect(boot.baPendukungList[0].peserta).toHaveLength(1);
    expect(boot.baList[0]['BA ID']).toBe('BA-2026-0001');
  });
  it('membawa identitas peserta BA Pendukung sebagai kandidat BA Pelaksanaan', async () => {
    await seed();
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,sumber,kegiatan_key) VALUES ('2026-09-12T08:00:00','BA-PEN-2026-0003','Ujian','A','UAS','2026-09-20','2','https://example.com/pen3.pdf','Admin','')").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan,urutan,active) VALUES ('2026-09-12T08:00:00','BA-PEN-2026-0003','INHAL-1','2201010001','Aisyah','A','ACC',2,1)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan,urutan,active) VALUES ('2026-09-12T08:00:00','BA-PEN-2026-0003','INHAL-2','2201010002','Budi','A','ACC',1,1)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan,urutan,active) VALUES ('2026-09-12T08:00:00','BA-PEN-2026-0003','INHAL-3','2201010003','Cici','A','ACC',3,0)").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    const pend = boot.baPendukungList.find((r) => r['BA ID'] === 'BA-PEN-2026-0003');
    expect(pend.kegiatanKey).toBe('ujian|a|uas');
    // urutan 1 tampil lebih dulu dan peserta dengan active=0 tidak ikut.
    expect(pend.peserta.map((p) => p.idPengajuan)).toEqual(['INHAL-2', 'INHAL-1']);
    expect(pend.peserta[1].npm).toBe('2201010001');
    expect(pend.peserta[1].statusPengajuan).toBe('ACC');
  });
  it('returns bootstrap with ok=false on invalid session', async () => {
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', { token: 'nope' });
    expect(boot.ok).toBe(false);
    expect(boot.message).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
  it('returns BA list for a valid session', async () => {
    await seed();
    const list = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list).toHaveLength(1);
    expect(list[0]['BA ID']).toBe('BA-2026-0001');
  });
  it('denies BA list requests outside the session scope', async () => {
    await seed();
    const scoped = await bagianCtx(['SGD']);
    await expect(getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', scoped)).rejects.toThrow();
    await expect(getBeritaAcaraList(env.DB, '', '', scoped)).rejects.toThrow();
    const own = await getBeritaAcaraList(env.DB, 'SGD', 'SGD', scoped);
    expect(own).toHaveLength(0);
  });

  it('menandai peserta yang sudah masuk BA Pelaksanaan sebagai baMember', async () => {
    await seed();
    await env.DB.prepare("UPDATE berita_acara SET kegiatan_key='ujian|a|uas' WHERE ba_id='BA-2026-0001'").run();
    await env.DB.prepare("UPDATE berita_acara_peserta SET id_pengajuan='INHAL-1' WHERE ba_id='BA-2026-0001'").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.rows[0].baMember).toBe(true);

    await env.DB.prepare("DELETE FROM berita_acara_peserta").run();
    const boot2 = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot2.rows[0].baMember).toBe(false);
  });

  it('mengirim notifikasi peserta yang disetujui admin dashboard', async () => {
    await seed();
    const accAt = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 19);
    await env.DB.prepare("UPDATE pengajuan SET status='ACC' WHERE id_pengajuan='INHAL-1'").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-09-12T02:12:00','INHAL-1','Menunggu','Menunggu verifikasi','')").run();
    await env.DB.prepare(`INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('${accAt}','INHAL-1','ACC','Disetujui','dr. Rina Nurhaliza')`).run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.notifikasiList).toHaveLength(1);
    const n = boot.notifikasiList[0];
    expect(n.idPengajuan).toBe('INHAL-1');
    expect(n.npm).toBe('2201010001');
    expect(n.nama).toBe('Aisyah');
    expect(n.blok).toBe('A');
    expect(n.kegiatan).toBe('UAS');
    expect(n.aktor).toBe('dr. Rina Nurhaliza');
    // Waktu ISO UTC tanpa sufiks Z diberi "Z" agar bisa dikonversi ke WIB.
    expect(n.waktu).toBe(accAt + 'Z');
  });

  it('memakai ACC terakhir dan melewati pengajuan yang bukan ACC lagi', async () => {
    await seed();
    await env.DB.prepare("UPDATE pengajuan SET status='Ditolak' WHERE id_pengajuan='INHAL-1'").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-09-12T03:30:00','INHAL-1','ACC','Disetujui','Admin A')").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.notifikasiList).toHaveLength(0);
  });

  it('menggabungkan beberapa kegiatan dalam satu baris notifikasi', async () => {
    await seed();
    await env.DB.prepare("UPDATE pengajuan SET status='ACC' WHERE id_pengajuan='INHAL-1'").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','Ujian Susulan','','2026-09-21','')").run();
    const now = new Date().toISOString().slice(0, 19);
    await env.DB.prepare(`INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('${now}','INHAL-1','ACC','Disetujui','Admin C')`).run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.notifikasiList).toHaveLength(1);
    expect(boot.notifikasiList[0].kegiatan).toBe('UAS, Ujian Susulan');
  });

  it('mengabaikan ACC di luar cakupan Bagian dan di luar 30 hari', async () => {
    await seed();
    await env.DB.prepare("UPDATE pengajuan SET status='ACC' WHERE id_pengajuan='INHAL-1'").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-09-12T03:30:00','INHAL-LAIN','ACC','Disetujui','Admin A')").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2020-01-01T00:00:00','INHAL-1','ACC','Lama','Admin B')").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.notifikasiList).toHaveLength(0);

    await env.DB.prepare("DELETE FROM status_history WHERE id_pengajuan='INHAL-1'").run();
    const now = new Date().toISOString().slice(0, 19);
    await env.DB.prepare(`INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('${now}','INHAL-1','ACC','Baru','Admin C')`).run();
    const boot2 = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot2.notifikasiList).toHaveLength(1);
    expect(boot2.notifikasiList[0].aktor).toBe('Admin C');
    expect(boot2.notifikasiList[0].waktu.endsWith('Z')).toBe(true);
  });
});
