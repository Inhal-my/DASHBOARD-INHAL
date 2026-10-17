(function (root) {
  'use strict';

  function normText(v) {
    return String(v == null ? '' : v)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dateOnly(v) {
    var m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }

  function kegiatanName(g) {
    var pilihan = String((g && g.pilihan) || '').trim();
    var detail = String((g && g.detail) || '').trim();
    return pilihan + (detail ? ' - ' + detail : '');
  }

  function normalizeKey(v) {
    return normText(v).replace(/^blok\s+/, '').replace(/ /g, '');
  }

  function sameKegiatan(blokA, namaA, blokB, namaB) {
    return normalizeKey(blokA) === normalizeKey(blokB)
      && normalizeKey(namaA) === normalizeKey(namaB);
  }

  function latest(list, getDate) {
    return list.slice().sort(function (a, b) {
      return String(getDate(b) || '').localeCompare(String(getDate(a) || ''));
    })[0] || null;
  }

  function matchByDate(candidates, refDate, getDate) {
    var tgl = dateOnly(refDate);
    if (!tgl) return null;
    var exact = candidates.filter(function (item) { return dateOnly(getDate(item)) === tgl; });
    return exact.length ? latest(exact, getDate) : null;
  }

  function baForKegiatan(ref, baList) {
    var blok = ref && ref.blok;
    var nama = ref && ref.nama;
    var candidates = (baList || []).filter(function (b) {
      return sameKegiatan(blok, nama, b.Blok, b['Nama Kegiatan']);
    });
    if (!candidates.length) return null;
    return matchByDate(candidates, ref && ref.tanggal, function (b) { return b['Tanggal Pelaksanaan']; })
      || latest(candidates, function (b) { return b['Tanggal Pelaksanaan']; });
  }

  function jadwalForKegiatan(ref, jadwalList) {
    var blok = ref && ref.blok;
    var nama = ref && ref.nama;
    var candidates = (jadwalList || []).filter(function (j) {
      return sameKegiatan(blok, nama, j.Blok, j.NamaKegiatan);
    });
    if (!candidates.length) return null;
    return matchByDate(candidates, ref && ref.tanggal, function (j) { return j.Tanggal; })
      || latest(candidates, function (j) { return j.Tanggal; });
  }

  function baForJadwal(jadwal, baList) {
    if (!jadwal) return null;
    var id = String(jadwal.baId || '').trim();
    if (id) {
      var found = (baList || []).filter(function (b) {
        return String(b['BA ID'] || '').trim() === id;
      })[0];
      if (found) return found;
    }
    return baForKegiatan({ blok: jadwal.Blok, nama: jadwal.NamaKegiatan, tanggal: jadwal.Tanggal }, baList);
  }

  function statusOf(ba, jadwal) {
    if (ba) return ba.selesai ? 'selesai' : 'draft';
    return jadwal ? 'terjadwal' : 'acc';
  }

  function scheduledIdsFor(g, jadwalList) {
    var ids = {};
    (jadwalList || []).forEach(function (j) {
      if (!sameKegiatan(g.blok, kegiatanName(g), j.Blok, j.NamaKegiatan)) return;
      (j.peserta || []).forEach(function (p) { ids[String(p.idPengajuan)] = true; });
    });
    return ids;
  }

  function unscheduledPeserta(g, jadwalList) {
    var ids = scheduledIdsFor(g, jadwalList);
    return (g.peserta || []).filter(function (p) { return !ids[String(p.idPengajuan)]; });
  }

  function groupFullyScheduled(g, jadwalList) {
    var peserta = g.peserta || [];
    if (!peserta.length) return false;
    var ids = scheduledIdsFor(g, jadwalList);
    return peserta.every(function (p) { return !!ids[String(p.idPengajuan)]; });
  }

  function groupRows(rows, options, pendingOnly) {
    var opts = options || {};
    var statuses = opts.statuses || ['ACC'];
    var finalOnly = opts.finalOnly !== false;
    var map = {};
    (rows || []).forEach(function (r) {
      if (pendingOnly && r.baMember) return;
      var key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
      var g = map[key];
      if (!g) {
        g = map[key] = {
          key: key,
          jenis: r.jenis,
          pilihan: r.pilihan,
          detail: r.detail,
          tanggal: r.tanggal,
          blok: r.blok,
          label: kegiatanName(r),
          nama: kegiatanName(r),
          peserta: [],
          statusCounts: {},
          blocked: false
        };
      }
      g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
      if (statuses.indexOf(r.status) !== -1) {
        g.peserta.push({
          idPengajuan: r.idPengajuan,
          npm: r.npm,
          namaLengkap: r.namaLengkap,
          blok: r.blok,
          statusPengajuan: r.status,
          baMember: !!r.baMember
        });
      }
      if (finalOnly && r.status === 'Menunggu') g.blocked = true;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (g) { return !g.blocked && g.peserta.length > 0; })
      .map(function (g) { g.statusOrder = Object.keys(g.statusCounts); return g; });
  }

  function buildAllGroups(rows, options) {
    return groupRows(rows, options, false);
  }

  function buildKegiatanGroups(rows, options) {
    return groupRows(rows, options, true);
  }

  function buildJadwalItems(kegiatanGroups, jadwalList, baList) {
    var items = (jadwalList || []).map(function (j) {
      var ba = baForJadwal(j, baList);
      return {
        id: 'j:' + j.JadwalID,
        kind: 'jadwal',
        key: j.JadwalID,
        blok: j.Blok,
        nama: j.NamaKegiatan,
        tanggal: j.Tanggal,
        jadwal: j,
        ba: ba,
        status: statusOf(ba, j),
        peserta: j.peserta || [],
        dosen: j.Dosen || ''
      };
    });
    (kegiatanGroups || []).forEach(function (g) {
      if (groupFullyScheduled(g, jadwalList)) return;
      var peserta = unscheduledPeserta(g, jadwalList);
      if (!peserta.length) return;
      var ref = { blok: g.blok, nama: g.nama, tanggal: g.tanggal };
      var jadwal = jadwalForKegiatan(ref, jadwalList);
      var ba = baForKegiatan(ref, baList);
      items.push({
        id: 'g:' + g.key,
        kind: 'group',
        key: g.key,
        blok: g.blok,
        nama: g.nama,
        tanggal: g.tanggal,
        jadwal: jadwal,
        ba: ba,
        status: 'acc',
        peserta: peserta,
        group: g,
        dosen: ''
      });
    });
    return items;
  }

  function buildBaWorkItems(kegiatanGroups, draftBaList, jadwalList) {
    var items = [];
    (draftBaList || []).forEach(function (b) {
      var ref = { blok: b.Blok, nama: b['Nama Kegiatan'], tanggal: b['Tanggal Pelaksanaan'] };
      items.push({
        id: 'b:' + b['BA ID'],
        kind: 'ba',
        key: b['BA ID'],
        blok: b.Blok,
        nama: b['Nama Kegiatan'],
        tanggal: b['Tanggal Pelaksanaan'],
        ba: b,
        jadwal: jadwalForKegiatan(ref, jadwalList),
        status: 'draft',
        peserta: b.peserta || [],
        dosen: b.Dosen || ''
      });
    });
    (kegiatanGroups || []).forEach(function (g) {
      var ref = { blok: g.blok, nama: g.nama, tanggal: g.tanggal };
      var jadwal = jadwalForKegiatan(ref, jadwalList);
      items.push({
        id: 'g:' + g.key,
        kind: 'group',
        key: g.key,
        blok: g.blok,
        nama: g.nama,
        tanggal: g.tanggal,
        jadwal: jadwal,
        ba: baForKegiatan(ref, jadwalList),
        status: jadwal ? 'terjadwal' : 'acc',
        peserta: g.peserta,
        group: g,
        dosen: ''
      });
    });
    return items;
  }

  function sortByDate(items, direction) {
    var dir = direction === 'asc' ? 1 : -1;
    return items.slice().sort(function (a, b) {
      var ta = dateOnly(a.tanggal);
      var tb = dateOnly(b.tanggal);
      if (ta !== tb) return (ta < tb ? -1 : 1) * dir;
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
  }

  function buildRiwayatItems(baList) {
    var items = (baList || []).filter(function (b) { return !!b.selesai; }).map(function (b) {
      return {
        id: 'b:' + b['BA ID'],
        kind: 'ba',
        key: b['BA ID'],
        blok: b.Blok,
        nama: b['Nama Kegiatan'],
        tanggal: b['Tanggal Pelaksanaan'],
        ba: b,
        status: 'selesai',
        peserta: b.peserta || [],
        dosen: b.Dosen || ''
      };
    });
    return sortByDate(items, 'desc');
  }

  function buildStats(input) {
    var rows = input.rows || [];
    var groups = input.kegiatanGroups || [];
    var allGroups = input.allGroups || [];
    var baList = input.baList || [];
    var jadwalList = input.jadwalList || [];
    var selesai = baList.filter(function (b) { return !!b.selesai; });
    var done = allGroups.filter(function (g) {
      var ba = baForKegiatan({ blok: g.blok, nama: g.nama, tanggal: g.tanggal }, baList);
      return !!(ba && ba.selesai);
    });
    return {
      totalPeserta: rows.length,
      belumDijadwalkan: groups.filter(function (g) {
        return !groupFullyScheduled(g, jadwalList);
      }).length,
      draftBa: baList.filter(function (b) { return !b.selesai; }).length,
      baSelesai: selesai.length,
      persenSelesai: allGroups.length ? Math.round(done.length * 100 / allGroups.length) : 0
    };
  }

  function buildBlokProgress(allGroups, baList) {
    var map = {};
    (allGroups || []).forEach(function (g) {
      var blok = String(g.blok || '').trim() || '-';
      if (!map[blok]) map[blok] = { blok: blok, total: 0, done: 0, persen: 0 };
      map[blok].total += 1;
      var ba = baForKegiatan({ blok: g.blok, nama: g.nama, tanggal: g.tanggal }, baList);
      if (ba && ba.selesai) map[blok].done += 1;
    });
    return Object.keys(map).map(function (k) {
      var row = map[k];
      row.persen = row.total ? Math.round(row.done * 100 / row.total) : 0;
      return row;
    }).sort(function (a, b) { return a.blok.localeCompare(b.blok); });
  }

  function matchesQuery(item, query) {
    var q = normText(query);
    if (!q) return true;
    var parts = [item.nama, item.blok, item.dosen];
    if (item.jadwal) parts.push(item.jadwal.Dosen, item.jadwal.Catatan);
    if (item.ba) parts.push(item.ba.Dosen, item.ba.Label, item.ba.Catatan);
    (item.peserta || []).forEach(function (p) { parts.push(p.namaLengkap, p.npm); });
    ((item.ba && item.ba.peserta) || []).forEach(function (p) { parts.push(p.namaLengkap, p.npm); });
    return normText(parts.join(' ')).indexOf(q) !== -1;
  }

  root.BagianState = {
    normText: normText,
    dateOnly: dateOnly,
    kegiatanName: kegiatanName,
    sameKegiatan: sameKegiatan,
    baForKegiatan: baForKegiatan,
    jadwalForKegiatan: jadwalForKegiatan,
    baForJadwal: baForJadwal,
    statusOf: statusOf,
    unscheduledPeserta: unscheduledPeserta,
    groupFullyScheduled: groupFullyScheduled,
    buildAllGroups: buildAllGroups,
    buildKegiatanGroups: buildKegiatanGroups,
    buildJadwalItems: buildJadwalItems,
    buildBaWorkItems: buildBaWorkItems,
    buildRiwayatItems: buildRiwayatItems,
    buildStats: buildStats,
    buildBlokProgress: buildBlokProgress,
    sortByDate: sortByDate,
    matchesQuery: matchesQuery
  };
})(typeof window !== 'undefined' ? window : globalThis);
