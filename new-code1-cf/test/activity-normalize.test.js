import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  getActivityLog, normalizeAudit, normalizeStatus, normalizeUpload, dedupeUploadRows,
  mergeAndSort, filterEvents, summarize, initials, parseDetail, wibRange, jenisInGroup
} from '../src/read/activity.js';
import { dispatchRpc } from '../src/rpc.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Devi' }) };
}

function audit(over) {
  return Object.assign({
    id: 1, timestamp: '2026-11-05T08:17:06', actor_email: 'Devi',
    aksi: 'UPDATE', target: 'Pengajuan', detail: '{"idPengajuan":"INHAL-1","Email":"a@b.c"}', alasan: 'Pemeliharaan'
  }, over);
}

describe('normalisasi audit_log', () => {
  it('memetakan aksi UPDATE pengajuan', () => {
    const e = normalizeAudit(audit({}));
    expect(e.jenis).toBe('UpdatePengajuan');
    expect(e.targetJenis).toBe('Pengajuan');
    expect(e.targetId).toBe('INHAL-1');
    expect(e.sumber).toBe('audit_log');
    expect(e.sesudah).toEqual({ Email: 'a@b.c' });
    expect(e.aktor).toBe('Devi');
    expect(e.aktorRole).toBe('Admin');
  });

  it('memetakan verifikasi pembayaran', () => {
    const e = normalizeAudit(audit({ aksi: 'VERIFY', target: 'Pembayaran', detail: '{"idPengajuan":"INHAL-2","nominal":250000,"kesesuaian":"pas"}' }));
    expect(e.jenis).toBe('VerifyBayar');
    expect(e.meta.nominal).toBe(250000);
    expect(e.sebelum).toEqual({ status: 'menunggu' });
    expect(e.sesudah).toEqual({ status: 'valid', nominal: 250000 });
    expect(e.ringkasan).toContain('Rp250.000');
  });

  it('memetakan BA dan master rename', () => {
    const ba = normalizeAudit(audit({ aksi: 'BA_CREATE', target: 'BA-PEL-2026-0001', detail: '{"jenis":"Pelaksanaan","jumlahPeserta":2}' }));
    expect(ba.jenis).toBe('BaCreate');
    expect(ba.targetJenis).toBe('Berita Acara');
    expect(ba.targetId).toBe('BA-PEL-2026-0001');
    const rn = normalizeAudit(audit({ aksi: 'RENAME_MASTER', target: 'Blok: A -> B', detail: '{}' }));
    expect(rn.jenis).toBe('RenameMaster');
    expect(rn.sebelum).toEqual({ nilai: 'A' });
    expect(rn.sesudah).toEqual({ nilai: 'B' });
  });

  it('menoleransi detail berupa teks biasa', () => {
    const e = normalizeAudit(audit({ aksi: 'FILE_ACCESS', target: 'up-1', detail: 'Akses berkas bukti.pdf' }));
    expect(e.jenis).toBe('FileAccess');
    expect(e.meta.berkas).toBe('bukti.pdf');
    expect(() => normalizeAudit(audit({ detail: 'bukan json' }))).not.toThrow();
    expect(parseDetail('bukan json').json).toBe(false);
  });

  it('menandai verifikator sesuai policy', () => {
    const e = normalizeAudit(audit({ actor_email: 'dr. Desi Isnayanti,M.Pd.Ked' }));
    expect(e.aktorRole).toBe('Verifikator');
  });
});

describe('normalisasi status_history', () => {
  it('mengisi status sebelumnya per pengajuan', () => {
    const first = normalizeStatus({ id: 1, timestamp: '2026-11-01T01:00:00', id_pengajuan: 'INHAL-1', status: 'Menunggu', catatan: '', actor_email: 'Devi' });
    const second = normalizeStatus({ id: 2, timestamp: '2026-11-02T01:00:00', id_pengajuan: 'INHAL-1', status: 'ACC', catatan: 'Lengkap', actor_email: 'dr. Desi Isnayanti,M.Pd.Ked' }, 'Menunggu');
    expect(first.jenis).toBe('Menunggu');
    expect(second.jenis).toBe('ACC');
    expect(second.sebelum).toEqual({ status: 'Menunggu' });
    expect(second.alasan).toBe('Lengkap');
    expect(second.aktorRole).toBe('Verifikator');
  });

  it('memetakan Ditolak dan Dibatalkan', () => {
    expect(normalizeStatus({ id: 3, timestamp: 't', id_pengajuan: 'X', status: 'Ditolak', actor_email: 'A' }).jenis).toBe('Tolak');
    expect(normalizeStatus({ id: 4, timestamp: 't', id_pengajuan: 'X', status: 'Dibatalkan', actor_email: 'A' }).jenis).toBe('Batal');
  });
});

describe('normalisasi log_upload', () => {
  const row = {
    id: 9, timestamp: '2026-11-05T02:00:00', id_pengajuan: 'INHAL-3', npm: '2201010001',
    nama_lengkap: 'Aisyah', blok: 'A', jenis_kegiatan: 'Ujian', detail: 'UAS',
    tanggal: '2026-11-20', link_acc_inhal: '', link_bukti_bayar: 'https://drive.google.com/file/d/abc123/view'
  };

  it('membedakan unggahan mahasiswa dan admin', () => {
    const mhs = normalizeUpload(row);
    expect(mhs.jenis).toBe('UploadMahasiswa');
    expect(mhs.aktor).toBe('Aisyah');
    expect(mhs.aktorRole).toBe('Mahasiswa');
    expect(mhs.meta.berkas).toBe('abc123');

    const admin = normalizeUpload(Object.assign({}, row, { detail: 'Unggah bukti bayar oleh admin' }));
    expect(admin.jenis).toBe('UploadAdmin');
    expect(admin.aktor).toBe('Admin');
  });

  it('memakai aktor audit_log pasangan bila tersedia', () => {
    const e = normalizeUpload(Object.assign({}, row, { detail: 'Unggah bukti bayar oleh admin' }), { actor_email: 'Yudha' });
    expect(e.aktor).toBe('Yudha');
  });
});

describe('dedupe dan merge', () => {
  it('membuang log_upload yang berpasangan dengan audit dalam 10 detik', () => {
    const uploads = [
      { id: 1, timestamp: '2026-11-05T08:00:00', id_pengajuan: 'INHAL-1', detail: 'Unggah bukti bayar oleh admin' },
      { id: 2, timestamp: '2026-11-05T09:00:00', id_pengajuan: 'INHAL-1', detail: 'UAS' }
    ];
    const audits = [
      { aksi: 'UPLOAD_BUKTI_ADMIN', timestamp: '2026-11-05T08:00:05', detail: '{"idPengajuan":"INHAL-1"}' }
    ];
    const kept = dedupeUploadRows(uploads, audits);
    expect(kept.map((r) => r.id)).toEqual([2]);
  });

  it('tidak membuang bila selisih lebih dari 10 detik atau pengajuan berbeda', () => {
    const uploads = [
      { id: 1, timestamp: '2026-11-05T08:01:00', id_pengajuan: 'INHAL-1', detail: 'x' },
      { id: 2, timestamp: '2026-11-05T08:00:00', id_pengajuan: 'INHAL-2', detail: 'x' }
    ];
    const audits = [{ aksi: 'RESET_UPLOAD', timestamp: '2026-11-05T08:00:00', detail: '{"idPengajuan":"INHAL-1"}' }];
    expect(dedupeUploadRows(uploads, audits)).toHaveLength(2);
  });

  it('mengurutkan menurun dan membuang id ganda', () => {
    const list = mergeAndSort([
      { id: 'audit:1', waktu: '2026-11-05T08:00:00' },
      { id: 'audit:2', waktu: '2026-11-05T09:00:00' },
      { id: 'audit:2', waktu: '2026-11-05T09:00:00' }
    ]);
    expect(list.map((e) => e.id)).toEqual(['audit:2', 'audit:1']);
  });
});

describe('filter, ringkasan, dan util', () => {
  const events = [
    { id: 'a', waktu: '2026-11-05T08:00:00', aktor: 'Devi', aktorRole: 'Admin', jenis: 'VerifyBayar', targetJenis: 'Pembayaran', targetId: 'INHAL-1', ringkasan: 'Memvalidasi', alasan: '' },
    { id: 'b', waktu: '2026-11-04T08:00:00', aktor: 'Desi', aktorRole: 'Verifikator', jenis: 'ACC', targetJenis: 'Pengajuan', targetId: 'INHAL-2', ringkasan: 'ACC pengajuan', alasan: 'Lengkap' }
  ];

  it('memfilter jenis, aktor, target, rentang, dan q', () => {
    expect(filterEvents(events, { jenis: 'ACC' }).map((e) => e.id)).toEqual(['b']);
    expect(filterEvents(events, { aktor: 'Devi' }).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(events, { target: 'Pembayaran' }).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(events, { q: 'lengkap' }).map((e) => e.id)).toEqual(['b']);
    expect(filterEvents(events, { dari: '2026-11-05', sampai: '2026-11-05' }).map((e) => e.id)).toEqual(['a']);
  });

  it('memfilter grup chip', () => {
    expect(jenisInGroup('ACC', 'keputusan')).toBe(true);
    expect(jenisInGroup('VerifyBayar', 'bayar')).toBe(true);
    expect(jenisInGroup('VerifyBayar', 'keputusan')).toBe(false);
    expect(filterEvents(events, { grup: 'keputusan' }).map((e) => e.id)).toEqual(['b']);
  });

  it('menghitung ringkasan', () => {
    const s = summarize(events, '2026-11-05');
    expect(s.total).toBe(2);
    expect(s.keputusan).toBe(1);
    expect(s.hariIni).toBe(1);
  });

  it('menghitung inisial dan rentang WIB', () => {
    expect(initials('Devi')).toBe('DE');
    expect(initials('dr. Desi Isnayanti,M.Pd.Ked')).toBe('DI');
    expect(initials('')).toBe('?');
    const r = wibRange('2026-11-05', '2026-11-05');
    expect(r.startUtc).toBe('2026-11-04T17:00:00');
    expect(r.endUtc).toBe('2026-11-05T16:59:59');
  });
});

describe('getActivityLog', () => {
  it('menolak tanpa sesi admin', async () => {
    await expect(getActivityLog(env.DB, {}, {})).rejects.toThrow();
  });

  it('menggabungkan tiga sumber, membuang duplikat, dan memaginasi', async () => {
    const ts = '2026-11-05T03:00:00';
    await env.DB.prepare("INSERT INTO audit_log (timestamp,actor_email,aksi,target,detail,alasan) VALUES (?1,'Devi','VERIFY','Pembayaran',?2,'')")
      .bind(ts, '{"idPengajuan":"INHAL-1","nominal":250000,"kesesuaian":"pas"}').run();
    await env.DB.prepare("INSERT INTO audit_log (timestamp,actor_email,aksi,target,detail,alasan) VALUES (?1,'Yudha','UPLOAD_BUKTI_ADMIN','Pengajuan',?2,'Unggah bukti bayar oleh admin')")
      .bind('2026-11-05T04:00:01', '{"idPengajuan":"INHAL-2","linkBukti":"https://drive.google.com/file/d/xyz/view"}').run();
    await env.DB.prepare("INSERT INTO log_upload (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,detail,tanggal,link_acc_inhal,link_bukti_bayar) VALUES (?1,'INHAL-2','2201010001','Aisyah','A','Ujian','Unggah bukti bayar oleh admin','2026-11-20','','https://x')")
      .bind('2026-11-05T04:00:02').run();
    await env.DB.prepare("INSERT INTO log_upload (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,detail,tanggal,link_acc_inhal,link_bukti_bayar) VALUES (?1,'INHAL-3','2201010002','Budi','B','SGD','SGD 1','2026-11-21','','https://y')")
      .bind('2026-11-05T05:00:00').run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-11-04T02:00:00','INHAL-3','Menunggu','','Devi')").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-11-05T06:00:00','INHAL-3','ACC','Berkas lengkap','dr. Desi Isnayanti,M.Pd.Ked')").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-11-06T06:00:00','INHAL-3','Ditolak','Di luar rentang','Devi')").run();

    const ctx = await adminCtx();
    const res = await getActivityLog(env.DB, { dari: '2026-11-05', sampai: '2026-11-05' }, ctx);
    const kinds = res.rows.map((e) => e.jenis);
    expect(kinds).toContain('VerifyBayar');
    expect(kinds).toContain('UploadAdmin');
    expect(kinds).toContain('UploadMahasiswa');
    expect(kinds).toContain('ACC');
    expect(kinds).not.toContain('Tolak');
    // log_upload admin INHAL-2 dedupe karena ada UPLOAD_BUKTI_ADMIN 1 detik sebelumnya.
    expect(res.rows.filter((e) => e.sumber === 'log_upload').length).toBe(1);
    expect(res.rows[0].waktu).toBe('2026-11-05T06:00:00');
    expect(res.total).toBe(res.rows.length);
    expect(res.summary.unggahan).toBe(2);
  });

  it('mengisi status sebelumnya di luar rentang filter', async () => {
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-10-01T01:00:00','INHAL-9','Menunggu','','Devi')").run();
    await env.DB.prepare("INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-11-05T01:00:00','INHAL-9','ACC','','Devi')").run();
    const ctx = await adminCtx();
    const res = await getActivityLog(env.DB, { dari: '2026-11-05', sampai: '2026-11-05', jenis: 'ACC' }, ctx);
    const acc = res.rows.find((e) => e.targetId === 'INHAL-9');
    expect(acc.sebelum).toEqual({ status: 'Menunggu' });
  });

  it('terdaftar sebagai RPC getActivityLog', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Devi' });
    const res = await dispatchRpc(env.DB, 'getActivityLog', [{ dari: '2026-11-05', sampai: '2026-11-05' }, token], '127.0.0.1', {});
    expect(res.error).toBeUndefined();
    expect(Array.isArray(res.rows)).toBe(true);
    expect(res.summary).toBeTruthy();
  });

  it('membatasi halaman ke halaman terakhir dan menyediakan chip grup', async () => {
    const ctx = await adminCtx();
    for (let i = 0; i < 5; i++) {
      await env.DB.prepare("INSERT INTO audit_log (timestamp,actor_email,aksi,target,detail,alasan) VALUES (?1,'Devi','FILE_ACCESS','up-" + i + "','Akses berkas x','')")
        .bind('2026-11-05T0' + i + ':00:00').run();
    }
    const res = await getActivityLog(env.DB, { dari: '2026-11-05', sampai: '2026-11-05', perPage: 2, page: 99 }, ctx);
    expect(res.page).toBe(res.pages);
    expect(res.rows.length).toBeGreaterThan(0);
    expect(Array.isArray(res.groups)).toBe(true);
    expect(res.groups.find((g) => g.key === '').jumlah).toBe(res.total);
  });
});
