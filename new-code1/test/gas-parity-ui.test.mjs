import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bagian = readFileSync(new URL('../pages/bagian.html', import.meta.url), 'utf8');
const dosenPicker = readFileSync(new URL('../pages/_dosen-picker.html', import.meta.url), 'utf8');
const bagianState = readFileSync(new URL('../pages/_bagian-state.html', import.meta.url), 'utf8');

describe('parity UI bagian GAS dengan CF', () => {
  it('memuat helper BagianState dan DosenPicker sebagai include GAS', () => {
    assert.match(bagian, /include\('pages\/_bagian-state'\)/);
    assert.match(bagian, /include\('pages\/_dosen-picker'\)/);
    assert.match(bagian, /window\.DosenPicker\.install\(app\)/);
    assert.match(bagianState, /root\.BagianState\s*=/);
    assert.match(dosenPicker, /app\.component\('dosen-picker'/);
  });

  it('menampilkan notifikasi peserta disetujui', () => {
    assert.match(bagian, /class="ntf-wrap"/);
    assert.match(bagian, /notifUnreadCount/);
    assert.match(bagian, /markAllNotifRead/);
    assert.match(bagian, /notifikasiList = res\.notifikasiList \|\| \[\]/);
  });

  it('menyediakan kalender lintas bagian read-only', () => {
    assert.match(bagian, /id: 'kalender'/);
    assert.match(bagian, /getKalenderBagianPelaksanaan/);
    assert.match(bagian, /kalenderCells/);
    assert.match(bagian, /kalenderBentrok/);
  });

  it('memakai dosen-picker multi-dosen pada jadwal dan BA', () => {
    assert.match(bagian, /<dosen-picker v-model="jadwal\.dosenList\[i\]"/);
    assert.match(bagian, /<dosen-picker v-model="ba\.dosenList\[i\]"/);
    assert.match(bagian, /dosenList: dosenList/);
    assert.doesNotMatch(bagian, /list="dosen-options"/);
    assert.doesNotMatch(bagian, /<datalist/);
  });
});

const detailLaporan = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');

describe('parity UI detail-laporan GAS dengan CF', () => {
  it('memuat DosenPicker sebagai include GAS', () => {
    assert.match(detailLaporan, /include\('pages\/_dosen-picker'\)/);
    assert.match(detailLaporan, /window\.DosenPicker\.install\(app\)/);
  });

  it('menyediakan Kelola BA untuk BA Pelaksanaan dan Pendukung', () => {
    assert.match(detailLaporan, /kelola: \{ open: false, baId: '', sumber: 'Bagian'/);
    assert.match(detailLaporan, /openKelolaBa\(r\.id, r\.sumber\)/);
    assert.match(detailLaporan, /async submitKelolaBa\(\)/);
    assert.match(detailLaporan, /k\.sumber === 'Admin' \? 'updateBeritaAcaraAdmin' : 'updateBeritaAcaraBagian'/);
    assert.match(detailLaporan, /<dosen-picker v-model="kelola\.dosen"/);
  });

  it('menghapus pengajuan langsung dari tabel rekap', () => {
    assert.match(detailLaporan, /deletePengajuanRow\(r\)/);
    assert.match(detailLaporan, /run\('deletePengajuanAdmin', id, alasan\)/);
    assert.match(detailLaporan, /colspan="12"/);
  });
});

const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');
const allGs = ['../0_code.gs', '../1_business.gs', '../2_web.gs', '../4_parity.gs']
  .map((p) => readFileSync(new URL(p, import.meta.url), 'utf8'))
  .join('\n');

describe('parity UI dashboard GAS dengan CF', () => {
  it('menyediakan Buat BA Pendukung dengan RPC baAdminCreate dan baAdminAddPeserta', () => {
    assert.match(dashboard, /@click="openBaCreate\(\)"/);
    assert.match(dashboard, /async baCreateSubmit\(\)/);
    assert.match(dashboard, /run\('baAdminCreate', this\.baCreate\.kegiatan\)/);
    assert.match(dashboard, /run\('baAdminAddPeserta', created\.baId, ids\)/);
    assert.match(dashboard, /baCreateUnits\(\)/);
    assert.match(dashboard, /baCreateToggleAll\(\)/);
    assert.match(dashboard, /baCreateAllSelected\(\)/);
  });

  it('menyediakan Periksa Integritas Master lewat auditMasterIntegrity', () => {
    assert.match(dashboard, /@click="openAuditMaster\(\)"/);
    assert.match(dashboard, /run\('auditMasterIntegrity'\)/);
    assert.match(dashboard, /auditMaster\.data\.dataQuality\.totals\.baOrphan/);
    assert.match(dashboard, /<div v-if="auditMaster\.open"/);
  });

  it('mengelola PDF BA bersama pada kelola BA Pendukung', () => {
    assert.match(dashboard, /ref="baManageSharedFile"/);
    assert.match(dashboard, /@change="onBaManageSharedFile"/);
    assert.match(dashboard, /run\('setBaAdminSharedFile'/);
    assert.match(dashboard, /run\('removeBaAdminSharedFile'/);
    assert.match(dashboard, /'baAdminAddPesertaMassal'/);
    assert.match(dashboard, /baManageAllCandidatesSelected/);
  });

  it('menambah peserta kandidat dan merakit PDF lewat rencana baAdminRegenerate', () => {
    assert.match(dashboard, /run\('baAdminGet', first\)/);
    assert.match(dashboard, /run\('baAdminRegenerate', this\.baManage\.baId\)/);
    assert.match(dashboard, /plan\.sharedFiles/);
    assert.match(dashboard, /sharedFiles: sharedFiles/);
    assert.match(dashboard, /baManageToggleAllCandidates\(\)/);
    assert.match(dashboard, /async baManageAddBulk\(requireShared\)/);
  });

  it('menyediakan tab Riwayat Aktivitas dengan linimasa dan detail', () => {
    assert.match(dashboard, /key: 'riwayat', icon: 'bi-clock-history', label: 'Riwayat'/);
    assert.match(dashboard, /v-if="tab==='riwayat'"/);
    assert.match(dashboard, /run\('getActivityLog'/);
    assert.match(dashboard, /async loadActivity\(opts\)/);
    assert.match(dashboard, /class="act-grid"/);
    assert.match(dashboard, /@click="openActivity\(e\)"/);
    assert.match(dashboard, /async exportActivityLog\(\)/);
    assert.match(dashboard, /v-if="act\.detail\.open"/);
    assert.match(dashboard, /\.act-drawer/);
  });

  it('semua RPC yang dipanggil dashboard tersedia di backend GAS', () => {
    const calls = new Set(Array.from(dashboard.matchAll(/run\('([A-Za-z0-9_]+)'/g), (m) => m[1]));
    const missing = Array.from(calls).filter((name) => !new RegExp('function ' + name + '\\(').test(allGs));
    assert.deepEqual(missing, []);
  });
});
