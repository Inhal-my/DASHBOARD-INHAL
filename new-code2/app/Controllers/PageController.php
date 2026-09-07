<?php

namespace App\Controllers;

class PageController extends BaseController
{
    private array $pages = [
        'index'    => 'pages/index',
        'portal'   => 'pages/portal',
        'bagian'   => 'pages/bagian',
        'dashboard'=> 'pages/dashboard',
        'laporan'  => 'pages/detail-laporan',
        'pengaturan'=> 'pages/pengaturan',
    ];

    public function show(string $page = 'index')
    {
        $key = array_key_exists($page, $this->pages) ? $page : 'index';
        $data = [
            'page'   => $key,
            'title'  => ucfirst($key),
            'userEmail' => session()->get('auth.nama') ?? '',
        ];
        return view($this->pages[$key], $data);
    }
}
