import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadState() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian-state.js'));
  expect(res.status).toBe(200);
  const src = await res.text();
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.BagianState;
}

const rows = [
  { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p1', npm: '001', namaLengkap: 'Ani', baMember: false },
  { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p2', npm: '002', namaLengkap: 'Budi', baMember: false },
  { jenis: 'KKD', pilihan: 'Farmasi', detail: '', tanggal: '2026-10-21', blok: '2', status: 'ACC', idPengajuan: 'p3', npm: '003', namaLengkap: 'Cici', baMember: true }
];

const jadwalList = [
  { JadwalID: 'j1', Blok: '1', NamaKegiatan: 'Neurologi - A', Tanggal: '2026-10-20', Jam: '08:00', Dosen: 'Dr. X', Catatan: '', baId: 'ba1', peserta: [{ idPengajuan: 'p1', namaLengkap: 'Ani', npm: '001' }] }
];

const baList = [
  { 'BA ID': 'ba1', Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-20', Jam: '08:00', Dosen: 'Dr. X', Label: '', Catatan: '', 'File URL': '', selesai: true, peserta: [{ namaLengkap: 'Ani', npm: '001' }] },
  { 'BA ID': 'ba2', Blok: '2', 'Nama Kegiatan': 'Farmasi', 'Tanggal Pelaksanaan': '2026-10-21', Jam: '', Dosen: '', Label: 'Sesi 1', Catatan: '', 'File URL': '', selesai: false, peserta: [{ namaLengkap: 'Cici', npm: '003' }] }
];

describe('bagian-state helpers', () => {
  it('menormalkan teks dan mencocokkan kegiatan', async () => {
    const S = await loadState();
    expect(S.normText('  Neurologi - A ')).toBe('neurologi a');
    expect(S.kegiatanName({ pilihan: 'Neurologi', detail: 'A' })).toBe('Neurologi - A');
    expect(S.sameKegiatan('Blok 1', 'Neurologi - A', '1', 'neurologi a')).toBe(true);
    expect(S.sameKegiatan('1', 'Neurologi - A', '2', 'Neurologi - A')).toBe(false);
  });

  it('menurunkan status dari BA dan jadwal', async () => {
    const S = await loadState();
    expect(S.statusOf(null, null)).toBe('acc');
    expect(S.statusOf(null, jadwalList[0])).toBe('terjadwal');
    expect(S.statusOf(baList[1], jadwalList[0])).toBe('draft');
    expect(S.statusOf(baList[0], jadwalList[0])).toBe('selesai');
  });

  it('memilih BA dengan tanggal yang sama lebih dulu', async () => {
    const S = await loadState();
    const list = baList.concat([{ 'BA ID': 'ba3', Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-22', selesai: true }]);
    const found = S.baForKegiatan({ blok: '1', nama: 'Neurologi - A', tanggal: '2026-10-20' }, list);
    expect(found['BA ID']).toBe('ba1');
  });

  it('memisahkan grup semua peserta dan grup sisa BA', async () => {
    const S = await loadState();
    const all = S.buildAllGroups(rows, { statuses: ['ACC'] });
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    expect(all.length).toBe(2);
    expect(pending.length).toBe(1);
    expect(pending[0].peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2']);
  });

  it('menghitung peserta yang belum terjadwal', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] })[0];
    expect(S.groupFullyScheduled(pending, jadwalList)).toBe(false);
    expect(S.unscheduledPeserta(pending, jadwalList).map((p) => p.idPengajuan)).toEqual(['p2']);
  });

  it('membangun daftar jadwal tanpa grup yang sudah terjadwal penuh', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const items = S.buildJadwalItems(pending, jadwalList, baList);
    expect(items.some((i) => i.kind === 'jadwal' && i.key === 'j1')).toBe(true);
    expect(items.some((i) => i.kind === 'group' && i.key === pending[0].key)).toBe(true);
    const full = [{ idPengajuan: 'p1' }, { idPengajuan: 'p2' }];
    const fullGroup = Object.assign({}, pending[0], { peserta: full });
    const fullJadwal = [Object.assign({}, jadwalList[0], { peserta: full })];
    const withFull = S.buildJadwalItems([fullGroup], fullJadwal, baList);
    expect(withFull.some((i) => i.kind === 'group')).toBe(false);
  });

  it('membangun antrean BA: draft masuk, selesai tidak', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const items = S.buildBaWorkItems(pending, S.buildRiwayatItems(baList).filter(() => false).concat([baList[1]]), jadwalList);
    expect(items.some((i) => i.kind === 'ba' && i.key === 'ba2')).toBe(true);
    expect(items.some((i) => i.kind === 'ba' && i.key === 'ba1')).toBe(false);
    expect(items.some((i) => i.kind === 'group')).toBe(true);
  });

  it('membangun riwayat hanya BA selesai dan mengurutkan terbaru', async () => {
    const S = await loadState();
    const items = S.buildRiwayatItems(baList);
    expect(items.length).toBe(1);
    expect(items[0].key).toBe('ba1');
  });

  it('menghitung statistik dan progres blok', async () => {
    const S = await loadState();
    const all = S.buildAllGroups(rows, { statuses: ['ACC'] });
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const stats = S.buildStats({ rows, kegiatanGroups: pending, allGroups: all, baList, jadwalList });
    expect(stats.totalPeserta).toBe(3);
    expect(stats.draftBa).toBe(1);
    expect(stats.baSelesai).toBe(1);
    expect(stats.belumDijadwalkan).toBe(1);
    const progress = S.buildBlokProgress(all, baList);
    expect(progress.find((b) => b.blok === '1')).toEqual({ blok: '1', total: 1, done: 1, persen: 100 });
    expect(progress.find((b) => b.blok === '2')).toEqual({ blok: '2', total: 1, done: 0, persen: 0 });
  });

  it('mencocokkan pencarian pada nama, dosen, dan peserta', async () => {
    const S = await loadState();
    const items = S.buildRiwayatItems(baList);
    expect(S.matchesQuery(items[0], 'ani')).toBe(true);
    expect(S.matchesQuery(items[0], 'dr x')).toBe(true);
    expect(S.matchesQuery(items[0], 'tidak ada')).toBe(false);
  });
});
