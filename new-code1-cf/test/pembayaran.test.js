import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { verifyPembayaran, correctPembayaran } from '../src/write/pembayaran.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Rani' }), env: {} };
}

async function seedPengajuan(extra = {}) {
  const row = {
    status: 'ACC',
    jenis: 'SGD',
    linkBukti: 'https://drive.example/bukti.pdf',
    linkFinal: '',
    statusPembayaran: 'menunggu',
    ...extra
  };
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status,link_bukti_bayar,link_final,status_pembayaran) VALUES ('2026-10-01T08:00:00','INHAL-1','2201010001','Siti','siti@contoh.com','0812','A',?1,?2,?3,?4,?5)"
  ).bind(row.jenis, row.status, row.linkBukti, row.linkFinal, row.statusPembayaran).run();
  await env.DB.prepare(
    "INSERT INTO check_data (timestamp,check_id,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,dosen,hadir,catatan,updated_at,biaya) VALUES ('2026-10-01T08:00:00','CHK-1','INHAL-1','2201010001','Siti','A','SGD','','BIAYA-OVERRIDE','','','','','2026-10-01T08:00:00','350000')"
  ).run();
}

function verifyPayload(over = {}) {
  return {
    idPengajuan: 'INHAL-1',
    nominal: 300000,
    tanggal: '2026-10-20',
    metode: 'Transfer Mandiri',
    kesesuaian: 'kurang',
    catatan: 'Kurang bayar disetujui.',
    expectedRevision: 0,
    ...over
  };
}

describe('pembayaran verification schema', () => {
  it('has payment columns and revision table', async () => {
    const cols = (await env.DB.prepare('PRAGMA table_info(pengajuan)').all()).results.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining([
      'status_pembayaran', 'kesesuaian_pembayaran', 'nominal_dibayar',
      'tanggal_bayar', 'metode_bayar', 'catatan_verifikasi',
      'verified_at', 'verified_by', 'payment_revision'
    ]));
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pembayaran_revisi'").first();
    expect(table).toBeTruthy();
  });
});

describe('payment read model', () => {
  it('exposes payment fields, the final flag and revision history', async () => {
    await seedPengajuan();
    await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    await env.DB.prepare("UPDATE pengajuan SET link_final = 'https://drive.example/final.pdf' WHERE id_pengajuan = 'INHAL-1'").run();

    const boot = await getLaporanBootstrap(env.DB, await adminCtx());
    const row = boot.rows.find((r) => r.pengajuan['ID Pengajuan'] === 'INHAL-1');
    expect(row.pengajuan['Status Pembayaran']).toBe('valid');
    expect(row.pengajuan['Kesesuaian Pembayaran']).toBe('kurang');
    expect(row.pengajuan['Nominal Dibayar']).toBe(300000);
    expect(row.pengajuan['Verified By']).toBe('Rani');
    expect(row.pengajuan['Payment Revision']).toBe(1);
    expect(row.pengajuan['Pembayaran Final']).toBe(true);
    expect(boot.pembayaranRevisi).toHaveLength(1);
    expect(boot.pembayaranRevisi[0]).toMatchObject({ idPengajuan: 'INHAL-1', revision: 1, mode: 'verifikasi', actor: 'Rani' });
  });
});

describe('verifyPembayaran', () => {
  it('requires admin', async () => {
    await seedPengajuan();
    await expect(verifyPembayaran(env.DB, verifyPayload(), {})).rejects.toThrow();
  });

  it('marks a payment valid and records a revision', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 1 });

    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status_pembayaran).toBe('valid');
    expect(p.kesesuaian_pembayaran).toBe('kurang');
    expect(p.nominal_dibayar).toBe(300000);
    expect(p.verified_by).toBe('Rani');
    expect(p.verified_at).toBeTruthy();
    expect(p.payment_revision).toBe(1);

    const revs = (await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1' ORDER BY revision").all()).results;
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ mode: 'verifikasi', status_lama: 'menunggu', status_baru: 'valid', kesesuaian_baru: 'kurang', nominal_baru: 300000, actor: 'Rani' });
  });

  it('rejects a kesesuaian that does not match the nominal', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ kesesuaian: 'pas' }), await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/kesesuaian/i);
  });

  it('verifies a payment that already has ACC Final', async () => {
    await seedPengajuan({ linkFinal: 'https://drive.example/final.pdf' });
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 1 });
  });

  it('verifies a payment whose participant is already in a BA', async () => {
    await seedPengajuan();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,label,jadwal_id) VALUES ('2026-10-01T08:00:00','BA-1','A','A','SGD','2026-10-02','08:00','','1','','', '','','','','')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan) VALUES ('2026-10-01T08:00:00','BA-1','INHAL-1','2201010001','Siti','A','A','ACC')"
    ).run();
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 1 });
  });

  it('rejects a stale revision', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    await verifyPembayaran(env.DB, verifyPayload(), ctx);
    const res = await verifyPembayaran(env.DB, verifyPayload(), ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/valid|diubah/i);
  });
});

describe('correctPembayaran', () => {
  async function verified() {
    await seedPengajuan();
    const ctx = await adminCtx();
    await verifyPembayaran(env.DB, verifyPayload(), ctx);
    return ctx;
  }

  it('keeps a valid payment valid after an administrative correction', async () => {
    const ctx = await verified();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      metode: 'Transfer BNI',
      tanggal: '2026-10-21',
      catatan: 'Metode diperbaiki.',
      alasan: 'Salah pilih metode transfer',
      expectedRevision: 1
    }, ctx);
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 2 });

    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status_pembayaran).toBe('valid');
    expect(p.metode_bayar).toBe('Transfer BNI');
    expect(p.kesesuaian_pembayaran).toBe('kurang');
    expect(p.payment_revision).toBe(2);
    const rev = await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1' AND revision = 2").first();
    expect(rev).toMatchObject({ mode: 'administratif', alasan: 'Salah pilih metode transfer', status_lama: 'valid', status_baru: 'valid' });
  });

  it('reopens a valid payment back to the queue', async () => {
    const ctx = await verified();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'buka_kembali',
      alasan: 'Bukti ternyata milik peserta lain',
      expectedRevision: 1
    }, ctx);
    expect(res).toMatchObject({ success: true, status: 'menunggu', revision: 2 });

    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status_pembayaran).toBe('menunggu');
    expect(p.verified_by).toBe('');
    expect(p.verified_at).toBe('');
    const rev = await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1' AND revision = 2").first();
    expect(rev).toMatchObject({ mode: 'buka_kembali', status_lama: 'valid', status_baru: 'menunggu' });
  });

  it('corrects a payment that already has ACC Final', async () => {
    await seedPengajuan({ linkFinal: 'https://drive.example/final.pdf' });
    const ctx = await adminCtx();
    await verifyPembayaran(env.DB, verifyPayload(), ctx);
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      metode: 'Transfer BNI',
      alasan: 'Salah pilih metode transfer',
      expectedRevision: 1
    }, ctx);
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 2 });
  });

  it('requires a reason', async () => {
    const ctx = await verified();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      metode: 'Transfer BNI',
      alasan: '',
      expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/alasan/i);
  });

  it('rejects an administrative correction that changes the nominal', async () => {
    const ctx = await verified();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      nominal: 250000,
      alasan: 'Nominal berubah',
      expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/buka kembali|nominal/i);
  });

  it('rejects a stale revision', async () => {
    const ctx = await verified();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      metode: 'Transfer BNI',
      alasan: 'Salah metode',
      expectedRevision: 0
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/diubah/i);
  });
});
