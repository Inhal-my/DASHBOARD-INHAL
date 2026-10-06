(function (root) {
  'use strict';

  function normBagian(v) {
    return String(v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function resolveBagianLabel(value, pilihan, namaKegiatan, options) {
    const opts = options || {};
    const norm = typeof opts.norm === 'function' ? opts.norm : normBagian;
    const categories = (opts.categories && opts.categories.length) ? opts.categories : ['Ujian', 'SGD', 'KKD'];
    const labs = opts.labs || [];
    const key = norm(value);
    if (key) {
      for (let i = 0; i < categories.length; i++) {
        if (norm(categories[i]) === key) return categories[i];
      }
      for (let i = 0; i < labs.length; i++) {
        if (norm(labs[i]) === key) return labs[i];
      }
    }
    const pKey = norm(pilihan);
    if (pKey) {
      for (let i = 0; i < labs.length; i++) {
        if (norm(labs[i]) === pKey) return labs[i];
      }
    }
    const nKey = norm(namaKegiatan);
    if (nKey) {
      const sorted = labs.slice().sort((a, b) => norm(b).length - norm(a).length);
      for (let i = 0; i < sorted.length; i++) {
        if (nKey.indexOf(norm(sorted[i])) !== -1) return sorted[i];
      }
    }
    return '';
  }

  function formatTanggal(v) {
    if (!v) return '-';
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '-';
      return v.getDate() + '/' + (v.getMonth() + 1) + '/' + v.getFullYear();
    }
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
  }

  function formatTanggalWaktu(v) {
    if (!v) return '-';
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '-';
      const p = function (n) { return (n < 10 ? '0' : '') + n; };
      return v.getDate() + '/' + (v.getMonth() + 1) + '/' + v.getFullYear() + ' ' + p(v.getHours()) + ':' + p(v.getMinutes());
    }
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (m) {
      const datePart = m[3] + '/' + m[2] + '/' + m[1];
      const timePart = (m[4] !== undefined && m[5] !== undefined) ? (' ' + m[4] + ':' + m[5]) : '';
      return datePart + timePart;
    }
    return s;
  }

  function formatRupiah(num) {
    const n = Number(num) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  function safeUrl(v) {
    const s = String(v == null ? '' : v).trim();
    return /^https?:\/\//i.test(s) ? s : '#';
  }

  root.AppCommon = {
    normBagian: normBagian,
    resolveBagianLabel: resolveBagianLabel,
    formatTanggal: formatTanggal,
    formatTanggalWaktu: formatTanggalWaktu,
    formatRupiah: formatRupiah,
    safeUrl: safeUrl
  };
})(typeof window !== 'undefined' ? window : this);
