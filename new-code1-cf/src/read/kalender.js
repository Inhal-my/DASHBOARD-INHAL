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

function sortEntries(a, b) {
  const byDate = a.Tanggal.localeCompare(b.Tanggal);
  if (byDate !== 0) return byDate;
  const byTime = timeKey(a.Jam).localeCompare(timeKey(b.Jam));
  if (byTime !== 0) return byTime;
  return (a.Bagian + '|' + a.NamaKegiatan).localeCompare(b.Bagian + '|' + b.NamaKegiatan);
}

function entrySummary(entry) {
  return {
    JadwalID: entry.JadwalID,
    Bagian: entry.Bagian,
    Blok: entry.Blok,
    NamaKegiatan: entry.NamaKegiatan
  };
}

/**
 * Menandai peserta yang bentrok: npm yang sama hadir pada dua jadwal berbeda
 * di tanggal dan jam yang sama. Hanya identitas peserta yang bentrok yang
 * ikut dikembalikan; peserta lain tetap tersembunyi dari kalender.
 */
export function markKalenderBentrok(entries, pesertaByJadwal) {
  const bySlot = {};
  (entries || []).forEach((entry) => {
    const tanggal = str(entry.Tanggal);
    const jam = timeKey(entry.Jam);
    if (!tanggal) return;
    const peserta = pesertaByJadwal[entry.JadwalID] || [];
    const seen = {};
    peserta.forEach((p) => {
      const npm = str(p && p.npm);
      if (!npm || seen[npm]) return;
      seen[npm] = true;
      const key = tanggal + '|' + jam + '|' + npm;
      if (!bySlot[key]) bySlot[key] = { npm: npm, entries: [] };
      if (!bySlot[key].entries.some((e) => e.JadwalID === entry.JadwalID)) {
        bySlot[key].entries.push(entry);
      }
    });
  });

  const bentrokByEntry = {};
  Object.keys(bySlot).forEach((key) => {
    const slot = bySlot[key];
    if (slot.entries.length < 2) return;
    const detail = slot.entries.map(entrySummary);
    slot.entries.forEach((entry) => {
      if (!bentrokByEntry[entry.JadwalID]) bentrokByEntry[entry.JadwalID] = {};
      const sample = (pesertaByJadwal[entry.JadwalID] || []).find((p) => str(p && p.npm) === slot.npm) || {};
      const bucket = bentrokByEntry[entry.JadwalID];
      bucket[slot.npm] = {
        npm: slot.npm,
        namaLengkap: str(sample.namaLengkap),
        blok: str(sample.blok),
        jadwal: detail
      };
    });
  });

  return (entries || []).map((entry) => {
    const bucket = bentrokByEntry[entry.JadwalID] || {};
    const pesertaBentrok = Object.keys(bucket).map((npm) => bucket[npm]);
    return Object.assign({}, entry, {
      bentrok: pesertaBentrok.length > 0,
      pesertaBentrok: pesertaBentrok
    });
  });
}

/**
 * Kalender pelaksanaan lintas bagian (SGD, KKD, Ujian, dan semua Lab).
 *
 * Hanya mengembalikan identitas jadwal tanpa data peserta (npm/nama), kecuali
 * peserta yang terindikasi bentrok (npm sama pada tanggal & jam yang sama di
 * dua jadwal berbeda). Kalender bersifat baca-saja; perubahan jadwal tetap
 * lewat menu Jadwal pada halaman bagian masing-masing.
 */
export async function computeKalenderJadwal(db) {
  const list = await computeJadwalList(db, '', '');
  const pesertaByJadwal = {};
  const entries = list
    .map((j) => {
      const id = str(j.JadwalID);
      if (id && !pesertaByJadwal[id]) pesertaByJadwal[id] = j.peserta || [];
      return {
        JadwalID: id,
        Bagian: str(j.Bagian),
        Blok: str(j.Blok),
        NamaKegiatan: str(j.NamaKegiatan),
        kegiatan_key: str(j.kegiatan_key),
        Tanggal: dateOnly(j.Tanggal),
        Jam: str(j.Jam),
        Dosen: str(j.Dosen),
        DosenList: j.DosenList || [],
        jumlahPeserta: (j.peserta || []).length,
        punyaBa: !!j.punyaBa,
        baId: str(j.baId),
        readOnly: true
      };
    })
    .filter((r) => !!r.Tanggal);

  return markKalenderBentrok(entries, pesertaByJadwal).sort(sortEntries);
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