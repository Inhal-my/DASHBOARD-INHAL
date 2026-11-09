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

export function isValidDateOnly(value) {
  const s = normalizeFormText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const parts = s.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function bagianKey(lab, kegiatan) {
  return norm(lab) + '|' + norm(kegiatan);
}

function detailPart(pilihan, detail, defaultDetail) {
  return [norm(pilihan), norm(detail) || defaultDetail].filter(Boolean).join(' | ');
}

export function buildPengajuanKey(formData) {
  const npm = norm(formData.npm);
  const jenis = norm(formData.jenisKegiatan);
  const parts = [];
  let tanggal = '';
  if (jenis === 'ujian') {
    parts.push(norm(formData.detailKegiatan));
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'sgd') {
    parts.push(detailPart(formData.pilihanSgd, formData.detailSgd, 'inhal'));
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'kkd') {
    parts.push(detailPart(formData.pilihanKkd, formData.detailKkd, 'inhal'));
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'praktikum' && Array.isArray(formData.praktikum)) {
    const rows = formData.praktikum.filter((p) => p && (normalizeFormText(p.lab) || normalizeFormText(p.kegiatanLab)));
    for (const row of rows) parts.push(detailPart(row.lab, row.kegiatanLab, ''));
    const first = rows[0];
    if (first) tanggal = norm(first.tanggal);
  }
  const detail = parts.filter(Boolean).sort().join(' && ');
  return [npm, jenis, detail, tanggal].join('||');
}

export function storedKeyFromDetails(pengajuan, details) {
  const npm = norm(pengajuan.npm);
  const jenis = norm(pengajuan.jenis_kegiatan);
  const defaultDetail = (jenis === 'kkd' || jenis === 'sgd') ? 'inhal' : '';
  const detailParts = [];
  let tanggal = '';
  (details || []).forEach((d) => {
    if (jenis === 'ujian') {
      detailParts.push(norm(d.pilihan));
    } else {
      detailParts.push(detailPart(d.pilihan, d.detail, defaultDetail));
    }
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
    addRow(normalizeFormText(formData.detailKegiatan), normalizeFormText(formData.detailUjian) || 'Inhal', normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'SGD') {
    addRow(normalizeFormText(formData.pilihanSgd), normalizeFormText(formData.detailSgd) || 'Inhal', normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'KKD') {
    addRow(normalizeFormText(formData.pilihanKkd), normalizeFormText(formData.detailKkd) || 'Inhal', normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'Praktikum' && Array.isArray(formData.praktikum)) {
    for (const p of formData.praktikum) {
      if (!p) continue;
      const lab = normalizeFormText(p.lab);
      const kegiatanLab = normalizeFormText(p.kegiatanLab);
      if (!lab && !kegiatanLab) continue;
      addRow(lab, kegiatanLab, normalizeFormText(p.tanggal));
    }
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
