(function (root) {
  'use strict';

  function str(v) {
    if (v === undefined || v === null) return '';
    return String(v).replace(/\u00a0/g, ' ').trim();
  }

  function dosenKey(v) {
    return str(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function normBagian(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normKegiatan(v) {
    return normBagian(String(v || '').replace(/[\u2010-\u2015\u2212]/g, '-'));
  }

  function kegiatanKey(bagian, blok, label) {
    return [normBagian(bagian), normBagian(blok), normKegiatan(label)].join('|');
  }

  function lev(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur.push(Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        ));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function dosenOf(list) {
    const out = [];
    const seen = {};
    (Array.isArray(list) ? list : []).forEach(function (v) {
      const nama = str(v).replace(/\s+/g, ' ');
      const key = dosenKey(nama);
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.push({ key: key, nama: nama });
    });
    return out;
  }

  function buildDosenReport(input) {
    const opts = input || {};
    const baList = Array.isArray(opts.baList) ? opts.baList : [];
    const jadwalList = Array.isArray(opts.jadwalList) ? opts.jadwalList : [];
    const cols = Array.isArray(opts.cols) ? opts.cols : [];
    const q = normBagian(opts.q);
    const dosenMap = {};
    const quality = [];

    function register(nama) {
      const key = dosenKey(nama);
      if (!key) return null;
      if (!dosenMap[key]) {
        dosenMap[key] = {
          key: key,
          names: {},
          rows: {},
          baIds: {},
          totalRealisasi: 0,
          totalRencana: 0,
          baRows: [],
          jadwalRows: []
        };
      }
      dosenMap[key].names[str(nama).replace(/\s+/g, ' ')] = 1;
      return dosenMap[key];
    }

    const normBa = baList.map(function (b) {
      const bagian = str(b.bagian) || 'Lainnya';
      const blok = str(b.blok);
      const label = str(b.label);
      const key = str(b.kegiatanKey) || kegiatanKey(bagian, blok, label);
      const jadwalIds = (Array.isArray(b.jadwalIds) ? b.jadwalIds : []).map(str).filter(Boolean);
      const flags = [];
      (Array.isArray(b.flags) ? b.flags : []).forEach(function (f) {
        const s = str(f);
        if (s && flags.indexOf(s) === -1) flags.push(s);
      });
      const status = str(b.status) || 'Lengkap';
      if (status === 'Draft' && flags.indexOf('Draft') === -1) flags.push('Draft');
      if (!jadwalIds.length && flags.indexOf('Tanpa tautan sesi') === -1) flags.push('Tanpa tautan sesi');
      return {
        id: str(b.id),
        key: key,
        bagian: bagian,
        bagianKey: normBagian(bagian),
        blok: blok,
        jenis: str(b.jenis),
        label: label,
        tanggal: str(b.tanggal),
        jam: str(b.jam),
        sesiCount: Math.max(1, Number(b.sesiCount) || 0),
        status: status,
        flags: flags,
        peserta: Array.isArray(b.peserta) ? b.peserta : [],
        jadwalIds: jadwalIds,
        dosenList: dosenOf(b.dosenList),
        fileUrl: str(b.fileUrl)
      };
    });

    const baScope = {};
    const detailMeta = {};
    const jadwalKeys = {};
    jadwalList.forEach(function (j) {
      const key = str(j.kegiatanKey);
      if (key) jadwalKeys[key] = (jadwalKeys[key] || 0) + 1;
    });
    normBa.forEach(function (b) {
      baScope[b.key] = true;
      if (!detailMeta[b.key]) {
        detailMeta[b.key] = {
          key: b.key,
          bagian: b.bagian,
          bagianKey: b.bagianKey,
          blok: b.blok,
          jenis: b.jenis,
          label: b.label
        };
      }
      if (!jadwalKeys[b.key] && b.flags.indexOf('Tanpa jadwal') === -1) b.flags.push('Tanpa jadwal');
    });

    normBa.forEach(function (b) {
      const dosenText = b.dosenList.map(function (d) { return d.nama; }).join(', ');
      if (b.flags.indexOf('Tanpa tautan sesi') !== -1) {
        quality.push({ type: 'tanpa-sesi', baId: b.id, dosen: dosenText, label: b.label, message: 'BA tanpa tautan sesi; dihitung 1 sesi.' });
      }
      if (b.flags.indexOf('Tanpa jadwal') !== -1) {
        quality.push({ type: 'tanpa-jadwal', baId: b.id, dosen: dosenText, label: b.label, message: 'Belum ada jadwal aktif untuk detail kegiatan ini; rencana 0.' });
      }
      if (b.status === 'Draft') {
        quality.push({ type: 'draft', baId: b.id, dosen: dosenText, label: b.label, message: 'BA berstatus Draft; tetap dihitung sebagai realisasi.' });
      }
    });

    normBa.forEach(function (b) {
      b.dosenList.forEach(function (d) {
        const row = register(d.nama);
        if (!row.rows[b.key]) {
          row.rows[b.key] = { realisasi: 0, rencana: 0, baIds: {}, peserta: {}, statuses: {}, flags: {} };
        }
        const cell = row.rows[b.key];
        cell.realisasi += b.sesiCount;
        if (b.id) cell.baIds[b.id] = 1;
        b.peserta.forEach(function (p) {
          const npm = str(p && p.npm);
          if (npm) cell.peserta[npm] = 1;
        });
        cell.statuses[b.status] = 1;
        b.flags.forEach(function (f) { cell.flags[f] = 1; });
        row.totalRealisasi += b.sesiCount;
        if (b.id) row.baIds[b.id] = 1;
        row.baRows.push({
          baId: b.id,
          kegiatanKey: b.key,
          bagian: b.bagian,
          blok: b.blok,
          jenis: b.jenis,
          label: b.label,
          tanggal: b.tanggal,
          jam: b.jam,
          sesiCount: b.sesiCount,
          pesertaCount: b.peserta.length,
          status: b.status,
          flags: b.flags.slice(),
          fileUrl: b.fileUrl
        });
      });
    });

    let rencanaGlobal = 0;
    const globalIds = {};
    jadwalList.forEach(function (j) {
      const key = str(j.kegiatanKey);
      if (!baScope[key]) return;
      const id = str(j.id);
      if (id && !globalIds[id]) {
        globalIds[id] = 1;
        rencanaGlobal += 1;
      }
      const meta = detailMeta[key] || {};
      const bagian = str(j.bagian) || meta.bagian || 'Lainnya';
      const blok = str(j.blok) || meta.blok || '';
      const label = str(j.label) || meta.label || '';
      const jenis = str(j.jenis) || meta.jenis || '';
      dosenOf(j.dosenList).forEach(function (d) {
        const row = dosenMap[d.key];
        if (!row) return;
        if (!row.rows[key]) {
          row.rows[key] = { realisasi: 0, rencana: 0, baIds: {}, peserta: {}, statuses: {}, flags: {} };
        }
        row.rows[key].rencana += 1;
        row.totalRencana += 1;
        row.jadwalRows.push({
          id: id,
          kegiatanKey: key,
          bagian: bagian,
          blok: blok,
          jenis: jenis,
          label: label,
          tanggal: str(j.tanggal),
          jam: str(j.jam),
          baId: str(j.baId)
        });
      });
    });

    Object.keys(dosenMap).forEach(function (key) {
      const names = Object.keys(dosenMap[key].names).sort(function (a, b) {
        return (b.length - a.length) || a.localeCompare(b, 'id');
      });
      dosenMap[key].label = names[0] || key;
      dosenMap[key].variantCount = names.length;
      if (names.length > 1) {
        quality.push({
          type: 'varian',
          dosen: dosenMap[key].label,
          message: 'Nama dosen memiliki ' + names.length + ' penulisan; digabung berdasarkan huruf dan angka. Varian: ' + names.join(' | ')
        });
      }
    });

    const keys = Object.keys(dosenMap);
    keys.forEach(function (key) {
      const a = dosenKey(dosenMap[key].label);
      let best = null;
      keys.forEach(function (otherKey) {
        if (otherKey === key) return;
        const b = dosenKey(dosenMap[otherKey].label);
        if (a.length < 10 || b.length < 10) return;
        const dist = lev(a, b);
        if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { key: otherKey, dist: dist };
      });
      if (best) {
        dosenMap[key].nearDuplicate = dosenMap[best.key].label;
        quality.push({
          type: 'varian',
          dosen: dosenMap[key].label,
          related: dosenMap[best.key].label,
          message: 'Kemungkinan varian nama dari "' + dosenMap[best.key].label + '"; tidak digabung otomatis.'
        });
      }
    });

    const colKeys = cols.map(normBagian);
    const rows = keys.map(function (key) {
      const d = dosenMap[key];
      const counts = {};
      colKeys.forEach(function (ck) { counts[ck] = { realisasi: 0, rencana: 0 }; });
      const details = Object.keys(d.rows).map(function (detailKey) {
        const c = d.rows[detailKey];
        const meta = detailMeta[detailKey] || {
          bagian: 'Lainnya', bagianKey: normBagian('Lainnya'), blok: '', jenis: '', label: detailKey
        };
        if (counts[meta.bagianKey]) {
          counts[meta.bagianKey].realisasi += c.realisasi;
          counts[meta.bagianKey].rencana += c.rencana;
        }
        return {
          key: detailKey,
          bagian: meta.bagian,
          blok: meta.blok,
          jenis: meta.jenis,
          label: meta.label,
          realisasi: c.realisasi,
          rencana: c.rencana,
          selisih: c.realisasi - c.rencana,
          baIds: Object.keys(c.baIds),
          baCount: Object.keys(c.baIds).length,
          peserta: Object.keys(c.peserta),
          pesertaUnik: Object.keys(c.peserta).length,
          statuses: Object.keys(c.statuses),
          flags: Object.keys(c.flags)
        };
      });
      details.sort(function (a, b) {
        return a.bagian.localeCompare(b.bagian, 'id')
          || String(a.blok).localeCompare(String(b.blok), 'id')
          || a.label.localeCompare(b.label, 'id');
      });
      const peserta = {};
      details.forEach(function (x) {
        x.peserta.forEach(function (npm) { peserta[npm] = 1; });
      });
      d.baRows.sort(function (a, b) {
        return String(a.tanggal).localeCompare(String(b.tanggal))
          || String(a.baId).localeCompare(String(b.baId));
      });
      d.jadwalRows.sort(function (a, b) {
        return String(a.tanggal).localeCompare(String(b.tanggal))
          || String(a.jam).localeCompare(String(b.jam))
          || String(a.id).localeCompare(String(b.id));
      });
      return {
        key: key,
        label: d.label,
        variantCount: d.variantCount,
        nearDuplicate: d.nearDuplicate || '',
        counts: counts,
        details: details,
        baRows: d.baRows,
        jadwalRows: d.jadwalRows,
        totalRealisasi: d.totalRealisasi,
        totalRencana: d.totalRencana,
        selisih: d.totalRealisasi - d.totalRencana,
        detailCount: details.length,
        baCount: Object.keys(d.baIds).length,
        pesertaUnik: Object.keys(peserta).length
      };
    }).filter(function (r) {
      return !q || normBagian(r.label).indexOf(q) !== -1;
    });

    rows.sort(function (a, b) { return a.label.localeCompare(b.label, 'id'); });

    const visBa = {};
    const visDetail = {};
    const visPeserta = {};
    let baDosen = 0;
    rows.forEach(function (r) {
      r.details.forEach(function (x) {
        visDetail[x.key] = 1;
        x.peserta.forEach(function (npm) { visPeserta[npm] = 1; });
      });
      r.baRows.forEach(function (b) {
        if (b.baId) visBa[b.baId] = 1;
        baDosen += 1;
      });
    });

    return {
      cols: cols,
      rows: rows,
      totals: {
        dosen: rows.length,
        detailUnik: Object.keys(visDetail).length,
        baUnik: Object.keys(visBa).length,
        baDosen: baDosen,
        pesertaUnik: Object.keys(visPeserta).length,
        sesiRealisasi: rows.reduce(function (t, r) { return t + r.totalRealisasi; }, 0),
        rencanaTabel: rows.reduce(function (t, r) { return t + r.totalRencana; }, 0),
        rencanaGlobal: rencanaGlobal
      },
      quality: quality
    };
  }

  root.DosenReport = {
    buildDosenReport: buildDosenReport,
    dosenKey: dosenKey,
    kegiatanKey: kegiatanKey,
    normBagian: normBagian,
    normKegiatan: normKegiatan
  };
})(typeof window !== 'undefined' ? window : this);
