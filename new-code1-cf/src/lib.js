export function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFormText(value) {
  return String(value == null ? '' : value).trim();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export function isValidPhone(value) {
  return /^[0-9+\-\s().]{8,20}$/.test(String(value || '').trim());
}

export function bagianKey(lab, kegiatan) {
  return norm(lab) + '|' + norm(kegiatan);
}

export function buildPengajuanKey(formData) {
  const npm = norm(formData.npm);
  const jenis = norm(formData.jenisKegiatan);
  let detail = '';
  let tanggal = '';
  if (jenis === 'ujian') {
    detail = norm(formData.detailKegiatan);
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'sgd') {
    detail = [norm(formData.pilihanSgd), norm(formData.detailSgd)].filter(Boolean).join(' | ');
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'kkd') {
    detail = [norm(formData.pilihanKkd), norm(formData.detailKkd)].filter(Boolean).join(' | ');
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'praktikum' && Array.isArray(formData.praktikum) && formData.praktikum.length > 0) {
    const parts = formData.praktikum
      .map((p) => [norm(p.lab), norm(p.kegiatanLab), norm(p.tanggal)].filter(Boolean).join(' | '))
      .filter(Boolean)
      .sort();
    detail = parts.join(' && ');
    tanggal = norm(formData.praktikum[0].tanggal);
  }
  return [npm, jenis, detail, tanggal].join('||');
}

export function storedKeyFromDetails(pengajuan, details) {
  const npm = norm(pengajuan.npm);
  const jenis = norm(pengajuan.jenis_kegiatan);
  const detailParts = [];
  let tanggal = '';
  (details || []).forEach((d) => {
    detailParts.push([norm(d.pilihan), norm(d.detail)].filter(Boolean).join(' | '));
    if (!tanggal) tanggal = norm(d.tanggal_pelaksanaan);
  });
  const detail = detailParts.filter(Boolean).sort().join(' && ');
  return [npm, jenis, detail, tanggal].join('||');
}

export function buildDetailKegiatanRows(formData, idPengajuan, bagianMap, nowIso) {
  const rows = [];
  const jenis = normalizeFormText(formData.jenisKegiatan);
  const addRow = (pilihan, detail, tanggal) => {
    rows.push({
      timestamp: nowIso,
      id_pengajuan: idPengajuan,
      jenis_kegiatan: jenis,
      pilihan,
      detail,
      tanggal_pelaksanaan: tanggal,
      bagian: jenis === 'Praktikum' ? (bagianMap.get(bagianKey(pilihan, detail)) || '') : ''
    });
  };
  if (jenis === 'Ujian') {
    addRow(normalizeFormText(formData.detailKegiatan), '', normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'SGD') {
    addRow(normalizeFormText(formData.pilihanSgd), normalizeFormText(formData.detailSgd), normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'KKD') {
    addRow(normalizeFormText(formData.pilihanKkd), normalizeFormText(formData.detailKkd), normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'Praktikum' && Array.isArray(formData.praktikum)) {
    formData.praktikum.forEach((p) => {
      const lab = normalizeFormText(p && p.lab);
      const kegiatan = normalizeFormText(p && p.kegiatanLab);
      const tanggal = normalizeFormText(p && p.tanggal);
      if (lab || kegiatan) addRow(lab, kegiatan, tanggal);
    });
  }
  return rows;
}

export function nowLocalIso(date = new Date()) {
  const pad = (n) => (n < 10 ? '0' : '') + n;
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

export function newIdPengajuan() {
  return 'INHAL-' + crypto.randomUUID();
}
