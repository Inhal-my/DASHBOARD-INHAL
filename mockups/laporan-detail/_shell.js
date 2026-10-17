(function () {
  function icon(id, cls) {
    return '<svg class="i ' + (cls || '') + '"><use href="icons.svg#' + id + '"></use></svg>';
  }

  var NAV = [
    { key: 'ringkasan', label: 'Ringkasan', icon: 'grid', href: '#' },
    { key: 'pengajuan', label: 'Pengajuan', icon: 'inbox', href: '#' },
    { key: 'ba', label: 'Berita Acara', icon: 'file', href: '#' },
    { key: 'laporan', label: 'Laporan', icon: 'chart', href: '#' },
    { key: 'master', label: 'Master', icon: 'settings', href: '#' }
  ];

  function sidebar(el) {
    var active = el.getAttribute('data-active') || 'laporan';
    var links = NAV.map(function (n) {
      var on = n.key === active ? ' on' : '';
      var pill = n.key === 'ba' ? '<span class="pill">3</span>' : '';
      return '<a class="' + on.trim() + '" href="' + n.href + '">' + icon(n.icon) + n.label + pill + '</a>';
    }).join('');
    el.innerHTML =
      '<div class="brand">' +
        '<div class="mark">' + icon('layers', 'lg') + '</div>' +
        '<div><div class="nm">Dashboard INHAL</div><div class="sb">Praktikum &middot; Admin</div></div>' +
      '</div>' +
      '<nav class="nav"><div class="sec">Menu</div>' + links + '</nav>' +
      '<div class="me">' +
        '<div class="row">' +
          '<div class="avatar" style="background:rgba(255,255,255,.12);color:#c7d2fe">AD</div>' +
          '<div class="min-w-0"><div class="nm">Admin INHAL</div><div class="sb">Super Admin</div></div>' +
        '</div>' +
        '<a class="out" href="#">' + icon('logout', 'xs') + ' Keluar</a>' +
      '</div>';
  }

  function topbar(el) {
    var title = el.getAttribute('data-title') || 'Laporan Detail';
    var crumb = el.getAttribute('data-crumb') || 'Laporan / <b>Detail</b>';
    el.innerHTML =
      '<div>' +
        '<div class="crumb">' + crumb + '</div>' +
        '<div class="title">' + title + '</div>' +
      '</div>' +
      '<div class="grow"></div>' +
      '<div class="search">' + icon('search', 'sm') + '<input placeholder="Cari mahasiswa / kegiatan..."></div>' +
      '<button class="iconbtn" title="Muat ulang">' + icon('refresh', 'sm') + '</button>' +
      '<button class="iconbtn" title="Notifikasi"><span class="dot"></span>' + icon('bell', 'sm') + '</button>' +
      '<div class="avatar">AD</div>';
  }

  function switchMode(mode) {
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
      b.setAttribute('aria-selected', b.getAttribute('data-mode') === mode ? 'true' : 'false');
    });
    document.querySelectorAll('[data-mode-panel]').forEach(function (p) {
      var on = p.getAttribute('data-mode-panel') === mode;
      p.hidden = !on;
      if (on) {
        p.classList.remove('fade-in');
        void p.offsetWidth;
        p.classList.add('fade-in');
      }
    });
  }

  function initSectionNav() {
    var nav = document.querySelector('[data-section-nav]');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
    if (!targets.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-90px 0px -65% 0px', threshold: 0.01 });
    targets.forEach(function (t) { obs.observe(t); });
  }

  if (/[?&]embed=1/.test(location.search)) document.body.classList.add('embed');

  document.querySelectorAll('[data-sidebar]').forEach(sidebar);
  document.querySelectorAll('[data-topbar]').forEach(topbar);
  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { switchMode(b.getAttribute('data-mode')); });
  });
  document.querySelectorAll('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () { window.print(); });
  });
  initSectionNav();
  var first = document.querySelector('[data-mode].on');
  if (first) switchMode(first.getAttribute('data-mode'));
})();
