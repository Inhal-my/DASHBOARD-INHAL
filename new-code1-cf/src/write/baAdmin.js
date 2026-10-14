import { requireAdmin } from '../session.js';
import { kegiatanKey, getBagianBaStatuses, getMasterOptions, resolveBagian12 } from '../read/common.js';
import { nextBaId } from './beritaAcara.js';
import { saveDriveFile, getDriveFileBase64, parseDriveFileId } from '../drive.js';
import { decodeBase64Size, resolveMime, base64ToBytes } from '../uploads.js';
import { mergeBaFilesToPdf } from '../baMerge.js';
import { PDFDocument } from 'pdf-lib';

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

async function pengajuanMatchesBa(db, p, ba, labs) {
  const key = str(ba.kegiatan_key);
  if (!key) return false;
  const blok = str(p.blok).replace(/\s+/g, ' ');
  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(str(p.id_pengajuan)).all()).results || [];
  for (const d of details) {
    const jenis = str(d.jenis_kegiatan);
    const nama = str(d.pilihan) + (str(d.detail) ? ' - ' + str(d.detail) : '');
    const bagian = lowsp(jenis) === 'praktikum'
      ? (resolveBagian12('Praktikum', str(d.pilihan), nama, labs) || 'Praktikum')
      : jenis;
    if (kegiatanKey(bagian, blok, nama) === key) return true;
  }
  return false;
}

export async function addBaAdminPesertaBulk(db, baId, ids, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const list = Array.isArray(ids) ? ids.map((x) => str(x)).filter(Boolean) : [];
  if (!id || !list.length) return { success: true, added: 0, skipped: 0 };

  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const existing = (await db.prepare('SELECT id_pengajuan, urutan, active FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const have = {};
  const inactive = {};
  for (const r of existing) {
    const k = str(r.id_pengajuan);
    if (Number(r.active) === 1) have[k] = true;
    else if (!inactive[k]) inactive[k] = r;
  }

  const labs = await getMasterOptions(db, 'Lab');
  let urutan = await nextUrutan(db, id);
  let added = 0;
  let skipped = 0;
  const ts = nowIso();
  const stmts = [];
  for (const pid of list) {
    if (have[pid]) { skipped += 1; continue; }
    const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(pid).first();
    if (!p) { skipped += 1; continue; }
    if (!(await pengajuanMatchesBa(db, p, ba, labs))) { skipped += 1; continue; }
    const prev = inactive[pid];
    if (prev) {
      stmts.push(db.prepare('UPDATE berita_acara_admin_peserta SET active = 1 WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid));
    } else {
      stmts.push(
        db.prepare(
          'INSERT INTO berita_acara_admin_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan, urutan, active) ' +
          'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)'
        ).bind(ts, id, pid, str(p.npm), str(p.nama_lengkap), str(p.blok), str(ba.bagian), str(p.status), urutan)
      );
      urutan += 1;
    }
    have[pid] = true;
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

export const BA_ADMIN_MAX_PAGES = 50;
export const BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024;

async function countActivePages(db, baId, exceptIdPengajuan) {
  const rows = (await db.prepare('SELECT id_pengajuan, page_count FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1').bind(baId).all()).results || [];
  let n = 0;
  for (const r of rows) {
    if (exceptIdPengajuan && str(r.id_pengajuan) === str(exceptIdPengajuan)) continue;
    n += Number(r.page_count) || 1;
  }
  return n;
}

async function countActiveBytes(db, baId, exceptIdPengajuan) {
  const rows = (await db.prepare('SELECT id_pengajuan, byte_size FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1').bind(baId).all()).results || [];
  let n = 0;
  for (const r of rows) {
    if (exceptIdPengajuan && str(r.id_pengajuan) === str(exceptIdPengajuan)) continue;
    n += Number(r.byte_size) || 0;
  }
  return n;
}

export async function setBaAdminPesertaBerkas(db, baId, idPengajuan, images, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const pid = str(idPengajuan);
  if (!id || !pid) return { success: false, message: 'BA ID / pengajuan kosong.' };

  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const list = Array.isArray(images) ? images : [];
  if (!list.length) return { success: false, message: 'Tidak ada halaman yang diunggah.' };

  const prepared = [];
  let newPages = 0;
  let totalBytes = 0;
  for (const f of list) {
    const mime = resolveMime(f && f.mimeType, f && f.data);
    if (mime !== 'image/jpeg' && mime !== 'image/jpg' && mime !== 'image/png' && mime !== 'application/pdf') {
      return { success: false, message: 'Format halaman harus JPG, PNG, atau PDF.' };
    }
    let pageCount = 1;
    if (mime === 'application/pdf') {
      try {
        const src = await PDFDocument.load(base64ToBytes(String(f.data)), { ignoreEncryption: true });
        pageCount = src.getPageCount();
      } catch (e) {
        return { success: false, message: 'PDF tidak dapat dibaca.' };
      }
      if (!pageCount) return { success: false, message: 'PDF tidak memiliki halaman.' };
    }
    const byteSize = decodeBase64Size(f && f.data);
    totalBytes += byteSize;
    newPages += pageCount;
    prepared.push({ mime: mime, data: String(f.data), name: String(f.name || ''), pageCount: pageCount, byteSize: byteSize });
  }

  const others = await countActivePages(db, id, pid);
  if (others + newPages > BA_ADMIN_MAX_PAGES) {
    return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman per BA terlampaui.' };
  }
  const otherBytes = await countActiveBytes(db, id, pid);
  if (otherBytes + totalBytes > BA_ADMIN_MAX_BYTES) {
    return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
  }

  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(pid).first();
  const npm = str(p && p.npm);
  const ts = nowIso();

  const existingPeserta = await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid).first();
  const activatePeserta = !existingPeserta || Number(existingPeserta.active) !== 1;
  const urutanPeserta = existingPeserta ? Number(existingPeserta.urutan) || 0 : await nextUrutan(db, id);

  // Unggah semua halaman dulu; D1 tidak disentuh sampai semua unggahan sukses.
  const uploaded = [];
  let page = 0;
  for (const it of prepared) {
    const up = await saveDriveFile(ctx.env, { data: it.data, mimeType: it.mime, name: it.name || ('page-' + (page + 1)) }, 'ba-admin-' + id + '-' + (npm || pid), { label: 'Halaman BA', maxBytes: BA_ADMIN_MAX_BYTES });
    if (!up.ok) return { success: false, message: up.message };
    uploaded.push({ page: page, name: String(up.name || ''), url: up.url, pageCount: it.pageCount, byteSize: it.byteSize });
    page += 1;
  }

  const stmts = [];
  if (existingPeserta) {
    if (activatePeserta) {
      stmts.push(db.prepare('UPDATE berita_acara_admin_peserta SET active = 1 WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid));
    }
  } else {
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_admin_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan, urutan, active) ' +
        "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)"
      ).bind(ts, id, pid, npm, str(p && p.nama_lengkap), str(p && p.blok), str(ba.bagian), str(p && p.status), urutanPeserta)
    );
  }
  stmts.push(db.prepare('UPDATE berita_acara_admin_berkas SET active = 0, superseded_at = ?1 WHERE ba_id = ?2 AND id_pengajuan = ?3 AND active = 1').bind(ts, id, pid));
  for (const u of uploaded) {
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, page_count, byte_size, active) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,1)'
      ).bind(ts, id, pid, npm, urutanPeserta, u.page, u.name, u.url, u.pageCount, u.byteSize)
    );
  }
  let count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
  if (activatePeserta) count += 1;
  stmts.push(db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id));
  await db.batch(stmts);
  return { success: true, pages: newPages };
}

export async function removeBaAdminPeserta(db, baId, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const pid = str(idPengajuan);
  if (!id || !pid) return { success: false, message: 'BA ID / pengajuan kosong.' };
  const ba = await db.prepare('SELECT ba_id FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
  const peserta = await db.prepare('SELECT id FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid).first();
  if (!peserta) return { success: false, message: 'Peserta tidak ditemukan pada BA ini.' };
  const ts = nowIso();
  await db.batch([
    db.prepare('UPDATE berita_acara_admin_peserta SET active = 0 WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid),
    db.prepare('UPDATE berita_acara_admin_berkas SET active = 0, superseded_at = ?1 WHERE ba_id = ?2 AND id_pengajuan = ?3 AND active = 1').bind(ts, id, pid)
  ]);
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
  await db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id).run();
  return { success: true };
}

export async function getBaAdminForPengajuan(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(idPengajuan);
  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!p) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(id).all()).results || [];
  const d0 = details[0] || {};
  const jenis = str(d0.jenis_kegiatan);
  const nama = str(d0.pilihan) + (str(d0.detail) ? ' - ' + str(d0.detail) : '');
  let bagian = jenis;
  if (lowsp(jenis) === 'praktikum') {
    const labs = await getMasterOptions(db, 'Lab');
    bagian = resolveBagian12('Praktikum', str(d0.pilihan), nama, labs) || 'Praktikum';
  }
  bagian = bagian || 'Admin';
  const blok = str(p.blok);
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
    const filesByPid = {};
    for (const b of berkas) {
      const k = str(b.id_pengajuan);
      if (!filesByPid[k]) filesByPid[k] = [];
      filesByPid[k].push({ pageIndex: Number(b.page_index) || 0, fileUrl: str(b.file_url), pageCount: Number(b.page_count) || 1 });
    }
    peserta = rows.map((r) => {
      const files = filesByPid[str(r.id_pengajuan)] || [];
      const totalPages = files.reduce((s, f) => s + (f.pageCount || 1), 0);
      return {
        idPengajuan: str(r.id_pengajuan), npm: str(r.npm), namaLengkap: str(r.nama_lengkap),
        blok: str(r.blok), urutan: Number(r.urutan) || 0, pages: totalPages,
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

async function runRegenerateBaAdminPdf(db, baId, ctx) {
  const id = str(baId);
  let baExists = false;
  try {
    const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
    if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
    baExists = true;

    const rows = (await db.prepare(
      'SELECT b.*, p.nama_lengkap AS p_nama, p.blok AS p_blok, p.urutan AS p_urutan FROM berita_acara_admin_berkas b ' +
      'JOIN berita_acara_admin_peserta p ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan ' +
      'WHERE b.ba_id = ?1 AND b.active = 1 AND p.active = 1 ' +
      'ORDER BY p.urutan, b.page_index'
    ).bind(id).all()).results || [];

    const allPeserta = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1 ORDER BY urutan').bind(id).all()).results || [];

    if (!rows.length) {
      await db.prepare("UPDATE berita_acara_admin SET file_url = '', file_name = '', needs_regen = 0 WHERE ba_id = ?1").bind(id).run();
      return { success: true, fileUrl: '', pages: 0 };
    }

    const totalSourcePages = rows.reduce((s, r) => s + (Number(r.page_count) || 1), 0);
    if (totalSourcePages > BA_ADMIN_MAX_PAGES) {
      await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
      return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman terlampaui.' };
    }

    const pagesByPid = {};
    for (const r of rows) {
      const pid = str(r.id_pengajuan);
      pagesByPid[pid] = (pagesByPid[pid] || 0) + (Number(r.page_count) || 1);
    }
    const pesertaList = allPeserta.map((r) => ({
      urutan: Number(r.urutan) || 0, nama: str(r.nama_lengkap), npm: str(r.npm),
      halaman: pagesByPid[str(r.id_pengajuan)] || 0
    }));

    const groupMap = new Map();
    for (const r of rows) {
      const pid = str(r.id_pengajuan);
      if (!groupMap.has(pid)) groupMap.set(pid, { peserta: { urutan: Number(r.p_urutan) || 0, nama: str(r.p_nama), npm: str(r.npm), blok: str(r.p_blok) }, rows: [] });
      groupMap.get(pid).rows.push(r);
    }

    const groups = [];
    let totalBytes = 0;
    for (const g of groupMap.values()) {
      const files = [];
      for (const r of g.rows) {
        const fileId = parseDriveFileId(r.file_url);
        const got = await getDriveFileBase64(ctx.env, fileId);
        if (!got.ok) throw new Error(got.message || 'Gagal mengambil berkas.');
        totalBytes += decodeBase64Size(got.base64);
        if (totalBytes > BA_ADMIN_MAX_BYTES) {
          await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
          return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
        }
        files.push({ bytes: base64ToBytes(got.base64), mime: got.mime });
      }
      groups.push({ peserta: g.peserta, files: files });
    }
    const merged = await mergeBaFilesToPdf({
      ba: { bagian: str(ba.bagian), blok: str(ba.blok), namaKegiatan: str(ba.nama_kegiatan), tanggal: str(ba.tanggal_pelaksanaan) },
      peserta: pesertaList,
      groups: groups
    });
    const up = await saveDriveFile(ctx.env, { data: bytesToBase64(merged.bytes), mimeType: 'application/pdf', name: 'ba-' + id + '.pdf' }, 'ba-admin-' + id + '-pdf', { allowedMime: ['application/pdf'], maxBytes: BA_ADMIN_MAX_BYTES, label: 'PDF BA' });
    if (!up.ok) throw new Error(up.message || 'Gagal mengunggah PDF BA.');
    const ts = nowIso();
    await db.prepare('UPDATE berita_acara_admin SET file_url = ?1, file_name = ?2, needs_regen = 0, updated_at = ?3 WHERE ba_id = ?4')
      .bind(up.url, String(up.name || ''), ts, id).run();
    return { success: true, fileUrl: up.url, pages: merged.sourcePages };
  } catch (e) {
    if (baExists) {
      try {
        await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
      } catch (e2) {}
    }
    return { success: false, message: (e && e.message) ? e.message : String(e) };
  }
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const regenLocks = new Set();

export async function regenerateBaAdminPdf(db, baId, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (regenLocks.has(id)) return { success: false, message: 'Regenerate sedang berjalan untuk BA ini.' };
  regenLocks.add(id);
  try {
    return await runRegenerateBaAdminPdf(db, id, ctx);
  } finally {
    regenLocks.delete(id);
  }
}

export async function addBaAdminPesertaWithBerkas(db, kegiatan, idPengajuan, images, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const pid = str(idPengajuan);
  if (!pid) return { success: false, message: 'Pengajuan kosong.' };
  const list = Array.isArray(images) ? images : [];
  if (!list.length) return { success: false, message: 'Berkas wajib diunggah untuk menambah peserta BA.' };

  const created = await getOrCreateBaAdmin(db, kegiatan, ctx);
  if (!created.success) return created;

  const set = await setBaAdminPesertaBerkas(db, created.baId, pid, list, ctx);
  if (!set.success) return set;

  const regen = await regenerateBaAdminPdf(db, created.baId, ctx);
  return {
    success: true,
    baId: created.baId,
    pages: set.pages,
    fileUrl: (regen && regen.fileUrl) || '',
    needsRegen: !(regen && regen.success),
    message: (regen && regen.success) ? 'Peserta & berkas disimpan.' : ((regen && regen.message) || 'Berkas tersimpan, PDF gagal dirakit.')
  };
}
