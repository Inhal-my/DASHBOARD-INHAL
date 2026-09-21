export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normKegiatan(s) {
  return norm(String(s || '').replace(/[\u2010-\u2015\u2212]/g, '-'));
}

export function kegiatanKey(bagian, blok, nama) {
  return [norm(bagian), norm(blok), normKegiatan(nama)].join('|');
}

function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

function field(obj, lowerKey, clientKey) {
  if (!obj) return '';
  const v = obj[lowerKey] !== undefined ? obj[lowerKey] : obj[clientKey];
  return v == null ? '' : String(v).trim();
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => {
    const s = String(p.statusPengajuan || '').trim();
    return s === 'Diterima' || s === 'ACC' || s === 'Ditolak';
  }).length;
  const finalCount = peserta.filter((p) => p.linkFinal).length;
  const selesai = baPelaksanaan.some((b) =>
    field(b, 'dosen', 'Dosen') && field(b, 'tanggal', 'Tanggal Pelaksanaan') && field(b, 'jam', 'Jam')
  );
  return {
    pendaftaran: total > 0 ? 'all' : 'none',
    pendukung: baPendukung.length ? 'all' : 'none',
    keputusan: stage(decided, total),
    final: stage(finalCount, total),
    pelaksanaan: baPelaksanaan.length ? 'all' : 'none',
    selesai: selesai ? 'all' : 'none',
    counts: { peserta: total, keputusan: decided, final: finalCount }
  };
}

export function rowFingerprint(row, cols) {
  return (cols || []).map((c) => String(row && row[c] != null ? row[c] : '').replace(/\u00a0/g, ' ').trim()).join('\u001f');
}

export function rowsMatchFingerprint(sheetRow, original, cols) {
  return rowFingerprint(sheetRow, cols) === rowFingerprint(original, cols);
}

export const MAHASISWA_CSV_MAX = 500;

export function parseMahasiswaCsv(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return { error: 'CSV kosong.' };
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ' '));
  const npmIdx = header.findIndex((h) => h === 'npm');
  const namaIdx = header.findIndex((h) => h === 'nama lengkap' || h === 'nama_lengkap' || h === 'nama');
  if (npmIdx === -1 || namaIdx === -1) return { error: 'Header CSV harus memuat kolom NPM dan Nama Lengkap.' };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    rows.push({ npm: String(cells[npmIdx] || '').trim(), namaLengkap: String(cells[namaIdx] || '').trim() });
  }
  return { rows: rows };
}

export function planMahasiswaCsvUpsert(rows, existingNpms) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length > MAHASISWA_CSV_MAX) return { error: 'Maksimal ' + MAHASISWA_CSV_MAX + ' baris.' };
  const parsed = [];
  const seen = new Set();
  let skipped = 0;
  for (let i = 0; i < list.length; i++) {
    const npm = String((list[i] && list[i].npm) || '').trim();
    if (!npm) { skipped++; continue; }
    if (seen.has(npm)) return { error: 'NPM duplikat di file: ' + npm };
    seen.add(npm);
    parsed.push({ npm: npm, nama: String((list[i] && (list[i].namaLengkap != null ? list[i].namaLengkap : list[i].nama)) || '').trim() });
  }
  if (!parsed.length) return { error: 'Tidak ada baris valid pada CSV.' };
  const existing = existingNpms || new Set();
  let inserted = 0;
  let updated = 0;
  parsed.forEach((row) => { if (existing.has(row.npm)) updated++; else inserted++; });
  return { insert: inserted, update: updated, skipped: skipped, parsed: parsed };
}

export function attachBaToUnits(units, baList, resolveBagian12) {
  const unitByKey = {};
  const unitByBag = {};
  const bagKey = (bagian, blok) => norm(bagian) + '|' + String(blok || '').replace(/\s+/g, ' ').trim().toLowerCase();
  (units || []).forEach((u) => {
    unitByKey[u.key] = u;
    const k = bagKey(u.bagian, u.blok);
    (unitByBag[k] = unitByBag[k] || []).push(u);
    if (!u.ba) u.ba = [];
  });
  const seen = new Set();
  const orphanBa = [];
  (baList || []).forEach((b) => {
    const dk = [norm(b.bagian), String(b.blok || '').toLowerCase(), normKegiatan(b.namaKegiatan), b.tanggal || '', b.fileUrl || ''].join('|');
    if (seen.has(dk)) return;
    seen.add(dk);
    const direct = b.kegiatanKey ? unitByKey[b.kegiatanKey] : null;
    if (direct) { direct.ba.push(b); return; }
    const resolved = resolveBagian12 ? (resolveBagian12(b.bagian, '', b.namaKegiatan) || b.bagian) : b.bagian;
    const candidates = unitByBag[bagKey(resolved, b.blok)] || [];
    const npms = (b.peserta || []).map((p) => p.npm).filter(Boolean);
    let matched = candidates.filter((u) => (u.peserta || []).some((p) => p.npm && npms.indexOf(p.npm) !== -1));
    if (!matched.length) {
      const bName = normKegiatan(b.namaKegiatan);
      matched = candidates.filter((u) => {
        const l = normKegiatan(u.label);
        return !!l && (bName === l || bName.endsWith(l));
      });
    }
    if (!matched.length) { orphanBa.push(b); return; }
    matched.forEach((u) => u.ba.push(b));
  });
  return { units: units, orphanBa: orphanBa };
}
