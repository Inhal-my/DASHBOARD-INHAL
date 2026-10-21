import { baginaKey, getMasterOptions, resolveBagian12 } from './common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function normKey(v) {
  return str(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/^blok\s+/, '').replace(/ /g, '');
}

function timeKey(v) {
  const m = str(v).match(/(\d{1,2})[.:](\d{2})/);
  return m ? String(Number(m[1])).padStart(2, '0') + ':' + m[2] : str(v);
}

export function jadwalIdentity(r) {
  const peserta = (r.peserta || [])
    .map((p) => str(p.npm) || str(p.idPengajuan))
    .filter(Boolean)
    .sort();
  return [
    normKey(r.Bagian), normKey(r.Blok), normKey(r.NamaKegiatan),
    str(r.Tanggal).slice(0, 10), timeKey(r.Jam), normKey(r.Dosen), peserta.join(',')
  ].join('|');
}

function mergeJadwal(a, b) {
  const preferB = !!b.punyaBa && !a.punyaBa;
  const base = preferB ? b : a;
  const other = preferB ? a : b;
  const merged = Object.assign({}, base);
  if (!merged.punyaBa && other.punyaBa) {
    merged.punyaBa = true;
    merged.baId = other.baId;
  }
  if ((other.peserta || []).length > (merged.peserta || []).length) merged.peserta = other.peserta;
  return merged;
}

function dedupeJadwal(rows) {
  const out = [];
  const index = {};
  for (const row of rows) {
    const key = jadwalIdentity(row);
    if (index[key] === undefined) {
      index[key] = out.length;
      out.push(row);
    } else {
      out[index[key]] = mergeJadwal(out[index[key]], row);
    }
  }
  return out;
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

  const deduped = dedupeJadwal(rows);
  const filter = baginaKey(bagianFilter);
  if (!filter) return deduped;
  const kat = baginaKey(kategori);
  const isPraktikum = kat === 'praktikum';
  const labs = isPraktikum ? await getMasterOptions(db, 'Lab') : null;
  return deduped.filter((r) => {
    if (isPraktikum) {
      const resolved = resolveBagian12(r.Bagian, '', r.NamaKegiatan, labs);
      return resolved ? baginaKey(resolved) === filter : false;
    }
    return baginaKey(r.Bagian) === filter;
  });
}
