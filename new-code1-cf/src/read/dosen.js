import { normalizeDosenList } from '../dosen.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

// Peta jadwal_id -> daftar dosen dari tabel relasi jadwal_dosen.
export async function loadJadwalDosenMap(db) {
  const { results } = await db.prepare(
    'SELECT jadwal_id, nama FROM jadwal_dosen ORDER BY urutan, id'
  ).all();
  const map = {};
  for (const row of results || []) {
    const id = str(row.jadwal_id);
    if (!id) continue;
    if (!map[id]) map[id] = [];
    const nama = str(row.nama);
    if (nama && map[id].indexOf(nama) === -1) map[id].push(nama);
  }
  return map;
}

// Peta ba_id -> daftar dosen dari tabel relasi ba_dosen.
export async function loadBaDosenMap(db) {
  const { results } = await db.prepare(
    'SELECT ba_id, nama FROM ba_dosen ORDER BY urutan, id'
  ).all();
  const map = {};
  for (const row of results || []) {
    const id = str(row.ba_id);
    if (!id) continue;
    if (!map[id]) map[id] = [];
    const nama = str(row.nama);
    if (nama && map[id].indexOf(nama) === -1) map[id].push(nama);
  }
  return map;
}

export function dosenListFor(map, id, fallback) {
  const list = (map && map[str(id)]) ? map[str(id)].slice() : [];
  if (list.length) return list;
  return normalizeDosenList(fallback);
}

// Daftar dosen BA: utamakan dosen dari jadwal yang tertaut agar relasi
// ba_dosen yang sudah tidak relevan tidak lagi muncul di laporan. Bila BA
// belum punya jadwal, pakai relasi ba_dosen lalu kolom teks BA.
export function baDosenListFor(baDosenMap, jadwalDosenMap, baId, jadwalIds, fallback) {
  const list = [];
  const ids = Array.isArray(jadwalIds) ? jadwalIds : [];
  for (const jid of ids) {
    const names = (jadwalDosenMap && jadwalDosenMap[str(jid)]) || [];
    for (const nama of names) {
      const value = str(nama);
      if (value && list.indexOf(value) === -1) list.push(value);
    }
  }
  if (list.length) return list;
  return dosenListFor(baDosenMap, baId, fallback);
}
