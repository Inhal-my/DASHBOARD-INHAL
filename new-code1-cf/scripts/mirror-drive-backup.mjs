import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encryptBuffer } from './backup-crypto.mjs';

/**
 * Mencerminkan arsip cadangan ke Google Drive melalui Drive Bridge.
 *
 * Catatan penting: aksi `saveFile` pada bridge menandai berkas
 * "Anyone with the link can view", jadi berkas sensitif (dump SQL, snapshot,
 * XLSX) DIENKRIPSI lebih dahulu. Yang dikirim terbuka hanya manifest
 * (jumlah baris, hash, ukuran - tanpa data pribadi).
 *
 * Bridge tidak menyediakan listing folder maupun penimpaan berkas, sehingga
 * retensi dijalankan memakai indeks lokal (state dir) berisi fileId tiap arsip,
 * lalu arsip kedaluwarsa dipindahkan ke trash lewat aksi `trashFile`.
 */

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const INDEX_FILE = 'drive-backup-index.json';

function argOf(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function usage(message) {
  console.error(message);
  console.error('Pemakaian: node scripts/mirror-drive-backup.mjs --label=<YYYYMMDD-HHmm> --index-dir=<dir>');
  console.error('  --bridge-url=<url> --bridge-token=<token> --passphrase=<min 12 karakter>');
  console.error('  [--dump=<f>] [--snapshot=<f>] [--xlsx=<f>] [--manifest=<f>] [--retention-days=3]');
  process.exit(2);
}

async function callBridge(config, payload) {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ token: config.token }, payload))
  });
  let data = {};
  try { data = await res.json(); } catch (err) { data = {}; }
  if (!res.ok || !data || data.success === false) {
    throw new Error('Bridge menolak: ' + String((data && data.message) || ('HTTP ' + res.status)));
  }
  return data;
}

function loadIndex(indexDir) {
  const path = join(indexDir, INDEX_FILE);
  if (!existsSync(path)) return { version: 1, entries: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return { version: 1, entries: parsed.entries };
  } catch (err) { }
  return { version: 1, entries: [] };
}

function saveIndex(indexDir, index) {
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(join(indexDir, INDEX_FILE), JSON.stringify(index, null, 2) + '\n');
}

/**
 * Memilih entri indeks yang sudah melewati masa retensi.
 * Entri tanpa `uploadedAt` yang valid dianggap kedaluwarsa agar arsip yatim
 * tidak menumpuk di Drive tanpa batas.
 */
export function selectExpired(entries, retentionDays, now) {
  const cutoff = Number(now) - Number(retentionDays) * 24 * 60 * 60 * 1000;
  return (entries || []).filter((entry) => {
    if (!entry) return false;
    const uploadedAt = new Date(entry.uploadedAt).getTime();
    if (!Number.isFinite(uploadedAt)) return true;
    return uploadedAt < cutoff;
  });
}

/** Menghapus label yang seluruh berkasnya berhasil dipindah ke trash. */
export function remainingEntries(entries, expiredEntries, failedEntries) {
  const failedLabels = new Set((failedEntries || []).map((f) => f.label));
  const removed = new Set((expiredEntries || [])
    .filter((e) => !failedLabels.has(e.label))
    .map((e) => e.label));
  return (entries || []).filter((e) => !removed.has(e.label));
}

async function main() {
  const argv = process.argv.slice(2);
  const label = argOf(argv, 'label', '');
  const indexDir = argOf(argv, 'index-dir', '');
  const config = { url: argOf(argv, 'bridge-url', ''), token: argOf(argv, 'bridge-token', '') };
  const passphrase = argOf(argv, 'passphrase', '');
  const retentionRaw = Number(argOf(argv, 'retention-days', '3'));
  const retentionDays = Number.isFinite(retentionRaw) ? retentionRaw : 3;

  if (!label) usage('--label wajib diisi.');
  if (!indexDir) usage('--index-dir wajib diisi.');
  if (!config.url || !config.token) usage('--bridge-url dan --bridge-token wajib diisi.');
  if (!passphrase) usage('--passphrase wajib diisi.');

  const sources = [
    { kind: 'dump', file: argOf(argv, 'dump', ''), target: label + '-database.sql.enc', encrypted: true },
    { kind: 'snapshot', file: argOf(argv, 'snapshot', ''), target: label + '-snapshot.json.gz.enc', encrypted: true },
    { kind: 'xlsx', file: argOf(argv, 'xlsx', ''), target: label + '-database.xlsx.enc', encrypted: true },
    { kind: 'manifest', file: argOf(argv, 'manifest', ''), target: label + '-manifest.json', encrypted: false }
  ].filter((s) => s.file);

  if (!sources.length) usage('Tidak ada berkas yang dicerminkan.');

  const index = loadIndex(indexDir);
  const uploaded = [];
  const skipped = [];

  for (const source of sources) {
    const raw = readFileSync(source.file);
    const payload = source.encrypted ? encryptBuffer(raw, passphrase) : raw;
    if (payload.length > MAX_UPLOAD_BYTES) {
      skipped.push({ kind: source.kind, bytes: payload.length, reason: 'melebihi batas ' + MAX_UPLOAD_BYTES + ' byte' });
      continue;
    }
    const data = await callBridge(config, {
      action: 'saveFile',
      base64: payload.toString('base64'),
      mimeType: source.encrypted ? 'application/octet-stream' : 'application/json',
      fileName: source.target,
      prefix: 'backup'
    });
    uploaded.push({
      kind: source.kind,
      fileName: source.target,
      bytes: payload.length,
      encrypted: source.encrypted,
      fileId: String(data.fileId || ''),
      url: String(data.url || '')
    });
  }

  if (uploaded.length) {
    index.entries = index.entries.filter((e) => e && e.label !== label);
    index.entries.push({ label: label, uploadedAt: new Date().toISOString(), files: uploaded });
  }

  const expired = selectExpired(index.entries, retentionDays, Date.now());
  const trashed = [];
  const failed = [];

  for (const entry of expired) {
    for (const file of entry.files || []) {
      if (!file.fileId) continue;
      try {
        await callBridge(config, { action: 'trashFile', fileId: file.fileId });
        trashed.push({ label: entry.label, kind: file.kind, fileId: file.fileId });
      } catch (err) {
        failed.push({ label: entry.label, kind: file.kind, error: String((err && err.message) || err) });
      }
    }
  }

  index.entries = remainingEntries(index.entries, expired, failed);
  saveIndex(indexDir, index);

  console.log(JSON.stringify({
    ok: failed.length === 0 && uploaded.length > 0,
    label: label,
    retentionDays: retentionDays,
    uploaded: uploaded.map((u) => ({ kind: u.kind, file: u.fileName, bytes: u.bytes, fileId: u.fileId, url: u.url })),
    skipped: skipped,
    trashed: trashed,
    failed: failed,
    indexEntries: index.entries.map((e) => e.label)
  }, null, 2));

  process.exitCode = uploaded.length && failed.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(JSON.stringify({ ok: false, error: String((err && err.message) || err) }, null, 2));
    process.exitCode = 1;
  });
}