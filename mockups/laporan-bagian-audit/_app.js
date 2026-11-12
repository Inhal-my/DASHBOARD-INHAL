(function () {
  'use strict';

  var NAMES = [
    'Aulia Rahma', 'Bagas Prakoso', 'Citra Dewi', 'Dimas Saputra', 'Eka Lestari',
    'Fahmi Idris', 'Gita Pramesti', 'Hanif Akbar', 'Indah Sari', 'Joko Wibowo',
    'Kartika Ayu', 'Lukman Hakim', 'Mega Putri', 'Naufal Rizki', 'Olivia Tan',
    'Putra Mahendra', 'Qori Amalia', 'Rizky Fadillah', 'Sinta Maharani', 'Tegar Pratama',
    'Umi Kalsum', 'Vina Oktavia', 'Wahyu Nugroho', 'Yasmin Zahra', 'Zaki Firmansyah'
  ];

  var DATA = [
    {
      id: 1, blok: 'Blok 1', bagian: 'SGD', jenis: 'SGD',
      nama: 'SGD - Refraksi', tanggalJadwal: '2026-10-06',
      peserta: { acc: 10, menunggu: 2, ditolak: 0 },
      baPen: { count: 1, tanggal: '2026-10-01' },
      baPel: [
        { id: 'BA-PEL/2026/10/0142', tanggal: '2026-10-06', sesi: 2, dosen: 'dr. Ratna W., dr. Budi S.', peserta: 6 },
        { id: 'BA-PEL/2026/10/0149', tanggal: '2026-10-13', sesi: 1, dosen: 'dr. Ratna W.', peserta: 4 }
      ]
    },
    {
      id: 2, blok: 'Blok 1', bagian: 'SGD', jenis: 'SGD',
      nama: 'SGD - Binokuler', tanggalJadwal: '2026-10-14',
      peserta: { acc: 8, menunggu: 0, ditolak: 0 },
      baPen: { count: 1, tanggal: '2026-10-08' },
      baPel: []
    },
    {
      id: 3, blok: 'Blok 1', bagian: 'KKD', jenis: 'KKD',
      nama: 'KKD - Tonometri', tanggalJadwal: '2026-10-20',
      peserta: { acc: 10, menunggu: 1, ditolak: 0 },
      baPen: null,
      baPel: [
        { id: 'BA-PEL/2026/10/0157', tanggal: '2026-10-20', sesi: 1, dosen: 'dr. Andi K.', peserta: 10 }
      ]
    },
    {
      id: 4, blok: 'Blok 1', bagian: 'Ujian', jenis: 'Ujian',
      nama: 'Ujian - OSCE Refraksi', tanggalJadwal: '2026-10-24',
      peserta: { acc: 24, menunggu: 0, ditolak: 1 },
      baPen: { count: 1, tanggal: '2026-10-18' },
      baPel: [
        { id: 'BA-PEL/2026/10/0163', tanggal: '2026-10-24', sesi: 1, dosen: 'dr. Maya L.', peserta: 24 }
      ]
    },
    {
      id: 5, blok: 'Blok 2', bagian: 'LAB 1', jenis: 'LAB 1',
      nama: 'LAB 1 - Slit Lamp', tanggalJadwal: '2026-11-22',
      peserta: { acc: 6, menunggu: 3, ditolak: 0 },
      baPen: { count: 1, tanggal: '2026-11-08' },
      baPel: []
    },
    {
      id: 6, blok: 'Blok 2', bagian: 'SGD', jenis: 'SGD',
      nama: 'SGD - Oftalmologi Dasar', tanggalJadwal: '2026-11-03',
      peserta: { acc: 0, menunggu: 0, ditolak: 0 },
      baPen: null,
      baPel: [
        { id: 'BA-PEL/2026/11/0211', tanggal: '2026-11-03', sesi: 1, dosen: 'dr. Nadia R.', peserta: 0 }
      ]
    },
    {
      id: 7, blok: 'Blok 2', bagian: 'LAB 2', jenis: 'LAB 2',
      nama: 'LAB 2 - Funduskopi', tanggalJadwal: '2026-11-05',
      peserta: { acc: 0, menunggu: 0, ditolak: 4 },
      baPen: null,
      baPel: []
    },
    {
      id: 8, blok: 'Blok 2', bagian: 'KKD', jenis: 'KKD',
      nama: 'KKD - Refraksi Subjektif', tanggalJadwal: '2026-11-09',
      peserta: { acc: 14, menunggu: 0, ditolak: 2 },
      baPen: { count: 2, tanggal: '2026-11-04' },
      baPel: [
        { id: 'BA-PEL/2026/11/0224', tanggal: '2026-11-09', sesi: 1, dosen: 'dr. Yusuf H.', peserta: 7 },
        { id: 'BA-PEL/2026/11/0231', tanggal: '2026-11-10', sesi: 1, dosen: 'dr. Intan M.', peserta: 5 }
      ]
    },
    {
      id: 9, blok: 'Blok 2', bagian: 'Ujian', jenis: 'Ujian',
      nama: 'Ujian - Remediasi Tonometri', tanggalJadwal: '2026-11-18',
      peserta: { acc: 5, menunggu: 4, ditolak: 0 },
      baPen: null,
      baPel: []
    },
    {
      id: 10, blok: 'Blok 3', bagian: 'KKD', jenis: 'KKD',
      nama: 'KKD - Retinoskopi', tanggalJadwal: '2026-10-28',
      peserta: { acc: 12, menunggu: 0, ditolak: 1 },
      baPen: { count: 1, tanggal: '2026-10-21' },
      baPel: [
        { id: 'BA-PEL/2026/10/0171', tanggal: '2026-10-28', sesi: 1, dosen: 'dr. Intan M.', peserta: 6 },
        { id: 'BA-PEL/2026/10/0178', tanggal: '2026-10-29', sesi: 1, dosen: 'dr. Yusuf H.', peserta: 6 }
      ]
    },
    {
      id: 11, blok: 'Blok 3', bagian: 'LAB 1', jenis: 'LAB 1',
      nama: 'LAB 1 - Oftalmoskopi', tanggalJadwal: '2026-11-12',
      peserta: { acc: 9, menunggu: 1, ditolak: 0 },
      baPen: { count: 1, tanggal: '2026-11-06' },
      baPel: []
    },
    {
      id: 12, blok: 'Blok 2', bagian: 'Ujian', jenis: 'Ujian',
      nama: 'Ujian - OSCP Dasar', tanggalJadwal: '2026-11-25',
      peserta: { acc: 0, menunggu: 0, ditolak: 0 },
      baPen: null,
      baPel: []
    }
  ];

  var state = { bagian: '', sel: null, expanded: {}, group: 'blok' };

  function fmtDate(iso) {
    if (!iso) return '&mdash;';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function num(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function totalPeserta(r) { return r.peserta.acc + r.peserta.menunggu + r.peserta.ditolak; }
  function adaAcc(r) { return r.peserta.acc > 0; }
  function tanpaAcc(r) { return !adaAcc(r); }
  function baPelCount(r) { return r.baPel ? r.baPel.length : 0; }
  function belumBaPel(r) { return baPelCount(r) === 0; }
  function units(r) { return baPelCount(r); }
  function baPelPeserta(r) {
    return (r.baPel || []).reduce(function (a, b) { return a + (b.peserta || 0); }, 0);
  }
  function dosenAll(r) {
    var out = [];
    (r.baPel || []).forEach(function (b) {
      String(b.dosen || '').split(',').forEach(function (d) {
        var v = d.trim();
        if (v && out.indexOf(v) === -1) out.push(v);
      });
    });
    return out;
  }
  function tanggalTerakhir(r) {
    if (r.baPel && r.baPel.length) {
      return r.baPel.map(function (b) { return b.tanggal; }).sort().slice(-1)[0];
    }
    return r.tanggalJadwal;
  }

  function pesertaList(r) {
    if (r._list) return r._list;
    var out = [];
    function push(status, n) {
      for (var k = 0; k < n; k++) {
        var i = out.length;
        out.push({
          npm: '23' + String(110000 + r.id * 37 + i * 3),
          nama: NAMES[(r.id * 7 + i * 3) % NAMES.length],
          status: status,
          ba: false
        });
      }
    }
    push('ACC', r.peserta.acc);
    push('Menunggu', r.peserta.menunggu);
    push('Ditolak', r.peserta.ditolak);

    var marked = 0;
    var target = Math.min(baPelPeserta(r) || 0, r.peserta.acc);
    for (var j = 0; j < out.length && marked < target; j++) {
      if (out[j].status === 'ACC') { out[j].ba = true; marked++; }
    }

    r._list = out;
    return out;
  }

  function bagianRank(b) {
    var seq = ['Ujian', 'SGD', 'KKD', 'LAB 1', 'LAB 2', 'LAB 3', 'LAB 4', 'LAB 5', 'LAB 6', 'LAB 7', 'LAB 8', 'LAB 9'];
    var i = seq.indexOf(b);
    if (i !== -1) return i;
    if (/^LAB \d+$/.test(b)) return 50 + Number(b.replace(/\D+/g, ''));
    return b === 'Lainnya' ? 900 : 800;
  }
  function cmp(a, b) {
    if (/^Blok \d+$/.test(a) && /^Blok \d+$/.test(b)) {
      return Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, ''));
    }
    var ra = bagianRank(a), rb = bagianRank(b);
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), 'id', { numeric: true });
  }
  function unique(list) {
    var out = [];
    list.forEach(function (v) { if (out.indexOf(v) === -1) out.push(v); });
    return out;
  }

  function scopeRows() {
    return DATA.filter(function (r) { return !state.bagian || r.bagian === state.bagian; });
  }

  function allBagian() {
    return unique(DATA.map(function (r) { return r.bagian; })).sort(cmp);
  }

  function matrixModel() {
    var rows = scopeRows();
    var bagian = state.bagian ? [state.bagian] : allBagian();
    var blok = unique(DATA.map(function (r) { return r.blok; })).sort(cmp);
    var cells = {};
    rows.forEach(function (r) {
      var k = r.blok + '::' + r.bagian;
      if (!cells[k]) cells[k] = [];
      cells[k].push(r);
    });
    var body = blok.map(function (b) {
      var counts = {}, keg = {};
      bagian.forEach(function (k) {
        var list = cells[b + '::' + k] || [];
        counts[k] = list.reduce(function (a, r) { return a + units(r); }, 0);
        keg[k] = list.length;
      });
      var total = bagian.reduce(function (a, k) { return a + counts[k]; }, 0);
      return { blok: b, counts: counts, keg: keg, total: total };
    });
    var colTotals = {};
    bagian.forEach(function (k) {
      colTotals[k] = body.reduce(function (a, row) { return a + row.counts[k]; }, 0);
    });
    var grand = body.reduce(function (a, row) { return a + row.total; }, 0);
    return {
      bagian: bagian, blok: blok, body: body, cells: cells,
      colTotals: colTotals, grand: grand,
      totalKegiatan: rows.length,
      totalBaPel: rows.reduce(function (a, r) { return a + baPelCount(r); }, 0),
      totalBaPen: rows.reduce(function (a, r) { return a + (r.baPen ? r.baPen.count : 0); }, 0),
      totalTanpaAcc: rows.filter(tanpaAcc).length,
      totalBelumBaPel: rows.filter(belumBaPel).length
    };
  }

  function detailGroups() {
    var rows = scopeRows().filter(function (r) {
      return !state.sel || (r.blok === state.sel.blok && r.bagian === state.sel.bagian);
    });
    var outer = state.group === 'bagian' ? 'bagian' : 'blok';
    var inner = state.group === 'bagian' ? 'blok' : 'bagian';
    var map = {};
    var order = [];
    rows.forEach(function (r) {
      var key = r[outer] + '::' + r[inner];
      if (!map[key]) {
        map[key] = { key: key, outer: r[outer], inner: r[inner], rows: [] };
        order.push(key);
      }
      map[key].rows.push(r);
    });
    order.sort(function (a, b) {
      var g1 = map[a], g2 = map[b];
      return cmp(g1.outer, g2.outer) || cmp(g1.inner, g2.inner);
    });
    return order.map(function (k) {
      var g = map[k];
      g.rows.sort(function (a, b) { return String(tanggalTerakhir(a)).localeCompare(String(tanggalTerakhir(b))); });
      g.units = g.rows.reduce(function (a, r) { return a + units(r); }, 0);
      return g;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ico(id, cls) {
    return '<svg class="i ' + (cls || '') + '"><use href="icons.svg#' + id + '"></use></svg>';
  }
  function pillStatus(s) {
    var cls = s === 'ACC' ? 'p-acc' : (s === 'Menunggu' ? 'p-wait' : (s === 'Ditolak' ? 'p-rej' : 'p-manual'));
    return '<span class="pill ' + cls + '">' + esc(s) + '</span>';
  }

  function renderStats(m) {
    var maxCell = 0, maxLabel = '&mdash;';
    m.bagian.forEach(function (k) {
      m.body.forEach(function (row) {
        if (row.counts[k] > maxCell) {
          maxCell = row.counts[k];
          maxLabel = row.blok + ' &middot; ' + k;
        }
      });
    });

    document.getElementById('stats').innerHTML =
      '<div class="kpi">' +
        '<div class="lb">Kegiatan</div>' +
        '<div class="big">' + num(m.totalKegiatan) + '</div>' +
        '<div class="sub"><b>' + m.totalTanpaAcc + '</b> tanpa peserta ACC &middot; tetap didaftar</div>' +
        '<div class="ic">' + ico('calendar') + '</div>' +
      '</div>' +
      '<div class="kpi">' +
        '<div class="lb">BA PEL</div>' +
        '<div class="big">' + num(m.totalBaPel) + '</div>' +
        '<div class="sub">dokumen &middot; 1 BA PEL = 1 hitungan</div>' +
        '<div class="ic g">' + ico('file') + '</div>' +
      '</div>' +
      '<div class="kpi">' +
        '<div class="lb">BA PEN</div>' +
        '<div class="big">' + num(m.totalBaPen) + '</div>' +
        '<div class="sub">berkas pendukung</div>' +
        '<div class="ic v">' + ico('book') + '</div>' +
      '</div>' +
      '<div class="kpi">' +
        '<div class="lb">Total hitungan</div>' +
        '<div class="big">' + num(m.grand) + '</div>' +
        '<div class="sub">' + (m.totalBelumBaPel
          ? '<b>' + m.totalBelumBaPel + '</b> kegiatan belum ada BA PEL (tidak dihitung)'
          : 'semua kegiatan sudah ada BA PEL') + '</div>' +
        '<div class="ic r">' + ico('target') + '</div>' +
      '</div>';
  }

  function renderMatrix(m) {
    var html = '';
    var sel = state.sel;

    html += '<div class="mtx-scroll"><table class="mtx">';
    html += '<thead><tr><th class="corner">Blok \\ Bagian</th>';
    m.bagian.forEach(function (b) {
      var isCol = sel && sel.bagian === b;
      html += '<th class="mid' + (isCol ? ' hl' : '') + '">' + esc(b) + '</th>';
    });
    html += '<th class="tot">Total</th></tr></thead><tbody>';

    m.body.forEach(function (row) {
      var isRow = sel && sel.blok === row.blok;
      html += '<tr' + (isRow ? ' class="hl"' : '') + '><td class="rh">' + esc(row.blok) + '</td>';
      m.bagian.forEach(function (b) {
        var c = row.counts[b];
        var hasKeg = row.keg[b] > 0;
        var on = sel && sel.blok === row.blok && sel.bagian === b;
        var cls = 'cell' + (c >= 2 ? ' c2' : (c === 1 ? ' c1' : ' c0')) + (on ? ' on' : '') + (hasKeg ? ' haskeg' : '');
        html += '<td class="mc"><button class="' + cls + '" data-blok="' + esc(row.blok) + '" data-bagian="' + esc(b) + '"' +
          (hasKeg ? '' : ' disabled') + ' aria-label="' + esc(row.blok + ' ' + b + ': ' + c + ' BA PEL, ' + row.keg[b] + ' kegiatan') + '">' +
          c + '</button></td>';
      });
      html += '<td class="rt">' + row.total + '</td></tr>';
    });

    html += '<tr class="mtx-total"><td class="rh">Total</td>';
    m.bagian.forEach(function (b) {
      html += '<td class="ct">' + m.colTotals[b] + '</td>';
    });
    html += '<td class="ct grand">' + m.grand + '</td></tr></tbody></table></div>';

    html += '<div class="mtx-foot">' +
      '<div class="mtx-legend">' +
        '<span><i class="dot" style="background:#ecfdf5;border:1px solid #a7f3d0"></i>2 BA PEL atau lebih</span>' +
        '<span><i class="dot" style="background:#fffbeb;border:1px solid #fde68a"></i>1 BA PEL</span>' +
        '<span><i class="dot" style="background:#fff;border:1px solid var(--slate-200)"></i>0 BA PEL, tanpa kegiatan</span>' +
        '<span><i class="dot" style="background:#fff1f2;border:1px solid #fecdd3"></i>0 BA PEL, ada kegiatan</span>' +
      '</div>' +
      '<div class="mtx-active">' +
        (sel
          ? '<span class="actchip">' + esc(sel.blok) + ' &middot; ' + esc(sel.bagian) + '</span>' +
            '<button class="lnk" id="cellclear">Tampilkan semua</button>'
          : '<span class="mtx-hint">Klik angka untuk menyaring detail kegiatan di bawah</span>') +
      '</div>' +
    '</div>';

    document.getElementById('matrix').innerHTML = html;
  }

  function pesertaCell(r) {
    if (totalPeserta(r) === 0) {
      return '<span class="cellsub">tanpa pendaftar</span><span class="badge b-slate">Tanpa ACC</span>';
    }
    var line = '<b>' + r.peserta.acc + '</b><span class="muted">/' + totalPeserta(r) + '</span>' +
      '<div class="cellsub">' + r.peserta.menunggu + ' menunggu &middot; ' + r.peserta.ditolak + ' ditolak</div>';
    if (tanpaAcc(r)) line += '<span class="badge b-amber">Tanpa ACC</span>';
    return line;
  }

  function baCell(r) {
    if (belumBaPel(r)) {
      return '<span class="badge b-amber">Belum ada BA PEL</span><div class="cellsub">tidak dihitung</div>';
    }
    var kurang = baPelPeserta(r) < r.peserta.acc;
    return '<span class="badge b-violet">' + baPelCount(r) + ' BA PEL</span>' +
      '<div class="cellsub">BA PEN: ' + (r.baPen ? r.baPen.count + ' berkas' : 'belum ada') + '</div>' +
      (kurang ? '<div class="cellsub late">' + baPelPeserta(r) + ' peserta, kurang dari ' + r.peserta.acc + ' ACC</div>' : '');
  }

  function detailRow(r, open) {
    var tgl = tanggalTerakhir(r);
    var dosen = dosenAll(r);
    var html = '<tr class="drow-main" data-id="' + r.id + '">' +
      '<td class="chev">' + ico(open ? 'chev-down' : 'chev-right', 'xs') + '</td>' +
      '<td class="nowrap"><span class="dim">' + esc(r.bagian) + '</span></td>' +
      '<td class="nowrap"><span class="dim">' + esc(r.blok) + '</span></td>' +
      '<td><div class="kegname">' + esc(r.nama) + '</div>' +
        '<div class="cellsub">' + esc(r.jenis) + ' &middot; ' + (dosen.length ? esc(dosen.join(', ')) : 'dosen belum ada di BA PEL') + '</div></td>' +
      '<td class="nowrap">' + fmtDate(tgl) + '<div class="cellsub">' + (baPelCount(r) ? 'tanggal BA PEL' : 'jadwal (rencana)') + '</div></td>' +
      '<td class="c">' + pesertaCell(r) + '</td>' +
      '<td class="nowrap">' + baCell(r) + '</td>' +
      '<td class="c"><span class="hit' + (units(r) ? '' : ' zero') + '">' + units(r) + '&times;</span></td>' +
      '</tr>';

    if (!open) return html;

    var list = pesertaList(r);
    var body;
    if (list.length) {
      body = '<table class="ptab"><thead><tr>' +
        '<th>NPM</th><th>Nama</th><th>Status</th><th class="c">Di BA PEL</th>' +
        '</tr></thead><tbody>' + list.map(function (p) {
          return '<tr><td class="mono">' + esc(p.npm) + '</td>' +
            '<td><b>' + esc(p.nama) + '</b></td>' +
            '<td>' + pillStatus(p.status) + '</td>' +
            '<td class="c">' + (p.ba ? '<span class="flag ok">&#10003;</span>' : '<span class="flag no">&ndash;</span>') + '</td></tr>';
        }).join('') + '</tbody></table>';
    } else {
      body = '<div class="dempty">Tidak ada pendaftar pada kegiatan ini.</div>';
    }

    var pelRows = (r.baPel || []).map(function (b) {
      return '<tr><td class="mono">' + esc(b.id) + '</td>' +
        '<td>' + fmtDate(b.tanggal) + '</td>' +
        '<td>' + b.sesi + ' sesi</td>' +
        '<td>' + esc(b.dosen) + '</td>' +
        '<td class="c">' + b.peserta + ' peserta</td></tr>';
    }).join('');

    return html + '<tr class="drow-detail"><td colspan="8"><div class="dwrap">' +
      '<div><div class="dtitle">Peserta (' + list.length + ')</div>' + body + '</div>' +
      '<div class="dside">' +
        '<div class="dside-title">Hitungan BA PEL</div>' +
        (baPelCount(r)
          ? '<table class="btab"><thead><tr><th>BA PEL</th><th>Tanggal</th><th>Sesi</th><th>Dosen</th><th class="c">Peserta</th></tr></thead>' +
            '<tbody>' + pelRows + '</tbody></table>'
          : '<div class="dempty">Belum ada BA PEL. Kegiatan ini <b>tidak dihitung</b> pada matriks, tetapi tetap didaftar di sini.</div>') +
        '<div class="ditem"><span class="nm">Kegiatan ini dihitung</span><span class="vl ' + (units(r) ? 'ok' : 'no') + '">' + units(r) + '&times;</span></div>' +
        '<div class="ditem"><span class="nm">BA PEN</span><span class="vl ' + (r.baPen ? 'ok' : 'no') + '">' +
          (r.baPen ? r.baPen.count + ' berkas' : 'belum ada') + '</span></div>' +
      '</div>' +
    '</div></td></tr>';
  }

  function renderDetail() {
    var groups = detailGroups();
    var html = '';

    groups.forEach(function (g) {
      html += '<tr class="det-grp"><td colspan="8"><div class="gl">' +
        '<span class="gbadge">' + esc(g.outer) + '</span>' +
        '<span class="gname">' + esc(g.inner) + '</span>' +
        '<span class="gcount"><b>' + g.rows.length + '</b> kegiatan</span>' +
        '<span class="gmeta"><span><b>' + g.units + '</b> hitungan</span></span>' +
        '</div></td></tr>';
      g.rows.forEach(function (r) { html += detailRow(r, !!state.expanded[r.id]); });
    });

    if (!groups.length) {
      html = '<tr><td colspan="8"><div class="dempty" style="margin:16px">Tidak ada kegiatan pada kombinasi ini.</div></td></tr>';
    }

    document.getElementById('detailbody').innerHTML = html;

    var nKeg = groups.reduce(function (a, g) { return a + g.rows.length; }, 0);
    var nUnit = groups.reduce(function (a, g) { return a + g.units; }, 0);
    document.getElementById('detailinfo').innerHTML =
      'Menampilkan <b>' + nKeg + '</b> kegiatan dengan <b>' + nUnit + '</b> hitungan' +
      (state.bagian ? ' &middot; bagian <b>' + esc(state.bagian) + '</b>' : '') +
      (state.sel ? ' &middot; disaring ke <b>' + esc(state.sel.blok) + ' &middot; ' + esc(state.sel.bagian) + '</b>' : '') +
      ' &middot; 1 halaman (mockup)';
  }

  function renderFootnote(m) {
    var tanpaPendaftar = scopeRows().filter(function (r) { return totalPeserta(r) === 0; }).length;
    document.getElementById('footnote').innerHTML =
      'Matriks menghitung <b>' + m.grand + '</b> BA PEL dari ' + m.totalKegiatan + ' kegiatan pada ' +
      m.blok.length + ' blok &times; ' + m.bagian.length + ' bagian &middot; ' +
      (m.totalBelumBaPel
        ? '<b>' + m.totalBelumBaPel + '</b> kegiatan belum ada BA PEL tidak dihitung tetapi tetap didaftar'
        : 'semua kegiatan sudah ada BA PEL') + ' &middot; ' +
      m.totalTanpaAcc + ' kegiatan tanpa peserta ACC tetap ditampilkan (' + tanpaPendaftar + ' tanpa pendaftar) &middot; data dummy';
  }

  function render() {
    document.getElementById('fgroup').value = state.group;
    document.getElementById('fbagian').value = state.bagian;
    var m = matrixModel();
    renderStats(m);
    renderMatrix(m);
    renderDetail();
    renderFootnote(m);
  }

  function init() {
    document.getElementById('fbagian').innerHTML =
      '<option value="">Semua bagian</option>' +
      allBagian().map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');

    document.getElementById('fbagian').addEventListener('change', function (e) {
      state.bagian = e.target.value;
      state.sel = null;
      render();
    });

    document.getElementById('freset').addEventListener('click', function () {
      state.bagian = ''; state.sel = null; state.expanded = {}; state.group = 'blok';
      render();
    });

    document.getElementById('matrix').addEventListener('click', function (e) {
      if (e.target.closest('#cellclear')) { state.sel = null; render(); return; }
      var cell = e.target.closest('button.cell');
      if (!cell || cell.disabled) return;
      var blok = cell.getAttribute('data-blok');
      var bagian = cell.getAttribute('data-bagian');
      if (state.sel && state.sel.blok === blok && state.sel.bagian === bagian) {
        state.sel = null;
      } else {
        state.sel = { blok: blok, bagian: bagian };
      }
      render();
      var card = document.getElementById('detail');
      if (state.sel && card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('fgroup').addEventListener('change', function (e) {
      state.group = e.target.value;
      render();
    });

    document.getElementById('detailbody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr.drow-main');
      if (!tr) return;
      var id = tr.getAttribute('data-id');
      state.expanded[id] = !state.expanded[id];
      render();
    });

    render();
  }

  init();
})();
