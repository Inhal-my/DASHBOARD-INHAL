import { requireAdmin } from '../session.js';
import { kegiatanKey, getBagianBaStatuses, getMasterOptions, resolveBagian12 } from './common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function lowsp(v) {
  return str(v).toLowerCase().replace(/\s+/g, ' ').trim();
}

function dateOnly(v) {
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
}

function pesertaRow(r) {
  return {
    idPengajuan: str(r.id_pengajuan),
    npm: str(r.npm),
    namaLengkap: str(r.nama_lengkap),
    blok: str(r.blok),
    statusPengajuan: str(r.status_pengajuan)
  };
}

function groupRow(map, key, extra) {
  if (!key) return null;
  if (!map[key]) {
    map[key] = {
      key: key,
      bagian: str(extra.bagian),
      blok: str(extra.blok),
      namaKegiatan: str(extra.namaKegiatan),
      jadwalCount: 0,
      baCount: 0,
      archivedCount: 0,
      tanggalList: []
    };
  }
  const row = map[key];
  if (!row.bagian && extra.bagian) row.bagian = str(extra.bagian);
  if (!row.blok && extra.blok) row.blok = str(extra.blok);
  if (!row.namaKegiatan && extra.namaKegiatan) row.namaKegiatan = str(extra.namaKegiatan);
  return row;
}

function addTanggal(row, tanggal) {
  const t = dateOnly(tanggal);
  if (t && row.tanggalList.indexOf(t) === -1) row.tanggalList.push(t);
}

export async function getBaRepairData(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = payload || {};
  const filterBagian = lowsp(p.bagian);
  const filterBlok = lowsp(p.blok);
  const filterKey = str(p.key);
  const q = lowsp(p.q);
  const includeArchived = p.includeArchived === true;

  const jadwalRows = (await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE active = 1 ORDER BY tanggal, jam, jadwal_id').all()).results || [];
  const jadwalPesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
  const baRows = (await db.prepare('SELECT * FROM berita_acara ORDER BY tanggal_pelaksanaan, jam, ba_id').all()).results || [];
  const activeBaRows = baRows.filter((b) => !str(b.archived_at));
  const visibleBaRows = includeArchived ? baRows : activeBaRows;
  const activeBaIdSet = {};
  for (const b of activeBaRows) activeBaIdSet[str(b.ba_id)] = true;
  const baPesertaRows = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const baDosenRows = (await db.prepare('SELECT * FROM ba_dosen ORDER BY ba_id, urutan, id').all()).results || [];
  const baSesiRows = (await db.prepare('SELECT * FROM berita_acara_sesi').all()).results || [];
  const pengajuanRows = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const detailRows = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const labs = await getMasterOptions(db, 'Lab');
  const allowedStatuses = await getBagianBaStatuses(db);

  const jadwalByKey = {};
  const jadwalById = {};
  for (const j of jadwalRows) {
    const key = str(j.kegiatan_key) || kegiatanKey(j.bagian, j.blok, j.nama_kegiatan);
    if (!key) continue;
    const row = {
      jadwalId: str(j.jadwal_id),
      bagian: str(j.bagian),
      blok: str(j.blok),
      namaKegiatan: str(j.nama_kegiatan),
      tanggal: dateOnly(j.tanggal),
      jam: str(j.jam),
      dosen: str(j.dosen),
      catatan: str(j.catatan),
      peserta: [],
      baIds: []
    };
    if (!jadwalByKey[key]) jadwalByKey[key] = [];
    jadwalByKey[key].push(row);
    jadwalById[row.jadwalId] = row;
  }

  for (const r of jadwalPesertaRows) {
    const j = jadwalById[str(r.jadwal_id)];
    if (!j) continue;
    j.peserta.push(pesertaRow(r));
  }

  const baByKey = {};
  const baById = {};
  for (const b of visibleBaRows) {
    const key = str(b.kegiatan_key) || kegiatanKey(b.bagian, b.blok, b.nama_kegiatan);
    if (!key) continue;
    const row = {
      baId: str(b.ba_id),
      bagian: str(b.bagian),
      blok: str(b.blok),
      namaKegiatan: str(b.nama_kegiatan),
      label: str(b.label),
      tanggal: dateOnly(b.tanggal_pelaksanaan),
      jam: str(b.jam),
      dosen: str(b.dosen),
      jumlahPeserta: Number(b.jumlah_peserta) || 0,
      fileUrl: str(b.file_url),
      fileName: str(b.file_name),
      catatan: str(b.catatan),
      archivedAt: str(b.archived_at),
      archivedBy: str(b.archived_by),
      archiveReason: str(b.archive_reason),
      mergedInto: str(b.merged_into),
      updatedAt: str(b.updated_at),
      revision: Number(b.revision) || 0,
      archived: !!str(b.archived_at),
      dosenList: [],
      peserta: [],
      jadwalIds: []
    };
    if (!baByKey[key]) baByKey[key] = [];
    baByKey[key].push(row);
    baById[row.baId] = row;
  }

  for (const d of baDosenRows) {
    const b = baById[str(d.ba_id)];
    const nama = str(d.nama);
    if (b && nama && b.dosenList.indexOf(nama) === -1) b.dosenList.push(nama);
  }
  for (const key of Object.keys(baById)) {
    const b = baById[key];
    if (!b.dosenList.length && b.dosen) b.dosenList.push(b.dosen);
  }

  for (const r of baPesertaRows) {
    const b = baById[str(r.ba_id)];
    if (!b) continue;
    b.peserta.push(pesertaRow(r));
  }

  for (const r of baSesiRows) {
    const b = baById[str(r.ba_id)];
    const j = jadwalById[str(r.jadwal_id)];
    if (b && b.jadwalIds.indexOf(str(r.jadwal_id)) === -1) b.jadwalIds.push(str(r.jadwal_id));
    if (j && activeBaIdSet[str(r.ba_id)] && j.baIds.indexOf(str(r.ba_id)) === -1) j.baIds.push(str(r.ba_id));
  }
  for (const b of baRows) {
    const row = baById[str(b.ba_id)];
    if (!row) continue;
    const jid = str(b.jadwal_id);
    if (jid && row.jadwalIds.indexOf(jid) === -1) row.jadwalIds.push(jid);
    const j = jadwalById[jid];
    if (j && activeBaIdSet[row.baId] && j.baIds.indexOf(row.baId) === -1) j.baIds.push(row.baId);
  }

  const groups = {};
  for (const key of Object.keys(jadwalByKey)) {
    const list = jadwalByKey[key];
    const first = list[0];
    const row = groupRow(groups, key, first);
    if (!row) continue;
    row.jadwalCount += list.length;
    for (const j of list) addTanggal(row, j.tanggal);
  }
  for (const key of Object.keys(baByKey)) {
    const list = baByKey[key];
    const first = list[0];
    const row = groupRow(groups, key, first);
    if (!row) continue;
    row.baCount += list.filter((b) => !b.archivedAt).length;
    row.archivedCount += list.filter((b) => b.archivedAt).length;
    for (const b of list) addTanggal(row, b.tanggal);
  }

  const groupList = Object.keys(groups)
    .map((key) => groups[key])
    .filter((row) => {
      if (filterBagian && lowsp(row.bagian) !== filterBagian) return false;
      if (filterBlok && lowsp(row.blok) !== filterBlok) return false;
      if (q) {
        const hay = lowsp([row.bagian, row.blok, row.namaKegiatan].join(' '));
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    })
    .sort((a, b) => (lowsp(a.bagian) + '|' + lowsp(a.blok) + '|' + lowsp(a.namaKegiatan))
      .localeCompare(lowsp(b.bagian) + '|' + lowsp(b.blok) + '|' + lowsp(b.namaKegiatan)));

  const bagianOptions = [];
  const bagianSeen = {};
  for (const row of groupList) {
    const key = lowsp(row.bagian);
    if (!key || bagianSeen[key]) continue;
    bagianSeen[key] = true;
    bagianOptions.push(row.bagian);
  }

  let workspace = null;
  if (filterKey && groups[filterKey]) {
    const g = groups[filterKey];
    const jadwal = (jadwalByKey[filterKey] || []).slice();
    const ba = (baByKey[filterKey] || []).slice();
    const activeBa = ba.filter((b) => !b.archivedAt);
    const jadwalIdsByPid = {};
    for (const j of jadwal) {
      for (const x of j.peserta) {
        const pid = str(x.idPengajuan);
        if (!pid) continue;
        if (!jadwalIdsByPid[pid]) jadwalIdsByPid[pid] = [];
        if (jadwalIdsByPid[pid].indexOf(j.jadwalId) === -1) jadwalIdsByPid[pid].push(j.jadwalId);
      }
    }
    const baIdsByPid = {};
    for (const b of activeBa) {
      for (const x of b.peserta) {
        const pid = str(x.idPengajuan);
        if (!pid) continue;
        if (!baIdsByPid[pid]) baIdsByPid[pid] = [];
        if (baIdsByPid[pid].indexOf(b.baId) === -1) baIdsByPid[pid].push(b.baId);
      }
    }

    const detailMap = {};
    for (const d of detailRows) {
      const pid = str(d.id_pengajuan);
      if (!pid) continue;
      if (!detailMap[pid]) detailMap[pid] = [];
      detailMap[pid].push(d);
    }

    const kandidat = [];
    for (const pRow of pengajuanRows) {
      const pid = str(pRow.id_pengajuan);
      const status = str(pRow.status);
      if (!pid || allowedStatuses.indexOf(status) === -1) continue;
      const blok = str(pRow.blok).replace(/\s+/g, ' ').trim();
      if (lowsp(blok) !== lowsp(g.blok)) continue;
      let cocok = false;
      for (const d of detailMap[pid] || []) {
        const jenis = str(d.jenis_kegiatan).replace(/\s+/g, ' ').trim();
        const nama = str(d.pilihan) + (str(d.detail) ? ' - ' + str(d.detail) : '');
        const dBagian = lowsp(jenis) === 'praktikum'
          ? (resolveBagian12('Praktikum', str(d.pilihan), nama, labs) || 'Praktikum')
          : jenis;
        if (kegiatanKey(dBagian, blok, nama) === filterKey) { cocok = true; break; }
      }
      if (!cocok) continue;
      const sourceJadwal = [];
      for (const jid of jadwalIdsByPid[pid] || []) {
        const j = jadwalById[jid];
        if (!j) continue;
        sourceJadwal.push({ jadwalId: j.jadwalId, tanggal: j.tanggal, jam: j.jam, dosen: j.dosen });
      }
      kandidat.push({
        idPengajuan: pid,
        npm: str(pRow.npm),
        namaLengkap: str(pRow.nama_lengkap),
        blok: blok,
        status: status,
        tanggalPelaksanaan: str(pRow.tanggal_pelaksanaan),
        dosen: str(pRow.dosen),
        jadwalIds: sourceJadwal.map((x) => x.jadwalId),
        sourceJadwal: sourceJadwal,
        baIds: (baIdsByPid[pid] || []).slice()
      });
    }
    kandidat.sort((a, b) => (lowsp(a.namaLengkap) + '|' + a.npm).localeCompare(lowsp(b.namaLengkap) + '|' + b.npm));

    workspace = {
      key: filterKey,
      bagian: g.bagian,
      blok: g.blok,
      namaKegiatan: g.namaKegiatan,
      jadwal: jadwal,
      ba: ba,
      activeBa: activeBa,
      kandidat: kandidat
    };
  }

  return {
    ok: true,
    groups: groupList,
    bagianOptions: bagianOptions,
    statuses: allowedStatuses,
    workspace: workspace
  };
}
