import { parseFileInput, decodeBase64Size } from './uploads.js';

export const MAX_BA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_BA_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export function validateDriveFile(file, allowed, maxBytes, label) {
  const name = label || 'berkas';
  if (!file || !file.data) return { ok: false, message: 'Berkas ' + name + ' wajib diunggah.' };
  const mime = String(file.mimeType || '').toLowerCase();
  if (allowed.indexOf(mime) === -1) {
    return { ok: false, message: 'Format berkas ' + name + ' tidak didukung.' };
  }
  const size = decodeBase64Size(file.data);
  if (size <= 0) return { ok: false, message: 'Berkas ' + name + ' kosong atau tidak valid.' };
  if (size > maxBytes) {
    return { ok: false, message: 'Ukuran berkas ' + name + ' maksimal ' + Math.floor(maxBytes / (1024 * 1024)) + ' MB.' };
  }
  return { ok: true, size: size, mime: mime, name: String(file.name || '') };
}

export function validateBaFile(file) {
  return validateDriveFile(file, ALLOWED_BA_MIME, MAX_BA_UPLOAD_BYTES, 'BA');
}

function bridgeConfig(env) {
  const url = String((env && env.GAS_DRIVE_URL) || '').trim();
  const token = String((env && env.GAS_DRIVE_TOKEN) || '').trim();
  if (!url || !token) return null;
  return { url: url, token: token };
}

export function parseDriveFileId(url) {
  const m = String(url || '').match(/[=\/]([\w\-]{20,})/);
  return m ? m[1] : '';
}

export async function saveDriveFile(env, input, prefix, opts) {
  const cfg = bridgeConfig(env);
  if (!cfg) return { ok: false, message: 'Penyimpanan Drive belum dikonfigurasi.' };

  const allowed = (opts && opts.allowedMime) || ALLOWED_BA_MIME;
  const maxBytes = (opts && opts.maxBytes) || MAX_BA_UPLOAD_BYTES;
  const label = (opts && opts.label) || 'BA';

  const parsed = parseFileInput(input);
  const valid = validateDriveFile(parsed, allowed, maxBytes, label);
  if (!valid.ok) return valid;

  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveFile', token: cfg.token, base64: parsed.data,
        mimeType: valid.mime, fileName: valid.name, prefix: String(prefix || 'ba')
      })
    });
  } catch (e) {
    return { ok: false, message: 'Gagal menghubungi penyimpanan Drive.' };
  }

  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok || !data || !data.success || !data.url) {
    return { ok: false, message: (data && data.message) || 'Gagal mengunggah berkas ke Drive.' };
  }
  return { ok: true, url: data.url, fileId: data.fileId || parseDriveFileId(data.url), size: valid.size, mime: valid.mime, name: valid.name };
}

export async function trashDriveFile(env, fileId) {
  const cfg = bridgeConfig(env);
  const id = String(fileId || '').trim();
  if (!cfg || !id) return { ok: false };
  try {
    await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trashFile', token: cfg.token, fileId: id })
    });
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}
