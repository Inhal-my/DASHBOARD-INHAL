/* Data dummy untuk mockup penggabungan tab Berita Acara + Daftar BA.
   Sengaja tidak menyentuh aplikasi produksi. */
window.BA_DATA = {
  meta: {
    periode: 'Semester Ganjil 2026/2027',
    dibuat: '3 November 2026',
    totalPengajuan: 67
  },
  units: [
    {
      key: 'KKD|A|KKD BM — Inhal',
      bagian: 'KKD', blok: 'A', kegiatan: 'KKD BM — Inhal',
      biaya: 450000,
      jadwalCount: 2,
      peserta: [
        { npm: '2201010001', nama: 'Ayu Lestari', status: 'ACC', final: true },
        { npm: '2201010004', nama: 'Dimas Nugroho', status: 'ACC', final: true },
        { npm: '2201010009', nama: 'Intan Maharani', status: 'Menunggu', final: false }
      ],
      pendukung: [
        { id: 'BAP-2026-0031', tanggal: '2026-09-12', file: true, status: 'Lengkap', catatan: '' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0112', tanggal: '2026-09-20', jam: '08.00–10.00', dosen: 'dr. Sari Wulandari', file: true, status: 'Lengkap', flags: [], sesiKe: 1, jumlahSesi: 2, pesertaCount: 2 },
        { id: 'BA-2026-0113', tanggal: '2026-09-27', jam: '13.00–15.00', dosen: 'dr. Sari Wulandari', file: true, status: 'Lengkap', flags: ['Kemungkinan duplikat'], sesiKe: 2, jumlahSesi: 2, pesertaCount: 2 }
      ]
    },
    {
      key: 'KKD|B|KKD BM — Inhal',
      bagian: 'KKD', blok: 'B', kegiatan: 'KKD BM — Inhal',
      biaya: 300000,
      jadwalCount: 1,
      peserta: [
        { npm: '2201010012', nama: 'Rizky Pratama', status: 'ACC', final: false },
        { npm: '2201010015', nama: 'Salsabila Putri', status: 'ACC', final: false }
      ],
      pendukung: [
        { id: 'BAP-2026-0032', tanggal: '2026-09-12', file: true, status: 'Lengkap', catatan: '' }
      ],
      pelaksanaan: []
    },
    {
      key: 'LO 1|A|LO 1 — Inhal',
      bagian: 'LO 1', blok: 'A', kegiatan: 'LO 1 — Inhal',
      biaya: 300000,
      jadwalCount: 1,
      peserta: [
        { npm: '2201010020', nama: 'Bagas Saputra', status: 'ACC', final: true },
        { npm: '2201010021', nama: 'Citra Amelia', status: 'ACC', final: true }
      ],
      pendukung: [
        { id: 'BAP-2026-0040', tanggal: '2026-09-14', file: true, status: 'Lengkap', catatan: 'Surat tugas terlampir.' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0120', tanggal: '2026-09-22', jam: '10.00–12.00', dosen: 'dr. Andi Kurniawan', file: true, status: 'Lengkap', flags: [], sesiKe: 1, jumlahSesi: 1, pesertaCount: 2 }
      ]
    },
    {
      key: 'S G D 3|B|S G D 3 — Inhal',
      bagian: 'SGD', blok: 'B', kegiatan: 'S G D 3 — Inhal',
      biaya: 450000,
      jadwalCount: 2,
      peserta: [
        { npm: '2201010030', nama: 'Fajar Ramadhan', status: 'ACC', final: false },
        { npm: '2201010031', nama: 'Hana Nuraini', status: 'ACC', final: true },
        { npm: '2201010033', nama: 'Krisna Wijaya', status: 'Menunggu', final: false }
      ],
      pendukung: [],
      pelaksanaan: [
        { id: 'BA-2026-0131', tanggal: '2026-09-24', jam: '08.00–10.00', dosen: 'dr. Maya Sari', file: true, status: 'Draft', flags: ['Draft'], sesiKe: 1, jumlahSesi: 2, pesertaCount: 3 },
        { id: 'BA-2026-0132', tanggal: '2026-10-01', jam: '', dosen: 'dr. Maya Sari', file: false, status: 'Draft', flags: ['Draft', 'Sesi ekstra'], sesiKe: 2, jumlahSesi: 2, pesertaCount: 2 }
      ]
    },
    {
      key: 'Mikrobiologi|A|Mikrobiologi — Remediasi',
      bagian: 'Mikrobiologi', blok: 'A', kegiatan: 'Mikrobiologi — Remediasi',
      biaya: 600000,
      jadwalCount: 3,
      peserta: [
        { npm: '2201010040', nama: 'Larasati Dewi', status: 'Diterima', final: false },
        { npm: '2201010041', nama: 'Muhammad Iqbal', status: 'Diterima', final: false },
        { npm: '2201010043', nama: 'Nadia Safira', status: 'Diterima', final: true },
        { npm: '2201010045', nama: 'Oka Mahendra', status: 'Menunggu', final: false }
      ],
      pendukung: [
        { id: 'BAP-2026-0055', tanggal: '2026-09-16', file: true, status: 'Lengkap', catatan: '' },
        { id: 'BAP-2026-0056', tanggal: '2026-09-18', file: false, status: 'Draft', catatan: 'Menunggu tanda tangan kepala bagian.' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0140', tanggal: '2026-09-25', jam: '13.00–15.00', dosen: 'dr. Ratna Puspita', file: true, status: 'Lengkap', flags: [], sesiKe: 1, jumlahSesi: 3, pesertaCount: 4 },
        { id: 'BA-2026-0141', tanggal: '2026-09-26', jam: '08.00–10.00', dosen: 'dr. Ratna Puspita', file: true, status: 'Lengkap', flags: [], sesiKe: 2, jumlahSesi: 3, pesertaCount: 4 },
        { id: 'BA-2026-0142', tanggal: '2026-10-02', jam: '10.00–12.00', dosen: 'dr. Budi Hartono', file: true, status: 'Lengkap', flags: ['Sebagian sesi tidak cocok'], sesiKe: 3, jumlahSesi: 3, pesertaCount: 3 }
      ]
    },
    {
      key: 'Literature Searching|A|Literature Searching — Praktikum',
      bagian: 'Literature Searching', blok: 'A', kegiatan: 'Literature Searching — Praktikum',
      biaya: 300000,
      jadwalCount: 1,
      peserta: [
        { npm: '2201010050', nama: 'Putri Anggraini', status: 'ACC', final: true },
        { npm: '2201010051', nama: 'Rafi Alfarizi', status: 'ACC', final: true }
      ],
      pendukung: [
        { id: 'BAP-2026-0061', tanggal: '2026-09-19', file: true, status: 'Lengkap', catatan: '' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0150', tanggal: '2026-09-29', jam: '09.00–11.00', dosen: 'Pustakawan: Rina Eka', file: true, status: 'Lengkap', flags: [], sesiKe: 1, jumlahSesi: 1, pesertaCount: 2 }
      ]
    },
    {
      key: 'UAS|A|UAS',
      bagian: 'Ujian', blok: 'A', kegiatan: 'UAS',
      biaya: 750000,
      jadwalCount: 2,
      peserta: [
        { npm: '2201010060', nama: 'Tegar Prasetyo', status: 'ACC', final: false },
        { npm: '2201010061', nama: 'Umi Kalsum', status: 'ACC', final: false },
        { npm: '2201010063', nama: 'Vino Aditya', status: 'ACC', final: true },
        { npm: '2201010065', nama: 'Wulan Sari', status: 'ACC', final: true },
        { npm: '2201010067', nama: 'Yoga Pratama', status: 'ACC', final: true }
      ],
      pendukung: [],
      pelaksanaan: []
    },
    {
      key: 'UAS|B|UAS',
      bagian: 'Ujian', blok: 'B', kegiatan: 'UAS',
      biaya: 450000,
      jadwalCount: 1,
      peserta: [
        { npm: '2201010070', nama: 'Zahra Aulia', status: 'ACC', final: true },
        { npm: '2201010071', nama: 'Arif Setiawan', status: 'ACC', final: false },
        { npm: '2201010073', nama: 'Bella Kartika', status: 'Menunggu', final: false }
      ],
      pendukung: [
        { id: 'BAP-2026-0070', tanggal: '2026-09-21', file: true, status: 'Lengkap', catatan: '' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0160', tanggal: '2026-10-05', jam: '08.00–10.00', dosen: 'dr. Hendra Gunawan', file: true, status: 'Lengkap', flags: [], sesiKe: 1, jumlahSesi: 1, pesertaCount: 3 }
      ]
    },
    {
      key: 'Praktikum Anatomi|C|Praktikum Anatomi',
      bagian: 'Lab Anatomi', blok: 'C', kegiatan: 'Praktikum Anatomi',
      biaya: 300000,
      jadwalCount: 2,
      peserta: [
        { npm: '2201010080', nama: 'Cindy Marlina', status: 'Diterima', final: false },
        { npm: '2201010081', nama: 'Dedi Kurnia', status: 'Diterima', final: false }
      ],
      pendukung: [
        { id: 'BAP-2026-0081', tanggal: '2026-09-23', file: true, status: 'Lengkap', catatan: '' }
      ],
      pelaksanaan: [
        { id: 'BA-2026-0170', tanggal: '2026-10-06', jam: '07.30–09.30', dosen: 'dr. Sari Wulandari', file: false, status: 'Draft', flags: ['Draft'], sesiKe: 1, jumlahSesi: 2, pesertaCount: 2 }
      ]
    }
  ],
  orphan: [
    { id: 'BA-2026-0099', bagian: 'KKD', blok: 'Z', kegiatan: 'KKD 9 — Inhal', tanggal: '2026-10-03', dosen: 'dr. Maya Sari', file: true }
  ]
};
