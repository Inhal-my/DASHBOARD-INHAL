import { baginaKey, getMasterOptions, resolveBagian12 } from './common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

export async function computeJadwalList(db, bagianFilter, kategori) {
  const jadwal = (await db.prepare('SELECT * FROM jadwal_pelaksanaan').all()).results || [];
  const pesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
  const baRows = (await db.prepare('SELECT ba_id, jadwal_id FROM berita_acara').all()).results || [];

  const baIdByJadwal = {};
  for (const b of baRows) {
    const j = str(b.jadwal_id);
    if (j && !baIdByJadwal[j]) baIdByJadwal[j] = str(b.ba_id);
  }
  const pesertaByJadwal = {};
  for (const p of pesertaRows) {
    const j = str(p.jadwal_id);
    if (!j) continue;
    if (!pesertaByJadwal[j]) pesertaByJadwal[j] = [];
    pesertaByJadwal[j].push({
      idPengajuan: str(p.id_pengajuan), npm: str(p.npm),
      namaLengkap: str(p.nama_lengkap), blok: str(p.blok),
      statusPengajuan: str(p.status_pengajuan)
    });
  }

  const rows = [];
  for (const r of jadwal) {
    if (Number(r.active) !== 1) continue;
    const id = str(r.jadwal_id);
    rows.push({
      JadwalID: id,
      Bagian: str(r.bagian),
      Blok: str(r.blok),
      NamaKegiatan: str(r.nama_kegiatan),
      kegiatan_key: str(r.kegiatan_key),
      Tanggal: str(r.tanggal),
      Jam: str(r.jam),
      Dosen: str(r.dosen),
      Catatan: str(r.catatan),
      Active: Number(r.active) || 0,
      punyaBa: !!baIdByJadwal[id],
      baId: baIdByJadwal[id] || '',
      peserta: pesertaByJadwal[id] || []
    });
  }

  const filter = baginaKey(bagianFilter);
  if (!filter) return rows;
  const kat = baginaKey(kategori);
  const isPraktikum = kat === 'praktikum';
  const labs = isPraktikum ? await getMasterOptions(db, 'Lab') : null;
  return rows.filter((r) => {
    if (isPraktikum) {
      const resolved = resolveBagian12(r.Bagian, '', r.NamaKegiatan, labs);
      return resolved ? baginaKey(resolved) === filter : false;
    }
    return baginaKey(r.Bagian) === filter;
  });
}
