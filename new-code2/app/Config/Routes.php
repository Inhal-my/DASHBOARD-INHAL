<?php

use CodeIgniter\Router\RouteCollection;

$routes->get('/', 'PageController::show/index');
$routes->get('/portal', 'PageController::show/portal');
$routes->get('/bagian', 'PageController::show/bagian');
$routes->get('/dashboard', 'PageController::show/dashboard');
$routes->get('/admin', 'PageController::show/dashboard');
$routes->get('/laporan', 'PageController::show/laporan');
$routes->get('/pengaturan', 'PageController::show/pengaturan');

$routes->get('/login', 'Auth::index');
$routes->post('/login', 'Auth::login');
$routes->get('/logout', 'Logout::index');
$routes->get('files/(:segment)/(:segment)', 'FileApi::index/$1/$2');

$routes->get('/api/bagian/bootstrap', 'Api\BagianApi::bootstrap', ['filter' => 'bagian', 'as' => 'bagian-bootstrap']);
$routes->get('/api/bagian/config', 'Api\BagianApi::config', ['filter' => 'bagian', 'as' => 'bagian-config']);
$routes->get('/api/bagian/ba', 'Api\BagianApi::ba', ['filter' => 'bagian', 'as' => 'bagian-ba']);
$routes->post('/api/bagian/ba', 'Api\BagianApi::store', ['filter' => 'bagian', 'as' => 'bagian-ba-store']);
$routes->post('/api/bagian/ba/(:segment)/status', 'Api\BagianApi::updateStatus/$1', ['filter' => 'bagian', 'as' => 'bagian-ba-status']);

$routes->get('/api/registration-options', 'Api\MasterApi::registrationOptions');
$routes->get('/api/mahasiswa/(:segment)', 'Api\MasterApi::mahasiswa/$1');
$routes->post('/api/pengajuan', 'Api\PengajuanApi::register');

$routes->get('/api/dashboard/bootstrap', 'Api\DashboardApi::bootstrap', ['filter' => 'admin', 'as' => 'dashboard-bootstrap']);
$routes->get('/api/laporan/bootstrap', 'Api\LaporanApi::bootstrap', ['filter' => 'admin', 'as' => 'laporan-bootstrap']);
$routes->get('/api/dashboard/stats', 'Api\DashboardApi::stats', ['filter' => 'admin', 'as' => 'dashboard-stats']);
$routes->get('/api/pengajuan/(:segment)', 'Api\DashboardApi::pengajuanDetail/$1', ['filter' => 'admin', 'as' => 'pengajuan-detail']);
$routes->put('/api/pengajuan/(:segment)/status', 'Api\DashboardApi::updateStatus/$1', ['filter' => 'admin', 'as' => 'pengajuan-status']);
$routes->put('/api/pengajuan/(:segment)/biaya', 'Api\DashboardApi::updateBiaya/$1', ['filter' => 'admin', 'as' => 'pengajuan-biaya']);
$routes->put('/api/pengajuan/(:segment)/detail/(:segment)', 'Api\DashboardApi::updateDetail/$1/$2', ['filter' => 'admin', 'as' => 'pengajuan-detail-update']);
$routes->delete('/api/pengajuan/(:segment)/detail/(:segment)', 'Api\DashboardApi::deleteDetail/$1/$2', ['filter' => 'admin', 'as' => 'pengajuan-detail-delete']);
$routes->put('/api/pengajuan/(:segment)', 'Api\DashboardApi::updateFields/$1', ['filter' => 'admin', 'as' => 'pengajuan-update']);
$routes->delete('/api/pengajuan/(:segment)', 'Api\DashboardApi::deletePengajuan/$1', ['filter' => 'admin', 'as' => 'pengajuan-delete']);
$routes->get('/api/portal/(:segment)', 'Api\PortalApi::data/$1');
$routes->post('/api/portal/(:segment)/bukti', 'Api\PortalApi::uploadBukti/$1');

$routes->get('/api/admin/ba/options', 'Api\BeritaAcaraApi::options', ['filter' => 'admin', 'as' => 'admin-ba-options']);
$routes->get('/api/admin/ba', 'Api\BeritaAcaraApi::index', ['filter' => 'admin', 'as' => 'admin-ba']);
$routes->post('/api/admin/ba', 'Api\BeritaAcaraApi::store', ['filter' => 'admin', 'as' => 'admin-ba-store']);
$routes->delete('/api/admin/ba/(:segment)', 'Api\BeritaAcaraApi::delete/$1', ['filter' => 'admin', 'as' => 'admin-ba-delete']);
$routes->post('/api/admin/ba-bagian/start', 'Api\BeritaAcaraApi::bypassStart', ['filter' => 'admin', 'as' => 'admin-ba-bagian-start']);
$routes->post('/api/admin/ba-bagian/end', 'Api\BeritaAcaraApi::bypassEnd', ['filter' => 'admin', 'as' => 'admin-ba-bagian-end']);

$routes->post('/api/pengajuan/(:segment)/email-status', 'Api\PengajuanApi::emailStatus/$1', ['filter' => 'admin', 'as' => 'pengajuan-email-status']);
$routes->post('/api/pengajuan/(:segment)/email-final', 'Api\PengajuanApi::emailFinal/$1', ['filter' => 'admin', 'as' => 'pengajuan-email-final']);
$routes->post('/api/pengajuan/(:segment)/email-bagian', 'Api\PengajuanApi::emailBagian/$1', ['filter' => 'admin', 'as' => 'pengajuan-email-bagian']);

$routes->get('/api/pengaturan/umum', 'Api\PengaturanApi::umumGet', ['filter' => 'admin', 'as' => 'pengaturan-umum']);
$routes->put('/api/pengaturan/umum', 'Api\PengaturanApi::umumSave', ['filter' => 'admin', 'as' => 'pengaturan-umum-save']);
$routes->get('/api/pengaturan/kegiatan', 'Api\PengaturanApi::kegiatanGet', ['filter' => 'admin', 'as' => 'pengaturan-kegiatan']);
$routes->put('/api/pengaturan/kegiatan', 'Api\PengaturanApi::kegiatanSave', ['filter' => 'admin', 'as' => 'pengaturan-kegiatan-save']);
$routes->get('/api/pengaturan/matakuliah', 'Api\PengaturanApi::matakuliahGet', ['filter' => 'admin', 'as' => 'pengaturan-matakuliah']);
$routes->put('/api/pengaturan/matakuliah', 'Api\PengaturanApi::matakuliahSave', ['filter' => 'admin', 'as' => 'pengaturan-matakuliah-save']);
$routes->get('/api/pengaturan/bagian', 'Api\PengaturanApi::bagianGet', ['filter' => 'admin', 'as' => 'pengaturan-bagian']);
$routes->put('/api/pengaturan/bagian', 'Api\PengaturanApi::bagianSave', ['filter' => 'admin', 'as' => 'pengaturan-bagian-save']);
$routes->get('/api/pengaturan/biaya', 'Api\PengaturanApi::biayaGet', ['filter' => 'admin', 'as' => 'pengaturan-biaya']);
$routes->put('/api/pengaturan/biaya', 'Api\PengaturanApi::biayaSave', ['filter' => 'admin', 'as' => 'pengaturan-biaya-save']);
$routes->get('/api/pengaturan/pengguna', 'Api\PengaturanApi::penggunaGet', ['filter' => 'admin', 'as' => 'pengaturan-pengguna']);
$routes->put('/api/pengaturan/pengguna', 'Api\PengaturanApi::penggunaSave', ['filter' => 'admin', 'as' => 'pengaturan-pengguna-save']);
$routes->get('/api/pengaturan/email', 'Api\PengaturanApi::emailGet', ['filter' => 'admin', 'as' => 'pengaturan-email']);
$routes->put('/api/pengaturan/email', 'Api\PengaturanApi::emailSave', ['filter' => 'admin', 'as' => 'pengaturan-email-save']);
$routes->get('/api/pengaturan/nomor-surat', 'Api\PengaturanApi::nomorSuratGet', ['filter' => 'admin', 'as' => 'pengaturan-nomor-surat']);
$routes->put('/api/pengaturan/nomor-surat', 'Api\PengaturanApi::nomorSuratSave', ['filter' => 'admin', 'as' => 'pengaturan-nomor-surat-save']);
$routes->get('/api/pengaturan/upload', 'Api\PengaturanApi::uploadGet', ['filter' => 'admin', 'as' => 'pengaturan-upload']);
$routes->put('/api/pengaturan/upload', 'Api\PengaturanApi::uploadSave', ['filter' => 'admin', 'as' => 'pengaturan-upload-save']);
$routes->get('/api/pengaturan/status', 'Api\PengaturanApi::statusGet', ['filter' => 'admin', 'as' => 'pengaturan-status']);
$routes->put('/api/pengaturan/status', 'Api\PengaturanApi::statusSave', ['filter' => 'admin', 'as' => 'pengaturan-status-save']);
$routes->get('/api/pengaturan/audit', 'Api\PengaturanApi::audit', ['filter' => 'admin', 'as' => 'pengaturan-audit']);
