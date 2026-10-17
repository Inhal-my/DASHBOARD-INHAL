const SECRET_KEY = /(token|password|passwd|secret|authorization|cookie|api[_-]?key|credential)/i;
const MAX_TEXT = 2000;
const MAX_ITEMS = 50;
const MAX_DEPTH = 4;

function scrub(value, depth = 0, seen = new WeakSet()) {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) + '…' : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrub(value.message, depth + 1, seen),
      stack: scrub(value.stack, depth + 1, seen)
    };
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => scrub(item, depth + 1, seen));
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : scrub(item, depth + 1, seen);
  }
  return out;
}

export function logEvent(level, event, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(scrub(fields) || {})
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  return payload;
}

export function logError(event, err, fields = {}) {
  const error = err instanceof Error
    ? err
    : { message: err === undefined || err === null ? 'unknown' : String(err) };
  return logEvent('error', event, { ...fields, error });
}
