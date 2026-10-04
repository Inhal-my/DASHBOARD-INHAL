<?php

namespace App\Libraries;

use App\Models\AdminModel;
use App\Models\BagianStaffModel;

class AuthService
{
    public const ROLE_ADMIN = 'admin';
    public const ROLE_BAGIAN = 'bagian';

    public function adminLogin(string $password): array
    {
        if ($password === '') {
            return ['ok' => false, 'message' => 'Masukkan password admin.'];
        }
        $session = session();
        $failed = (int) $session->get('login_failed_admin') ?? 0;
        if ($failed >= 5) {
            return ['ok' => false, 'message' => 'Terlalu banyak percobaan. Coba lagi nanti.'];
        }
        $admin = (new AdminModel())->first();
        if ($admin && password_verify($password, $admin['password_hash'])) {
            $session->remove('login_failed_admin');
            $session->set('auth', ['role' => self::ROLE_ADMIN, 'nama' => $admin['nama']]);
            $session->regenerate(true);
            return ['ok' => true, 'nama' => $admin['nama']];
        }
        $session->set('login_failed_admin', $failed + 1);
        return ['ok' => false, 'message' => 'Password admin salah.'];
    }

    public function bagianLogin(string $email, string $password): array
    {
        $staf = (new BagianStaffModel())->where('email', trim($email))->first();
        if (!$staf || !password_verify($password, $staf['password_hash'])) {
            return ['ok' => false, 'message' => 'Email atau password salah.'];
        }
        $session = session();
        $session->set('auth', [
            'role'       => self::ROLE_BAGIAN,
            'email'      => $staf['email'],
            'nama'       => $staf['nama'],
            'kategori'   => $staf['kategori'],
            'kategoris'  => $staf['kategori'] ? [$staf['kategori']] : [],
        ]);
        $session->regenerate(true);
        return ['ok' => true, 'nama' => $staf['nama'], 'kategori' => $staf['kategori']];
    }

    public function logout(): void
    {
        $session = session();
        $session->remove('auth');
        $session->remove('bab_session');
        $session->destroy();
    }

    public function sessionAuth(): ?array
    {
        return session()->get('auth');
    }

    public function isAdmin(): bool
    {
        return ($this->sessionAuth()['role'] ?? null) === self::ROLE_ADMIN;
    }

    public function isBagian(): bool
    {
        return ($this->sessionAuth()['role'] ?? null) === self::ROLE_BAGIAN;
    }

    public function requireAdmin(): void
    {
        if (!$this->isAdmin()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['ok' => false, 'message' => 'Sesi admin tidak ditemukan. Silakan login.']);
            exit;
        }
    }

    public function requireBagian(): void
    {
        if (!$this->isBagian()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['ok' => false, 'message' => 'Sesi bagian tidak ditemukan.']);
            exit;
        }
    }

    public function sessionBagian(): ?array
    {
        $session = session();
        $bypass = $session->get('bab_session');
        $auth = $session->get('auth');
        if ($bypass) {
            return [
                'role'       => self::ROLE_BAGIAN,
                'nama'       => $bypass['nama'] ?? 'Admin',
                'email'      => '',
                'kategori'   => $bypass['kategori'] ?? '',
                'subBagian'  => $bypass['subBagian'] ?? '',
                'kategoris'  => $bypass['kategoris'] ?? [],
                'bypass'     => true,
            ];
        }
        if (!$auth || ($auth['role'] ?? null) !== self::ROLE_BAGIAN) {
            return null;
        }
        $staf = (new BagianStaffModel())->where('email', trim($auth['email'] ?? ''))->first();
        return [
            'role'       => self::ROLE_BAGIAN,
            'nama'       => $auth['nama'] ?? ($staf['nama'] ?? 'Petugas Bagian'),
            'email'      => $auth['email'] ?? '',
            'kategori'   => $auth['kategori'] ?? ($staf['kategori'] ?? ''),
            'subBagian'  => '',
            'kategoris'  => $auth['kategoris'] ?? ($staf['kategori'] ? [$staf['kategori']] : []),
            'staf'       => $staf,
        ];
    }

    public function adminBagianBypass(string $kategori, string $subBagian): array
    {
        $this->requireAdmin();
        $allowed = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
        if (!in_array($kategori, $allowed, true)) {
            return ['ok' => false, 'message' => 'Pilih kategori kegiatan terlebih dahulu.'];
        }
        if ($kategori === 'Praktikum' && trim($subBagian) === '') {
            return ['ok' => false, 'message' => 'Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.'];
        }
        $auth = $this->sessionAuth();
        session()->set('bab_session', [
            'role'      => self::ROLE_BAGIAN,
            'nama'      => $auth['nama'] ?? 'Admin',
            'kategori'  => $kategori,
            'subBagian' => trim($subBagian),
            'kategoris' => [$kategori],
            'bypass'    => true,
        ]);
        return ['ok' => true, 'nama' => $auth['nama'] ?? 'Admin', 'kategori' => $kategori, 'subBagian' => trim($subBagian)];
    }
}
