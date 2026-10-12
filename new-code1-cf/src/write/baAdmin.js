import { requireAdmin } from '../session.js';
import { kegiatanKey, getBagianBaStatuses } from '../read/common.js';
import { nextBaId } from './beritaAcara.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}
function lowsp(v) { return str(v).toLowerCase().replace(/\s+/g, ' ').trim(); }
function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function findBaByKey(db, key) {
  if (!key) return null;
  return await db.prepare('SELECT * FROM berita_acara_admin WHERE kegiatan_key = ?1').bind(key).first();
}

export async function getOrCreateBaAdmin(db, kegiatan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const bagian = str(kegiatan.bagian) || 'Admin';
  const blok = str(kegiatan.blok);
  const nama = str(kegiatan.namaKegiatan);
  const key = kegiatanKey(bagian, blok, nama);
  const dup = await findBaByKey(db, key);
  if (dup) return { success: true, baId: str(dup.ba_id), created: false };

  const baId = await nextBaId(db, 'berita_acara_admin');
  const ts = nowIso();
  await db.prepare(
    'INSERT INTO berita_acara_admin (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, jumlah_peserta, file_name, file_url, catatan, sumber, kegiatan_key, updated_at, needs_regen) ' +
    "VALUES (?1,?2,?3,?4,?5,?6,?7,'0','','',?8,'Admin',?9,?10,0)"
  ).bind(ts, baId, bagian, blok, nama, str(kegiatan.tanggalPelaksanaan), str(kegiatan.jam), str(kegiatan.catatan), key, ts).run();
  return { success: true, baId, created: true };
}

async function nextUrutan(db, baId) {
  const row = await db.prepare('SELECT MAX(urutan) AS m FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(baId).first();
  const m = row && row.m != null ? Number(row.m) : 0;
  return (isNaN(m) ? 0 : m) + 1;
}

export async function addBaAdminPesertaBulk(db, baId, ids, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const list = Array.isArray(ids) ? ids.map((x) => str(x)).filter(Boolean) : [];
  if (!id || !list.length) return { success: true, added: 0, skipped: 0 };

  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const existing = (await db.prepare('SELECT id_pengajuan FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const have = {};
  for (const r of existing) have[str(r.id_pengajuan)] = true;

  let urutan = await nextUrutan(db, id);
  let added = 0;
  let skipped = 0;
  const ts = nowIso();
  const stmts = [];
  for (const pid of list) {
    if (have[pid]) { skipped += 1; continue; }
    const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(pid).first();
    if (!p) { skipped += 1; continue; }
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_admin_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan, urutan, active) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)'
      ).bind(ts, id, pid, str(p.npm), str(p.nama_lengkap), str(p.blok), str(ba.bagian), str(p.status), urutan)
    );
    have[pid] = true;
    urutan += 1;
    added += 1;
  }
  if (stmts.length) await db.batch(stmts);
  if (added) {
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
    await db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id).run();
  }
  return { success: true, added, skipped };
}

async function listCandidates(db, kegiatan) {
  const jenis = lowsp(kegiatan.jenis);
  const pilihan = lowsp(kegiatan.pilihan);
  const detailText = lowsp(kegiatan.detail);
  const blokNorm = str(kegiatan.blok).replace(/\s+/g, ' ');
  const bagian = str(kegiatan.bagian);
  const allowed = await getBagianBaStatuses(db);
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const idSet = new Set();
  for (const d of details) {
    if (lowsp(d.jenis_kegiatan) !== jenis) continue;
    if (lowsp(d.pilihan) !== pilihan) continue;
    if (lowsp(d.detail) !== detailText) continue;
    const pid = str(d.id_pengajuan);
    if (pid) idSet.add(pid);
  }
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const out = [];
  for (const p of pengajuan) {
    const pid = str(p.id_pengajuan);
    if (!idSet.has(pid)) continue;
    if (str(p.blok).replace(/\s+/g, ' ') !== blokNorm) continue;
    const st = str(p.status);
    if (allowed.indexOf(st) === -1) continue;
    out.push({ idPengajuan: pid, npm: str(p.npm), namaLengkap: str(p.nama_lengkap), blok: str(p.blok), bagian, statusPengajuan: st });
  }
  out.sort((a, b) => a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()));
  return out;
}

export async function getBaAdminForPengajuan(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(idPengajuan);
  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!p) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(id).all()).results || [];
  const d0 = details[0] || {};
  const bagian = str(d0.jenis_kegiatan) || str(p.jenis_kegiatan) || 'Admin';
  const blok = str(p.blok);
  const nama = str(d0.pilihan) + (str(d0.detail) ? ' - ' + str(d0.detail) : '');
  const tanggal = str(d0.tanggal_pelaksanaan) || str(p.tanggal_pelaksanaan);
  const kegiatan = { bagian, blok, namaKegiatan: nama, jenis: str(d0.jenis_kegiatan), pilihan: str(d0.pilihan), detail: str(d0.detail), tanggalPelaksanaan: tanggal };

  const key = kegiatanKey(bagian, blok, nama);
  const baRow = await findBaByKey(db, key);
  let ba = null;
  let peserta = [];
  if (baRow) {
    ba = { baId: str(baRow.ba_id), bagian: str(baRow.bagian), blok: str(baRow.blok), namaKegiatan: str(baRow.nama_kegiatan), tanggal: str(baRow.tanggal_pelaksanaan), jam: str(baRow.jam), catatan: str(baRow.catatan), fileUrl: str(baRow.file_url), jumlahPeserta: Number(baRow.jumlah_peserta) || 0, needsRegen: Number(baRow.needs_regen) === 1 };
    const rows = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1 ORDER BY urutan').bind(ba.baId).all()).results || [];
    const berkas = (await db.prepare('SELECT * FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1 ORDER BY page_index').bind(ba.baId).all()).results || [];
    const filesByNpm = {};
    for (const b of berkas) {
      const k = str(b.npm);
      if (!filesByNpm[k]) filesByNpm[k] = [];
      filesByNpm[k].push({ pageIndex: Number(b.page_index) || 0, fileUrl: str(b.file_url) });
    }
    peserta = rows.map((r) => {
      const files = filesByNpm[str(r.npm)] || [];
      return {
        idPengajuan: str(r.id_pengajuan), npm: str(r.npm), namaLengkap: str(r.nama_lengkap),
        blok: str(r.blok), urutan: Number(r.urutan) || 0, pages: files.length,
        fileUrl: files.length ? files[0].fileUrl : '', files,
        isCurrent: str(r.id_pengajuan) === id
      };
    });
  }
  const candidates = await listCandidates(db, kegiatan);
  const inBa = {};
  for (const x of peserta) inBa[x.idPengajuan] = true;
  const filtered = candidates.filter((c) => !inBa[c.idPengajuan]);
  return { success: true, data: { kegiatan, ba, peserta, candidates: filtered } };
}
