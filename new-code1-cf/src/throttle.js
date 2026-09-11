export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

export function throttleKey(role, ip) {
  return String(role || '') + ':' + String(ip || 'local');
}

export async function getThrottleState(db, key) {
  const row = await db.prepare(
    'SELECT fail_count, window_start, locked_until FROM auth_throttle WHERE key = ?1'
  ).bind(key).first();
  if (!row) return { locked: false, retryAfterMs: 0, failCount: 0 };
  const now = Date.now();
  const lockedUntil = row.locked_until ? Date.parse(String(row.locked_until)) : 0;
  if (lockedUntil && lockedUntil > now) {
    return { locked: true, retryAfterMs: lockedUntil - now, failCount: Number(row.fail_count) || 0 };
  }
  return { locked: false, retryAfterMs: 0, failCount: Number(row.fail_count) || 0 };
}

export async function recordFailure(db, key) {
  const now = Date.now();
  const row = await db.prepare(
    'SELECT fail_count, window_start FROM auth_throttle WHERE key = ?1'
  ).bind(key).first();
  let count = 1;
  let windowStart = now;
  if (row) {
    const start = row.window_start ? Date.parse(String(row.window_start)) : 0;
    if (start && now - start < WINDOW_MS) {
      count = (Number(row.fail_count) || 0) + 1;
      windowStart = start;
    }
  }
  const lockedUntil = count >= MAX_FAILS ? new Date(now + LOCK_MS).toISOString() : null;
  await db.prepare(
    'INSERT INTO auth_throttle (key, fail_count, window_start, locked_until) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(key) DO UPDATE SET fail_count = ?2, window_start = ?3, locked_until = ?4'
  ).bind(key, count, new Date(windowStart).toISOString(), lockedUntil).run();
  return { count, locked: count >= MAX_FAILS };
}

export async function clearFailures(db, key) {
  await db.prepare('DELETE FROM auth_throttle WHERE key = ?1').bind(key).run();
}

export function lockoutMessage(retryAfterMs) {
  const mins = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return 'Terlalu banyak percobaan login. Coba lagi dalam ' + mins + ' menit.';
}
