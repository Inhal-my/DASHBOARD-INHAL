import { requireAdmin } from '../session.js';
import { toClientRow } from './columns.js';
import { formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap, resolveBiayaForPengajuan } from './common.js';

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

export async function getLaporanBootstrap(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const histories = (await db.prepare('SELECT * FROM status_history').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const baPeserta = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const pesertaMap = {};
  for (const r of baPeserta) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!pesertaMap[id]) pesertaMap[id] = [];
    pesertaMap[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }

  const detailById = {};
  for (const d of details) {
    const k = String(d.id_pengajuan || '').trim();
    if (!detailById[k]) detailById[k] = [];
    detailById[k].push(toClientRow('detail_kegiatan', d));
  }
  const historyById = {};
  for (const h of histories) {
    const k = String(h.id_pengajuan || '').trim();
    if (!historyById[k]) historyById[k] = [];
    historyById[k].push(toClientRow('status_history', h));
  }

  let totalPendaftar = 0, totalDiterima = 0, totalDitolak = 0, totalMenunggu = 0, totalAcc = 0, totalBiaya = 0;
  const perJenis = {}, perBlok = {}, perStatus = {};
  const rows = pengajuan.map((p) => {
    const id = String(p.id_pengajuan || '').trim();
    const row = toClientRow('pengajuan', p);
    const status = String(row.Status || '').trim();
    totalPendaftar++;
    if (status === 'Diterima') totalDiterima++;
    if (status === 'Ditolak') totalDitolak++;
    if (status === 'Menunggu') totalMenunggu++;
    if (status === 'ACC') totalAcc++;
    perStatus[status || 'Lainnya'] = (perStatus[status || 'Lainnya'] || 0) + 1;
    const jenis = String(row['Jenis Kegiatan'] || 'Lainnya').trim();
    perJenis[jenis] = (perJenis[jenis] || 0) + 1;
    const blok = String(row.Blok || '-').trim();
    perBlok[blok] = (perBlok[blok] || 0) + 1;
    row.Biaya = resolveBiayaForPengajuan(row, biayaMap, overrideMap);
    row['Biaya Rupiah'] = formatRupiah(row.Biaya);
    totalBiaya += row.Biaya;
    return { pengajuan: row, details: detailById[id] || [], history: historyById[id] || [] };
  });

  const sortedBa = ba.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const beritaAcara = sortedBa.filter((r) => baSumber(toClientRow('berita_acara', r)) === 'Bagian').map((r) => {
    const c = toClientRow('berita_acara', r);
    c.peserta = pesertaMap[String(r.ba_id || '').trim()] || [];
    return c;
  });

  const pushUnique = (list, v) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s && list.indexOf(s) === -1) list.push(s);
  };
  const dosen = [];
  pengajuan.forEach((p) => pushUnique(dosen, toClientRow('pengajuan', p).Dosen));
  dosen.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const blok = [];
  pengajuan.forEach((p) => pushUnique(blok, toClientRow('pengajuan', p).Blok));
  ba.forEach((b) => pushUnique(blok, toClientRow('berita_acara', b).Blok));
  blok.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  return {
    summary: { totalPendaftar, totalDiterima, totalDitolak, totalMenunggu, totalAcc, totalBiaya, perJenis, perBlok, perStatus },
    rows,
    beritaAcara,
    dosen,
    blok,
    bagian: { categories: ['Ujian', 'SGD', 'KKD'], labs: await getMasterOptions(db, 'Lab') }
  };
}
