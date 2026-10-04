function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export async function nextIdNumber(db, scope, seedMax = 0) {
  const s = String(scope || '').trim();
  if (!s) throw new Error('Scope urutan wajib diisi.');
  const seed = Math.max(0, Number(seedMax) || 0);
  const row = await db.prepare(
    'INSERT INTO id_sequence (scope, last_number, updated_at) VALUES (?1, ?2 + 1, ?3) ' +
    'ON CONFLICT(scope) DO UPDATE SET ' +
    'last_number = CASE WHEN id_sequence.last_number < ?2 THEN ?2 + 1 ELSE id_sequence.last_number + 1 END, ' +
    'updated_at = excluded.updated_at ' +
    'RETURNING last_number'
  ).bind(s, seed, nowIso()).first();
  return Number(row && row.last_number) || 1;
}
