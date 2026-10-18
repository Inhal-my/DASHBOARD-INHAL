import { requireAdmin } from '../session.js';
import { verifyPassword } from '../password.js';
import { generateTotpSecret, verifyTotp } from './totp.js';
import { generateRecoveryCodes, hashRecoveryCode } from './recovery.js';
import {
  getAdminMfa, savePendingMfa, enableAdminMfa, disableAdminMfa, verifyAdminMfa
} from './store.js';

const NO_ADMIN_ID = 'Sesi ini tidak memiliki identitas admin. Silakan login ulang.';

function otpauthUrl(secret, accountName) {
  const issuer = 'INHAL';
  const label = encodeURIComponent(`${issuer}:${accountName || 'Admin'}`);
  const params = new URLSearchParams({
    secret, issuer, algorithm: 'SHA1', digits: '6', period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function mfaStatus(db, ctx) {
  const admin = await requireAdmin(db, ctx.token, ctx.session);
  if (!admin.adminId) return { available: false, enabled: false, message: NO_ADMIN_ID };
  const row = await getAdminMfa(db, admin.adminId);
  let recoveryCount = 0;
  try { recoveryCount = JSON.parse(row?.recovery || '[]').length; } catch { recoveryCount = 0; }
  return {
    available: true,
    enabled: !!(row && Number(row.enabled) === 1),
    recoveryCount,
    hasPending: !!(row && Number(row.enabled) !== 1)
  };
}

export async function mfaSetup(db, ctx) {
  const admin = await requireAdmin(db, ctx.token, ctx.session);
  if (!admin.adminId) return { ok: false, message: NO_ADMIN_ID };
  const row = await getAdminMfa(db, admin.adminId);
  if (row && Number(row.enabled) === 1) {
    return { ok: false, message: 'MFA sudah aktif. Nonaktifkan terlebih dahulu untuk mengatur ulang.' };
  }
  const secret = generateTotpSecret();
  await savePendingMfa(db, admin.adminId, secret);
  return { ok: true, secret, otpauthUrl: otpauthUrl(secret, admin.nama) };
}

export async function mfaEnable(db, code, ctx) {
  const admin = await requireAdmin(db, ctx.token, ctx.session);
  if (!admin.adminId) return { ok: false, message: NO_ADMIN_ID };
  const row = await getAdminMfa(db, admin.adminId);
  if (!row || Number(row.enabled) === 1) {
    return { ok: false, message: 'Mulai pengaturan MFA terlebih dahulu.' };
  }
  const check = await verifyTotp(row.secret, code);
  if (!check.ok) return { ok: false, message: 'Kode autentikator salah atau sudah kedaluwarsa.' };
  const codes = generateRecoveryCodes(8);
  const hashes = await Promise.all(codes.map(hashRecoveryCode));
  await enableAdminMfa(db, admin.adminId, row.secret, hashes, check.step);
  return {
    ok: true,
    message: 'MFA aktif. Simpan recovery code berikut; kode hanya ditampilkan sekali.',
    recoveryCodes: codes
  };
}

export async function mfaDisable(db, password, code, ctx) {
  const admin = await requireAdmin(db, ctx.token, ctx.session);
  if (!admin.adminId) return { ok: false, message: NO_ADMIN_ID };
  const row = await getAdminMfa(db, admin.adminId);
  if (!row || Number(row.enabled) !== 1) return { ok: false, message: 'MFA belum aktif.' };
  const account = await db.prepare('SELECT password FROM admin WHERE id = ?1').bind(admin.adminId).first();
  if (!account || !(await verifyPassword(String(password || '').trim(), String(account.password || '').trim()))) {
    return { ok: false, message: 'Password admin salah.' };
  }
  const check = await verifyAdminMfa(db, row, code);
  if (!check.ok) return { ok: false, message: 'Kode autentikator atau recovery code salah.' };
  await disableAdminMfa(db, admin.adminId);
  return { ok: true, message: 'MFA dinonaktifkan.' };
}
