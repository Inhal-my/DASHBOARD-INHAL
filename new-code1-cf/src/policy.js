import { norm } from './read/common.js';

// Hanya akun ini yang boleh menentukan keputusan pengajuan
// (ACC / Ditolak / Dibatalkan) dan menarik kembali ACC menjadi Menunggu.
// Identitas dicocokkan dari nama sesi (bukan admin_id) karena daftar admin
// disimpan ulang dengan DELETE+INSERT sehingga id-nya berubah.
export const VERIFIKATOR_NAMES = ['dr. Desi Isnayanti,M.Pd.Ked'];

function identityKey(value) {
  return norm(value).replace(/[^a-z0-9]+/g, '');
}

const VERIFIKATOR_KEYS = VERIFIKATOR_NAMES.map(identityKey);

export function isVerifikator(session) {
  const nama = session && session.nama;
  if (!nama) return false;
  return VERIFIKATOR_KEYS.indexOf(identityKey(nama)) !== -1;
}

export const VERIFIKATOR_DENIED =
  'Akses ditolak. Hanya verifikator yang dapat mengubah keputusan pengajuan (ACC, Ditolak, Dibatalkan).';

export function assertVerifikator(session) {
  if (!isVerifikator(session)) throw new Error(VERIFIKATOR_DENIED);
  return session;
}
