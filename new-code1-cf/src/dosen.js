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

// Validasi nama dosen terhadap daftar master. Mengembalikan daftar kanonik
// (nama master persis) dan nama yang tidak dikenal. `existing` adalah nama
// yang sudah terpasang pada jadwal/BA sehingga varian lama tetap diizinkan.
export function validateDosenAgainstMaster(value, master, existing) {
  const list = normalizeDosenList(value);
  const masterMap = new Map();
  for (const item of master || []) {
    const nama = str(item).replace(/\s+/g, ' ');
    const key = dosenKey(nama);
    if (key && !masterMap.has(key)) masterMap.set(key, nama);
  }
  if (masterMap.size === 0) return { list, invalid: [] };
  const allowedExisting = new Set((existing || []).map(dosenKey));
  const out = [];
  const invalid = [];
  for (const nama of list) {
    const key = dosenKey(nama);
    if (masterMap.has(key)) {
      out.push(masterMap.get(key));
    } else if (allowedExisting.has(key)) {
      out.push(nama);
    } else {
      invalid.push(nama);
    }
  }
  return { list: out, invalid };
}

export function dosenMasterErrorMessage(invalid) {
  return 'Dosen tidak ada di daftar master: ' + (invalid || []).join(', ') + '. Pilih nama dosen dari daftar.';
}

export function dosenListFromRow(row) {
  if (!row) return [];
  return normalizeDosenList(row.dosenList, row.dosen);
}

export function dosenJoin(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean).join(', ');
}
