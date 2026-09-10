import { getBuktiMode, getStudentNameByNpm } from './repo.js';

export function normalizeNpm(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '');
}

export async function getStudentPortalData(db, npm) {
  const npmRaw = String(npm == null ? '' : npm).trim();
  const npmKey = normalizeNpm(npmRaw);
  if (!npmKey) {
    return { error: 'NPM tidak boleh kosong' };
  }

  const { results: all } = await db.prepare('SELECT * FROM pengajuan').all();
  const { results: details } = await db.prepare('SELECT * FROM detail_kegiatan').all();
  const detailById = new Map();
  for (const d of details || []) {
    if (!detailById.has(d.id_pengajuan)) detailById.set(d.id_pengajuan, []);
    detailById.get(d.id_pengajuan).push(d);
  }

  const rows = (all || []).filter((p) => normalizeNpm(p.npm) === npmKey);
  let namaLengkap = '';
  const history = [];

  rows.forEach((p) => {
    if (!namaLengkap && p.nama_lengkap) namaLengkap = String(p.nama_lengkap).trim();
    const id = String(p.id_pengajuan || '').trim();
    const pDetails = detailById.get(id) || [];
    const detailText = pDetails
      .map((d) => [d.pilihan || '', d.detail || ''].filter(Boolean).join(' - '))
      .filter(Boolean)
      .join('; ');
    const tanggalKegiatan = pDetails.length
      ? (pDetails[0].tanggal_pelaksanaan || '')
      : (p.tanggal_pelaksanaan || '');
    const hasUpload = !!(p.link_acc_inhal || p.link_bukti_bayar);
    history.push({
      id: id,
      idPengajuan: id,
      tanggalAjuan: p.timestamp || '',
      blok: p.blok || '',
      jenis: String(p.jenis_kegiatan || '').trim(),
      detail: detailText,
      tanggalKegiatan: tanggalKegiatan,
      status: p.status || 'Menunggu',
      reason: p.catatan_admin || '',
      hasUpload: hasUpload,
      linkFinal: p.link_final || '',
      uploadTimestamp: hasUpload ? (p.updated_at || 'Uploaded') : ''
    });
  });

  if (!namaLengkap) {
    namaLengkap = await getStudentNameByNpm(db, npmKey);
  }
  if (!namaLengkap && history.length === 0) {
    return { error: 'Data pengajuan tidak ditemukan untuk NPM ' + npmRaw + '.' };
  }

  history.sort((a, b) => String(b.tanggalAjuan || '').localeCompare(String(a.tanggalAjuan || '')));

  let latestEmail = '';
  let latestNoHp = '';
  const sortedRows = rows.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  for (const r of sortedRows) {
    if (!latestEmail && r.email) latestEmail = String(r.email).trim();
    if (!latestNoHp && r.no_hp_wa) latestNoHp = String(r.no_hp_wa).trim();
    if (latestEmail && latestNoHp) break;
  }

  const buktiMode = await getBuktiMode(db);

  return {
    nama: namaLengkap || 'Mahasiswa',
    npm: npmRaw,
    email: latestEmail,
    noHp: latestNoHp,
    buktiMode: buktiMode,
    history: history
  };
}
