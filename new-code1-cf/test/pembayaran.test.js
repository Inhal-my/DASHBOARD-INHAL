import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { verifyPembayaran, correctPembayaran, gratiskanPembayaran } from '../src/write/pembayaran.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

afterEach(() => { vi.unstubAllGlobals(); });

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Rani' }), env: {} };
}

async function adminCtxWithDrive() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Rani' }), env: driveEnv };
}

function stubBridge(handler) {
  const calls = [];
  const f = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return new Response(JSON.stringify(handler(body)), { status: 200 });
  });
  vi.stubGlobal('fetch', f);
  return calls;
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

  it('memakai biaya dari Detail bila tanpa override', async () => {
    await seedPengajuan();
    await env.DB.prepare("DELETE FROM check_data WHERE id_pengajuan = 'INHAL-1'").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Inhal','Rp. 250.000')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('SGD','Rp. 100.000')").run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan) VALUES ('2026-10-01T08:00:00','INHAL-1','SGD','SGD 1','Inhal','2026-10-02')"
    ).run();
    const res = await verifyPembayaran(env.DB, verifyPayload({ nominal: 250000, kesesuaian: 'pas' }), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid' });
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.kesesuaian_pembayaran).toBe('pas');
    expect(p.nominal_dibayar).toBe(250000);
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

  it('mengirim email final setelah pembayaran divalidasi', async () => {
    await seedPengajuan();
    const calls = stubBridge(() => ({
      success: true,
      pdfUrl: 'https://drive.google.com/file/d/FINAL1234567890/view',
      studentEmailSent: true,
      bagianEmailSent: true
    }));
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtxWithDrive());
    expect(res).toMatchObject({ success: true, status: 'valid' });
    expect(res.notification).toMatchObject({ ok: true });
    expect(calls[0].action).toBe('sendFinalEmail');
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.link_final).toContain('FINAL1234567890');
  });

  it('tetap valid walau pengiriman email final gagal', async () => {
    await seedPengajuan();
    stubBridge(() => ({ success: false, message: 'Layanan email sibuk' }));
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtxWithDrive());
    expect(res).toMatchObject({ success: true, status: 'valid' });
    expect(res.notification).toMatchObject({ ok: false });
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status_pembayaran).toBe('valid');
    expect(p.link_final || '').toBe('');
  });

  it('rejects a kesesuaian that does not match the nominal', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ kesesuaian: 'pas' }), await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/kesesuaian/i);
  });

  it('menjelaskan nominal dan pilihan kesesuaian yang benar saat tidak cocok', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ nominal: 400000, kesesuaian: 'kurang' }), await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toContain('lebih dari');
    expect(res.message).toContain('Lebih');
  });

  it('menerima pilihan Lebih dengan nominal manual di atas tagihan', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ nominal: 400000, kesesuaian: 'lebih' }), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 1 });
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.kesesuaian_pembayaran).toBe('lebih');
    expect(p.nominal_dibayar).toBe(400000);
  });

  it('menerima pilihan Pas saat nominal sama dengan tagihan', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ nominal: 350000, kesesuaian: 'pas' }), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', revision: 1 });
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.kesesuaian_pembayaran).toBe('pas');
    expect(p.nominal_dibayar).toBe(350000);
  });

  it('menormalkan pilihan Kesesuaian berhuruf besar dari panel admin', async () => {
    await seedPengajuan();
    const res = await verifyPembayaran(env.DB, verifyPayload({ kesesuaian: 'Kurang' }), await adminCtx());
    expect(res.success).toBe(true);
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.kesesuaian_pembayaran).toBe('kurang');
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

  it('menolak verifikasi saat pengajuan belum ACC', async () => {
    await seedPengajuan({ status: 'Menunggu' });
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/ACC/);
    const p = await env.DB.prepare("SELECT status_pembayaran FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status_pembayaran).toBe('menunggu');
  });

  it('memvalidasi pembayaran pengajuan Disetujui dan menaikkan status ke ACC', async () => {
    await seedPengajuan({ status: 'Disetujui' });
    const res = await verifyPembayaran(env.DB, verifyPayload(), await adminCtx());
    expect(res).toMatchObject({ success: true, status: 'valid', pengajuanStatus: 'ACC' });
    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status).toBe('ACC');
    expect(p.status_pembayaran).toBe('valid');
    const hist = await env.DB.prepare("SELECT * FROM status_history WHERE id_pengajuan = 'INHAL-1'").all();
    expect(hist.results.map((r) => r.status)).toEqual(['ACC']);
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
    expect(p.status).toBe('Disetujui');
    expect(p.status_pembayaran).toBe('menunggu');
    expect(p.verified_by).toBe('');
    expect(p.verified_at).toBe('');
    expect(p.link_final).toBe('');
    const rev = await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1' AND revision = 2").first();
    expect(rev).toMatchObject({ mode: 'buka_kembali', status_lama: 'valid', status_baru: 'menunggu' });
  });

  it('menolak buka kembali bila peserta sudah masuk jadwal atau BA', async () => {
    const ctx = await verified();
    await env.DB.prepare(
      "INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-10-01T08:00:00','JDW-1','INHAL-1','2201010001','Siti','A','ACC')"
    ).run();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'buka_kembali',
      alasan: 'Bukti perlu dicek ulang',
      expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/jadwal atau Berita Acara/);
    const p = await env.DB.prepare("SELECT status, status_pembayaran FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status).toBe('ACC');
    expect(p.status_pembayaran).toBe('valid');
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

  it('menolak koreksi saat pengajuan tidak lagi ACC', async () => {
    const ctx = await verified();
    await env.DB.prepare("UPDATE pengajuan SET status = 'Dibatalkan' WHERE id_pengajuan = 'INHAL-1'").run();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1',
      mode: 'administratif',
      metode: 'Transfer BNI',
      alasan: 'Salah metode',
      expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/ACC/);
  });
});

describe('gratiskanPembayaran', () => {
  it('requires admin', async () => {
    await seedPengajuan();
    await expect(gratiskanPembayaran(env.DB, { idPengajuan: 'INHAL-1', expectedRevision: 0 }, {})).rejects.toThrow();
  });

  it('menetapkan gratis: ACC, biaya Rp 0, dan mengirim surat final', async () => {
    await seedPengajuan();
    const calls = stubBridge(() => ({
      success: true,
      pdfUrl: 'https://drive.google.com/file/d/GRATIS123456789/view',
      studentEmailSent: true,
      bagianEmailSent: true
    }));
    const res = await gratiskanPembayaran(env.DB, {
      idPengajuan: 'INHAL-1', catatan: 'Dibebaskan biaya', expectedRevision: 0
    }, await adminCtxWithDrive());
    expect(res).toMatchObject({ success: true, status: 'gratis', pengajuanStatus: 'ACC', revision: 1 });
    expect(calls[0].action).toBe('sendFinalEmail');

    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status).toBe('ACC');
    expect(p.status_pembayaran).toBe('gratis');
    expect(p.kesesuaian_pembayaran).toBe('gratis');
    expect(p.nominal_dibayar).toBe(0);
    expect(p.catatan_verifikasi).toBe('Dibebaskan biaya');
    expect(p.link_final).toContain('GRATIS123456789');

    const override = await env.DB.prepare("SELECT biaya FROM check_data WHERE id_pengajuan = 'INHAL-1' AND detail = 'BIAYA-OVERRIDE'").first();
    expect(String(override && override.biaya)).toBe('0');

    const rev = await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1'").first();
    expect(rev).toMatchObject({ mode: 'gratis', status_lama: 'menunggu', status_baru: 'gratis', kesesuaian_baru: 'gratis', nominal_baru: 0, actor: 'Rani' });
  });

  it('menolak gratis bila pembayaran sudah valid', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    await verifyPembayaran(env.DB, verifyPayload(), ctx);
    const res = await gratiskanPembayaran(env.DB, { idPengajuan: 'INHAL-1', expectedRevision: 1 }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/valid/i);
  });

  it('menolak gratis saat revision sudah berubah', async () => {
    await seedPengajuan();
    const res = await gratiskanPembayaran(env.DB, { idPengajuan: 'INHAL-1', expectedRevision: 9 }, await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/diubah/i);
  });

  it('menolak gratis untuk pengajuan yang belum Disetujui/ACC', async () => {
    await seedPengajuan({ status: 'Menunggu' });
    const res = await gratiskanPembayaran(env.DB, { idPengajuan: 'INHAL-1', expectedRevision: 0 }, await adminCtx());
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Disetujui atau ACC/);
  });
});

describe('correctPembayaran batalkan gratis', () => {
  async function gratis() {
    await seedPengajuan();
    const ctx = await adminCtx();
    await gratiskanPembayaran(env.DB, { idPengajuan: 'INHAL-1', expectedRevision: 0 }, ctx);
    return ctx;
  }

  it('mengembalikan biaya ke MasterBiaya dan status ke Disetujui', async () => {
    const ctx = await gratis();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1', mode: 'batal_gratis', alasan: 'Salah menandai gratis', expectedRevision: 1
    }, ctx);
    expect(res).toMatchObject({ success: true, status: 'menunggu', pengajuanStatus: 'Disetujui', revision: 2 });

    const p = await env.DB.prepare("SELECT * FROM pengajuan WHERE id_pengajuan = 'INHAL-1'").first();
    expect(p.status).toBe('Disetujui');
    expect(p.status_pembayaran).toBe('menunggu');
    expect(p.kesesuaian_pembayaran).toBe('');
    expect(p.nominal_dibayar).toBeNull();
    expect(p.link_final).toBe('');

    const override = await env.DB.prepare("SELECT COUNT(*) AS n FROM check_data WHERE id_pengajuan = 'INHAL-1' AND detail = 'BIAYA-OVERRIDE'").first();
    expect(Number(override.n)).toBe(0);

    const rev = await env.DB.prepare("SELECT * FROM pembayaran_revisi WHERE id_pengajuan = 'INHAL-1' AND revision = 2").first();
    expect(rev).toMatchObject({ mode: 'batal_gratis', status_lama: 'gratis', status_baru: 'menunggu' });
  });

  it('menolak mode administratif untuk pembayaran gratis', async () => {
    const ctx = await gratis();
    const res = await correctPembayaran(env.DB, {
      idPengajuan: 'INHAL-1', mode: 'administratif', metode: 'X', alasan: 'Salah metode', expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Batalkan Gratis/i);
  });
});
