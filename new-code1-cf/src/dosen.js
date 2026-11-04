// Utilitas daftar dosen. Satu jadwal/BA boleh memiliki 2-5 dosen; tabel relasi
// (jadwal_dosen/ba_dosen) adalah sumber kebenaran, kolom `dosen` lama hanya
// menyimpan dosen utama demi kompatibilitas konsumen lama.

export const MAX_DOSEN = 5;

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

export function dosenKey(v) {
  return str(v).replace(/\s+/g, ' ').toLowerCase();
}

// Mengubah input apa pun menjadi daftar dosen bersih: membuang kosong,
// merapikan spasi, menolak duplikat (case-insensitive), dan membatasi jumlah.
export function normalizeDosenList(value, fallback) {
  let raw = value;
  if (raw === undefined || raw === null || raw === '') {
    raw = fallback;
  }
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) raw = [raw];
  const out = [];
  const seen = {};
  for (const item of raw) {
    const nama = str(item).replace(/\s+/g, ' ');
    if (!nama) continue;
    const key = dosenKey(nama);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(nama);
    if (out.length >= MAX_DOSEN) break;
  }
  return out;
}

export function dosenListFromRow(row) {
  if (!row) return [];
  return normalizeDosenList(row.dosenList, row.dosen);
}

export function dosenJoin(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean).join(', ');
}
