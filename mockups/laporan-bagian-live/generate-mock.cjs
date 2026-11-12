const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'mock-data.js');

const NAMES = [
  'Aulia Rahma', 'Bagas Prakoso', 'Citra Dewi', 'Dimas Saputra', 'Eka Lestari',
  'Fahmi Idris', 'Gita Pramesti', 'Hanif Akbar', 'Indah Sari', 'Joko Wibowo',
  'Kartika Ayu', 'Lukman Hakim', 'Mega Putri', 'Naufal Rizki', 'Olivia Tan',
  'Putra Mahendra', 'Qori Amalia', 'Rizky Fadillah', 'Sinta Maharani', 'Tegar Pratama',
  'Umi Kalsum', 'Vina Oktavia', 'Wahyu Nugroho', 'Yasmin Zahra', 'Zaki Firmansyah'
];

const DATA = [
  { id: 1, blok: 'Blok 1', bagian: 'SGD', nama: 'SGD - Refraksi', tanggalJadwal: '2026-10-06',
    peserta: { acc: 10, menunggu: 2, ditolak: 0 }, baPen: { count: 1, tanggal: '2026-10-01' },
    baPel: [
      { id: 'BA-PEL/2026/10/0142', tanggal: '2026-10-06', jam: '08.00', dosen: 'dr. Ratna W., dr. Budi S.', peserta: 6 },
      { id: 'BA-PEL/2026/10/0149', tanggal: '2026-10-13', jam: '10.00', dosen: 'dr. Ratna W.', peserta: 4 }
    ] },
  { id: 2, blok: 'Blok 1', bagian: 'SGD', nama: 'SGD - Binokuler', tanggalJadwal: '2026-10-14',
    peserta: { acc: 8, menunggu: 0, ditolak: 0 }, baPen: { count: 1, tanggal: '2026-10-08' }, baPel: [] },
  { id: 3, blok: 'Blok 1', bagian: 'KKD', nama: 'KKD - Tonometri', tanggalJadwal: '2026-10-20',
    peserta: { acc: 10, menunggu: 1, ditolak: 0 }, baPen: null,
    baPel: [{ id: 'BA-PEL/2026/10/0157', tanggal: '2026-10-20', jam: '13.00', dosen: 'dr. Andi K.', peserta: 10 }] },
  { id: 4, blok: 'Blok 1', bagian: 'Ujian', nama: 'Ujian - OSCE Refraksi', tanggalJadwal: '2026-10-24',
    peserta: { acc: 24, menunggu: 0, ditolak: 1 }, baPen: { count: 1, tanggal: '2026-10-18' },
    baPel: [{ id: 'BA-PEL/2026/10/0163', tanggal: '2026-10-24', jam: '07.30', dosen: 'dr. Maya L.', peserta: 24 }] },
  { id: 5, blok: 'Blok 2', bagian: 'LAB 1', nama: 'LAB 1 - Slit Lamp', tanggalJadwal: '2026-11-22',
    peserta: { acc: 6, menunggu: 3, ditolak: 0 }, baPen: { count: 1, tanggal: '2026-11-08' }, baPel: [] },
  { id: 6, blok: 'Blok 2', bagian: 'SGD', nama: 'SGD - Oftalmologi Dasar', tanggalJadwal: '2026-11-03',
    peserta: { acc: 0, menunggu: 0, ditolak: 0 }, baPen: null,
    baPel: [{ id: 'BA-PEL/2026/11/0211', tanggal: '2026-11-03', jam: '09.00', dosen: 'dr. Nadia R.', peserta: 0 }] },
  { id: 7, blok: 'Blok 2', bagian: 'LAB 2', nama: 'LAB 2 - Funduskopi', tanggalJadwal: '2026-11-05',
    peserta: { acc: 0, menunggu: 0, ditolak: 4 }, baPen: null, baPel: [] },
  { id: 8, blok: 'Blok 2', bagian: 'KKD', nama: 'KKD - Refraksi Subjektif', tanggalJadwal: '2026-11-09',
    peserta: { acc: 14, menunggu: 0, ditolak: 2 }, baPen: { count: 2, tanggal: '2026-11-04' },
    baPel: [
      { id: 'BA-PEL/2026/11/0224', tanggal: '2026-11-09', jam: '08.00', dosen: 'dr. Yusuf H.', peserta: 7 },
      { id: 'BA-PEL/2026/11/0231', tanggal: '2026-11-10', jam: '08.00', dosen: 'dr. Intan M.', peserta: 5 }
    ] },
  { id: 9, blok: 'Blok 2', bagian: 'Ujian', nama: 'Ujian - Remediasi Tonometri', tanggalJadwal: '2026-11-18',
    peserta: { acc: 5, menunggu: 4, ditolak: 0 }, baPen: null, baPel: [] },
  { id: 10, blok: 'Blok 3', bagian: 'KKD', nama: 'KKD - Retinoskopi', tanggalJadwal: '2026-10-28',
    peserta: { acc: 12, menunggu: 0, ditolak: 1 }, baPen: { count: 1, tanggal: '2026-10-21' },
    baPel: [
      { id: 'BA-PEL/2026/10/0171', tanggal: '2026-10-28', jam: '09.00', dosen: 'dr. Intan M.', peserta: 6 },
      { id: 'BA-PEL/2026/10/0178', tanggal: '2026-10-29', jam: '09.00', dosen: 'dr. Yusuf H.', peserta: 6 }
    ] },
  { id: 11, blok: 'Blok 3', bagian: 'LAB 1', nama: 'LAB 1 - Oftalmoskopi', tanggalJadwal: '2026-11-12',
    peserta: { acc: 9, menunggu: 1, ditolak: 0 }, baPen: { count: 1, tanggal: '2026-11-06' }, baPel: [] },
  { id: 12, blok: 'Blok 2', bagian: 'Ujian', nama: 'Ujian - OSCP Dasar', tanggalJadwal: '2026-11-25',
    peserta: { acc: 0, menunggu: 0, ditolak: 0 }, baPen: null, baPel: [] }
];

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();
}
function kegiatanKey(bagian, blok, nama) {
  return [norm(bagian), norm(blok), norm(nama)].join('|');
}

let npmSeq = 23010001;
const pengajuan = [];
const rows = [];
const beritaAcara = [];
const kegiatan = [];
const jadwal = [];
const blokSet = {};
let nameIdx = 0;

DATA.forEach((entry, ei) => {
  blokSet[entry.blok] = 1;
  const unitPeserta = [];
  const total = entry.peserta.acc + entry.peserta.menunggu + entry.peserta.ditolak;
  const statusOrder = [];
  for (let i = 0; i < entry.peserta.acc; i++) statusOrder.push('ACC');
  for (let i = 0; i < entry.peserta.menunggu; i++) statusOrder.push('Menunggu');
  for (let i = 0; i < entry.peserta.ditolak; i++) statusOrder.push('Ditolak');

  const unitRows = [];
  for (let i = 0; i < total; i++) {
    const npm = String(npmSeq++);
    const nama = NAMES[nameIdx++ % NAMES.length];
    const status = statusOrder[i];
    const pengajuanId = 'PGJ-' + entry.id + '-' + (i + 1);
    const lastBaDate = entry.baPel.length ? entry.baPel[entry.baPel.length - 1].tanggal : null;
    const tanggal = lastBaDate || entry.tanggalJadwal;
    const row = {
      pengajuan: {
        'Timestamp': entry.tanggalJadwal + ' 08:00:00',
        'ID Pengajuan': pengajuanId,
        'NPM': npm,
        'Nama Lengkap': nama,
        'Email': norm(nama).replace(/ /g, '.') + '@student.unhas.ac.id',
        'Blok': entry.blok,
        'Jenis Kegiatan': entry.bagian,
        'Status': status,
        'Link Bukti Bayar': status === 'Ditolak' ? '' : 'https://drive.google.com/file/d/mock-' + npm + '/view',
        'Link ACC INHAL': status === 'ACC' ? 'https://inhal.example/acc/' + npm : '',
        'Link Final': status === 'ACC' ? 'https://inhal.example/final/' + npm : '',
        'Dosen': entry.baPel.length ? entry.baPel[0].dosen.split(',')[0].trim() : '',
        'Tanggal Pelaksanaan': tanggal,
        'Biaya': 150000,
        'Biaya Rupiah': 'Rp150.000',
        'Masuk BA': false,
        'Pembayaran Final': false,
        'Sumber': 'Mahasiswa'
      },
      details: [{
        'ID Pengajuan': pengajuanId,
        'Jenis Kegiatan': entry.bagian,
        'Pilihan': entry.nama,
        'Detail': '',
        'Tanggal Pelaksanaan': tanggal,
        'Bagian': entry.bagian
      }],
      history: []
    };
    unitRows.push({ npm: npm, nama: nama, status: status, pengajuanId: pengajuanId, row: row });
    pengajuan.push(row.pengajuan);
  }

  const baPesertaByBaId = {};
  const baPelaksanaan = [];
  entry.baPel.forEach((b) => {
    const peserta = unitRows.slice(0, Math.min(b.peserta, unitRows.length)).map((r) => ({
      npm: r.npm, namaLengkap: r.nama
    }));
    const baClient = {
      'Timestamp': b.tanggal + ' 15:00:00',
      'BA ID': b.id,
      'Bagian': entry.bagian,
      'Blok': entry.blok,
      'Nama Kegiatan': entry.nama,
      'Tanggal Pelaksanaan': b.tanggal,
      'Jam': b.jam,
      'Dosen': b.dosen,
      'DosenList': b.dosen.split(',').map((d) => d.trim()).filter(Boolean),
      'Jumlah Peserta': b.peserta,
      'File URL': 'https://drive.google.com/file/d/mock-' + b.id.replace(/[^A-Za-z0-9]/g, '') + '/view',
      'Catatan': '',
      'Sumber': 'Bagian',
      'Kegiatan Key': kegiatanKey(entry.bagian, entry.blok, entry.nama),
      'Label': entry.nama,
      'peserta': peserta
    };
    beritaAcara.push(baClient);
    baPelaksanaan.push(baClient);
    baPesertaByBaId[b.id] = peserta;
  });

  const baPendukung = [];
  if (entry.baPen) {
    for (let i = 0; i < entry.baPen.count; i++) {
      baPendukung.push({
        'Timestamp': entry.baPen.tanggal + ' 10:00:00',
        'BA ID': 'BA-PEN/2026/' + String(entry.id).padStart(2, '0') + '/' + (i + 1),
        'Bagian': entry.bagian,
        'Blok': entry.blok,
        'Nama Kegiatan': entry.nama,
        'Tanggal Pelaksanaan': entry.baPen.tanggal,
        'Jam': '10.00',
        'Jumlah Peserta': total,
        'File URL': 'https://drive.google.com/file/d/mock-pen-' + entry.id + '-' + (i + 1) + '/view',
        'Sumber': 'Admin'
      });
    }
  }

  const pesertaUnit = unitRows.map((r) => ({
    idPengajuan: r.pengajuanId,
    npm: r.npm,
    namaLengkap: r.nama,
    statusPengajuan: r.status,
    linkFinal: r.status === 'ACC' ? 'https://inhal.example/final/' + r.npm : '',
    masukBa: entry.baPel.some((b) => baPesertaByBaId[b.id].some((p) => p.npm === r.npm))
  }));

  const key = kegiatanKey(entry.bagian, entry.blok, entry.nama);
  const dosenSet = [];
  entry.baPel.forEach((b) => b.dosen.split(',').forEach((d) => {
    const v = d.trim();
    if (v && dosenSet.indexOf(v) === -1) dosenSet.push(v);
  }));
  const jadwalList = [{
    jadwalId: 'JDW-' + entry.id,
    tanggal: entry.tanggalJadwal,
    jam: entry.baPel.length ? entry.baPel[0].jam : '08.00',
    dosen: dosenSet[0] || '',
    dosenList: dosenSet.slice(0, 1),
    catatan: '',
    peserta: pesertaUnit.map((p) => ({ npm: p.npm, namaLengkap: p.namaLengkap })),
    baId: entry.baPel.length ? entry.baPel[0].id : '',
    kegiatanKey: key,
    bagian: entry.bagian,
    blok: entry.blok,
    namaKegiatan: entry.nama,
    label: entry.nama
  }];
  jadwal.push(jadwalList[0]);

  const finalCount = pesertaUnit.filter((p) => p.masukBa).length;
  kegiatan.push({
    key: key,
    bagian: entry.bagian,
    blok: entry.blok,
    label: entry.nama,
    peserta: pesertaUnit,
    baPendukung: baPendukung,
    baPelaksanaan: baPelaksanaan,
    pelaksanaan: baPelaksanaan.map((b) => ({
      baId: b['BA ID'], tanggal: b['Tanggal Pelaksanaan'], jam: b.Jam, dosen: b.Dosen,
      dosenList: b.DosenList, jadwalIds: [], jumlahSesi: 0
    })),
    dosenList: dosenSet,
    jadwal: jadwalList,
    progress: {
      pendaftaran: total > 0 ? 'all' : 'none',
      pendukung: baPendukung.length ? 'all' : 'none',
      keputusan: total ? 'all' : 'none',
      final: total ? 'all' : 'none',
      pelaksanaan: baPelaksanaan.length ? 'all' : 'none',
      selesai: 'none',
      counts: { peserta: total, keputusan: total, final: finalCount }
    },
    counts: { peserta: total, keputusan: total, final: finalCount }
  });

  rows.push(...unitRows.map((r) => r.row));
});

const perStatus = {}, perJenis = {}, perBlok = {};
let totalAcc = 0, totalMenunggu = 0, totalDitolak = 0;
pengajuan.forEach((p) => {
  perStatus[p.Status] = (perStatus[p.Status] || 0) + 1;
  perJenis[p['Jenis Kegiatan']] = (perJenis[p['Jenis Kegiatan']] || 0) + 1;
  perBlok[p.Blok] = (perBlok[p.Blok] || 0) + 1;
  if (p.Status === 'ACC') totalAcc++;
  if (p.Status === 'Menunggu') totalMenunggu++;
  if (p.Status === 'Ditolak') totalDitolak++;
});

const dosen = Array.from(new Set(beritaAcara.flatMap((b) => b.DosenList))).sort((a, b) => a.localeCompare(b));
const blok = Object.keys(blokSet).sort((a, b) => a.localeCompare(b));

const payload = {
  summary: {
    totalPendaftar: pengajuan.length,
    totalDitolak: totalDitolak,
    totalMenunggu: totalMenunggu,
    totalAcc: totalAcc,
    totalBiaya: pengajuan.length * 150000,
    perJenis: perJenis,
    perBlok: perBlok,
    perStatus: perStatus
  },
  rows: rows,
  uploadBukti: pengajuan.map((p) => ({
    idPengajuan: p['ID Pengajuan'],
    waktuUploadBukti: p['Link Bukti Bayar'] ? p['Timestamp'] : '',
    sumberUpload: p['Link Bukti Bayar'] ? 'Portal Mahasiswa' : ''
  })),
  beritaAcara: beritaAcara,
  dosen: dosen,
  dosenOptions: dosen,
  blok: blok,
  kegiatan: kegiatan,
  jadwal: jadwal,
  baAudit: { summary: { total: beritaAcara.length, lengkap: 0, kurang: 0 } },
  pembayaranRevisi: [],
  bagian: { categories: ['Ujian', 'SGD', 'KKD'], labs: ['LAB 1', 'LAB 2'] }
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, 'window.MOCK_LAPORAN = ' + JSON.stringify(payload, null, 2) + ';\n');
console.log('written', OUT, 'rows', rows.length, 'ba', beritaAcara.length, 'units', kegiatan.length);
