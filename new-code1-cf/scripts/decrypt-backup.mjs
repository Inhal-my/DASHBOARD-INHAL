import { readFileSync, writeFileSync } from 'node:fs';
import { decryptBuffer } from './backup-crypto.mjs';

/**
 * Mendekripsi arsip cadangan hasil mirror-drive-backup.mjs.
 *
 * Pemakaian:
 *   node scripts/decrypt-backup.mjs <arsip.enc> --out=<berkas> [--passphrase=...]
 *
 * Passphrase dibaca dari --passphrase atau environment BACKUP_PASSPHRASE.
 */

function argOf(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
const output = argOf(argv, 'out', '');
const passphrase = argOf(argv, 'passphrase', process.env.BACKUP_PASSPHRASE || '');

if (!input) {
  console.error('Pemakaian: node scripts/decrypt-backup.mjs <arsip.enc> --out=<berkas> [--passphrase=...]');
  process.exit(2);
}
if (!output) {
  console.error('--out wajib diisi.');
  process.exit(2);
}
if (!passphrase) {
  console.error('Passphrase kosong. Isi --passphrase atau environment BACKUP_PASSPHRASE.');
  process.exit(2);
}

try {
  const plain = decryptBuffer(readFileSync(input), passphrase);
  writeFileSync(output, plain);
  console.log(JSON.stringify({ ok: true, input: input, output: output, bytes: plain.length }, null, 2));
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    error: String((err && err.message) || err),
    hint: 'Passphrase salah atau berkas rusak; AES-GCM menolak autentikasi.'
  }, null, 2));
  process.exit(1);
}