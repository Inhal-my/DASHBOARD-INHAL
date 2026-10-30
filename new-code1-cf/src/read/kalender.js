import { getSession, AUTH_ERROR } from '../session.js';
import { computeJadwalList } from './jadwal.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function dateOnly(v) {
  const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function timeKey(v) {
  const m = str(v).match(/(\d{1,2})[.:](\d{2})/);
  return m ? String(Number(m[1])).padStart(2, '0') + ':' + m[2] : str(v);
}

/**
 * Kalender pelaksanaan lintas bagian (SGD, KKD, Ujian, dan semua Lab).
 *
 * Sengaja hanya mengembalikan data yang aman ditampilkan ke semua petugas
 * bagian: identitas jadwal tanpa data peserta (npm/nama). Kalender bersifat
 * baca-saja; perubahan jadwal tetap lewat menu Jadwal pada halaman bagian
 * masing-masing.
 */
export async function computeKalenderJadwal(db) {
  const list = await computeJadwalList(db, '', '');
  return list
    .map((j) => ({
      JadwalID: str(j.JadwalID),
      Bagian: str(j.Bagian),
      Blok: str(j.Blok),
      NamaKegiatan: str(j.NamaKegiatan),
      kegiatan_key: str(j.kegiatan_key),
      Tanggal: dateOnly(j.Tanggal),
      Jam: str(j.Jam),
      Dosen: str(j.Dosen),
      jumlahPeserta: (j.peserta || []).length,
      punyaBa: !!j.punyaBa,
      baId: str(j.baId),
      readOnly: true
    }))
    .filter((r) => !!r.Tanggal)
    .sort((a, b) => {
      const byDate = a.Tanggal.localeCompare(b.Tanggal);
      if (byDate !== 0) return byDate;
      const byTime = timeKey(a.Jam).localeCompare(timeKey(b.Jam));
      if (byTime !== 0) return byTime;
      return (a.Bagian + '|' + a.NamaKegiatan).localeCompare(b.Bagian + '|' + b.NamaKegiatan);
    });
}

export async function getKalenderBagianPelaksanaan(db, ctx) {
  const out = { ok: false, message: '', entries: [], readOnly: true };
  try {
    const c = ctx || {};
    const s = c.session ? c.session : await getSession(db, c.token);
    if (!s || s.role !== 'bagian') { out.message = AUTH_ERROR; return out; }
    out.entries = await computeKalenderJadwal(db);
    out.ok = true;
    return out;
  } catch (e) {
    out.ok = false;
    out.message = (e && e.message) ? e.message : String(e);
    return out;
  }
}