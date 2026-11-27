import { getBaRules, getBaRuleFor } from '../read/common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function dateOnly(v) {
  return str(v).slice(0, 10);
}

export async function ruleForKategori(db, kategori) {
  return getBaRuleFor(await getBaRules(db), kategori);
}

// Kategori diturunkan dari kolom `bagian` yang tersimpan. Nama lab Praktikum
// (mis. "Lab Anatomi") maupun "Praktikum" dipetakan ke Praktikum; bagian lain
// yang bukan kategori dikenal dianggap Praktikum karena hanya kategori itu
// yang memakai sub-bagian.
export function kategoriFromBagian(bagian, labs) {
  const k = str(bagian).toLowerCase().replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'sgd') return 'SGD';
  if (k === 'ujian') return 'Ujian';
  if (k === 'kkd' || k === 'keterampilan klinik dasar' || k === 'keterampilan dasar') return 'KKD';
  if (k === 'praktikum') return 'Praktikum';
  for (const lab of labs || []) {
    if (str(lab).toLowerCase().replace(/\s+/g, ' ') === k) return 'Praktikum';
  }
  return 'Praktikum';
}

export function overrideReason(payload, ruleKey) {
  const o = payload && payload.override;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return '';
  return str(o[ruleKey]);
}

function allowOverride(ruleKey, message) {
  return { ok: false, rule: ruleKey, allowOverride: true, message };
}

export async function loadPengajuanStatusMap(db) {
  const { results } = await db.prepare('SELECT id_pengajuan, status FROM pengajuan').all();
  const map = {};
  for (const r of results || []) map[str(r.id_pengajuan)] = str(r.status);
  return map;
}

// (d) Per-peserta: status final = ACC saja. Longgar mengeluarkan non-ACC
// otomatis (tanpa opsi paksa-ikut); Ketat menolak.
export function applyPerPesertaRule(rule, peserta, statusMap, label) {
  const mode = (rule && rule.perPeserta) || 'bebas';
  if (mode === 'bebas') return { ok: true, peserta: peserta || [], deferred: [], mode };
  const final = [];
  const deferred = [];
  for (const p of peserta || []) {
    const pid = str(p.idPengajuan);
    const st = (pid && statusMap && statusMap[pid] !== undefined) ? statusMap[pid] : str(p.statusPengajuan);
    const item = { ...p, statusPengajuan: st };
    if (st === 'ACC') final.push(item); else deferred.push(item);
  }
  const names = (list) => list.map((x) => x.namaLengkap || x.npm).join(', ');
  if (mode === 'ketat' && deferred.length) {
    return {
      ok: false,
      rule: 'perPeserta',
      message: (label || 'Kegiatan ini') + ': semua peserta harus ACC — ' + names(deferred) + '.'
    };
  }
  if (mode === 'longgar' && !final.length) {
    return { ok: false, rule: 'perPeserta', message: (label || 'Kegiatan ini') + ': tidak ada peserta final (ACC).' };
  }
  return { ok: true, peserta: final, deferred, mode };
}

// (a) Multi-jadwal: Longgar hanya mengizinkan tanggal yang sama dengan jadwal
// utama; tanggal berbeda (mis. susulan) wajib override.
export async function checkMultiJadwal(db, opts) {
  const mode = (opts.rule && opts.rule.multiJadwal) || 'bebas';
  if (mode === 'bebas') return { ok: true };
  const key = str(opts.kegiatanKey);
  const exclude = str(opts.excludeJadwalId);
  const { results } = await db.prepare(
    'SELECT jadwal_id, tanggal FROM jadwal_pelaksanaan WHERE active = 1 AND kegiatan_key = ?1'
  ).bind(key).all();
  const others = (results || []).filter((r) => str(r.jadwal_id) !== exclude);
  if (!others.length) return { ok: true };
  const label = opts.label || 'Kegiatan ini';
  if (mode === 'ketat') {
    return { ok: false, rule: 'multiJadwal', message: label + ' hanya boleh satu jadwal per kegiatan.' };
  }
  const primary = others.map((r) => dateOnly(r.tanggal)).filter(Boolean).sort()[0] || '';
  const tanggal = dateOnly(opts.tanggal);
  if (primary && tanggal && tanggal === primary) return { ok: true };
  const alasan = overrideReason(opts.payload, 'multiJadwal');
  if (alasan) return { ok: true, override: 'multiJadwal', alasan };
  return allowOverride(
    'multiJadwal',
    label + ' sudah punya jadwal di tanggal ' + (primary || '-') + '. Tanggal berbeda memerlukan konfirmasi alasan.'
  );
}

// (b) BA multi-sesi: Longgar cukup bila semua sesi bertanggal sama; beda
// tanggal wajib override.
export function checkMultiSesi(rule, sesi, payload, label) {
  const mode = (rule && rule.multiSesi) || 'bebas';
  if (mode === 'bebas' || !sesi || sesi.length <= 1) return { ok: true };
  if (mode === 'ketat') {
    return { ok: false, rule: 'multiSesi', message: (label || 'Kegiatan ini') + ' tidak boleh memakai BA multi-sesi.' };
  }
  const dates = Array.from(new Set((sesi || []).map((s) => dateOnly(s.tanggal)).filter(Boolean)));
  if (dates.length <= 1) return { ok: true };
  const alasan = overrideReason(payload, 'multiSesi');
  if (alasan) return { ok: true, override: 'multiSesi', alasan };
  return allowOverride(
    'multiSesi',
    (label || 'Kegiatan ini') + ': sesi berbeda tanggal memerlukan konfirmasi alasan.'
  );
}

// (c) Multi-BA: Longgar mengizinkan BA tambahan hanya bila tanggalnya berbeda
// dari BA utama; tanggal sama wajib override.
export async function checkMultiBa(db, opts) {
  const mode = (opts.rule && opts.rule.multiBa) || 'bebas';
  if (mode === 'bebas') return { ok: true };
  const key = str(opts.kegiatanKey);
  const exclude = str(opts.excludeBaId);
  const { results } = await db.prepare(
    "SELECT ba_id, tanggal_pelaksanaan FROM berita_acara WHERE COALESCE(archived_at, '') = '' AND kegiatan_key = ?1"
  ).bind(key).all();
  const others = (results || []).filter((r) => str(r.ba_id) !== exclude);
  if (!others.length) return { ok: true };
  const label = opts.label || 'Kegiatan ini';
  if (mode === 'ketat') {
    return { ok: false, rule: 'multiBa', message: label + ' hanya boleh satu BA per kegiatan.' };
  }
  const primary = others.map((r) => dateOnly(r.tanggal_pelaksanaan)).filter(Boolean).sort()[0] || '';
  const tanggal = dateOnly(opts.tanggal);
  if (primary && tanggal && tanggal !== primary) return { ok: true };
  const alasan = overrideReason(opts.payload, 'multiBa');
  if (alasan) return { ok: true, override: 'multiBa', alasan };
  return allowOverride(
    'multiBa',
    label + ': BA tambahan di tanggal yang sama memerlukan konfirmasi alasan.'
  );
}
