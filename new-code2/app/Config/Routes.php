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

$routes->get('/api/bagian/bootstrap', 'Api\BagianApi::bootstrap', ['filter' => 'bagian', 'as' => 'bagian-bootstrap']);
$routes->get('/api/bagian/config', 'Api\BagianApi::config', ['filter' => 'bagian', 'as' => 'bagian-config']);
$routes->get('/api/bagian/ba', 'Api\BagianApi::ba', ['filter' => 'bagian', 'as' => 'bagian-ba']);
$routes->post('/api/bagian/ba', 'Api\BagianApi::store', ['filter' => 'bagian', 'as' => 'bagian-ba-store']);
$routes->post('/api/bagian/ba/(:segment)/status', 'Api\BagianApi::updateStatus/$1', ['filter' => 'bagian', 'as' => 'bagian-ba-status']);

$routes->get('/api/registration-options', 'Api\MasterApi::registrationOptions');
$routes->get('/api/mahasiswa/(:segment)', 'Api\MasterApi::mahasiswa/$1');
$routes->post('/api/pengajuan', 'Api\PengajuanApi::register');
$routes->get('/api/portal/(:segment)', 'Api\PortalApi::data/$1');
$routes->post('/api/portal/(:segment)/bukti', 'Api\PortalApi::uploadBukti/$1');
