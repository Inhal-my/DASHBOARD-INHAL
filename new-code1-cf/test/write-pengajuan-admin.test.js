import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  updatePengajuanFields, updateDetailKegiatan, deleteDetailKegiatan,
  updatePengajuanStatus, deletePengajuanAdmin, updateCheckDataPartial, resetUploadBukti
} from '../src/write/pengajuanAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const VERIFIKATOR = 'dr. Desi Isnayanti,M.Pd.Ked';

async function adminCtx() {
  const session = { role: 'admin', nama: VERIFIKATOR };
  return { token: await createSession(env.DB, session), session, env: {} };
}

const driveEnv = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

async function adminCtxWithDrive() {
  const session = { role: 'admin', nama: VERIFIKATOR };
  return { token: await createSession(env.DB, session), session, env: driveEnv };
}

async function otherAdminCtx() {
  const session = { role: 'admin', nama: 'Admin Lain' };
  return { token: await createSession(env.DB, session), session, env: {} };
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

async function seedPengajuan({ status = 'Menunggu', nomorSurat = '', sumber = 'Portal' } = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status,nomor_surat,sumber) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','aisyah@contoh.com','0812','A','SGD',?1,?2,?3)"
  ).bind(status, nomorSurat, sumber).run();
}

async function seedDetail(jenis = 'SGD', pilihan = 'SGD 1', detail = '') {
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1',?1,?2,?3,'2026-09-20','')"
  ).bind(jenis, pilihan, detail).run();
}

describe('pengajuan admin writes', () => {
  it('requires admin', async () => {
    await expect(updatePengajuanFields(env.DB, 'INHAL-1', {}, {})).rejects.toThrow();
    await expect(updateDetailKegiatan(env.DB, 'INHAL-1', 0, {}, {})).rejects.toThrow();
    await expect(deleteDetailKegiatan(env.DB, 'INHAL-1', 0, {})).rejects.toThrow();
    await expect(updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', {})).rejects.toThrow();
    await expect(deletePengajuanAdmin(env.DB, 'INHAL-1', '', {})).rejects.toThrow();
    await expect(updateCheckDataPartial(env.DB, {}, {})).rejects.toThrow();
    await expect(resetUploadBukti(env.DB, 'INHAL-1', {}, {})).rejects.toThrow();
  });

  it('upserts check data and mirrors dosen and tanggal to the pengajuan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const ins = await updateCheckDataPartial(env.DB, {
      idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A',
      jenisKegiatan: 'SGD', pilihan: 'SGD 1', detail: '', tanggalPelaksanaan: '2026-09-21',
      dosen: 'dr. Andi', hadir: 'Ya', catatan: 'ok'
    }, ctx);
    expect(ins.success).toBe(true);
    let rows = (await env.DB.prepare('SELECT * FROM check_data WHERE id_pengajuan = ?1').bind('INHAL-1').all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0].hadir).toBe('Ya');
    let p = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Andi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-21');

    const upd = await updateCheckDataPartial(env.DB, {
      idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A',
      jenisKegiatan: 'SGD', pilihan: 'SGD 1', detail: '', tanggalPelaksanaan: '2026-09-21',
      hadir: 'Tidak'
    }, ctx);
    expect(upd.success).toBe(true);
    rows = (await env.DB.prepare('SELECT * FROM check_data WHERE id_pengajuan = ?1').bind('INHAL-1').all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0].hadir).toBe('Tidak');
    expect(rows[0].dosen).toBe('dr. Andi');
  });

  it('updates pengajuan fields and rejects bad email', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await updatePengajuanFields(env.DB, 'INHAL-1', { blok: 'B', noHp: '0899', dosen: 'dr. Andi' }, ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.blok).toBe('B');
    expect(row.no_hp_wa).toBe('0899');
    expect(row.dosen).toBe('dr. Andi');
    expect(row.updated_at).toBeTruthy();
    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE target = 'Pengajuan' AND aksi = 'UPDATE'").all();
    expect(audit.results.length).toBeGreaterThanOrEqual(1);

    const bad = await updatePengajuanFields(env.DB, 'INHAL-1', { email: 'not-an-email' }, ctx);
    expect(bad.success).toBe(false);
    expect(bad.message).toContain('email');
  });

  it('stores and clears the biaya override', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const set = await updatePengajuanFields(env.DB, 'INHAL-1', { biaya: '150000' }, ctx);
    expect(set.success).toBe(true);
    let c = await env.DB.prepare("SELECT * FROM check_data WHERE id_pengajuan = 'INHAL-1' AND detail = 'BIAYA-OVERRIDE'").all();
    expect(c.results).toHaveLength(1);
    expect(c.results[0].biaya).toBe('150000');

    const clear = await updatePengajuanFields(env.DB, 'INHAL-1', { biaya: '' }, ctx);
    expect(clear.success).toBe(true);
    c = await env.DB.prepare("SELECT * FROM check_data WHERE id_pengajuan = 'INHAL-1' AND detail = 'BIAYA-OVERRIDE'").all();
    expect(c.results).toHaveLength(0);
  });

  it('updates and deletes a detail row by index', async () => {
    await seedPengajuan();
    await seedDetail('SGD', 'SGD 1', '');
    await seedDetail('SGD', 'SGD 2', '');
    const ctx = await adminCtx();

    const upd = await updateDetailKegiatan(env.DB, 'INHAL-1', 0, { pilihan: 'SGD 9', detail: 'Baru' }, ctx);
    expect(upd.success).toBe(true);
    let rows = (await env.DB.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1 ORDER BY id').bind('INHAL-1').all()).results;
    expect(rows[0].pilihan).toBe('SGD 9');
    expect(rows[0].detail).toBe('Baru');

    const del = await deleteDetailKegiatan(env.DB, 'INHAL-1', 0, ctx);
    expect(del.success).toBe(true);
    rows = (await env.DB.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1 ORDER BY id').bind('INHAL-1').all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0].pilihan).toBe('SGD 2');

    const missing = await updateDetailKegiatan(env.DB, 'INHAL-1', 5, { pilihan: 'x' }, ctx);
    expect(missing.success).toBe(false);

    const audit = await env.DB.prepare("SELECT aksi FROM audit_log WHERE target = 'DetailKegiatan' ORDER BY id").all();
    expect(audit.results.map((r) => r.aksi)).toEqual(['UPDATE', 'DELETE']);
  });

  it('resolves bagian when a detail becomes Praktikum', async () => {
    await seedPengajuan();
    await seedDetail('SGD', 'SGD 1', '');
    const ctx = await adminCtx();
    const res = await updateDetailKegiatan(env.DB, 'INHAL-1', 0, { jenisKegiatan: 'Praktikum', pilihan: 'Lab Anatomi', detail: 'Praktikum 1' }, ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.bagian).toBe('Anatomi');
  });

  it('menolak Detail Remediasi untuk KKD/SGD', async () => {
    await seedPengajuan();
    await seedDetail('SGD', 'SGD 1', '');
    const ctx = await adminCtx();
    const res = await updateDetailKegiatan(env.DB, 'INHAL-1', 0, { detail: 'Remediasi' }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Remediasi/);
    const row = await env.DB.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.detail).toBe('');
  });
});

describe('pengajuan admin status and delete', () => {
  it('rejects an unknown status', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const bad = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Diterima', '', '', ctx);
    expect(bad.success).toBe(false);
  });

  it('menolak ACC/Tolak/Batalkan dari admin yang bukan verifikator', async () => {
    await seedPengajuan();
    const ctx = await otherAdminCtx();
    for (const status of ['ACC', 'Ditolak', 'Dibatalkan']) {
      const res = await updatePengajuanStatus(env.DB, 'INHAL-1', status, 'Catatan uji', '', ctx);
      expect(res.success).toBe(false);
      expect(res.message).toContain('verifikator');
    }
    const row = await env.DB.prepare('SELECT status FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Menunggu');
    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE aksi = 'DENY'").all();
    expect(audit.results.length).toBe(3);
  });

  it('menolak penarikan ACC ke Menunggu oleh admin yang bukan verifikator', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await otherAdminCtx();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Menunggu', 'Uji revert', '', ctx);
    expect(res.success).toBe(false);
    const row = await env.DB.prepare('SELECT status FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('ACC');
  });

  it('menolak pengembalian Ditolak/Dibatalkan ke Menunggu oleh admin lain', async () => {
    await seedPengajuan({ status: 'Ditolak' });
    const ctx = await otherAdminCtx();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Menunggu', 'Uji revert', '', ctx);
    expect(res.success).toBe(false);
    const row = await env.DB.prepare('SELECT status FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Ditolak');
  });

  it('admin lain tetap boleh memperbarui catatan tanpa mengubah status', async () => {
    await seedPengajuan({ status: 'Menunggu' });
    const ctx = await otherAdminCtx();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Menunggu', 'Catatan tambahan', '', ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT status, catatan_admin FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Menunggu');
    expect(row.catatan_admin).toBe('Catatan tambahan');
  });

  it('verifikator boleh menarik ACC kembali ke Menunggu', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await adminCtx();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Menunggu', 'Ditinjau ulang', '', ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT status FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Menunggu');
  });

  it('ACC issues a nomor surat and records history', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const ok = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', 'Berkas lengkap', '', ctx);
    expect(ok.success).toBe(true);
    expect(ok.nomorSurat).toMatch(/^\d{3}\/INHAL\/FKIK-UMSU\/[IVX]+\/\d{4}$/);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('ACC');
    expect(row.catatan_admin).toBe('Berkas lengkap');
    expect(row.nomor_surat).toBe(ok.nomorSurat);
    const hist = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind('INHAL-1').all();
    expect(hist.results.map((r) => r.status)).toEqual(['ACC']);
  });

  it('keeps the existing nomor surat on a repeated ACC', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const first = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    const second = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    expect(second.success).toBe(true);
    expect(second.nomorSurat).toBe(first.nomorSurat);
  });

  it('issues consecutive nomor surat for two ACC transitions', async () => {
    await seedPengajuan();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','budi@contoh.com','0813','A','SGD','Menunggu')"
    ).run();
    const ctx = await adminCtx();
    const first = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    const second = await updatePengajuanStatus(env.DB, 'INHAL-2', 'ACC', '', '', ctx);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.nomorSurat).not.toBe(second.nomorSurat);
    const numbers = [first.nomorSurat, second.nomorSurat].map((s) => parseInt(s.slice(0, 3), 10)).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2]);
  });

  it('rejects Ditolak/Dibatalkan without catatan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const noNote = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', '', '', ctx);
    expect(noNote.success).toBe(false);
    expect(noNote.message).toMatch(/[Cc]atatan/);
    const ok = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare('SELECT status, catatan_admin FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Ditolak');
    expect(row.catatan_admin).toBe('Berkas tidak lengkap');
  });

  it('mengirim email penolakan ber-PDF ke mahasiswa saat transisi ke Ditolak', async () => {
    await seedPengajuan();
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: 'https://drive.google.com/file/d/REJ1234567890/view' }));
    const ctx = await adminCtxWithDrive();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Email pemberitahuan Ditolak terkirim');
    expect(calls).toHaveLength(1);
    expect(calls[0].action).toBe('sendStatusEmail');
    expect(calls[0].status).toBe('Ditolak');
    expect(calls[0].recipient).toBe('aisyah@contoh.com');
    expect(calls[0].data['Catatan Admin']).toBe('Berkas tidak lengkap');
    expect(calls[0].data.AlasanPenolakan).toBe('Berkas tidak lengkap');
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Berhasil');
    expect(row.lampiran_email).toContain('REJ1234567890');
    expect(row.notifikasi_terkirim_pada).toBeTruthy();
    expect(row.status).toBe('Ditolak');
  });

  it('mengirim email pemberitahuan saat transisi ke Dibatalkan', async () => {
    await seedPengajuan();
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: 'https://drive.google.com/file/d/CAN1234567890/view' }));
    const ctx = await adminCtxWithDrive();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Dibatalkan', 'Mahasiswa mengundurkan diri', '', ctx);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Email pemberitahuan Dibatalkan terkirim');
    expect(calls[0].action).toBe('sendStatusEmail');
    expect(calls[0].status).toBe('Ditolak');
    expect(calls[0].data.Status).toBe('Dibatalkan');
    const row = await env.DB.prepare('SELECT status_notifikasi_email FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status_notifikasi_email).toBe('Berhasil');
  });

  it('tidak mengirim email ulang saat status penolakan tidak berubah', async () => {
    await seedPengajuan();
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: 'https://drive.google.com/file/d/REJ1234567890/view' }));
    const ctx = await adminCtxWithDrive();
    await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    const second = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Catatan diperbarui', '', ctx);
    expect(second.success).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('tetap memperbarui status saat email penolakan gagal dikirim', async () => {
    await seedPengajuan();
    await seedDetail();
    stubBridge(() => ({ success: false, message: 'Aksi tidak dikenal: sendStatusEmail' }));
    const ctx = await adminCtxWithDrive();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(res.success).toBe(true);
    expect(res.message).toContain('gagal');
    const row = await env.DB.prepare('SELECT status, status_notifikasi_email, error_notifikasi_email FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Ditolak');
    expect(row.status_notifikasi_email).toBe('Gagal');
    expect(row.error_notifikasi_email).toContain('Aksi tidak dikenal');
  });

  it('tidak mengirim email penolakan untuk pengajuan manual', async () => {
    await seedPengajuan({ sumber: 'Manual' });
    await seedDetail();
    const calls = stubBridge(() => ({ success: true, attachmentUrl: '' }));
    const ctx = await adminCtxWithDrive();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(0);
    expect(res.message).not.toContain('Email pemberitahuan');
  });

  it('menyinkronkan status peserta BA dan jadwal saat status berubah', async () => {
    await seedPengajuan({ status: 'ACC' });
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (ba_id,id_pengajuan,status_pengajuan) VALUES ('BA-1','INHAL-1','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (ba_id,id_pengajuan,status_pengajuan,active) VALUES ('BA-PEN-1','INHAL-1','ACC',1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO jadwal_peserta (jadwal_id,id_pengajuan,status_pengajuan) VALUES ('JDW-1','INHAL-1','ACC')"
    ).run();

    const ctx = await adminCtx();
    const res = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(res.success).toBe(true);

    const bagian = await env.DB.prepare("SELECT status_pengajuan FROM berita_acara_peserta WHERE ba_id = 'BA-1'").first();
    expect(bagian.status_pengajuan).toBe('Ditolak');
    const pendukung = await env.DB.prepare("SELECT status_pengajuan FROM berita_acara_admin_peserta WHERE ba_id = 'BA-PEN-1'").first();
    expect(pendukung.status_pengajuan).toBe('Ditolak');
    const jadwal = await env.DB.prepare("SELECT status_pengajuan FROM jadwal_peserta WHERE jadwal_id = 'JDW-1'").first();
    expect(jadwal.status_pengajuan).toBe('Ditolak');
  });

  it('deletes a pengajuan with its related rows', async () => {
    await seedPengajuan();
    await seedDetail();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-09-10T08:00:00','INHAL-1','Menunggu','','Admin')").run();
    await env.DB.prepare("INSERT INTO check_data (timestamp,check_id,id_pengajuan,detail,biaya) VALUES ('2026-09-10T08:00:00','CHK-1','INHAL-1','BIAYA-OVERRIDE','1000')").run();
    await env.DB.prepare("INSERT INTO log_upload (timestamp,id_pengajuan,npm) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001')").run();
    const ctx = await adminCtx();

    const res = await deletePengajuanAdmin(env.DB, 'INHAL-1', 'Salah input', ctx);
    expect(res.success).toBe(true);
    expect(res.deleted).toBe(4);
    for (const t of ['pengajuan', 'detail_kegiatan', 'status_history', 'check_data', 'log_upload']) {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM ' + t).first();
      expect(Number(c.n)).toBe(0);
    }
    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE target = 'Pengajuan' AND aksi = 'DELETE'").all();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0].alasan).toBe('Salah input');
  });

  it('membersihkan BA yang tidak lagi punya peserta saat pengajuan dihapus', async () => {
    await seedPengajuan();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','A','SGD','Menunggu')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,kegiatan_key) VALUES ('2026-09-20T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1')"
    ).run();
    for (const [id, npm, nama] of [['INHAL-1', '2201010001', 'Aisyah'], ['INHAL-2', '2201010002', 'Budi']]) {
      await env.DB.prepare(
        "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,active) VALUES ('2026-09-20T08:00:00','BA-PEN-2026-0001',?1,?2,?3,'A',1)"
      ).bind(id, npm, nama).run();
    }
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,page_index,file_name,file_url,active) VALUES ('2026-09-20T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',0,'a.pdf','https://drive/a',1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan) VALUES ('2026-09-20T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1')"
    ).run();
    for (const [id, npm, nama] of [['INHAL-1', '2201010001', 'Aisyah'], ['INHAL-2', '2201010002', 'Budi']]) {
      await env.DB.prepare(
        "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-20T08:00:00','BA-PEL-2026-0001',?1,?2,?3,'A')"
      ).bind(id, npm, nama).run();
    }

    const ctx = await adminCtx();
    const first = await deletePengajuanAdmin(env.DB, 'INHAL-1', 'Salah input', ctx);
    expect(first.success).toBe(true);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin WHERE ba_id='BA-PEN-2026-0001'").first()).n)).toBe(1);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id='BA-PEN-2026-0001'").first()).n)).toBe(0);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first()).n)).toBe(1);

    const second = await deletePengajuanAdmin(env.DB, 'INHAL-2', 'Salah input', ctx);
    expect(second.success).toBe(true);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin WHERE ba_id='BA-PEN-2026-0001'").first()).n)).toBe(0);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first()).n)).toBe(0);
  });
});

describe('reset upload bukti', () => {
  async function seedWithLinks(status = 'Diterima') {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,status,link_acc_inhal,link_bukti_bayar,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','aisyah@contoh.com',?1,'https://drive/acc','https://drive/bukti','https://drive/final')"
    ).bind(status).run();
    await seedDetail();
  }

  it('menolak saat status bukan ACC', async () => {
    await seedWithLinks('Menunggu');
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', {}, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ACC');
    expect(res.message).not.toContain('Diterima');
  });

  it('rejects when there is nothing to reset', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', {}, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Tidak ada berkas');
  });

  it('clears links, sets the reset flag, and records the snapshot', async () => {
    await seedWithLinks('ACC');
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', { note: 'File salah' }, ctx);
    expect(res.success).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_acc_inhal).toBe('');
    expect(row.link_bukti_bayar).toBe('');
    expect(row.link_final).toBe('');
    expect(row.upload_reset_at).toBeTruthy();
    expect(row.upload_reset_by).toBe(VERIFIKATOR);
    expect(row.upload_reset_note).toBe('File salah');
    expect(row.status).toBe('ACC');

    const log = await env.DB.prepare("SELECT * FROM log_upload WHERE id_pengajuan = 'INHAL-1'").all();
    expect(log.results).toHaveLength(1);
    expect(log.results[0].link_acc_inhal).toBe('https://drive/acc');
    expect(log.results[0].link_bukti_bayar).toBe('https://drive/bukti');

    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE aksi = 'RESET_UPLOAD'").all();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0].alasan).toBe('File salah');
  });

  it('mengembalikan status pembayaran ke belum saat bukti direset', async () => {
    await seedWithLinks('ACC');
    await env.DB.prepare("UPDATE pengajuan SET status_pembayaran = 'menunggu' WHERE id_pengajuan = 'INHAL-1'").run();
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', { note: 'Bukti salah' }, ctx);
    expect(res.success).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_bukti_bayar).toBe('');
    expect(row.status_pembayaran).toBe('belum');
  });

  it('menolak reset unggahan saat pembayaran sudah valid', async () => {
    await seedWithLinks('ACC');
    await env.DB.prepare("UPDATE pengajuan SET status_pembayaran = 'valid' WHERE id_pengajuan = 'INHAL-1'").run();
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', {}, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/valid/i);

    const row = await env.DB.prepare('SELECT link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.link_bukti_bayar).toBe('https://drive/bukti');
  });
});
