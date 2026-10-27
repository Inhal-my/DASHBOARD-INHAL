import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';
import { saveBeritaAcaraAdmin } from '../src/write/beritaAcara.js';

describe('getLaporanBootstrap', () => {
  it('summarizes pengajuan with biaya and BA', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,dosen,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','ACC','dr. Andi','https://x/final')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Ujian','Rp. 300.000')").run();
    const ctx = { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
    const boot = await getLaporanBootstrap(env.DB, ctx);
    expect(boot.summary.totalPendaftar).toBe(1);
    expect(boot.summary.totalAcc).toBe(1);
    expect(boot.summary.totalBiaya).toBe(300000);
    expect(boot.rows[0].pengajuan['ID Pengajuan']).toBe('INHAL-1');
    expect(boot.rows[0].details).toHaveLength(1);
    expect(boot.dosen).toContain('dr. Andi');
    expect(boot.dosenOptions).toContain('dr. Andi');
    expect(boot.blok).toContain('A');
    expect(boot.bagian.labs).toContain('Lab Anatomi');
  });

  it('mengembalikan unit kegiatan dengan progres', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,catatan,sumber,kegiatan_key) VALUES ('2026-09-11T08:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','08:00','dr. Andi','1','http://ba','','Bagian','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-2026-0001','INHAL-1','2201010001','Aisyah','A')"
    ).run();
    const data = await getLaporanBootstrap(env.DB, { token });
    expect(Array.isArray(data.kegiatan)).toBe(true);
    const unit = data.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(unit).toBeTruthy();
    expect(unit.progress.final).toBe('all');
    expect(unit.baPelaksanaan).toHaveLength(1);
    expect(unit.progress.selesai).toBe('all');
  });

  it('menautkan BA Pendukung yang nama kegiatannya memakai em-dash', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','Remediasi','2026-09-20','')"
    ).run();
    const saved = await saveBeritaAcaraAdmin(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1 — Remediasi', tanggalPelaksanaan: '2026-09-20',
      jenis: 'SGD', pilihan: 'SGD 1', detail: 'Remediasi', catatan: ''
    }, { token });
    expect(saved.success).toBe(true);

    const data = await getLaporanBootstrap(env.DB, { token });
    const unit = data.kegiatan.find((u) => u.key === 'sgd|a|sgd 1 - remediasi');
    expect(unit).toBeTruthy();
    expect(unit.baPendukung).toHaveLength(1);
    expect(unit.progress.pendukung).toBe('all');
  });

  it("final mengikuti keanggotaan BA Pelaksanaan, bukan link_final", async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
    ).run();
    const before = await getLaporanBootstrap(env.DB, { token });
    const u0 = before.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(u0.peserta[0].masukBa).toBe(false);
    expect(u0.progress.final).toBe('none');

    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,catatan,sumber,kegiatan_key) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-09-20','08:00','dr. Andi','1','http://ba','','Bagian','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','INHAL-1','2201010001','Aisyah','A')"
    ).run();
    const after = await getLaporanBootstrap(env.DB, { token });
    const u1 = after.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(u1.peserta[0].masukBa).toBe(true);
    expect(u1.progress.final).toBe('all');
  });

  it('menandai BA Pelaksanaan multi-sesi pada unit dan ringkasan', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,catatan,sumber,kegiatan_key) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-09-20','08:00','dr. Andi','1','http://ba1','','Bagian','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,catatan,sumber,kegiatan_key) VALUES ('2026-09-12T08:00:00','BA-PEL-2026-0002','SGD','A','SGD 1','2026-09-21','13:00','dr. Andi','1','http://ba2','','Bagian','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','INHAL-1','2201010001','Aisyah','A')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-12T08:00:00','BA-PEL-2026-0002','INHAL-1','2201010001','Aisyah','A')"
    ).run();

    const data = await getLaporanBootstrap(env.DB, { token });
    const unit = data.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(unit.baAudit.jumlahSesi).toBe(2);
    expect(unit.baAudit.status).toBe('Multi-sesi');
    expect(unit.baAudit.sesi.map((s) => s.baId)).toEqual(['BA-PEL-2026-0001', 'BA-PEL-2026-0002']);
    expect(data.baAudit.summary.multiSesi).toBe(1);
    expect(data.baAudit.summary.totalSesi).toBe(2);
  });
});

describe('waktu unggah bukti bayar', () => {
  async function seedBukti(link, extra = {}) {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_bukti_bayar,status_pembayaran,upload_reset_at) " +
      "VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC',?1,'menunggu',?2)"
    ).bind(link, extra.uploadResetAt || '').run();
  }

  async function seedLog(timestamp, linkBukti, linkAcc = '') {
    await env.DB.prepare(
      "INSERT INTO log_upload (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,detail,tanggal,link_acc_inhal,link_bukti_bayar) " +
      "VALUES (?1,'INHAL-1','2201010001','Aisyah','A','SGD','','',?3,?2)"
    ).bind(timestamp, linkBukti, linkAcc).run();
  }

  it('mengambil unggahan terakhir dari berkas yang sedang dipakai', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const aktif = 'https://drive.example/file/d/AAAAAAAAAAAAAAAAAAAAA/view';
    const lama = 'https://drive.example/file/d/BBBBBBBBBBBBBBBBBBBBB/view';
    await seedBukti(aktif);
    await seedLog('2026-09-11T08:00:00', lama);
    await seedLog('2026-09-12T09:30:00', aktif);
    await seedLog('2026-09-13T10:00:00', aktif);

    const data = await getLaporanBootstrap(env.DB, { token });
    const up = data.uploadBukti.find((u) => u.idPengajuan === 'INHAL-1');
    expect(up.waktuUploadBukti).toBe('2026-09-13T10:00:00');
    expect(up.sumberUpload).toBe('Portal Mahasiswa');
  });

  it('tidak memakai baris log dari berkas lain', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await seedBukti('https://drive.example/file/d/CCCCCCCCCCCCCCCCCCCCC/view');
    await seedLog('2026-09-12T09:30:00', 'https://drive.example/file/d/DDDDDDDDDDDDDDDDDDDDD/view');

    const data = await getLaporanBootstrap(env.DB, { token });
    const up = data.uploadBukti.find((u) => u.idPengajuan === 'INHAL-1');
    expect(up.waktuUploadBukti).toBe('');
    expect(up.sumberUpload).toBe('');
  });

  it('mengabaikan penanda reset dan unggahan sebelum reset', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const link = 'https://drive.example/file/d/EEEEEEEEEEEEEEEEEEEEE/view';
    await seedBukti(link, { uploadResetAt: '2026-09-14T11:00:00' });
    await seedLog('2026-09-12T09:30:00', link);
    await seedLog('2026-09-14T11:00:00', link);
    await seedLog('2026-09-15T08:15:00', link);

    const data = await getLaporanBootstrap(env.DB, { token });
    const up = data.uploadBukti.find((u) => u.idPengajuan === 'INHAL-1');
    expect(up.waktuUploadBukti).toBe('2026-09-15T08:15:00');
  });

  it('mengosongkan waktu unggah bila semua log terjadi sebelum reset', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const link = 'https://drive.example/file/d/GGGGGGGGGGGGGGGGGGGGG/view';
    await seedBukti(link, { uploadResetAt: '2026-09-14T11:00:00' });
    await seedLog('2026-09-12T09:30:00', link);
    await seedLog('2026-09-14T11:00:00', link);

    const data = await getLaporanBootstrap(env.DB, { token });
    const up = data.uploadBukti.find((u) => u.idPengajuan === 'INHAL-1');
    expect(up.waktuUploadBukti).toBe('');
  });

  it('mengosongkan waktu unggah saat belum ada jejak log (data lama)', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await seedBukti('https://drive.example/file/d/FFFFFFFFFFFFFFFFFFFFF/view');

    const data = await getLaporanBootstrap(env.DB, { token });
    const up = data.uploadBukti.find((u) => u.idPengajuan === 'INHAL-1');
    expect(up).toMatchObject({ waktuUploadBukti: '', sumberUpload: '' });
  });
});
