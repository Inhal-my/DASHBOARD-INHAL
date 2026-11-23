import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../pages/portal.html', import.meta.url), 'utf8');

describe('penetapan pengajuan gratis GAS', () => {
  it('updatePengajuanStatus menerima flag gratis', () => {
    assert.match(business, /function updatePengajuanStatus\(idPengajuan, newStatus, catatan, actorEmail, gratis\)/);
    assert.match(business, /const gratisFlag = gratis === true \|\| gratis === 1 \|\| String\(gratis \|\| ''\)\.toLowerCase\(\) === 'true';/);
  });

  it('menolak gratis yang digabung dengan penolakan/pembatalan atau pembayaran valid', () => {
    assert.match(business, /Status Gratis tidak dapat digabung dengan/);
    assert.match(business, /Pembayaran sudah valid; status gratis tidak dapat ditetapkan\./);
    assert.match(business, /Ubah ke Menunggu terlebih dahulu sebelum menetapkan gratis\./);
  });

  it('gratis memaksa ACC dan mengubah biaya menjadi nol', () => {
    assert.match(business, /_upsertBiayaCheckData\(idPengajuan, '0', existing\)/);
    assert.match(business, /Pengajuan ditandai gratis: status ACC dan biaya Rp 0\./);
  });

  it('gratis mencatat audit dan mengirim surat final otomatis', () => {
    assert.match(business, /action: 'GRATIS'/);
    assert.match(business, /const autoFinal = markGratis && effectiveStatus === STATUS\.ACC && !_paymentStr\(existing\['Link Final'\]\);/);
    assert.match(business, /Surat ACC final terkirim\./);
  });

  it('portal menolak unggah bukti untuk pengajuan gratis', () => {
    assert.match(business, /if \(_paymentStatus\(existing\) === 'gratis'\) \{/);
    assert.match(business, /Pengajuan ini gratis, tidak perlu mengunggah bukti bayar\./);
  });

  it('data portal menandai item gratis', () => {
    assert.match(business, /gratis: _paymentStatus\(p\) === 'gratis',/);
  });
});

describe('UI gratis GAS', () => {
  it('dashboard punya state dan konfirmasi gratis', () => {
    assert.match(dashboard, /gratis: false, gratisPrevStatus: 'Menunggu'/);
    assert.match(dashboard, /onGratisToggle\(\)/);
    assert.match(dashboard, /Tetapkan Pengajuan Gratis/);
  });

  it('dashboard mengirim flag gratis ke server', () => {
    assert.match(dashboard, /const gratis = !!this\.detail\.gratis;/);
    assert.match(dashboard, /gratis \? 'ACC' : status, catatan, '', gratis\)/);
  });

  it('portal menampilkan status gratis dan menyembunyikan unggah', () => {
    assert.match(portal, /detailItem\.gratis/);
    assert.match(portal, /Pengajuan ini gratis \(Rp 0\)\. Tidak perlu unggah bukti bayar\./);
    assert.match(portal, /Pengajuan gratis - bukti ACC final akan tersedia otomatis\./);
  });
});
