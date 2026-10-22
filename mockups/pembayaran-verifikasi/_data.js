window.MOCK_ROWS = [
  {
    id: 'p1', nama: 'Ahmad Fauzi', npm: '210901001', prodi: 'Informatika',
    kegiatan: 'KKD 1 - Inhal', tagihan: 250000, dibayar: 250000,
    status: 'valid', kesesuaian: 'pas', metode: 'Transfer BSI', tanggal: '12 Okt 2026', versi: 1,
    verifikator: 'Rani · Keuangan', finalSent: true, bukti: true,
    catatan: 'Nominal sesuai tagihan. Bukti asli, bukan tangkapan layar.'
  },
  {
    id: 'p2', nama: 'Siti Nurhaliza', npm: '220901014', prodi: 'Manajemen',
    kegiatan: 'SGD 2 - Remediasi', tagihan: 350000, dibayar: 300000,
    status: 'menunggu', kesesuaian: 'kurang', metode: 'Transfer Mandiri', tanggal: '14 Okt 2026', versi: 2,
    verifikator: 'Belum diverifikasi', finalSent: true, bukti: true,
    catatan: 'Versi 2 terbaca Rp300.000, kurang Rp50.000 dari tagihan.'
  },
  {
    id: 'p3', nama: 'Budi Santoso', npm: '200901033', prodi: 'Akuntansi',
    kegiatan: 'SGD 1 - Inhal', tagihan: 150000, dibayar: 150000,
    status: 'menunggu', kesesuaian: 'pas', metode: 'Transfer BRI', tanggal: '15 Okt 2026', versi: 1,
    verifikator: 'Belum diverifikasi', finalSent: false, bukti: true,
    catatan: 'Menunggu pemeriksaan oleh petugas.'
  },
  {
    id: 'p4', nama: 'Rina Wulandari', npm: '210901078', prodi: 'Informatika',
    kegiatan: 'KKD 2 - Sertifikasi', tagihan: 500000, dibayar: 550000,
    status: 'menunggu', kesesuaian: 'lebih', metode: 'Transfer BNI', tanggal: '16 Okt 2026', versi: 1,
    verifikator: 'Belum diverifikasi', finalSent: false, bukti: true,
    catatan: 'Terindikasi kelebihan bayar Rp50.000.'
  },
  {
    id: 'p5', nama: 'M. Ikhsan', npm: '230901002', prodi: 'Hukum',
    kegiatan: 'KKD 1 - Legal Drafting', tagihan: 0, dibayar: 0,
    status: 'gratis', kesesuaian: null, metode: '—', tanggal: '10 Okt 2026', versi: 0,
    verifikator: 'Rani · Keuangan', finalSent: true, bukti: false,
    catatan: 'Dibiayakan fakultas. Tidak perlu bukti bayar.'
  },
  {
    id: 'p6', nama: 'Dewi Lestari', npm: '220901055', prodi: 'Kedokteran',
    kegiatan: 'SGD 1 - Kesehatan', tagihan: 275000, dibayar: 0,
    status: 'belum', kesesuaian: null, metode: '—', tanggal: '—', versi: 0,
    verifikator: '—', finalSent: false, bukti: false,
    catatan: 'Peserta belum mengunggah bukti.'
  },
  {
    id: 'p7', nama: 'Fajar Ramadhan', npm: '200901091', prodi: 'Teknik Sipil',
    kegiatan: 'KKD 2 - Kunjungan Industri', tagihan: 400000, dibayar: 400000,
    status: 'menunggu', kesesuaian: 'pas', metode: 'Transfer BSI', tanggal: '11 Okt 2026', versi: 1,
    verifikator: 'Belum diverifikasi', finalSent: false, bukti: true,
    masalah: 'Bukti tidak sesuai',
    catatan: 'Bukti berupa tangkapan layar percakapan, bukan resi transfer.'
  },
  {
    id: 'p8', nama: 'Nadia Putri', npm: '210901120', prodi: 'Psikologi',
    kegiatan: 'SGD 2 - Public Speaking', tagihan: 200000, dibayar: 200000,
    status: 'menunggu', kesesuaian: 'pas', metode: 'Transfer BSI', tanggal: '17 Okt 2026', versi: 1,
    verifikator: 'Belum diverifikasi', finalSent: true, bukti: true,
    catatan: 'ACC Final sudah terkirim sebelum pembayaran diverifikasi.'
  },
  {
    id: 'p9', nama: 'Rizky Pratama', npm: '220901137', prodi: 'Informatika',
    kegiatan: 'KKD 1 - Hackathon', tagihan: 100000, dibayar: 0,
    status: 'belum', kesesuaian: null, metode: '—', tanggal: '—', versi: 0,
    verifikator: '—', finalSent: false, bukti: false,
    catatan: 'Peserta belum mengunggah bukti.'
  },
  {
    id: 'p10', nama: 'Ayu Safitri', npm: '210901145', prodi: 'Farmasi',
    kegiatan: 'SGD 2 - GMP', tagihan: 325000, dibayar: 325000,
    status: 'valid', kesesuaian: 'pas', metode: 'Transfer Mandiri', tanggal: '13 Okt 2026', versi: 1,
    verifikator: 'Rani · Keuangan', finalSent: true, bukti: true,
    catatan: 'Nominal sesuai tagihan.'
  }
];

window.STATUS = {
  belum:    { label: 'Belum Bayar',         cls: 'slate',  short: 'Belum' },
  menunggu: { label: 'Menunggu Verifikasi', cls: 'amber',  short: 'Menunggu' },
  valid:    { label: 'Valid',               cls: 'green',  short: 'Valid' },
  gratis:   { label: 'Gratis',              cls: 'indigo', short: 'Gratis' }
};

window.KESESUAIAN = {
  kurang: { label: 'Kurang', cls: 'rose' },
  lebih:  { label: 'Lebih',  cls: 'amber' },
  pas:    { label: 'Pas',    cls: 'green' }
};

window.rp = function (n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
};

window.badge = function (status) {
  var s = window.STATUS[status] || window.STATUS.belum;
  return '<span class="badge ' + s.cls + '">' + s.label + '</span>';
};

window.initials = function (nama) {
  return String(nama || '?')
    .replace(/[^A-Za-zÀ-ÿ ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join('');
};

window.diffInfo = function (r) {
  if (!r.bukti || r.status === 'belum') {
    return { cls: '', text: 'Belum ada bukti', short: '—' };
  }
  if (r.status === 'gratis') {
    return { cls: 'pas', text: 'Tanpa biaya', short: 'Gratis' };
  }
  var d = (r.dibayar || 0) - (r.tagihan || 0);
  if (d === 0) return { cls: 'pas', text: 'Pas dengan tagihan', short: 'Pas' };
  if (d < 0) return { cls: 'kurang', text: 'Kurang ' + window.rp(-d), short: 'Kurang ' + window.rp(-d) };
  return { cls: 'lebih', text: 'Lebih ' + window.rp(d), short: 'Lebih ' + window.rp(d) };
};

window.suggestKesesuaian = function (r) {
  if (r.kesesuaian) return r.kesesuaian;
  if (!r.bukti || r.status === 'belum') return 'pas';
  if (r.status === 'gratis') return 'pas';
  var d = (r.dibayar || 0) - (r.tagihan || 0);
  if (d === 0) return 'pas';
  return d < 0 ? 'kurang' : 'lebih';
};

window.receiptHTML = function (r) {
  if (!r.bukti) {
    return '<div class="empty-state">Belum ada bukti bayar yang diunggah.</div>';
  }
  var ref = 'TRF/' + String(r.npm).slice(-6) + '/' + String(2026).slice(-2) + (r.versi > 1 ? '-v' + r.versi : '');
  return '' +
    '<div class="receipt-wrap">' +
      '<div class="receipt">' +
        '<div class="rh">BUKTI TRANSFER</div>' +
        '<div class="bank">' + r.metode.replace('Transfer ', 'Bank ') + '</div>' +
        '<div class="ramt">' + window.rp(r.dibayar) + '</div>' +
        '<div class="rok">BERHASIL</div>' +
        '<div class="rline"><span>Pengirim</span><span>' + r.nama.toUpperCase() + '</span></div>' +
        '<div class="rline"><span>Tanggal</span><span>' + r.tanggal + '</span></div>' +
        '<div class="rline"><span>No. referensi</span><span>' + ref + '</span></div>' +
        '<div class="rline"><span>Keterangan</span><span>' + r.kegiatan.slice(0, 24) + '</span></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px">' +
        '<span class="cell-sub">versi ' + r.versi + ' · diunggah ' + r.tanggal + '</span>' +
        '<a class="filelink" href="#" onclick="return false"><span class="file-ic">PDF</span>Buka berkas</a>' +
      '</div>' +
    '</div>';
};

window.ocrHTML = function (r) {
  if (!r.bukti || r.status !== 'menunggu') return '';
  return '' +
    '<div class="ocr">' +
      '<div class="top">' +
        '<div><div class="k">Pembacaan otomatis bukti</div><div class="v">' + window.rp(r.dibayar) + '</div></div>' +
        '<span class="conf">keyakinan 96%</span>' +
      '</div>' +
      '<div class="note">Nominal dan tanggal terisi otomatis dari PDF. Petugas tetap menentukan kesesuaian secara manual.</div>' +
    '</div>';
};

window.timelineHTML = function (r) {
  if (!r.versi) {
    return '<div class="note-box">Belum ada bukti yang diunggah, sehingga belum ada riwayat versi.</div>';
  }
  var items = '';
  items +=
    '<div class="tl-item">' +
      '<div class="tl-dot amber"></div>' +
      '<div class="tl-main"><div class="tl-title">Versi 1 diunggah</div>' +
      '<div class="tl-sub">' + (r.versi > 1 ? '8 Okt 2026' : r.tanggal) + ' · ' + (r.versi > 1 ? 'Hasil pindai buram, nominal tidak terbaca.' : 'Bukti diunggah peserta.') + '</div></div>' +
    '</div>';
  if (r.versi > 1) {
    items +=
      '<div class="tl-item">' +
        '<div class="tl-dot indigo"></div>' +
        '<div class="tl-main"><div class="tl-title">Versi 2 diunggah peserta</div>' +
        '<div class="tl-sub">' + r.tanggal + ' · ' + r.catatan + '</div></div>' +
      '</div>';
  }
  if (r.status === 'valid') {
    items +=
      '<div class="tl-item">' +
        '<div class="tl-dot green"></div>' +
        '<div class="tl-main"><div class="tl-title">Diverifikasi: ' + (window.KESESUAIAN[r.kesesuaian] || window.KESESUAIAN.pas).label + '</div>' +
        '<div class="tl-sub">' + r.tanggal + ' · ' + r.verifikator + '</div></div>' +
      '</div>';
  }
  return '<div class="timeline">' + items + '</div>';
};

window.flagText = function (r) {
  if (r.status === 'valid' || r.status === 'gratis') return '';
  if (r.masalah) return r.masalah;
  if (r.finalSent) return 'Final terkirim, bayar belum valid';
  return '';
};

window.byId = function (id) {
  return window.MOCK_ROWS.filter(function (r) { return r.id === id; })[0];
};
