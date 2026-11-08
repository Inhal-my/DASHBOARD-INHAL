/**
 * Daftar izin mode baca-saja. Modul ini sengaja tanpa dependensi Node agar bisa
 * dijalankan di workerd (wrangler dev) maupun diuji dari Node.
 *
 * Kriteria RPC yang diizinkan: tidak menulis tabel aplikasi dan tidak memanggil
 * layanan luar (Drive/email). `authenticateAdmin` dan `logoutSession` tetap
 * diizinkan karena keduanya hanya menyentuh tabel sesi di salinan lokal.
 */
export const READ_ONLY_RPC = [
  'authenticateAdmin',
  'logoutSession',
  'mfaStatus',
  'getActivityLog',
  'getDashboardBootstrap',
  'getDashboardStats',
  'getPengajuanList',
  'getPengajuanWithDetails',
  'getBagianAggregation',
  'getBeritaAcaraAdminList',
  'getBeritaAcaraList',
  'getKalenderBagianPelaksanaan',
  'getLaporanBootstrap',
  'getBagianBootstrap',
  'getBaginaConfig',
  'getBagianBaSettings',
  'getLabOptions',
  'getMasterDataMonitor',
  'getUploadMonitor',
  'getBaUploadOptions',
  'getMahasiswaByNpm',
  'getDosenOptions',
  'getBagianStaffList',
  'getRegistrationOptions',
  'diagnosticData',
  'auditMasterIntegrity',
  'previewMasterRename',
  'baAdminGet'
];

export function isReadOnlyRpc(fn) {
  return READ_ONLY_RPC.indexOf(String(fn || '')) !== -1;
}

const BLOCKED_PATHS = [
  ['POST', '/api/pengajuan'],
  ['POST', '/api/portal/upload'],
  ['POST', '/api/database-export']
];

/** Alasan penolakan, atau string kosong bila request boleh lanjut. */
export function blockedRequest(method, pathname, rpcFn) {
  const m = String(method || 'GET').toUpperCase();
  if (m === 'POST' && pathname === '/api/rpc') {
    return isReadOnlyRpc(rpcFn)
      ? ''
      : 'RPC ' + String(rpcFn || '(kosong)') + ' tidak diizinkan di mode baca-saja.';
  }
  for (const pair of BLOCKED_PATHS) {
    if (pair[0] === m && pair[1] === pathname) {
      return 'Endpoint ' + pathname + ' tidak diizinkan di mode baca-saja.';
    }
  }
  return '';
}
