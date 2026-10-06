import { norm, bagianKey, storedKeyFromDetails } from './lib.js';

export async function getMasterOptions(db, kategori) {
  const { results } = await db.prepare('SELECT kategori, nilai FROM master_kegiatan').all();
  const target = norm(kategori);
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    if (norm(r.kategori) !== target) continue;
    const v = String(r.nilai || '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export async function getBuktiMode(db) {
  const row = await db.prepare("SELECT value FROM config WHERE key = 'BUKTI_MODE'").first();
  const v = row ? String(row.value || '').trim().toLowerCase() : '';
  return v === 'lenggang' ? 'lenggang' : 'strict';
}

export async function getStudentNameByNpm(db, npm) {
  const row = await db.prepare('SELECT nama_lengkap FROM mahasiswa WHERE npm = ?1').bind(String(npm || '').trim()).first();
  return row ? (row.nama_lengkap || '') : '';
}

export async function getMahasiswaByNpm(db, npm) {
  const row = await db.prepare('SELECT npm, nama_lengkap, email, blok, keterangan FROM mahasiswa WHERE npm = ?1').bind(String(npm || '').trim()).first();
  if (!row) return null;
  return {
    NPM: row.npm || '',
    'Nama Lengkap': row.nama_lengkap || '',
    Email: row.email || '',
    Blok: row.blok || '',
    Keterangan: row.keterangan || ''
  };
}

export async function getDosenOptions(db) {
  return getMasterOptions(db, 'Dosen');
}

export async function getBagianStaffList(db) {
  const { results } = await db.prepare('SELECT email, kategori, nama, pass FROM bagian_staff ORDER BY id').all();
  return (results || []).map((r) => ({
    Email: r.email || '', Kategori: r.kategori || '', Nama: r.nama || '', Pass: r.pass || ''
  }));
}

export async function getBagianMap(db) {
  const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
  const map = new Map();
  for (const r of results || []) {
    const key = bagianKey(r.lab, r.kegiatan_lab);
    if (key !== '|' && !map.has(key)) map.set(key, r.bagian || '');
  }
  return map;
}

export async function findDuplicatePengajuan(db, formKey) {
  if (!formKey) return false;
  const { results: pengajuans } = await db.prepare('SELECT id_pengajuan, npm, jenis_kegiatan FROM pengajuan').all();
  const { results: details } = await db.prepare('SELECT id_pengajuan, pilihan, detail, tanggal_pelaksanaan FROM detail_kegiatan').all();
  const byId = new Map();
  for (const d of details || []) {
    if (!byId.has(d.id_pengajuan)) byId.set(d.id_pengajuan, []);
    byId.get(d.id_pengajuan).push(d);
  }
  for (const p of pengajuans || []) {
    if (storedKeyFromDetails(p, byId.get(p.id_pengajuan) || []) === formKey) return true;
  }
  return false;
}
