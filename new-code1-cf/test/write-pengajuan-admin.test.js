import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  updatePengajuanFields, updateDetailKegiatan, deleteDetailKegiatan,
  updatePengajuanStatus, deletePengajuanAdmin, syncLogDataToPengajuan, updateCheckDataPartial
} from '../src/write/pengajuanAdmin.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function seedPengajuan({ status = 'Menunggu', nomorSurat = '' } = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status,nomor_surat) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','aisyah@contoh.com','0812','A','SGD',?1,?2)"
  ).bind(status, nomorSurat).run();
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
    await expect(syncLogDataToPengajuan(env.DB, {})).rejects.toThrow();
    await expect(updateCheckDataPartial(env.DB, {}, {})).rejects.toThrow();
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
});

describe('pengajuan admin status and delete', () => {
  it('rejects an invalid status and applies a valid one with history', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const bad = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ngawur', '', '', ctx);
    expect(bad.success).toBe(false);

    const ok = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Diterima', 'Berkas lengkap', '', ctx);
    expect(ok.success).toBe(true);
    expect(ok.nomorSurat).toMatch(/^\d{3}\/INHAL\/FKIK-UMSU\/[IVX]+\/\d{4}$/);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Diterima');
    expect(row.catatan_admin).toBe('Berkas lengkap');
    expect(row.nomor_surat).toBe(ok.nomorSurat);
    const hist = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind('INHAL-1').all();
    expect(hist.results).toHaveLength(1);
    expect(hist.results[0].status).toBe('Diterima');
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
});

describe('sync log data', () => {
  it('reports when there is nothing to sync', async () => {
    const ctx = await adminCtx();
    const res = await syncLogDataToPengajuan(env.DB, ctx);
    expect(res.success).toBe(true);
    expect(res.report.total).toBe(0);
  });

  it('creates a pengajuan from a stored log row and skips duplicates', async () => {
    const payload = {
      'ID Pengajuan': 'INHAL-OLD-1', NPM: '2201010002', 'Nama Lengkap': 'Budi',
      'Email': 'budi@contoh.com', Blok: 'B', 'Jenis Kegiatan': 'SGD', Status: 'Diterima',
      'Pilihan SGD': 'SGD 1', 'Detail SGD': 'Materi A', 'Tanggal SGD': '2026-08-01'
    };
    await env.DB.prepare("INSERT INTO log_data (timestamp,payload) VALUES ('2026-08-01T08:00:00',?1)").bind(JSON.stringify(payload)).run();
    const ctx = await adminCtx();

    const res = await syncLogDataToPengajuan(env.DB, ctx);
    expect(res.success).toBe(true);
    expect(res.report.created).toBe(1);
    const p = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-OLD-1').first();
    expect(p).toBeTruthy();
    expect(p.status).toBe('Diterima');
    const d = await env.DB.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind('INHAL-OLD-1').all();
    expect(d.results).toHaveLength(1);
    expect(d.results[0].pilihan).toBe('SGD 1');

    const again = await syncLogDataToPengajuan(env.DB, ctx);
    expect(again.report.created).toBe(0);
    expect(again.report.skipped).toBe(1);
  });
});
