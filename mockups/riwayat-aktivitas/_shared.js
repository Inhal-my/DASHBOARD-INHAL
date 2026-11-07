/* Helper bersama untuk mockup Riwayat Aktivitas (dummy, tanpa backend). */
(function () {
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function parse(iso) {
    const [d, t] = String(iso).split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi, s] = (t || '00:00:00').split(':').map(Number);
    return new Date(y, mo - 1, da, h, mi, s || 0);
  }

  function fmtTanggal(iso) {
    const d = parse(iso);
    return `${pad(d.getDate())} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }

  function fmtJam(iso) {
    const d = parse(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtHari(iso) {
    const d = parse(iso);
    return HARI[d.getDay()];
  }

  function fmtTanggalLengkap(iso) {
    return `${fmtHari(iso)}, ${fmtTanggal(iso)} ${fmtJam(iso)}`;
  }

  function rupiah(n) {
    if (n === null || n === undefined || n === '') return '—';
    return 'Rp' + Number(n).toLocaleString('id-ID');
  }

  function kind(jenis) {
    return (window.ACT_KINDS && window.ACT_KINDS[jenis]) || { label: jenis, badge: 'slate', dot: 'act', grup: 'Lainnya' };
  }

  function badge(jenis) {
    const k = kind(jenis);
    return `<span class="badge ${k.badge}">${k.label}</span>`;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function actorHtml(e, small) {
    const size = small ? 'width:26px;height:26px;font-size:10px' : '';
    return `<div class="act-actor">
      <div class="avatar" style="${size}">${esc(e.inisial || '?')}</div>
      <div><div class="nm">${esc(e.aktor)}</div><div class="role">${esc(e.aktorRole || '')}</div></div>
    </div>`;
  }

  function filterEvents(events, f) {
    return events.filter(function (e) {
      if (f.jenis && e.jenis !== f.jenis) return false;
      if (f.aktor && e.aktor !== f.aktor) return false;
      if (f.target && e.targetJenis !== f.target) return false;
      if (f.dari && e.waktu.slice(0, 10) < f.dari) return false;
      if (f.sampai && e.waktu.slice(0, 10) > f.sampai) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        const hay = [e.aktor, e.aktorRole, e.targetId, e.targetJenis, e.ringkasan, e.alasan, kind(e.jenis).label].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* Render isi drawer detail untuk satu event. */
  function renderDetail(e) {
    const k = kind(e.jenis);
    let html = '';
    html += `<div class="drawer-head">
      <div>
        <div class="drawer-title">Detail Aktivitas</div>
        <div class="drawer-sub">${esc(fmtTanggalLengkap(e.waktu))} · ${esc(e.targetId)}</div>
      </div>
      <button class="iconbtn" data-close>&times;</button>
    </div>`;
    html += `<div class="drawer-body">`;

    html += `<div class="info-card"><div class="info-grid">
      <div><div class="k">Aktor</div><div class="v">${esc(e.aktor)}</div></div>
      <div><div class="k">Peran</div><div class="v">${esc(e.aktorRole || '-')}</div></div>
      <div><div class="k">Jenis Aksi</div><div class="v">${badge(e.jenis)}</div></div>
      <div><div class="k">Sumber Data</div><div class="v mono">${esc(e.sumber)}</div></div>
      <div><div class="k">Target</div><div class="v">${esc(e.targetJenis)}</div></div>
      <div><div class="k">ID Target</div><div class="v mono">${esc(e.targetId)}</div></div>
    </div></div>`;

    html += `<div class="info-card">
      <div class="section-label">Ringkasan</div>
      <div style="font-size:12.5px;font-weight:700;margin-top:5px;line-height:1.55">${esc(e.ringkasan)}</div>
      ${e.alasan ? `<div class="note-box" style="margin-top:9px"><b>Alasan / catatan:</b> ${esc(e.alasan)}</div>` : ''}
    </div>`;

    if (e.meta && Object.keys(e.meta).length) {
      html += `<div class="info-card"><div class="section-label" style="margin-bottom:7px">Rincian</div><div class="kv-grid">`;
      Object.keys(e.meta).forEach(function (key) {
        let val = e.meta[key];
        if (Array.isArray(val)) val = val.join(', ');
        if (key === 'nominal' || key === 'nominalLama' || key === 'nominalBaru' || key === 'tagihan') val = rupiah(val);
        html += `<div><div class="k">${esc(key)}</div><div class="v">${esc(val)}</div></div>`;
      });
      html += `</div></div>`;
    }

    if (e.sebelum || e.sesudah) {
      const keys = [];
      Object.keys(e.sebelum || {}).forEach(function (x) { if (keys.indexOf(x) === -1) keys.push(x); });
      Object.keys(e.sesudah || {}).forEach(function (x) { if (keys.indexOf(x) === -1) keys.push(x); });
      html += `<div class="info-card"><div class="section-label" style="margin-bottom:7px">Sebelum &rarr; Sesudah</div>
        <table class="diff-table"><thead><tr><th>Field</th><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody>`;
      keys.forEach(function (key) {
        const b = e.sebelum ? e.sebelum[key] : undefined;
        const a = e.sesudah ? e.sesudah[key] : undefined;
        const same = String(b) === String(a);
        html += `<tr><td class="k">${esc(key)}</td><td class="${same ? '' : 'before'}">${esc(b === undefined ? '—' : b)}</td><td class="${same ? '' : 'after'}">${esc(a === undefined ? '—' : a)}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    html += `<div class="info-card">
      <div class="section-label" style="margin-bottom:7px">Payload mentah (audit_log.detail)</div>
      <div class="json-box">${esc(JSON.stringify({ aksi: e.jenis, target: e.targetId, detail: e.meta || {}, alasan: e.alasan || '' }, null, 2))}</div>
      <div class="note-box" style="margin-top:9px">Mockup: payload ini ilustrasi bentuk JSON yang tersimpan di kolom <span class="mono">detail</span>.</div>
    </div>`;

    html += `</div>`;
    html += `<div class="drawer-foot">
      <button class="btn primary" data-close>Tutup</button>
      <button class="btn" onclick="toast('Mockup: tautan ke pengajuan belum aktif')">Buka pengajuan</button>
      <button class="btn ghost" onclick="toast('Mockup: salin ID belum aktif')">Salin ID</button>
    </div>`;
    return html;
  }

  function openDrawer(html) {
    let ov = document.querySelector('.drawer-overlay');
    let dr = document.querySelector('.drawer');
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'drawer-overlay';
      dr = document.createElement('div'); dr.className = 'drawer';
      document.body.appendChild(ov); document.body.appendChild(dr);
      ov.addEventListener('click', closeDrawer);
      dr.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-close]')) closeDrawer();
      });
    }
    dr.innerHTML = html;
    requestAnimationFrame(function () { ov.classList.add('open'); dr.classList.add('open'); });
  }

  function closeDrawer() {
    const ov = document.querySelector('.drawer-overlay');
    const dr = document.querySelector('.drawer');
    if (ov) ov.classList.remove('open');
    if (dr) dr.classList.remove('open');
  }

  window.MOCK = {
    fmtTanggal: fmtTanggal, fmtJam: fmtJam, fmtTanggalLengkap: fmtTanggalLengkap,
    fmtHari: fmtHari, rupiah: rupiah, kind: kind, badge: badge, esc: esc,
    actorHtml: actorHtml, filterEvents: filterEvents, renderDetail: renderDetail,
    openDrawer: openDrawer, closeDrawer: closeDrawer, parse: parse
  };

  window.toast = function (msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
})();
