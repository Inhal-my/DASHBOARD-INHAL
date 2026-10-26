// Tautan BA Pelaksanaan -> jadwal sesi. Satu BA boleh mencakup banyak jadwal;
// kolom lama berita_acara.jadwal_id tetap dipakai sebagai fallback.

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

export async function loadBaSesiMap(db) {
  const { results } = await db.prepare(
    'SELECT ba_id, jadwal_id FROM berita_acara_sesi ORDER BY urutan, id'
  ).all();
  const map = {};
  for (const row of results || []) {
    const baId = str(row.ba_id);
    const jadwalId = str(row.jadwal_id);
    if (!baId || !jadwalId) continue;
    if (!map[baId]) map[baId] = [];
    if (map[baId].indexOf(jadwalId) === -1) map[baId].push(jadwalId);
  }
  return map;
}

export function baJadwalIds(map, baId, legacyJadwalId) {
  const key = str(baId);
  const ids = (map && map[key]) ? map[key].slice() : [];
  if (!ids.length) {
    const legacy = str(legacyJadwalId);
    if (legacy) ids.push(legacy);
  }
  return ids;
}

// Peta jadwal_id -> ba_id untuk penanda "punyaBa" pada daftar jadwal.
export function baIdByJadwal(rows, sesiMap) {
  const out = {};
  for (const row of rows || []) {
    const jadwalId = str(row && row.jadwal_id);
    const baId = str(row && row.ba_id);
    if (jadwalId && baId && !out[jadwalId]) out[jadwalId] = baId;
  }
  for (const baId of Object.keys(sesiMap || {})) {
    for (const jadwalId of sesiMap[baId]) {
      if (jadwalId && baId) out[jadwalId] = baId;
    }
  }
  return out;
}
