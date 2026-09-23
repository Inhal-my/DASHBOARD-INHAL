<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\AuthService;

class AdminFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (!(new AuthService())->isAdmin()) {
            return service('response')->setStatusCode(401)->setJSON(['ok' => false, 'message' => 'Sesi admin tidak ditemukan. Silakan login.']);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
