export const MANUAL_ACC_CONFIG_KEY = 'allow_manual_acc';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

// Pengaturan ACC manual: saat nonaktif, status ACC hanya boleh dicapai lewat
// validasi pembayaran atau jalur gratis otomatis.
export async function getAccSettings(db) {
  let value = '';
  try {
    const row = await db.prepare('SELECT value FROM config WHERE key = ?1').bind(MANUAL_ACC_CONFIG_KEY).first();
    value = str(row && row.value);
  } catch (e) {
    value = '';
  }
  return { allowManualAcc: value === '1' };
}

export async function isManualAccEnabled(db) {
  const settings = await getAccSettings(db);
  return settings.allowManualAcc;
}

export async function setAccSettings(db, settings) {
  const enabled = !!(settings && settings.allowManualAcc);
  await db.prepare(
    'INSERT INTO config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(MANUAL_ACC_CONFIG_KEY, enabled ? '1' : '0').run();
  return { allowManualAcc: enabled };
}
