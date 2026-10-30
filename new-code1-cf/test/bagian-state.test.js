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
  { 'BA ID': 'ba1', Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-20', Jam: '08:00', Dosen: 'Dr. X', Label: '', Catatan: '', 'File URL': 'https://example.com/ba1.pdf', selesai: true, peserta: [{ namaLengkap: 'Ani', npm: '001' }] },
  { 'BA ID': 'ba2', Blok: '2', 'Nama Kegiatan': 'Farmasi', 'Tanggal Pelaksanaan': '2026-10-21', Jam: '', Dosen: '', Label: 'Sesi 1', Catatan: '', 'File URL': '', selesai: false, peserta: [{ namaLengkap: 'Cici', npm: '003' }] }
];

const baPendukungList = [
  {
    'BA ID': 'BA-PEN-1', 'File URL': 'https://example.com/pen.pdf', 'File Name': 'pen.pdf',
    Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-20',
    peserta: [
      { idPengajuan: 'p1', npm: '001', namaLengkap: 'Ani', blok: '1', statusPengajuan: 'ACC' },
      { idPengajuan: 'p4', npm: '004', namaLengkap: 'Dedi', blok: '1', statusPengajuan: 'ACC' },
      { idPengajuan: 'p5', npm: '005', namaLengkap: 'Eka', blok: '1', statusPengajuan: 'Menunggu' },
      { idPengajuan: 'p4', npm: '004', namaLengkap: 'Dedi', blok: '1', statusPengajuan: 'ACC' }
    ]
  }
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

  it('membawa jumlah sesi ke item BA', async () => {
    const S = await loadState();
    const multi = Object.assign({}, baList[0], { jumlahSesi: 2, sesi: ['j1', 'j9'] });
    expect(S.buildRiwayatItems([multi])[0].jumlahSesi).toBe(2);
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const draft = Object.assign({}, baList[1], { sesi: ['j2'] });
    const items = S.buildBaWorkItems(pending, [draft], jadwalList);
    expect(items.find((i) => i.kind === 'ba').jumlahSesi).toBe(1);
  });

  it('menggabungkan sesi jadwal satu kegiatan', async () => {
    const S = await loadState();
    const list = [
      { JadwalID: 'j2', Blok: '1', NamaKegiatan: 'Neurologi - A', Tanggal: '2026-10-22', Jam: '10:00', peserta: [{ idPengajuan: 'p2', npm: '002', namaLengkap: 'Budi' }] },
      { JadwalID: 'j1', Blok: '1', NamaKegiatan: 'Neurologi - A', Tanggal: '2026-10-20', Jam: '08:00', peserta: [{ idPengajuan: 'p1', npm: '001', namaLengkap: 'Ani' }] },
      { JadwalID: 'j3', Blok: '2', NamaKegiatan: 'Farmasi', Tanggal: '2026-10-21', Jam: '09:00', peserta: [] }
    ];
    const sessions = S.sessionsForKegiatan({ blok: '1', nama: 'Neurologi - A' }, list);
    expect(sessions.map((j) => j.JadwalID)).toEqual(['j1', 'j2']);
    expect(S.unionPeserta(sessions).map((p) => p.idPengajuan)).toEqual(['p1', 'p2']);
    const sum = S.sesiSummary(sessions);
    expect(sum.jumlahSesi).toBe(2);
    expect(sum.jumlahPeserta).toBe(2);
    expect(sum.mulai).toBe('2026-10-20');
    expect(sum.selesai).toBe('2026-10-22');
    expect(sum.label).toBe('2 sesi');
  });

  it('menyalakan dan mematikan sesi beserta peserta gabungan', async () => {
    const S = await loadState();
    const sessions = [
      { JadwalID: 'j1', Tanggal: '2026-10-20', peserta: [{ idPengajuan: 'p1', namaLengkap: 'Ani', npm: '001' }] },
      { JadwalID: 'j2', Tanggal: '2026-10-22', peserta: [{ idPengajuan: 'p2', namaLengkap: 'Budi', npm: '002' }] }
    ];
    const on = S.applySessionToggle([], 'j1', sessions);
    expect(on.jadwalIds).toEqual(['j1']);
    expect(Object.keys(on.selected)).toEqual(['p1']);
    const both = S.applySessionToggle(on.jadwalIds, 'j2', sessions);
    expect(both.jadwalIds).toEqual(['j1', 'j2']);
    expect(Object.keys(both.selected).sort()).toEqual(['p1', 'p2']);
    const off = S.applySessionToggle(both.jadwalIds, 'j1', sessions);
    expect(off.jadwalIds).toEqual(['j2']);
    expect(Object.keys(off.selected)).toEqual(['p2']);
    expect(S.sesiSummary([]).label).toBe('Tanpa sesi');
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

  it('membaca peserta BA Pendukung sebagai kandidat tanpa duplikat', async () => {
    const S = await loadState();
    const list = S.pendukungPesertaList(baPendukungList[0]);
    expect(list.map((p) => p.idPengajuan)).toEqual(['p1', 'p4', 'p5']);
    expect(list[1].sumber).toBe('pendukung');
    expect(list[1].pendukungBaId).toBe('BA-PEN-1');
    expect(list[1].pendukungFileUrl).toBe('https://example.com/pen.pdf');
    expect(S.pendukungPesertaList(null)).toEqual([]);
    expect(S.baPendukungFor({ blok: '1', nama: 'Neurologi - A', tanggal: '2026-10-20' }, baPendukungList)['BA ID']).toBe('BA-PEN-1');
    expect(S.baPendukungFor({ blok: '2', nama: 'Farmasi', tanggal: '2026-10-21' }, baPendukungList)).toBe(null);
  });

  it('menggabungkan peserta BA Pendukung ke kandidat form BA', async () => {
    const S = await loadState();
    const group = S.buildKegiatanGroups(rows, { statuses: ['ACC'] })[0];
    const ref = { blok: group.blok, nama: group.nama, tanggal: group.tanggal };

    const off = S.mergeBaCandidates(ref, group.peserta, baPendukungList, { statuses: ['ACC'] });
    expect(off.peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2']);
    expect(off.tambahan.map((p) => p.idPengajuan)).toEqual(['p4']);
    expect(off.ditolak.map((p) => p.idPengajuan)).toEqual(['p5']);
    expect(off.jumlahPendukung).toBe(3);
    expect(off.includePendukung).toBe(false);
    expect(off.peserta[0].punyaPendukung).toBe(true);
    expect(off.peserta[0].pendukungBaId).toBe('BA-PEN-1');
    expect(off.peserta[1].punyaPendukung).toBe(false);
    expect(off.peserta[1].pendukungBaId).toBe('');

    const on = S.mergeBaCandidates(ref, group.peserta, baPendukungList, { statuses: ['ACC'], includePendukung: true });
    expect(on.peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2', 'p4']);
    expect(on.peserta[2].sumber).toBe('pendukung');
    expect(on.peserta[2].pendukungFileUrl).toBe('https://example.com/pen.pdf');
    expect(on.jumlahTambahan).toBe(1);
    expect(on.jumlahDitolak).toBe(1);

    // Tanpa daftar status, semua peserta BA Pendukung yang belum ada dianggap kandidat.
    const all = S.mergeBaCandidates(ref, group.peserta, baPendukungList, { includePendukung: true });
    expect(all.peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2', 'p4', 'p5']);

    // Kegiatan tanpa BA Pendukung tidak menambah kandidat.
    const kosong = S.mergeBaCandidates({ blok: '2', nama: 'Farmasi', tanggal: '2026-10-21' }, [{ idPengajuan: 'p3', npm: '003', namaLengkap: 'Cici' }], baPendukungList, { includePendukung: true });
    expect(kosong.peserta.map((p) => p.idPengajuan)).toEqual(['p3']);
    expect(kosong.ba).toBe(null);
  });

  it('menyalakan dan mematikan sumber BA Pendukung tanpa membuang pilihan kegiatan', async () => {
    const S = await loadState();
    const tambahan = [{ idPengajuan: 'p4' }, { idPengajuan: 'p5' }];
    const on = S.applyPendukungToggle(tambahan, { p1: true }, true);
    expect(on.includePendukung).toBe(true);
    expect(Object.keys(on.selected).sort()).toEqual(['p1', 'p4', 'p5']);
    const off = S.applyPendukungToggle(tambahan, on.selected, false);
    expect(off.includePendukung).toBe(false);
    expect(Object.keys(off.selected)).toEqual(['p1']);
  });

  it('menolak kandidat pendukung yang kegiatannya bukan kegiatan BA ini', async () => {
    const S = await loadState();
    const group = S.buildKegiatanGroups(rows, { statuses: ['ACC'] })[0];
    const ref = { blok: group.blok, nama: group.nama, tanggal: group.tanggal };
    const hasil = S.mergeBaCandidates(ref, group.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: rows, group: group
    });
    // p4 & p5 tidak punya baris pada kegiatan Neurologi - A di `rows`.
    expect(hasil.peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2']);
    expect(hasil.tambahan).toEqual([]);
    expect(hasil.tidakSesuai.map((p) => p.idPengajuan)).toEqual(['p4', 'p5']);
    expect(hasil.jumlahTidakSesuai).toBe(2);
    expect(hasil.jumlahTambahan).toBe(0);
  });

  it('memakai status pengajuan terkini dari baris peserta', async () => {
    const S = await loadState();
    const group = S.buildKegiatanGroups(rows, { statuses: ['ACC'] })[0];
    const ref = { blok: group.blok, nama: group.nama, tanggal: group.tanggal };
    const barisPendukung = rows.concat([
      { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p4', npm: '004', namaLengkap: 'Dedi', baMember: false },
      { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'Menunggu', idPengajuan: 'p5', npm: '005', namaLengkap: 'Eka', baMember: false },
      { jenis: 'KKD', pilihan: 'Farmasi', detail: '', tanggal: '2026-10-21', blok: '2', status: 'ACC', idPengajuan: 'p6', npm: '006', namaLengkap: 'Fani', baMember: false }
    ]);
    const hasil = S.mergeBaCandidates(ref, group.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: barisPendukung, group: group
    });
    expect(hasil.peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2', 'p4']);
    expect(hasil.tambahan.map((p) => p.idPengajuan)).toEqual(['p4']);
    expect(hasil.ditolak.map((p) => p.idPengajuan)).toEqual(['p5']);
    expect(hasil.tidakSesuai).toEqual([]);

    // Snapshot BA Pendukung boleh bilang ACC; baris peserta yang menentukan.
    const berubah = barisPendukung.map((r) => (r.idPengajuan === 'p4' ? Object.assign({}, r, { status: 'Ditolak' }) : r));
    const ditolak = S.mergeBaCandidates(ref, group.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: berubah, group: group
    });
    expect(ditolak.tambahan).toEqual([]);
    expect(ditolak.ditolak.map((p) => p.idPengajuan)).toEqual(['p4', 'p5']);

    // Tanggal baris berbeda tidak membuat peserta gugur: server mencocokkan kegiatan tanpa tanggal.
    const tanggalLain = barisPendukung.map((r) => (r.idPengajuan === 'p4' ? Object.assign({}, r, { tanggal: '2026-11-01' }) : r));
    const ok = S.mergeBaCandidates(ref, group.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: tanggalLain, group: group
    });
    expect(ok.tambahan.map((p) => p.idPengajuan)).toEqual(['p4']);
  });

  it('tetap mencocokkan baris peserta saat grup berasal dari jadwal tanpa jenis', async () => {
    const S = await loadState();
    // Grup dari jadwal hanya membawa blok + nama kegiatan (tanpa jenis/pilihan/detail).
    const jadwalGroup = {
      blok: '1', nama: 'Neurologi - A', pilihan: 'Neurologi - A', detail: '',
      tanggal: '2026-10-20', peserta: [{ idPengajuan: 'p1' }, { idPengajuan: 'p2' }]
    };
    const ref = { blok: jadwalGroup.blok, nama: jadwalGroup.nama, tanggal: jadwalGroup.tanggal };
    const barisPendukung = rows.concat([
      { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p4', npm: '004', namaLengkap: 'Dedi', baMember: false }
    ]);
    const hasil = S.mergeBaCandidates(ref, jadwalGroup.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: barisPendukung, group: jadwalGroup
    });
    expect(hasil.tambahan.map((p) => p.idPengajuan)).toEqual(['p4']);
    expect(hasil.tidakSesuai.map((p) => p.idPengajuan)).toEqual(['p5']);

    // Tanpa baris peserta sama sekali, penyaringan dilewati (status snapshot dipakai).
    const tanpaBaris = S.mergeBaCandidates(ref, jadwalGroup.peserta, baPendukungList, {
      statuses: ['ACC'], includePendukung: true, rows: [], group: jadwalGroup
    });
    expect(tanpaBaris.tambahan.map((p) => p.idPengajuan)).toEqual(['p4']);
    expect(tanpaBaris.ditolak.map((p) => p.idPengajuan)).toEqual(['p5']);
  });
});
const kalenderEntries = [
  { JadwalID: 'k2', Bagian: 'SGD', Blok: '1', NamaKegiatan: 'SGD Neurologi', Tanggal: '2026-10-20', Jam: '08:00', Dosen: 'Dr. A', readOnly: true },
  { JadwalID: 'k1', Bagian: 'KKD', Blok: '2', NamaKegiatan: 'KKD Farmasi', Tanggal: '2026-10-20', Jam: '09:00', Dosen: 'Dr. B', readOnly: true },
  { JadwalID: 'k3', Bagian: 'Lab Farmasi', Blok: '3', NamaKegiatan: 'Praktikum Farmasi', Tanggal: '2026-10-05', Jam: '13:00', Dosen: 'Dr. C', readOnly: true },
  { JadwalID: 'k4', Bagian: 'Ujian', Blok: '1', NamaKegiatan: 'UAS', Tanggal: '2026-11-02', Jam: '10:00', Dosen: '', readOnly: true }
];

describe('bagian-state kalender helpers', () => {
  it('memberi label bulan dan mengurutkan entri lintas bagian', async () => {
    const S = await loadState();
    expect(S.kalenderMonthLabel(2026, 10)).toBe('Oktober 2026');
    expect(S.kalenderMonthLabel(2026, 1)).toBe('Januari 2026');
    expect(S.kalenderMonthLabel(2026, 0)).toBe('-');
    expect(S.sortKalenderEntries(kalenderEntries).map((e) => e.JadwalID)).toEqual(['k3', 'k2', 'k1', 'k4']);
    expect(S.sortKalenderEntries(null)).toEqual([]);
  });

  it('menyaring entri per bulan', async () => {
    const S = await loadState();
    expect(S.kalenderMonthEntries(kalenderEntries, 2026, 10).map((e) => e.JadwalID)).toEqual(['k3', 'k2', 'k1']);
    expect(S.kalenderMonthEntries(kalenderEntries, 2026, 11).map((e) => e.JadwalID)).toEqual(['k4']);
    expect(S.kalenderMonthEntries(kalenderEntries, 2026, 9)).toEqual([]);
  });

  it('memfilter entri per bagian dan kata kunci', async () => {
    const S = await loadState();
    expect(S.filterKalenderEntries(kalenderEntries, { bagian: 'KKD' }).map((e) => e.JadwalID)).toEqual(['k1']);
    expect(S.filterKalenderEntries(kalenderEntries, { query: 'farmasi' }).map((e) => e.JadwalID)).toEqual(['k1', 'k3']);
    expect(S.filterKalenderEntries(kalenderEntries, { query: 'dr. a' }).map((e) => e.JadwalID)).toEqual(['k2']);
    expect(S.filterKalenderEntries(kalenderEntries, { bagian: 'SGD', query: 'farmasi' })).toEqual([]);
    expect(S.filterKalenderEntries(kalenderEntries, {})).toHaveLength(4);
  });

  it('menyusun opsi filter bagian (kategori dulu, lalu lab)', async () => {
    const S = await loadState();
    const opts = S.kalenderBagianOptions(kalenderEntries, { labs: ['Lab Farmasi'] });
    expect(opts.map((o) => o.value)).toEqual(['SGD', 'KKD', 'Ujian', 'Lab Farmasi']);
    expect(opts.map((o) => o.count)).toEqual([1, 1, 1, 1]);
    const tanpaLab = S.kalenderBagianOptions(kalenderEntries);
    expect(tanpaLab.map((o) => o.value)).toEqual(['SGD', 'KKD', 'Ujian', 'Lab Farmasi']);
  });

  it('membangun sel grid bulanan Senin-pertama', async () => {
    const S = await loadState();
    const cells = S.buildKalenderCells(kalenderEntries, 2026, 10, '2026-10-05');
    // 1 Oktober 2026 = Kamis -> offset 3 hari (Senin = 0), 31 hari -> 5 baris (35 sel)
    expect(cells).toHaveLength(35);
    expect(cells[0].date).toBe('2026-09-28');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[3].date).toBe('2026-10-01');
    expect(cells[3].day).toBe(1);
    expect(cells[3].inMonth).toBe(true);

    const hariKosong = S.buildKalenderCells([], 2026, 10, '2026-10-05');
    expect(hariKosong).toHaveLength(35);
    expect(hariKosong.every((c) => c.count === 0)).toBe(true);

    const tanggal5 = cells.find((c) => c.date === '2026-10-05');
    expect(tanggal5.isToday).toBe(true);
    expect(tanggal5.items.map((e) => e.JadwalID)).toEqual(['k3']);

    const tanggal20 = cells.find((c) => c.date === '2026-10-20');
    expect(tanggal20.count).toBe(2);
    expect(tanggal20.items.map((e) => e.JadwalID)).toEqual(['k2', 'k1']);

    expect(S.buildKalenderCells(kalenderEntries, 0, 10, '')).toEqual([]);
    expect(S.buildKalenderCells(kalenderEntries, 2026, 13, '')).toEqual([]);
  });
});
