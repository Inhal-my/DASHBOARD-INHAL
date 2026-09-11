import { baginaHasAccess, getBagianAliasMap } from './read/common.js';
import { throttleKey, getThrottleState, recordFailure, clearFailures, lockoutMessage } from './throttle.js';

export const SESSION_TTL_SECS = 4 * 60 * 60;
export const AUTH_ERROR = 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.';

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function expiresAt() {
  return new Date(Date.now() + SESSION_TTL_SECS * 1000).toISOString().replace(/\.\d+Z$/, '');
}

export async function createSession(db, payload) {
  const token = crypto.randomUUID();
  const p = payload || {};
  await db.prepare(
    'INSERT INTO sessions (token, role, nama, kategori, sub_bagian, kategoris, created_at, expires_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)'
  ).bind(
    token, p.role || '', p.nama || '', p.kategori || '', p.subBagian || '',
    JSON.stringify(p.kategoris || []), nowIso(), expiresAt()
  ).run();
  return token;
}

export async function getSession(db, token) {
  if (!token) return null;
  const row = await db.prepare('SELECT * FROM sessions WHERE token = ?1').bind(String(token)).first();
  if (!row) return null;
  if (row.expires_at && String(row.expires_at) <= nowIso()) {
    await destroySession(db, token);
    return null;
  }
  let kategoris = [];
  try { kategoris = JSON.parse(row.kategoris || '[]'); } catch (e) { kategoris = []; }
  return {
    role: row.role || '', nama: row.nama || '', kategori: row.kategori || '',
    subBagian: row.sub_bagian || '', kategoris: kategoris
  };
}

export async function destroySession(db, token) {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(String(token)).run();
}

export async function requireAdmin(db, token) {
  const s = await getSession(db, token);
  if (!s || s.role !== 'admin') throw new Error(AUTH_ERROR);
  return s;
}

export async function requireBagianSession(db, kategori, subBagian, token) {
  const s = await getSession(db, token);
  if (!s || s.role !== 'bagian') throw new Error(AUTH_ERROR);
  const kat = String(kategori || '').trim();
  if (kat) {
    const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
    const aliasMap = getBagianAliasMap(results || []);
    if (!baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian, aliasMap)) {
      throw new Error('Akses ditolak. Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '.');
    }
  }
  return s;
}

export async function authenticateAdmin(db, password, ip) {
  const key = throttleKey('admin', ip);
  const lock = await getThrottleState(db, key);
  if (lock.locked) return { ok: false, message: lockoutMessage(lock.retryAfterMs) };
  const pwd = String(password || '').trim();
  if (!pwd) return { ok: false, message: 'Masukkan password admin.' };
  const { results } = await db.prepare('SELECT password, nama FROM admin').all();
  for (const row of results || []) {
    if (String(row.password || '').trim() && String(row.password).trim() === pwd) {
      await clearFailures(db, key);
      const nama = String(row.nama || '').trim() || 'Admin';
      return { ok: true, token: await createSession(db, { role: 'admin', nama }), nama };
    }
  }
  await recordFailure(db, key);
  return { ok: false, message: 'Password admin salah.' };
}

export async function authenticateBagian(db, password, kategori, subBagian, ip) {
  const key = throttleKey('bagian', ip);
  const lock = await getThrottleState(db, key);
  if (lock.locked) return { ok: false, message: lockoutMessage(lock.retryAfterMs) };
  const pwd = String(password || '').trim();
  if (!pwd) return { ok: false, message: 'Masukkan password.' };
  const kat = String(kategori || '').trim();
  const sub = String(subBagian || '').trim();
  const { results } = await db.prepare('SELECT email, kategori, nama, pass FROM bagian_staff').all();
  const { results: masterBagian } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
  const aliasMap = getBagianAliasMap(masterBagian || []);
  let account = null;
  for (const r of results || []) {
    if (String(r.pass || '').trim() && String(r.pass).trim() === pwd) {
      const entry = { kategoris: r.kategori ? [r.kategori] : [], nama: r.nama };
      if (baginaHasAccess(entry, kat, sub, aliasMap)) {
        account = { nama: String(r.nama || '').trim() || 'Bagian', kategori: String(r.kategori || '').trim(), kategoris: entry.kategoris };
        break;
      }
    }
  }
  if (!account) {
    await recordFailure(db, key);
    return { ok: false, message: 'Password tidak berlaku untuk bagian ' + (kat || 'yang dipilih') + ' ini.' };
  }
  await clearFailures(db, key);
  const token = await createSession(db, {
    role: 'bagian', nama: account.nama, kategori: kat, subBagian: sub, kategoris: account.kategoris
  });
  return { ok: true, token, nama: account.nama, kategori: kat, subBagian: sub };
}

export async function adminBagianBypass(db, kategori, subBagian, token) {
  const admin = await requireAdmin(db, token);
  const kat = String(kategori || '').trim();
  const allowedCats = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
  if (allowedCats.indexOf(kat) === -1) return { ok: false, message: 'Pilih kategori kegiatan terlebih dahulu.' };
  const sub = String(subBagian || '').trim();
  if (kat === 'Praktikum' && !sub) return { ok: false, message: 'Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.' };
  const newToken = await createSession(db, { role: 'bagian', nama: admin.nama || 'Admin', kategori: kat, subBagian: sub, kategoris: [kat] });
  return { ok: true, token: newToken, nama: admin.nama || 'Admin', kategori: kat, subBagian: sub };
}

export async function logoutSession(db, token) {
  await destroySession(db, token);
  return { success: true, message: 'Anda telah keluar.' };
}
