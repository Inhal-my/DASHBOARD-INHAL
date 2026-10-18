import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { dispatchRpc } from '../src/rpc.js';
import { totp } from '../src/mfa/totp.js';

async function login(password, code) {
  return dispatchRpc(env.DB, 'authenticateAdmin', code === undefined ? [password] : [password, code]);
}

async function setupAdmin(password = 'rahasia') {
  await env.DB.prepare("INSERT INTO admin (password, nama) VALUES (?1,'Admin')").bind(password).run();
  const sess = await login(password);
  expect(sess.ok).toBe(true);
  const setup = await dispatchRpc(env.DB, 'mfaSetup', [sess.token]);
  expect(setup.ok).toBe(true);
  const code = await totp(setup.secret, Date.now());
  const enabled = await dispatchRpc(env.DB, 'mfaEnable', [code, sess.token]);
  expect(enabled.ok).toBe(true);
  return { token: sess.token, secret: setup.secret, recoveryCodes: enabled.recoveryCodes };
}

describe('alur MFA admin', () => {
  it('status, setup, aktif, dan nonaktif dengan password + kode', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    const sess = await login('rahasia');
    const status0 = await dispatchRpc(env.DB, 'mfaStatus', [sess.token]);
    expect(status0).toMatchObject({ available: true, enabled: false });

    const setup = await dispatchRpc(env.DB, 'mfaSetup', [sess.token]);
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    expect(setup.otpauthUrl).toContain(setup.secret);

    const enabled = await dispatchRpc(env.DB, 'mfaEnable', [await totp(setup.secret, Date.now()), sess.token]);
    expect(enabled.ok).toBe(true);
    expect(enabled.recoveryCodes).toHaveLength(8);

    const row = await env.DB.prepare('SELECT * FROM admin_mfa').first();
    expect(row.enabled).toBe(1);
    expect(row.recovery).not.toContain(enabled.recoveryCodes[0]);

    const status1 = await dispatchRpc(env.DB, 'mfaStatus', [sess.token]);
    expect(status1).toMatchObject({ enabled: true, recoveryCount: 8 });

    const wrongPwd = await dispatchRpc(env.DB, 'mfaDisable', ['salah', await totp(setup.secret, Date.now() + 30000), sess.token]);
    expect(wrongPwd.ok).toBe(false);

    const disabled = await dispatchRpc(env.DB, 'mfaDisable', ['rahasia', await totp(setup.secret, Date.now() + 30000), sess.token]);
    expect(disabled.ok).toBe(true);
    const status2 = await dispatchRpc(env.DB, 'mfaStatus', [sess.token]);
    expect(status2.enabled).toBe(false);
  });

  it('login wajib kode, menolak replay, dan menerima recovery code sekali pakai', async () => {
    const { secret, recoveryCodes } = await setupAdmin();

    const noCode = await login('rahasia');
    expect(noCode.ok).toBe(false);
    expect(noCode.mfaRequired).toBe(true);

    const nextCode = await totp(secret, Date.now() + 30000);
    const okLogin = await login('rahasia', nextCode);
    expect(okLogin.ok).toBe(true);
    expect(okLogin.token).toBeTruthy();

    const replay = await login('rahasia', nextCode);
    expect(replay.ok).toBe(false);
    expect(replay.mfaRequired).toBe(true);

    const recovery = await login('rahasia', recoveryCodes[0]);
    expect(recovery.ok).toBe(true);

    const reused = await login('rahasia', recoveryCodes[0]);
    expect(reused.ok).toBe(false);
    expect(reused.mfaRequired).toBe(true);

    const status = await dispatchRpc(env.DB, 'mfaStatus', [okLogin.token]);
    expect(status.recoveryCount).toBe(7);
  });

  it('menolak RPC MFA tanpa sesi admin', async () => {
    const res = await dispatchRpc(env.DB, 'mfaStatus', []);
    expect(res.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
});
