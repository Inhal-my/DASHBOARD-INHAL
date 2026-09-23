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

    /** Keys that render through layouts/admin. Grows per conversion task. */
    private array $shellKeys = ['dashboard', 'laporan', 'pengaturan'];

    private array $titles = [
        'dashboard'  => 'Dashboard',
        'laporan'    => 'Laporan',
        'pengaturan' => 'Pengaturan',
    ];

    public function show(string $page = 'index')
    {
        $key = array_key_exists($page, $this->pages) ? $page : 'index';

        if (!in_array($key, ['dashboard', 'laporan', 'pengaturan'], true)) {
            $data = [
                'page'   => $key,
                'title'  => ucfirst($key),
                'userEmail' => session()->get('auth.nama') ?? '',
            ];
            return view($this->pages[$key], $data);
        }

        // Admin shell pages: admin-only guard.
        $svc = new \App\Libraries\AuthService();
        if (!$svc->isAdmin()) {
            return redirect()->to('/login');
        }

        $title = $this->titles[$key] ?? ucfirst($key);
        $userEmail = session()->get('auth.nama') ?? '';

        // Not yet converted: keep standalone full-document rendering.
        if (!in_array($key, $this->shellKeys, true)) {
            return view($this->pages[$key], [
                'page'   => $key,
                'title'  => $title,
                'userEmail' => $userEmail,
            ]);
        }

        $sub = $key === 'pengaturan'
            ? $this->normalizeSubMenu((string) ($this->request->getGet('tab') ?? 'umum'))
            : '';

        $fragment = view($this->pages[$key], [
            'page'       => $key,
            'title'      => $title,
            'userEmail'  => $userEmail,
        ]);

        return view('layouts/admin', [
            'page'          => $key,
            'title'         => $title,
            'userEmail'     => $userEmail,
            'activeMenu'    => $key,
            'activeSubMenu' => $sub,
            'content'       => $fragment,
        ]);
    }

    private function normalizeSubMenu(string $tab): string
    {
        $allowed = ['umum','matakuliah','kegiatan','bagian','biaya','mahasiswa','pengguna','email','nomor','upload','status','audit'];
        return in_array($tab, $allowed, true) ? $tab : 'umum';
    }
}
