(function () {
  'use strict';

  try {
    localStorage.setItem('inhal_admin_session', JSON.stringify({
      token: 'mock-token-preview',
      nama: 'Admin Preview',
      role: 'admin'
    }));
  } catch (e) { /* localStorage tidak tersedia */ }

  var DATA = window.MOCK_LAPORAN || {};

  function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/rpc') === -1) return originalFetch(input, init);

    var payload = {};
    try { payload = JSON.parse((init && init.body) || '{}'); } catch (e) { payload = {}; }
    var fn = String(payload.fn || '');

    if (fn === 'getLaporanBootstrap') return Promise.resolve(jsonResponse(DATA));
    if (fn === 'authenticateAdmin') {
      return Promise.resolve(jsonResponse({ ok: true, token: 'mock-token-preview', nama: 'Admin Preview' }));
    }
    if (fn === 'logoutSession') return Promise.resolve(jsonResponse({ ok: true }));
    return Promise.resolve(jsonResponse({ error: 'Fungsi mock tidak tersedia: ' + fn }));
  };

  window.MOCK_PREVIEW = true;

  try {
    var url = new URL(window.location.href);
    if (!url.searchParams.get('mode')) {
      url.searchParams.set('mode', 'analitis');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch (e) { /* URL API tidak tersedia */ }
})();
