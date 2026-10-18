import { verifyTotp } from './totp.js';
import { findRecoveryCode } from './recovery.js';

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export async function getAdminMfa(db, adminId) {
  if (!adminId) return null;
  return db.prepare('SELECT * FROM admin_mfa WHERE admin_id = ?1').bind(adminId).first();
}

export async function savePendingMfa(db, adminId, secret) {
  const ts = nowIso();
  await db.prepare(
    'INSERT INTO admin_mfa (admin_id, secret, enabled, recovery, last_step, created_at, updated_at) ' +
    "VALUES (?1, ?2, 0, '[]', 0, ?3, ?3) " +
    'ON CONFLICT(admin_id) DO UPDATE SET secret = excluded.secret, enabled = 0, ' +
    'recovery = excluded.recovery, last_step = 0, updated_at = excluded.updated_at'
  ).bind(adminId, secret, ts).run();
}

export async function enableAdminMfa(db, adminId, secret, recoveryHashes, lastStep) {
  await db.prepare(
    'UPDATE admin_mfa SET secret = ?1, enabled = 1, recovery = ?2, last_step = ?3, updated_at = ?4 WHERE admin_id = ?5'
  ).bind(secret, JSON.stringify(recoveryHashes || []), Number(lastStep || 0), nowIso(), adminId).run();
}

export async function disableAdminMfa(db, adminId) {
  await db.prepare('DELETE FROM admin_mfa WHERE admin_id = ?1').bind(adminId).run();
}

export async function verifyAdminMfa(db, row, code) {
  const clean = String(code || '').trim();
  if (!clean) return { ok: false, reason: 'missing' };

  const totpResult = await verifyTotp(row.secret, clean);
  if (totpResult.ok) {
    if (Number(row.last_step || 0) >= totpResult.step) {
      return { ok: false, reason: 'replay' };
    }
    await db.prepare('UPDATE admin_mfa SET last_step = ?1, updated_at = ?2 WHERE admin_id = ?3')
      .bind(totpResult.step, nowIso(), row.admin_id).run();
    return { ok: true, method: 'totp', step: totpResult.step };
  }

  let hashes = [];
  try { hashes = JSON.parse(row.recovery || '[]'); } catch { hashes = []; }
  const index = await findRecoveryCode(clean, hashes);
  if (index >= 0) {
    hashes.splice(index, 1);
    await db.prepare('UPDATE admin_mfa SET recovery = ?1, updated_at = ?2 WHERE admin_id = ?3')
      .bind(JSON.stringify(hashes), nowIso(), row.admin_id).run();
    return { ok: true, method: 'recovery', remaining: hashes.length };
  }

  return { ok: false, reason: 'invalid' };
}
