const API_BASE = 'https://api.cloudflare.com/client/v4';

export function exportUrl(accountId, databaseId) {
  return API_BASE + '/accounts/' + accountId + '/d1/database/' + databaseId + '/export';
}

function apiError(json, status) {
  const messages = ((json && json.errors) || [])
    .map((e) => e && e.message)
    .filter(Boolean);
  return messages.length ? messages.join('; ') : 'HTTP ' + status;
}

async function readExportResponse(res, action) {
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('D1 export ' + action + ' gagal: respons bukan JSON (HTTP ' + res.status + ').');
  }
  if (!res.ok || !json || json.success === false) {
    throw new Error('D1 export ' + action + ' gagal: ' + apiError(json, res.status));
  }
  return (json && json.result) || {};
}

function request(accountId, databaseId, token, body, fetchImpl) {
  if (!accountId || !databaseId || !token) {
    return Promise.reject(new Error('Konfigurasi backup tidak lengkap (ACCOUNT_ID, DATABASE_ID, atau token).'));
  }
  return fetchImpl(exportUrl(accountId, databaseId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });
}

export async function startExport({ accountId, databaseId, token, fetchImpl = fetch }) {
  const res = await request(accountId, databaseId, token, { output_format: 'polling' }, fetchImpl);
  const result = await readExportResponse(res, 'start');
  if (!result.at_bookmark) {
    throw new Error('D1 export start tidak mengembalikan at_bookmark.');
  }
  return result;
}

export async function pollExport({ accountId, databaseId, token, bookmark, fetchImpl = fetch }) {
  const res = await request(accountId, databaseId, token, { current_bookmark: bookmark }, fetchImpl);
  return readExportResponse(res, 'poll');
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function stamp(value) {
  return new Date(value || Date.now()).toISOString().replace(/[:.]/g, '-');
}

export async function saveBackup(bucket, {
  bytes,
  bookmark,
  startedAt,
  databaseId,
  databaseName = 'inhal-poc'
}) {
  if (!bucket) throw new Error('Binding R2 BACKUP_BUCKET tidak tersedia.');
  if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) {
    throw new Error('Isi dump backup tidak valid.');
  }
  const id = stamp(startedAt);
  const filename = 'd1/' + id + '.sql';
  const manifestKey = 'd1/' + id + '.json';
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const manifest = {
    database: databaseName,
    databaseId: databaseId || '',
    bookmark: bookmark || '',
    filename: filename,
    bytes: bytes.byteLength,
    sha256: hex(digest),
    startedAt: new Date(startedAt || Date.now()).toISOString(),
    finishedAt: new Date().toISOString()
  };
  await bucket.put(filename, bytes, {
    httpMetadata: { contentType: 'application/sql' }
  });
  await bucket.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
  await bucket.put('status/last-success.json', JSON.stringify({
    workflow: 'd1-backup',
    finishedAt: manifest.finishedAt,
    bookmark: manifest.bookmark,
    filename: manifest.filename,
    bytes: manifest.bytes,
    sha256: manifest.sha256
  }, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
  return manifest;
}

export async function writeFailure(bucket, info) {
  if (!bucket) return;
  try {
    await bucket.put('status/last-failure.json', JSON.stringify({
      workflow: 'd1-backup',
      at: new Date().toISOString(),
      message: String((info && info.message) || 'Backup gagal.'),
      step: String((info && info.step) || '')
    }, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
  } catch (e) {
    // Status kegagalan tidak boleh menutupi error asli.
  }
}
