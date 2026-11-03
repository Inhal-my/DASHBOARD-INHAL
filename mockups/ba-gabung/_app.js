(function () {
  var D = window.BA_DATA;

  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function fmtTanggal(iso) {
    if (!iso) return '-';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length < 3) return iso;
    return (+p[2]) + ' ' + BULAN[(+p[1]) - 1] + ' ' + p[0];
  }
  function fmtTanggalPanjang(iso) {
    if (!iso) return '-';
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return HARI[d.getDay()] + ', ' + fmtTanggal(iso);
  }
  function rupiah(n) {
    return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  }
  function pct(a, b) {
    if (!b) return 0;
    return Math.round((a / b) * 100);
  }

  function units() { return D.units || []; }

  function unitStats(u) {
    var peserta = u.peserta || [];
    var final = peserta.filter(function (p) { return p.final; }).length;
    var pendukung = u.pendukung || [];
    var pelaksanaan = u.pelaksanaan || [];
    var sesi = pelaksanaan.reduce(function (t, b) { return t + (b.jumlahSesi || 1); }, 0);
    var temuan = 0;
    pelaksanaan.forEach(function (b) { temuan += (b.flags || []).length; });
    pendukung.forEach(function (b) { if (!b.file || b.status !== 'Lengkap') temuan += 1; });
    var lengkapPendukung = pendukung.length > 0 && pendukung.every(function (b) { return b.file && b.status === 'Lengkap'; });
    var lengkapPelaksanaan = pelaksanaan.length > 0 && pelaksanaan.every(function (b) { return b.file && b.status === 'Lengkap'; });
    return {
      peserta: peserta.length, final: final,
      pendukung: pendukung.length, pelaksanaan: pelaksanaan.length,
      sesi: sesi, temuan: temuan,
      lengkapPendukung: lengkapPendukung, lengkapPelaksanaan: lengkapPelaksanaan,
      status: (lengkapPendukung && lengkapPelaksanaan) ? 'Lengkap'
        : (!pendukung.length && !pelaksanaan.length) ? 'Belum mulai'
        : 'Perlu tindakan'
    };
  }

  function baRows() {
    var out = [];
    units().forEach(function (u) {
      (u.pendukung || []).forEach(function (b) {
        out.push({
          jenis: 'Pendukung', sumber: 'Admin', id: b.id, unit: u,
          bagian: u.bagian, blok: u.blok, kegiatan: u.kegiatan,
          tanggal: b.tanggal, jam: '', dosen: '-',
          pesertaCount: u.peserta.length, file: !!b.file,
          status: b.status, flags: b.file && b.status === 'Lengkap' ? [] : ['Berkas belum lengkap'],
          catatan: b.catatan || '', sesiKe: 0, jumlahSesi: 0
        });
      });
      (u.pelaksanaan || []).forEach(function (b) {
        out.push({
          jenis: 'Pelaksanaan', sumber: 'Bagian', id: b.id, unit: u,
          bagian: u.bagian, blok: u.blok, kegiatan: u.kegiatan,
          tanggal: b.tanggal, jam: b.jam || '', dosen: b.dosen || '-',
          pesertaCount: b.pesertaCount || 0, file: !!b.file,
          status: b.status, flags: b.flags || [],
          catatan: b.catatan || '', sesiKe: b.sesiKe || 0, jumlahSesi: b.jumlahSesi || 0
        });
      });
    });
    return out.sort(function (a, b) {
      return String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.id).localeCompare(String(b.id));
    });
  }

  function totals() {
    var t = { kegiatan: units().length, peserta: 0, final: 0, pendukung: 0, pelaksanaan: 0, sesi: 0, temuan: 0, lengkap: 0, perlu: 0, belum: 0 };
    var seen = {};
    units().forEach(function (u) {
      (u.peserta || []).forEach(function (p) {
        if (!seen[p.npm]) { seen[p.npm] = true; t.peserta += 1; }
        if (p.final) t.final += 1;
      });
      var s = unitStats(u);
      t.pendukung += s.pendukung;
      t.pelaksanaan += s.pelaksanaan;
      t.sesi += s.sesi;
      t.temuan += s.temuan;
      if (s.status === 'Lengkap') t.lengkap += 1;
      else if (s.status === 'Perlu tindakan') t.perlu += 1;
      else t.belum += 1;
    });
    return t;
  }

  function actionsFor(u) {
    var s = unitStats(u);
    var list = [];
    if (!s.pendukung) list.push({ key: 'pendukung', label: 'Unggah BA Pendukung', tone: 'rose' });
    else if (!s.lengkapPendukung) list.push({ key: 'pendukung', label: 'Lengkapi BA Pendukung', tone: 'amber' });
    if (u.pelaksanaan.length && !s.lengkapPelaksanaan) list.push({ key: 'pelaksanaan', label: 'Lengkapi BA Pelaksanaan', tone: 'amber' });
    if (!u.pelaksanaan.length && s.pendukung) list.push({ key: 'pelaksanaan', label: 'Tambah BA Pelaksanaan', tone: 'rose' });
    return list;
  }

  function flagsOf(b) { return b.flags || []; }

  function toast(msg) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-demo]');
      if (el) {
        e.preventDefault();
        toast(el.getAttribute('data-demo'));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindGlobal);

  window.BA = {
    D: D, fmtTanggal: fmtTanggal, fmtTanggalPanjang: fmtTanggalPanjang,
    rupiah: rupiah, pct: pct, units: units, unitStats: unitStats,
    baRows: baRows, totals: totals, actionsFor: actionsFor,
    flagsOf: flagsOf, toast: toast
  };
})();
