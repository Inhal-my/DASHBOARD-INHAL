function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function fail(message) {
  return { ok: false, message: 'Data tidak valid: ' + message + '.' };
}

function checkText(value, label, max, required) {
  const text = cleanText(value);
  if (required && !text) return fail(label + ' wajib diisi');
  if (text.length > max) return fail(label + ' maksimal ' + max + ' karakter');
  return { ok: true, value: text };
}

function checkDate(value, label, required) {
  const text = cleanText(value);
  if (!text) return required ? fail(label + ' wajib diisi') : { ok: true, value: '' };
  if (text.length > 40) return fail(label + ' terlalu panjang');
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (!m) return fail(label + ' harus berformat YYYY-MM-DD');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return fail(label + ' bukan tanggal yang valid');
  }
  return { ok: true, value: text };
}

function checkPeserta(value) {
  if (value === undefined || value === null) return { ok: true };
  if (!Array.isArray(value)) return fail('daftar peserta harus berupa array');
  if (value.length > 500) return fail('peserta maksimal 500 orang');
  for (const p of value) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('setiap peserta harus berupa objek');
    const npm = checkText(p.npm, 'NPM', 40, false);
    if (!npm.ok) return npm;
    const nama = checkText(p.namaLengkap || p.nama, 'nama peserta', 200, false);
    if (!nama.ok) return nama;
    const id = checkText(p.idPengajuan, 'ID pengajuan peserta', 120, false);
    if (!id.ok) return id;
  }
  return { ok: true };
}

export function validateJadwalInput(payload) {
  const p = payload || {};
  const checks = [
    checkText(p.bagian, 'Bagian', 120, false),
    checkText(p.blok, 'Blok', 120, false),
    checkText(p.namaKegiatan, 'Nama kegiatan', 200, true),
    checkText(p.dosen, 'Dosen', 200, false),
    checkText(p.catatan, 'Catatan', 2000, false),
    checkText(p.jam, 'Jam', 40, false),
    checkDate(p.tanggal, 'Tanggal pelaksanaan', true)
  ];
  for (const c of checks) if (!c.ok) return c;
  return checkPeserta(p.peserta);
}

export function validateBaCreateInput(payload) {
  const p = payload || {};
  const checks = [
    checkText(p.bagian, 'Bagian', 120, false),
    checkText(p.blok, 'Blok', 120, false),
    checkText(p.namaKegiatan, 'Nama kegiatan', 200, true),
    checkText(p.dosen, 'Dosen', 200, false),
    checkText(p.catatan, 'Catatan', 2000, false),
    checkText(p.label, 'Label', 200, false),
    checkText(p.jam, 'Jam', 40, false),
    checkDate(p.tanggalPelaksanaan, 'Tanggal pelaksanaan', true)
  ];
  for (const c of checks) if (!c.ok) return c;
  return checkPeserta(p.peserta);
}

export function validateBaUpdateInput(payload) {
  const p = payload || {};
  const checks = [];
  if (p.tanggal !== undefined) checks.push(checkDate(p.tanggal, 'Tanggal pelaksanaan', true));
  if (p.jam !== undefined) checks.push(checkText(p.jam, 'Jam', 40, false));
  if (p.dosen !== undefined) checks.push(checkText(p.dosen, 'Dosen', 200, false));
  if (p.catatan !== undefined) checks.push(checkText(p.catatan, 'Catatan', 2000, false));
  if (p.label !== undefined) checks.push(checkText(p.label, 'Label', 200, false));
  for (const c of checks) if (!c.ok) return c;
  if (p.pesertaIds !== undefined) {
    if (!Array.isArray(p.pesertaIds)) return fail('daftar peserta harus berupa array');
    if (p.pesertaIds.length > 500) return fail('peserta maksimal 500 orang');
    for (const id of p.pesertaIds) {
      const c = checkText(id, 'ID pengajuan peserta', 120, false);
      if (!c.ok) return c;
    }
  }
  return checkPeserta(p.peserta);
}
