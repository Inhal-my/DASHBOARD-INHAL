import { getSession, requireBagianSession, AUTH_ERROR } from '../session.js';
import { toClientRow } from './columns.js';
import { computeJadwalList } from './jadwal.js';
import {
  baginaKey, getMasterOptions, getBagianBaSettings, baginaHasAccess,
  getBagianAliasMap, resolveBagian12, kegiatanKey
} from './common.js';

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

export async function getBaginaConfig(db, ctx) {
  await requireBagianSession(db, '', '', ctx.token, ctx.session);
  return {
    categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'],
    labOptions: await getMasterOptions(db, 'Lab'),
    kegiatanLabOptions: await getMasterOptions(db, 'Kegiatan Lab'),
    ba: await getBagianBaSettings(db)
  };
}

async function computeBagianRows(db, kategori, subBagian) {
  const all = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const kat = baginaKey(kategori);
  const sub = baginaKey(subBagian);
  const byId = {};
  for (const d of details) {
    const id = String(d.id_pengajuan || '').trim();
    if (!id) continue;
    if (!byId[id]) byId[id] = [];
    byId[id].push(toClientRow('detail_kegiatan', d));
  }
  const rows = [];
  const baKeyByBaId = {};
  for (const b of (await db.prepare('SELECT ba_id, kegiatan_key FROM berita_acara').all()).results || []) {
    const id = String(b.ba_id || '').trim();
    if (id) baKeyByBaId[id] = String(b.kegiatan_key || '').trim();
  }
  const baMemberByKey = {};
  for (const p of (await db.prepare('SELECT ba_id, id_pengajuan FROM berita_acara_peserta').all()).results || []) {
    const key = baKeyByBaId[String(p.ba_id || '').trim()];
    const idp = String(p.id_pengajuan || '').trim();
    if (!key || !idp) continue;
    if (!baMemberByKey[key]) baMemberByKey[key] = new Set();
    baMemberByKey[key].add(idp);
  }
  const bagianForKey = String(subBagian || kategori || '').trim();
  for (const p of all) {
    const prow = toClientRow('pengajuan', p);
    const id = String(prow['ID Pengajuan'] || '').trim();
    const ds = byId[id];
    if (!ds) continue;
    for (const d of ds) {
      const dJenis = baginaKey(d['Jenis Kegiatan']);
      if (kat && dJenis !== kat) continue;
      if (kat === 'praktikum' && sub) {
        const dBagian = baginaKey(d.Bagian);
        const dPilihan = baginaKey(d.Pilihan);
        if (dBagian !== sub && dPilihan !== sub) continue;
      }
      const namaKegiatan = String(d.Pilihan || '').trim() + (String(d.Detail || '').trim() ? ' - ' + String(d.Detail || '').trim() : '');
      const kk = kegiatanKey(bagianForKey, String(prow.Blok || '').trim(), namaKegiatan);
      const memberSet = baMemberByKey[kk];
      rows.push({
        idPengajuan: id,
        npm: String(prow.NPM || '').trim(),
        namaLengkap: String(prow['Nama Lengkap'] || '').trim(),
        blok: String(prow.Blok || '').trim(),
        jenis: String(d['Jenis Kegiatan'] || '').trim(),
        pilihan: String(d.Pilihan || '').trim(),
        detail: String(d.Detail || '').trim(),
        tanggal: String(d['Tanggal Pelaksanaan'] || ''),
        bagian: String(d.Bagian || '').trim(),
        status: String(prow.Status || '').trim(),
        linkSurat: String(prow['Link Surat Keterangan'] || '').trim(),
        linkFinal: String(prow['Link Final'] || '').trim(),
        baMember: !!(memberSet && memberSet.has(id))
      });
    }
  }
  return rows;
}

async function getBaPesertaMap(db) {
  const rows = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const map = {};
  for (const r of rows) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }
  return map;
}

async function getBaAdminPesertaMap(db) {
  const rows = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE active = 1').all()).results || [];
  const map = {};
  for (const r of rows) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }
  return map;
}

async function computeBaPendukungList(db, bagianFilter, kategori) {
  const all = (await db.prepare('SELECT * FROM berita_acara_admin').all()).results || [];
  const filter = baginaKey(bagianFilter);
  const kat = baginaKey(kategori);
  const labs = kat === 'praktikum' ? await getMasterOptions(db, 'Lab') : null;
  const pesertaMap = await getBaAdminPesertaMap(db);
  const rows = all
    .slice()
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .map((r) => {
      const c = toClientRow('berita_acara_admin', r);
      c.peserta = pesertaMap[String(r.ba_id || '').trim()] || [];
      return c;
    });
  if (!filter) return rows;
  return rows.filter((r) => {
    if (kat === 'praktikum') {
      const resolved = resolveBagian12(r.Bagian, '', r['Nama Kegiatan'], labs);
      if (resolved && baginaKey(resolved) === filter) return true;
    }
    return baginaKey(r.Bagian) === filter;
  });
}

async function computeBaList(db, bagianFilter, kategori) {
  const all = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const rows = all.map((r) => toClientRow('berita_acara', r)).filter((r) => baSumber(r) === 'Bagian');
  const filter = baginaKey(bagianFilter);
  const kat = baginaKey(kategori);
  const isPraktikum = kat === 'praktikum';
  const labs = isPraktikum ? await getMasterOptions(db, 'Lab') : null;
  const pesertaMap = await getBaPesertaMap(db);
  const sanitized = rows.map((c) => {
    const copy = Object.assign({}, c);
    copy.peserta = pesertaMap[String(c['BA ID'] || '').trim()] || [];
    copy.selesai = !!(String(c.Dosen || '').trim() && String(c['Tanggal Pelaksanaan'] || '').trim() && String(c.Jam || '').trim());
    return copy;
  });
  if (filter) {
    return sanitized.filter((r) => {
      if (isPraktikum) {
        const resolved = resolveBagian12(r.Bagian, '', r['Nama Kegiatan'], labs);
        return resolved ? baginaKey(resolved) === filter : false;
      }
      return baginaKey(r.Bagian) === filter;
    });
  }
  return sanitized;
}

export async function getBagianBootstrap(db, kategori, subBagian, ctx) {
  const out = {
    ok: false, message: '', nama: '',
    kategori: String(kategori || '').trim(), subBagian: String(subBagian || '').trim(),
    config: { categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'], labOptions: [], kegiatanLabOptions: [] },
    rows: [], baList: [], baPendukungList: [], jadwalList: []
  };
  try {
    const s = ctx.session ? ctx.session : await getSession(db, ctx.token);
    if (!s || s.role !== 'bagian') { out.message = AUTH_ERROR; return out; }
    const kat = out.kategori;
    if (kat) {
      const masterBagian = (await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all()).results || [];
      if (!baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian, getBagianAliasMap(masterBagian))) {
        out.message = 'Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '. Bukan ' + kat + '.';
        return out;
      }
    }
    out.ok = true;
    out.nama = s.nama || '';
    out.config.labOptions = await getMasterOptions(db, 'Lab');
    out.config.kegiatanLabOptions = await getMasterOptions(db, 'Kegiatan Lab');
    out.rows = await computeBagianRows(db, kat, subBagian);
    out.baList = await computeBaList(db, subBagian || out.kategori, out.kategori);
    out.baPendukungList = await computeBaPendukungList(db, subBagian || out.kategori, out.kategori);
    out.jadwalList = await computeJadwalList(db, subBagian || out.kategori, out.kategori);
    return out;
  } catch (e) {
    out.message = (e && e.message) ? e.message : String(e);
    return out;
  }
}

export async function getBeritaAcaraList(db, bagianFilter, kategori, ctx) {
  const s = ctx.session ? ctx.session : await getSession(db, ctx.token);
  if (!s || s.role !== 'bagian') throw new Error(AUTH_ERROR);
  const kat = String(kategori || '').trim();
  const sub = String(bagianFilter || '').trim();
  const masterBagian = (await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all()).results || [];
  if (!baginaHasAccess({ kategoris: s.kategoris || [] }, kat, sub, getBagianAliasMap(masterBagian))) {
    throw new Error('Akses ditolak. Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '.');
  }
  return await computeBaList(db, bagianFilter, kategori);
}
