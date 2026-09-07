<?php

use CodeIgniter\Router\RouteCollection;

$routes->get('/', 'PageController::show/index');
$routes->get('/portal', 'PageController::show/portal');
$routes->get('/bagian', 'PageController::show/bagian');
$routes->get('/dashboard', 'PageController::show/dashboard');
$routes->get('/admin', 'PageController::show/dashboard');
$routes->get('/laporan', 'PageController::show/laporan');
$routes->get('/pengaturan', 'PageController::show/pengaturan');

$routes->get('/api/registration-options', 'Api\MasterApi::registrationOptions');
$routes->get('/api/mahasiswa/(:segment)', 'Api\MasterApi::mahasiswa/$1');
$routes->post('/api/pengajuan', 'Api\PengajuanApi::register');
$routes->get('/api/portal/(:segment)', 'Api\PortalApi::data/$1');
$routes->post('/api/portal/(:segment)/bukti', 'Api\PortalApi::uploadBukti/$1');
