function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function first(obj, lowerKey, clientKey) {
  if (!obj) return '';
  const lower = obj[lowerKey];
  if (lower !== undefined && lower !== null && lower !== '') return lower;
  return obj[clientKey];
}

function sessionPeserta(b) {
  const raw = Array.isArray(b && b.peserta) ? b.peserta : [];
  const seen = {};
  const out = [];
  for (const p of raw) {
    const npm = str(p && p.npm);
    const nama = str((p && p.namaLengkap) || (p && p.nama));
    const key = npm || nama;
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push({ npm: npm, namaLengkap: nama, blok: str(p && p.blok) });
  }
  return out;
}

function normalizeSession(b, jadwalIds) {
  const baId = str(first(b, 'baId', 'BA ID'));
  const tanggal = str(first(b, 'tanggal', 'Tanggal Pelaksanaan'));
  const jam = str(first(b, 'jam', 'Jam'));
  const dosen = str(first(b, 'dosen', 'Dosen'));
  const fileUrl = str(first(b, 'fileUrl', 'File URL'));
  const jadwalId = str(first(b, 'jadwalId', 'Jadwal ID'));
  const peserta = sessionPeserta(b);
  const jadwalCocok = jadwalId ? jadwalIds.has(jadwalId) : null;
  const lengkap = !!(fileUrl && tanggal && jam && dosen && peserta.length);
  return {
    index: 0,
    baId: baId,
    label: str(first(b, 'label', 'Label')),
    tanggal: tanggal,
    jam: jam,
    dosen: dosen,
    catatan: str(first(b, 'catatan', 'Catatan')),
    timestamp: str(first(b, 'timestamp', 'Timestamp')),
    pesertaCount: peserta.length,
    peserta: peserta,
    fileUrl: fileUrl,
    baseFileUrl: str(first(b, 'baseFileUrl', 'Base File URL')),
    berkasAda: !!fileUrl,
    jadwalId: jadwalId,
    jadwalCocok: jadwalCocok,
    lengkap: lengkap,
    status: lengkap ? 'Lengkap' : 'Draft',
    flags: []
  };
}

function compareSession(a, b) {
  if (a.tanggal && !b.tanggal) return -1;
  if (!a.tanggal && b.tanggal) return 1;
  return a.tanggal.localeCompare(b.tanggal)
    || a.jam.localeCompare(b.jam)
    || a.timestamp.localeCompare(b.timestamp)
    || a.baId.localeCompare(b.baId);
}

function isBagian(row) {
  const sumber = str(row && row.sumber).toLowerCase();
  return !sumber || sumber === 'bagian';
}

function jadwalKey(j) {
  return str((j && (j.kegiatanKey || j.kegiatan_key)) || '');
}

export function buildBaPelaksanaanAudit(units, jadwalList) {
  const rows = [];
  const summary = {
    totalKegiatan: 0,
    totalSesi: 0,
    multiSesi: 0,
    satuSesi: 0,
    belumSesi: 0,
    sesiEkstra: 0,
    sesiDraft: 0,
    kemungkinanDuplikat: 0,
    jadwalBelum: 0
  };
  const allJadwal = (jadwalList || []).filter((j) => j && str(j.jadwalId || j['Jadwal ID']));
  const jadwalByKey = {};
  for (const j of allJadwal) {
    const key = jadwalKey(j);
    if (!key) continue;
    if (!jadwalByKey[key]) jadwalByKey[key] = [];
    jadwalByKey[key].push(j);
  }

  for (const unit of units || []) {
    const key = str(unit && unit.key);
    const jadwal = jadwalByKey[key] || [];
    const jadwalIds = new Set(jadwal.map((j) => str(j.jadwalId || j['Jadwal ID'])));
    const raw = ((unit && unit.baPelaksanaan) || []).filter(isBagian);
    const sesi = raw.map((b) => normalizeSession(b, jadwalIds)).sort(compareSession);
    sesi.forEach((s, i) => { s.index = i + 1; });

    const dupGroups = {};
    for (const s of sesi) {
      const dupKey = [s.tanggal, s.jam, s.dosen.toLowerCase()].join('|');
      if (!dupGroups[dupKey]) dupGroups[dupKey] = 0;
      dupGroups[dupKey] += 1;
    }
    for (const s of sesi) {
      const dupKey = [s.tanggal, s.jam, s.dosen.toLowerCase()].join('|');
      if (dupGroups[dupKey] > 1) s.flags.push('Kemungkinan duplikat');
      if (s.status === 'Draft') s.flags.push('Draft');
      if (jadwal.length && !s.jadwalId) s.flags.push('Sesi ekstra');
    }

    const coveredJadwal = new Set(sesi.map((s) => s.jadwalId).filter(Boolean));
    const jadwalBelum = jadwal.filter((j) => !coveredJadwal.has(str(j.jadwalId || j['Jadwal ID']))).length;
    const sesiDraft = sesi.filter((s) => s.status === 'Draft').length;
    const sesiEkstra = sesi.filter((s) => s.flags.indexOf('Sesi ekstra') !== -1).length;
    const kemungkinanDuplikat = Object.keys(dupGroups).filter((k) => dupGroups[k] > 1).length;
    const pesertaSeen = {};
    for (const s of sesi) {
      for (const p of s.peserta) {
        const pk = p.npm || p.namaLengkap;
        if (pk) pesertaSeen[pk] = true;
      }
    }
    const row = {
      key: key,
      bagian: str(unit && unit.bagian),
      blok: str(unit && unit.blok),
      kegiatan: str((unit && (unit.label || unit.namaKegiatan)) || ''),
      jumlahSesi: sesi.length,
      status: sesi.length > 1 ? 'Multi-sesi' : (sesi.length === 1 ? 'Satu sesi' : 'Belum'),
      jadwalCount: jadwal.length,
      jadwalBelum: jadwalBelum,
      sesiEkstra: sesiEkstra,
      sesiDraft: sesiDraft,
      kemungkinanDuplikat: kemungkinanDuplikat,
      pesertaUnik: Object.keys(pesertaSeen).length,
      sesi: sesi
    };
    if (unit && typeof unit === 'object') unit.baAudit = row;
    rows.push(row);

    summary.totalKegiatan += 1;
    summary.totalSesi += row.jumlahSesi;
    if (row.status === 'Multi-sesi') summary.multiSesi += 1;
    if (row.status === 'Satu sesi') summary.satuSesi += 1;
    if (row.status === 'Belum') summary.belumSesi += 1;
    summary.sesiEkstra += row.sesiEkstra;
    summary.sesiDraft += row.sesiDraft;
    summary.kemungkinanDuplikat += row.kemungkinanDuplikat;
    summary.jadwalBelum += row.jadwalBelum;
  }

  return { rows: rows, summary: summary };
}
