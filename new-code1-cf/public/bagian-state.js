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

  function sessionsForKegiatan(ref, jadwalList) {
    var blok = ref && ref.blok;
    var nama = ref && ref.nama;
    return (jadwalList || []).filter(function (j) {
      return sameKegiatan(blok, nama, j.Blok, j.NamaKegiatan);
    }).sort(function (a, b) {
      var ka = dateOnly(a.Tanggal) + '|' + String(a.Jam || '');
      var kb = dateOnly(b.Tanggal) + '|' + String(b.Jam || '');
      return ka.localeCompare(kb);
    });
  }

  function pesertaKey(p) {
    return String((p && (p.idPengajuan || p.npm)) || '').trim();
  }

  function unionPeserta(sessions) {
    var seen = {};
    var out = [];
    (sessions || []).forEach(function (j) {
      (j.peserta || []).forEach(function (p) {
        var key = pesertaKey(p);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push({
          idPengajuan: String((p && p.idPengajuan) || '').trim(),
          npm: String((p && p.npm) || '').trim(),
          namaLengkap: String((p && p.namaLengkap) || '').trim(),
          blok: String((p && p.blok) || '').trim(),
          statusPengajuan: String((p && (p.statusPengajuan || p.status)) || '').trim()
        });
      });
    });
    return out;
  }

  // Toggle satu sesi jadwal pada form BA. Mengembalikan daftar sesi terpilih
  // beserta union peserta dan peta peserta terpilih.
  function applySessionToggle(jadwalIds, jadwalId, sessions) {
    var id = String(jadwalId || '').trim();
    var list = (jadwalIds || []).map(function (v) { return String(v || '').trim(); }).filter(Boolean);
    var idx = list.indexOf(id);
    if (id && idx === -1) list.push(id);
    else if (idx !== -1) list.splice(idx, 1);
    var picked = {};
    list.forEach(function (jid) { picked[jid] = true; });
    var chosen = (sessions || []).filter(function (j) { return picked[String(j.JadwalID)]; });
    var peserta = unionPeserta(chosen);
    var selected = {};
    peserta.forEach(function (p) { if (p.idPengajuan) selected[p.idPengajuan] = true; });
    return { jadwalIds: list, sessions: chosen, peserta: peserta, selected: selected };
  }

  function sesiSummary(sessions) {
    var list = sessions || [];
    var tanggal = list.map(function (j) { return dateOnly(j.Tanggal); }).filter(Boolean).sort();
    return {
      jumlahSesi: list.length,
      jumlahPeserta: unionPeserta(list).length,
      mulai: tanggal[0] || '',
      selesai: tanggal[tanggal.length - 1] || '',
      label: list.length ? list.length + ' sesi' : 'Tanpa sesi'
    };
  }

  // --- Sumber pilihan peserta "Dari BA Pendukung" (form BA Pelaksanaan) -----

  function normalizePeserta(p, sumber) {
    return {
      idPengajuan: String((p && p.idPengajuan) || '').trim(),
      npm: String((p && p.npm) || '').trim(),
      namaLengkap: String((p && p.namaLengkap) || '').trim(),
      blok: String((p && p.blok) || '').trim(),
      statusPengajuan: String((p && (p.statusPengajuan || p.status)) || '').trim(),
      baMember: !!(p && p.baMember),
      sumber: sumber || 'kegiatan'
    };
  }

  function baPendukungFor(ref, baPendukungList) {
    return baForKegiatan(ref, baPendukungList);
  }

  // Peserta satu BA Pendukung sebagai kandidat peserta BA Pelaksanaan.
  function pendukungPesertaList(baPendukung) {
    var ba = baPendukung || {};
    var baId = String(ba['BA ID'] || '').trim();
    var fileUrl = String(ba['File URL'] || '').trim();
    var fileName = String(ba['File Name'] || '').trim();
    var seen = {};
    var out = [];
    (ba.peserta || []).forEach(function (p) {
      var key = pesertaKey(p);
      if (!key || seen[key]) return;
      seen[key] = true;
      var item = normalizePeserta(p, 'pendukung');
      item.pendukungBaId = baId;
      item.pendukungFileUrl = fileUrl;
      item.pendukungFileName = fileName;
      out.push(item);
    });
    return out;
  }

  function statusDiterima(status, statuses) {
    if (!statuses || !statuses.length) return true;
    return statuses.indexOf(String(status || '').trim()) !== -1;
  }

  // Baris peserta (satu baris = satu pengajuan pada satu kegiatan) dipakai untuk
  // dua hal: memastikan peserta BA Pendukung memang berada di kegiatan BA
  // Pelaksanaan yang sedang dibuat (aturan yang sama dipakai server di
  // validateBaPesertaKegiatan, yang mencocokkan bagian|blok|nama kegiatan tanpa
  // tanggal) dan membaca status pengajuan terkini, karena server memvalidasi
  // status dari tabel pengajuan, bukan snapshot BA Pendukung.
  //
  // Pencocokan memakai blok + nama kegiatan (normalisasi yang sama dengan
  // `baForKegiatan`) supaya form BA dari jadwal - yang tidak membawa
  // jenis/pilihan/detail - tetap bisa mencocokkan baris peserta.
  function barisKegiatanCocok(ref, group, r) {
    if (!r) return false;
    var g = group;
    if (g && g.jenis !== undefined && normText(g.jenis) !== normText(r.jenis)) return false;
    return sameKegiatan(ref.blok, ref.nama, r.blok, kegiatanName(r));
  }

  // null berarti tanpa penyaringan: pemanggil tidak memberi `rows` atau tidak ada
  // baris yang cocok (nama kegiatan berbeda). Server tetap sumber kebenaran.
  function barisPesertaMap(rows, ref, group) {
    if (!rows || !rows.length) return null;
    var refKegiatan = {
      blok: (ref && ref.blok) || (group && group.blok),
      nama: (ref && ref.nama) || kegiatanName(group)
    };
    if (!refKegiatan.blok && !refKegiatan.nama) return null;
    var map = {};
    var cocok = false;
    rows.forEach(function (r) {
      if (!barisKegiatanCocok(refKegiatan, group, r)) return;
      cocok = true;
      var pid = String((r && r.idPengajuan) || '').trim();
      if (pid) map[pid] = String((r && r.status) || '').trim();
    });
    return cocok ? map : null;
  }

  // Kandidat peserta form BA Pelaksanaan: peserta kegiatan + peserta BA Pendukung
  // untuk kegiatan yang sama. `includePendukung` menyalakan sumber "Dari BA
  // Pendukung"; `statuses` menyaring status di luar ketentuan; `rows` + `group`
  // menyaring peserta yang kegiatannya bukan kegiatan BA ini (server tetap
  // memvalidasi saat simpan).
  function mergeBaCandidates(ref, groupPeserta, baPendukungList, options) {
    var opts = options || {};
    var ba = baPendukungFor(ref, baPendukungList);
    var semua = pendukungPesertaList(ba);
    var byKey = {};
    semua.forEach(function (p) { byKey[pesertaKey(p)] = p; });
    var seen = {};
    var base = [];
    (groupPeserta || []).forEach(function (p) {
      var key = pesertaKey(p);
      if (!key || seen[key]) return;
      seen[key] = true;
      var match = byKey[key];
      var item = normalizePeserta(p, 'kegiatan');
      item.punyaPendukung = !!match;
      item.pendukungBaId = match ? match.pendukungBaId : '';
      base.push(item);
    });
    var baris = barisPesertaMap(opts.rows, ref, opts.group);
    var tambahan = [];
    var ditolak = [];
    var tidakSesuai = [];
    semua.forEach(function (p) {
      var key = pesertaKey(p);
      if (!key || seen[key]) return;
      seen[key] = true;
      var pid = String(p.idPengajuan || '').trim();
      if (baris && !(pid && baris[pid] !== undefined)) { tidakSesuai.push(p); return; }
      var status = pid && baris && baris[pid] !== undefined ? baris[pid] : String(p.statusPengajuan || '').trim();
      if (statusDiterima(status, opts.statuses)) tambahan.push(p);
      else ditolak.push(p);
    });
    return {
      ba: ba || null,
      base: base,
      semua: semua,
      tambahan: tambahan,
      ditolak: ditolak,
      tidakSesuai: tidakSesuai,
      includePendukung: !!opts.includePendukung,
      peserta: opts.includePendukung ? base.concat(tambahan) : base,
      jumlahPendukung: semua.length,
      jumlahTambahan: tambahan.length,
      jumlahDitolak: ditolak.length,
      jumlahTidakSesuai: tidakSesuai.length
    };
  }

  // Menyalakan/mematikan sumber BA Pendukung pada peta pilihan peserta.
  // `tambahan` hanya berisi peserta yang belum ada di daftar kegiatan, sehingga
  // mematikan sumber tidak membuang peserta yang berasal dari kegiatan.
  function applyPendukungToggle(tambahan, selected, include) {
    var out = {};
    Object.keys(selected || {}).forEach(function (k) { if (selected[k]) out[k] = true; });
    (tambahan || []).forEach(function (p) {
      var key = String((p && p.idPengajuan) || '').trim();
      if (!key) return;
      if (include) out[key] = true;
      else delete out[key];
    });
    return { includePendukung: !!include, selected: out };
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

  function baSesiCount(b) {
    if (!b) return 0;
    var n = Number(b.jumlahSesi || 0);
    if (n) return n;
    return (b.sesi || []).length;
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
        dosen: b.Dosen || '',
        jumlahSesi: baSesiCount(b)
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

  /**
   * Daftar peserta kalender: urut blok lalu nama, entri tanpa nama dibuang.
   * Dipakai modal detail kalender untuk menampilkan nama peserta jadwal milik
   * bagian sendiri (data berasal dari `jadwalList` klien, bukan dari kalender).
   */
  function sortKalenderPeserta(list) {
    return (list || [])
      .filter(function (p) { return !!String((p && p.namaLengkap) || '').trim(); })
      .slice()
      .sort(function (a, b) {
        var ba = normText(a && a.blok);
        var bb = normText(b && b.blok);
        if (ba !== bb) return ba < bb ? -1 : 1;
        return String(a.namaLengkap).localeCompare(String(b.namaLengkap));
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
        dosen: b.Dosen || '',
        jumlahSesi: baSesiCount(b)
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

  var KALENDER_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function pad2(n) {
    return (Number(n) < 10 ? '0' : '') + Number(n);
  }

  function kalenderMonthLabel(year, month) {
    var mo = Number(month);
    if (!(mo >= 1 && mo <= 12)) return '-';
    return KALENDER_BULAN[mo - 1] + ' ' + Number(year);
  }

  function sortKalenderEntries(list) {
    return (list || []).slice().sort(function (a, b) {
      var da = dateOnly(a && a.Tanggal);
      var db = dateOnly(b && b.Tanggal);
      if (da !== db) return da < db ? -1 : 1;
      var ja = String((a && a.Jam) || '');
      var jb = String((b && b.Jam) || '');
      if (ja !== jb) return ja < jb ? -1 : 1;
      return String((a && a.Bagian) || '').localeCompare(String((b && b.Bagian) || ''));
    });
  }

  function kalenderMonthEntries(entries, year, month) {
    var prefix = Number(year) + '-' + pad2(month);
    var out = (entries || []).filter(function (e) {
      return dateOnly(e && e.Tanggal).slice(0, 7) === prefix;
    });
    return sortKalenderEntries(out);
  }

  function filterKalenderEntries(entries, opts) {
    var o = opts || {};
    var bagian = normText(o.bagian);
    var q = normText(o.query);
    return (entries || []).filter(function (e) {
      if (!e) return false;
      if (bagian && normText(e.Bagian) !== bagian) return false;
      if (!q) return true;
      var parts = [e.Bagian, e.Blok, 'blok ' + String(e.Blok || ''), e.NamaKegiatan, e.Dosen, e.Jam];
      return normText(parts.join(' ')).indexOf(q) !== -1;
    });
  }

  function kalenderBagianOptions(entries, options) {
    var o = options || {};
    var categories = o.categories || ['SGD', 'KKD', 'Ujian', 'Praktikum'];
    var labs = o.labs || [];
    var map = {};
    var order = [];
    (entries || []).forEach(function (e) {
      var label = String((e && e.Bagian) || '').trim();
      if (!label) return;
      var key = normText(label);
      if (!map[key]) {
        map[key] = { value: label, label: label, count: 0 };
        order.push(key);
      }
      map[key].count += 1;
    });
    function rank(label) {
      var key = normText(label);
      var i = categories.map(normText).indexOf(key);
      if (i !== -1) return i;
      var j = labs.map(normText).indexOf(key);
      if (j !== -1) return 100 + j;
      return 500;
    }
    return order.map(function (k) { return map[k]; }).sort(function (a, b) {
      var ra = rank(a.label);
      var rb = rank(b.label);
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  }

  function buildKalenderCells(entries, year, month, today) {
    var y = Number(year);
    var mo = Number(month);
    if (!y || !(mo >= 1 && mo <= 12)) return [];
    var offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // Senin = 0
    var daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    var total = Math.ceil((offset + daysInMonth) / 7) * 7;
    var byDate = {};
    (entries || []).forEach(function (e) {
      var key = dateOnly(e && e.Tanggal);
      if (!key) return;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(e);
    });
    var start = Date.UTC(y, mo - 1, 1 - offset);
    var todayKey = dateOnly(today);
    var cells = [];
    for (var i = 0; i < total; i++) {
      var d = new Date(start + i * 86400000);
      var iso = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
      var items = sortKalenderEntries(byDate[iso] || []);
      cells.push({
        date: iso,
        day: d.getUTCDate(),
        month: d.getUTCMonth() + 1,
        inMonth: (d.getUTCFullYear() === y) && ((d.getUTCMonth() + 1) === mo),
        isToday: !!todayKey && iso === todayKey,
        items: items,
        count: items.length
      });
    }
    return cells;
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
    sessionsForKegiatan: sessionsForKegiatan,
    unionPeserta: unionPeserta,
    applySessionToggle: applySessionToggle,
    baPendukungFor: baPendukungFor,
    pendukungPesertaList: pendukungPesertaList,
    mergeBaCandidates: mergeBaCandidates,
    applyPendukungToggle: applyPendukungToggle,
    sesiSummary: sesiSummary,
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
    sortKalenderPeserta: sortKalenderPeserta,
    matchesQuery: matchesQuery,
    kalenderMonthLabel: kalenderMonthLabel,
    sortKalenderEntries: sortKalenderEntries,
    kalenderMonthEntries: kalenderMonthEntries,
    filterKalenderEntries: filterKalenderEntries,
    kalenderBagianOptions: kalenderBagianOptions,
    buildKalenderCells: buildKalenderCells
  };
})(typeof window !== 'undefined' ? window : globalThis);
