import { getBuktiMode as repoBuktiMode } from '../repo.js';

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function baginaKey(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseCurrency(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const clean = String(str).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function formatRupiah(num) {
  const n = Number(num) || 0;
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return sign + 'Rp ' + out;
}

export function dateOnly(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
}

export function pushUnique(list, v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s && list.indexOf(s) === -1) list.push(s);
}

export async function getMasterOptions(db, kategori) {
  const { results } = await db.prepare('SELECT kategori, nilai FROM master_kegiatan').all();
  const target = norm(kategori);
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    if (norm(r.kategori) !== target) continue;
    const v = String(r.nilai || '').trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

export async function getBuktiMode(db) {
  return repoBuktiMode(db);
}

export async function getBiayaMap(db) {
  try {
    const { results } = await db.prepare('SELECT kegiatan, biaya FROM master_biaya').all();
    const map = {};
    for (const r of results || []) {
      const k = String(r.kegiatan || '').trim();
      if (k) map[k] = parseCurrency(r.biaya);
    }
    return map;
  } catch (e) {
    return {};
  }
}

export async function getBiayaOverrideMap(db) {
  try {
    const { results } = await db.prepare('SELECT id_pengajuan, pilihan, detail, tanggal_pelaksanaan, biaya FROM check_data').all();
    const map = {};
    for (const c of results || []) {
      const id = String(c.id_pengajuan || '').trim();
      if (!id) continue;
      if (String(c.detail || '').trim() !== 'BIAYA-OVERRIDE') continue;
      if (String(c.pilihan || '').trim() || String(c.tanggal_pelaksanaan || '').trim()) continue;
      const biaya = String(c.biaya || '').trim();
      if (!biaya) continue;
      map[id] = parseCurrency(biaya);
    }
    return map;
  } catch (e) {
    return {};
  }
}

export function resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap) {
  const id = String((pengajuan && pengajuan['ID Pengajuan']) || '').trim();
  overrideMap = overrideMap || {};
  if (id && overrideMap[id] !== undefined && overrideMap[id] !== null && String(overrideMap[id]).trim() !== '') {
    return overrideMap[id];
  }
  biayaMap = biayaMap || {};
  const jenis = String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim();
  if (jenis && biayaMap[jenis] !== undefined) return biayaMap[jenis];
  const jNorm = norm(jenis);
  for (const k of Object.keys(biayaMap)) {
    const kNorm = norm(k);
    if (kNorm && jNorm && (jNorm.indexOf(kNorm) !== -1 || kNorm.indexOf(jNorm) !== -1)) return biayaMap[k];
  }
  return 0;
}

export function resolveBagianFor(masterBagianRows, jenis, pilihan, detail) {
  if (jenis !== 'Praktikum') return '';
  const lab = norm(pilihan);
  const kegiatan = norm(detail);
  for (const r of masterBagianRows || []) {
    if (norm(r.lab) === lab && norm(r.kegiatan_lab) === kegiatan) return r.bagian || '';
  }
  return '';
}

export function isWildcardBaginaKategori(k) {
  const v = baginaKey(k);
  return v === '' || v === '*' || v === 'semua' || v === 'all';
}

export function getBagianAliasMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const lab = baginaKey(r.lab);
    if (!lab) continue;
    for (const field of ['lab', 'kegiatan_lab', 'bagian']) {
      const k = baginaKey(r[field]);
      if (k) map[k] = lab;
    }
  }
  return map;
}

export function baginaHasAccess(entry, kategori, subBagian, aliasMap) {
  if (!entry || !entry.kategoris || entry.kategoris.length === 0) return true;
  const kat = baginaKey(kategori);
  const sub = baginaKey(subBagian);
  const isPraktikum = kat === 'praktikum';
  const map = (isPraktikum && sub) ? (aliasMap || {}) : {};
  for (const raw of entry.kategoris) {
    const nk = baginaKey(raw);
    if (isWildcardBaginaKategori(raw)) return true;
    if (nk === kat) return true;
    if (isPraktikum && nk.indexOf('lab') !== -1 && (!sub || nk.indexOf(sub) !== -1)) return true;
    if (sub && nk === sub) return true;
    if (sub && map[nk] === sub) return true;
  }
  return false;
}

export function getBagianOptions12(labs) {
  return ['Ujian', 'SGD', 'KKD'].concat(labs || []);
}

export function resolveBagian12(rawLabel, pilihan, namaKegiatan, labs) {
  const categories = ['Ujian', 'SGD', 'KKD'];
  const list = labs || [];
  const v = String(rawLabel || '').replace(/\s+/g, ' ').trim();
  const key = norm(v);
  if (key) {
    for (const c of categories) if (norm(c) === key) return c;
    for (const l of list) if (norm(l) === key) return l;
  }
  const pKey = norm(pilihan);
  if (pKey) for (const l of list) if (norm(l) === pKey) return l;
  const nKey = norm(namaKegiatan);
  if (nKey) {
    const sorted = list.slice().sort((a, b) => norm(b).length - norm(a).length);
    for (const l of sorted) if (nKey.indexOf(norm(l)) !== -1) return l;
  }
  return '';
}

export function normBagianAggregateWithLabs(raw, labs) {
  const v = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!v) return 'Lainnya';
  const key = norm(v);
  for (const c of ['SGD', 'KKD', 'Ujian', 'Praktikum']) {
    if (norm(c) === key) return c;
  }
  for (const l of labs || []) {
    if (norm(l) === key) return 'Praktikum';
  }
  return 'Lainnya';
}

async function configValue(db, key, fallback) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?1').bind(key).first();
  const v = row ? String(row.value || '').trim() : '';
  return v === '' ? fallback : v;
}

export async function getBagianBaStatuses(db) {
  const raw = await configValue(db, 'BAGIAN_BA_STATUSES', '');
  const def = ['Diterima', 'ACC'];
  if (!raw) return def;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : def;
}

export async function getBagianBaFinalOnly(db) {
  return (await configValue(db, 'BAGIAN_BA_FINAL_ONLY', 'true')) !== 'false';
}

export async function getBagianBaSettings(db) {
  return { statuses: await getBagianBaStatuses(db), finalOnly: await getBagianBaFinalOnly(db) };
}
