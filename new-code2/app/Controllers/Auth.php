<?php

namespace App\Controllers;

use App\Libraries\AuthService;

class Auth extends BaseController
{
    public function index()
    {
        $svc = new AuthService();
        if ($svc->isAdmin()) {
            return redirect()->to('/dashboard');
        }
        if ($svc->sessionBagian() !== null) {
            return redirect()->to('/bagian');
        }
        return view('pages/bagian', [
            'page'   => 'login',
            'title'  => 'Masuk',
            'userEmail' => '',
        ]);
    }

    public function login()
    {
        $svc = new AuthService();
        $role = $this->request->getPost('role') === AuthService::ROLE_ADMIN
            ? AuthService::ROLE_ADMIN
            : AuthService::ROLE_BAGIAN;
        if ($role === AuthService::ROLE_ADMIN) {
            $res = $svc->adminLogin(trim((string) $this->request->getPost('password')));
            $redirect = '/dashboard';
        } else {
            $res = $svc->bagianLogin(
                trim((string) $this->request->getPost('email')),
                trim((string) $this->request->getPost('password'))
            );
            $redirect = '/bagian';
        }
        if ($this->request->isAJAX()) {
            if (!$res['ok']) {
                return $this->response->setStatusCode(401)->setJSON([
                    'ok' => false,
                    'message' => $res['message'],
                ]);
            }
            return $this->response->setJSON([
                'ok'       => true,
                'message'  => 'Login berhasil.',
                'nama'     => $res['nama'],
                'redirect' => $redirect,
            ]);
        }
        if (!$res['ok']) {
            return redirect()->to('/login');
        }
        return redirect()->to($redirect);
    }
}
