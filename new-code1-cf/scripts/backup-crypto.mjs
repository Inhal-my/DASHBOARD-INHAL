import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Enkripsi arsip cadangan sebelum dikirim ke Drive.
 *
 * Alasan: `saveFile` di Drive Bridge menandai setiap berkas sebagai
 * "Anyone with the link can view", sehingga dump database TIDAK boleh dikirim
 * dalam bentuk terbuka. Format berkas: INHALBK1 | salt(16) | iv(12) | tag(16) | ciphertext.
 */

const MAGIC = Buffer.from('INHALBK1', 'utf8');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function deriveKey(passphrase, salt) {
  if (!passphrase || String(passphrase).length < 12) {
    throw new Error('Passphrase enkripsi minimal 12 karakter.');
  }
  return scryptSync(String(passphrase), salt, KEY_BYTES);
}

export function encryptBuffer(buffer, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decryptBuffer(buffer, passphrase) {
  if (buffer.length < MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES) {
    throw new Error('Berkas terlalu pendek untuk menjadi arsip INHAL.');
  }
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Magic header tidak dikenal (bukan arsip INHALBK1).');
  }
  let offset = MAGIC.length;
  const salt = buffer.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const iv = buffer.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = buffer.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(offset)), decipher.final()]);
}