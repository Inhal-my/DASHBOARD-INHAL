export const MAX_UPLOAD_BYTES = 700 * 1024;
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export function decodeBase64Size(base64) {
  const clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) return 0;
  const padding = (clean.match(/=+$/) || [''])[0].length;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function parseFileInput(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(input);
    if (!m) return null;
    return { mimeType: m[1], data: m[2], name: '' };
  }
  if (typeof input === 'object' && input.data) {
    let mime = String(input.mimeType || '');
    let data = String(input.data);
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(data);
    if (m) { mime = mime || m[1]; data = m[2]; }
    return { mimeType: mime, data: data, name: String(input.name || '') };
  }
  return null;
}

export function validateUpload(file) {
  if (!file || !file.data) return { ok: false, message: 'Berkas tidak valid.' };
  const mime = String(file.mimeType || '').toLowerCase();
  if (ALLOWED_MIME.indexOf(mime) === -1) {
    return { ok: false, message: 'Format berkas harus PDF, JPG, atau PNG.' };
  }
  const size = decodeBase64Size(file.data);
  if (size <= 0) return { ok: false, message: 'Berkas kosong atau tidak valid.' };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'Ukuran berkas maksimal ' + Math.floor(MAX_UPLOAD_BYTES / 1024) + ' KB.' };
  }
  return { ok: true, size: size, mime: mime };
}

export function newUploadId() {
  return 'UPL-' + crypto.randomUUID();
}

export function buildUploadStatement(db, { id, pengajuanId, kind, file, createdBy, createdAt }) {
  return db.prepare(
    'INSERT INTO uploads (id, pengajuan_id, kind, file_name, mime_type, size, content, created_at, created_by) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
  ).bind(id, String(pengajuanId || ''), String(kind || ''), String(file.name || ''), file.mime, file.size, file.data, createdAt, String(createdBy || ''));
}

export function prepareUpload(input, { pengajuanId, kind, createdBy, createdAt }) {
  const parsed = parseFileInput(input);
  const valid = validateUpload(parsed);
  if (!valid.ok) return { ok: false, message: valid.message };
  const id = newUploadId();
  return {
    ok: true, id: id, url: '/api/files/' + id, size: valid.size, mime: valid.mime,
    row: {
      id: id, pengajuanId: pengajuanId, kind: kind,
      file: { name: parsed.name, mime: valid.mime, size: valid.size, data: parsed.data },
      createdBy: createdBy, createdAt: createdAt
    }
  };
}

export async function saveUpload(db, input, meta) {
  const prepared = prepareUpload(input, meta);
  if (!prepared.ok) return prepared;
  await buildUploadStatement(db, prepared.row).run();
  return { ok: true, id: prepared.id, url: prepared.url, size: prepared.size, mime: prepared.mime };
}

export async function getUpload(db, id) {
  return await db.prepare('SELECT id, file_name, mime_type, content FROM uploads WHERE id = ?1').bind(String(id || '')).first();
}

export function base64ToBytes(base64) {
  const bin = atob(String(base64 || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
