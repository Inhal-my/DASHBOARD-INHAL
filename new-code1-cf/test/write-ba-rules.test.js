import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import {
  saveBeritaAcaraBagian, updateBeritaAcaraBagian
} from '../src/write/beritaAcara.js';
import { kategoriFromBagian } from '../src/write/baRules.js';

const BEBAS = { multiJadwal: 'bebas', multiSesi: 'bebas', multiBa: 'bebas', perPeserta: 'bebas' };

async function bagianCtx(kategoris = ['SGD']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris }), env: {} };
}

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function setRules(sgd) {
  const rules = {
    SGD: { ...BEBAS, ...(sgd || {}) },
    Ujian: { ...BEBAS }
  };
  await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('BA_RULES', ?1)")
    .bind(JSON.stringify(rules)).run();
}

async function seedPeserta(id, npm, nama, status = 'ACC') {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD',?4)"
  ).bind(id, npm, nama, status).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD','SGD 1','','2026-09-20','')"
  ).bind(id).run();
}

async function seedPesertaJenis(id, npm, nama, jenis, pilihan, status = 'ACC') {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A',?4,?5)"
  ).bind(id, npm, nama, jenis, status).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'','2026-09-20','')"
  ).bind(id, jenis, pilihan).run();
}

async function setCategoryRules(kat, patch) {
  const rules = {};
  for (const c of ['SGD', 'Ujian', 'KKD', 'Praktikum']) rules[c] = { ...BEBAS };
  rules[kat] = { ...BEBAS, ...(patch || {}) };
  await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('BA_RULES', ?1)")
    .bind(JSON.stringify(rules)).run();
}

async function seedDua(statusKedua = 'ACC') {
  await seedPeserta('INHAL-1', '2201010001', 'Aisyah', 'ACC');
  await seedPeserta('INHAL-2', '2201010002', 'Budi', statusKedua);
}

function pesertaOf(id, npm, nama, status = 'ACC') {
  return { idPengajuan: id, npm: npm, namaLengkap: nama, blok: 'A', statusPengajuan: status };
}

const AISYAH = ['INHAL-1', '2201010001', 'Aisyah'];
const BUDI = ['INHAL-2', '2201010002', 'Budi'];

async function makeJadwal(ctx, tanggal, jam, peserta, override) {
  const res = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: tanggal, jam: jam,
    dosen: 'dr. Andi', catatan: '', peserta: peserta,
    ...(override ? { override: override } : {})
  }, 'SGD', ctx);
  return res;
}

function baPayload(extra) {
  return {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
    jam: '09:00', dosen: 'dr. Andi', catatan: '',
    ...(extra || {})
  };
}

async function auditCount(aksi, target) {
  const row = target
    ? await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE aksi = ?1 AND target = ?2').bind(aksi, target).first()
    : await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE aksi = ?1').bind(aksi).first();
  return Number(row.n);
}

describe('aturan BA (a) multi-jadwal', () => {
  it('ketat menolak jadwal kedua untuk kegiatan yang sama', async () => {
    await seedDua();
    await setRules({ multiJadwal: 'ketat' });
    const ctx = await bagianCtx();
    const first = await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)]);
    expect(first.success).toBe(true);

    const second = await makeJadwal(ctx, '2026-09-21', '09:00', [pesertaOf(...BUDI)]);
    expect(second.success).toBe(false);
    expect(second.rule).toBe('multiJadwal');
    expect(second.message).toContain('hanya boleh satu jadwal');
  });

  it('longgar mengizinkan tanggal sama, menolak tanggal beda tanpa alasan', async () => {
    await seedDua();
    await setRules({ multiJadwal: 'longgar' });
    const ctx = await bagianCtx();
    expect((await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)])).success).toBe(true);

    const sameDate = await makeJadwal(ctx, '2026-09-20', '13:00', [pesertaOf(...BUDI)]);
    expect(sameDate.success).toBe(true);
    expect(sameDate.overrideApplied).toBeUndefined();
  });

  it('longgar menerima tanggal beda bila ada alasan override dan mencatat audit', async () => {
    await seedDua();
    await setRules({ multiJadwal: 'longgar' });
    const ctx = await bagianCtx();
    expect((await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)])).success).toBe(true);

    const blocked = await makeJadwal(ctx, '2026-09-21', '09:00', [pesertaOf(...BUDI)]);
    expect(blocked.success).toBe(false);
    expect(blocked.allowOverride).toBe(true);
    expect(blocked.rule).toBe('multiJadwal');

    const ok = await makeJadwal(ctx, '2026-09-21', '09:00', [pesertaOf(...BUDI)], { multiJadwal: 'jadwal susulan' });
    expect(ok.success).toBe(true);
    expect(ok.overrideApplied).toEqual(['multiJadwal']);
    expect(await auditCount('BA_RULE_OVERRIDE', ok.jadwalId)).toBe(1);
  });
});

describe('aturan BA (b) multi-sesi', () => {
  it('ketat menolak BA dengan lebih dari satu sesi', async () => {
    await seedDua();
    await setRules({ multiSesi: 'ketat' });
    const ctx = await bagianCtx();
    const a = (await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)])).jadwalId;
    const b = (await makeJadwal(ctx, '2026-09-21', '13:00', [pesertaOf(...BUDI)])).jadwalId;

    const res = await saveBeritaAcaraBagian(env.DB, baPayload({
      jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }), 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.rule).toBe('multiSesi');
    expect(res.message).toContain('tidak boleh memakai BA multi-sesi');
  });

  it('longgar menerima multi-sesi tanggal sama tanpa override', async () => {
    await seedDua();
    await setRules({ multiSesi: 'longgar' });
    const ctx = await bagianCtx();
    const a = (await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)])).jadwalId;
    const b = (await makeJadwal(ctx, '2026-09-20', '13:00', [pesertaOf(...BUDI)])).jadwalId;

    const res = await saveBeritaAcaraBagian(env.DB, baPayload({
      jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }), 'SGD', ctx);
    expect(res.success).toBe(true);
    expect(res.overrideApplied).toBeUndefined();
  });

  it('longgar menolak sesi beda tanggal tanpa alasan, menerima dengan alasan', async () => {
    await seedDua();
    await setRules({ multiSesi: 'longgar' });
    const ctx = await bagianCtx();
    const a = (await makeJadwal(ctx, '2026-09-20', '09:00', [pesertaOf(...AISYAH)])).jadwalId;
    const b = (await makeJadwal(ctx, '2026-09-21', '13:00', [pesertaOf(...BUDI)])).jadwalId;

    const blocked = await saveBeritaAcaraBagian(env.DB, baPayload({
      jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }), 'SGD', ctx);
    expect(blocked.success).toBe(false);
    expect(blocked.allowOverride).toBe(true);

    const ok = await saveBeritaAcaraBagian(env.DB, baPayload({
      jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)],
      override: { multiSesi: 'gabung kelas' }
    }), 'SGD', ctx);
    expect(ok.success).toBe(true);
    expect(ok.overrideApplied).toEqual(['multiSesi']);
    expect(await auditCount('BA_RULE_OVERRIDE', ok.baId)).toBe(1);
  });
});

describe('aturan BA (c) multi-BA', () => {
  it('ketat menolak BA kedua untuk kegiatan yang sama', async () => {
    await seedDua();
    await setRules({ multiBa: 'ketat' });
    const ctx = await bagianCtx();
    expect((await saveBeritaAcaraBagian(env.DB, baPayload({ peserta: [pesertaOf(...AISYAH)] }), 'SGD', ctx)).success).toBe(true);

    const second = await saveBeritaAcaraBagian(env.DB, baPayload({ tanggalPelaksanaan: '2026-09-21', peserta: [pesertaOf(...BUDI)] }), 'SGD', ctx);
    expect(second.success).toBe(false);
    expect(second.rule).toBe('multiBa');
    expect(second.message).toContain('hanya boleh satu BA');
  });

  it('longgar menerima tanggal beda, menolak tanggal sama tanpa alasan', async () => {
    await seedDua();
    await setRules({ multiBa: 'longgar' });
    const ctx = await bagianCtx();
    expect((await saveBeritaAcaraBagian(env.DB, baPayload({ peserta: [pesertaOf(...AISYAH)] }), 'SGD', ctx)).success).toBe(true);

    const beda = await saveBeritaAcaraBagian(env.DB, baPayload({ tanggalPelaksanaan: '2026-09-21', peserta: [pesertaOf(...BUDI)] }), 'SGD', ctx);
    expect(beda.success).toBe(true);
    expect(beda.overrideApplied).toBeUndefined();

    const sama = await saveBeritaAcaraBagian(env.DB, baPayload({ peserta: [pesertaOf(...BUDI)] }), 'SGD', ctx);
    expect(sama.success).toBe(false);
    expect(sama.allowOverride).toBe(true);

    const ok = await saveBeritaAcaraBagian(env.DB, baPayload({
      peserta: [pesertaOf(...BUDI)], override: { multiBa: 'BA tambahan' }
    }), 'SGD', ctx);
    expect(ok.success).toBe(true);
    expect(ok.overrideApplied).toEqual(['multiBa']);
    expect(await auditCount('BA_RULE_OVERRIDE', ok.baId)).toBe(1);
  });
});

describe('aturan BA (d) per-peserta', () => {
  it('ketat menolak bila ada peserta non-ACC', async () => {
    await seedDua('Menunggu');
    await setRules({ perPeserta: 'ketat' });
    const ctx = await bagianCtx();

    const res = await saveBeritaAcaraBagian(env.DB, baPayload({
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI, 'Menunggu')]
    }), 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.rule).toBe('perPeserta');
    expect(res.message).toContain('semua peserta harus ACC');
    expect(res.message).toContain('Budi');
  });

  it('longgar mengeluarkan peserta non-ACC otomatis', async () => {
    await seedDua('Menunggu');
    await setRules({ perPeserta: 'longgar' });
    const ctx = await bagianCtx();

    const res = await saveBeritaAcaraBagian(env.DB, baPayload({
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI, 'Menunggu')]
    }), 'SGD', ctx);
    expect(res.success).toBe(true);
    expect(res.deferred).toHaveLength(1);
    expect(res.deferred[0].namaLengkap).toBe('Budi');

    const rows = await env.DB.prepare('SELECT npm FROM berita_acara_peserta WHERE ba_id = ?1').bind(res.baId).all();
    expect(rows.results.map((r) => r.npm)).toEqual(['2201010001']);
    const ba = await env.DB.prepare('SELECT jumlah_peserta FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(Number(ba.jumlah_peserta)).toBe(1);
  });

  it('longgar menolak bila tidak ada peserta ACC sama sekali', async () => {
    await seedPeserta('INHAL-1', '2201010001', 'Aisyah', 'Menunggu');
    await seedPeserta('INHAL-2', '2201010002', 'Budi', 'Menunggu');
    await setRules({ perPeserta: 'longgar' });
    const ctx = await bagianCtx();

    const res = await saveBeritaAcaraBagian(env.DB, baPayload({
      peserta: [pesertaOf(...AISYAH, 'Menunggu'), pesertaOf(...BUDI, 'Menunggu')]
    }), 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak ada peserta final (ACC)');
  });

  it('ketat juga berlaku saat mengubah peserta BA', async () => {
    await seedDua('Menunggu');
    const ctx = await bagianCtx();
    await setRules({ perPeserta: 'longgar' });
    const draft = await saveBeritaAcaraBagian(env.DB, baPayload({
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI, 'Menunggu')]
    }), 'SGD', ctx);
    expect(draft.success).toBe(true);

    await setRules({ perPeserta: 'ketat' });
    const res = await updateBeritaAcaraBagian(env.DB, draft.baId, {
      pesertaIds: ['INHAL-1', 'INHAL-2']
    }, await adminCtx());
    expect(res.success).toBe(false);
    expect(res.rule).toBe('perPeserta');
  });
});

function baPayloadKat(kat, nama, extra) {
  return {
    bagian: kat, blok: 'A', namaKegiatan: nama, tanggalPelaksanaan: '2026-09-20',
    jam: '09:00', dosen: 'dr. Andi', catatan: '',
    ...(extra || {})
  };
}

describe('aturan BA kategori KKD/Praktikum', () => {
  it('kategoriFromBagian memetakan KKD, Praktikum, dan nama lab', () => {
    expect(kategoriFromBagian('KKD')).toBe('KKD');
    expect(kategoriFromBagian('Praktikum')).toBe('Praktikum');
    expect(kategoriFromBagian('Lab Anatomi', ['Lab Anatomi'])).toBe('Praktikum');
    expect(kategoriFromBagian('Lab Anatomi')).toBe('Praktikum');
    expect(kategoriFromBagian('SGD')).toBe('SGD');
    expect(kategoriFromBagian('Ujian')).toBe('Ujian');
    expect(kategoriFromBagian('')).toBe('');
  });

  it('KKD per-peserta ketat menolak peserta non-ACC', async () => {
    await seedPesertaJenis('INHAL-K1', '2201010101', 'Kiki', 'KKD', 'KKD 1', 'ACC');
    await seedPesertaJenis('INHAL-K2', '2201010102', 'Lina', 'KKD', 'KKD 1', 'Menunggu');
    await setCategoryRules('KKD', { perPeserta: 'ketat' });
    const ctx = await bagianCtx(['KKD']);

    const res = await saveBeritaAcaraBagian(env.DB, baPayloadKat('KKD', 'KKD 1', {
      peserta: [pesertaOf('INHAL-K1', '2201010101', 'Kiki'), pesertaOf('INHAL-K2', '2201010102', 'Lina', 'Menunggu')]
    }), 'KKD', ctx);
    expect(res.success).toBe(false);
    expect(res.rule).toBe('perPeserta');
    expect(res.message).toContain('Lina');
  });

  it('Praktikum per-peserta longgar mengeluarkan non-ACC otomatis', async () => {
    await seedPesertaJenis('INHAL-P1', '2201010201', 'Maya', 'Praktikum', 'Praktikum 1', 'ACC');
    await seedPesertaJenis('INHAL-P2', '2201010202', 'Nanda', 'Praktikum', 'Praktikum 1', 'Menunggu');
    await setCategoryRules('Praktikum', { perPeserta: 'longgar' });
    const ctx = await bagianCtx(['Praktikum']);

    const res = await saveBeritaAcaraBagian(env.DB, baPayloadKat('Praktikum', 'Praktikum 1', {
      peserta: [pesertaOf('INHAL-P1', '2201010201', 'Maya'), pesertaOf('INHAL-P2', '2201010202', 'Nanda', 'Menunggu')]
    }), 'Praktikum', ctx);
    expect(res.success).toBe(true);
    expect(res.deferred).toHaveLength(1);
    expect(res.deferred[0].namaLengkap).toBe('Nanda');
    const rows = await env.DB.prepare('SELECT npm FROM berita_acara_peserta WHERE ba_id = ?1').bind(res.baId).all();
    expect(rows.results.map((r) => r.npm)).toEqual(['2201010201']);
  });

  it('aturan KKD tetap berlaku saat mengubah peserta BA', async () => {
    await seedPesertaJenis('INHAL-K1', '2201010101', 'Kiki', 'KKD', 'KKD 1', 'ACC');
    await seedPesertaJenis('INHAL-K2', '2201010102', 'Lina', 'KKD', 'KKD 1', 'Menunggu');
    await setCategoryRules('KKD', { perPeserta: 'longgar' });
    const ctx = await bagianCtx(['KKD']);
    const draft = await saveBeritaAcaraBagian(env.DB, baPayloadKat('KKD', 'KKD 1', {
      peserta: [pesertaOf('INHAL-K1', '2201010101', 'Kiki'), pesertaOf('INHAL-K2', '2201010102', 'Lina', 'Menunggu')]
    }), 'KKD', ctx);
    expect(draft.success).toBe(true);
    expect(draft.deferred).toHaveLength(1);

    await setCategoryRules('KKD', { perPeserta: 'ketat' });
    const res = await updateBeritaAcaraBagian(env.DB, draft.baId, {
      pesertaIds: ['INHAL-K1', 'INHAL-K2']
    }, await adminCtx());
    expect(res.success).toBe(false);
    expect(res.rule).toBe('perPeserta');
  });
});
