<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\AuthService;

class BagianFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $bypass = session()->get('bab_session') !== null;
        if (!(new AuthService())->isBagian() && !$bypass) {
            return service('response')->setStatusCode(401)->setJSON(['ok' => false, 'message' => 'Sesi bagian tidak ditemukan.']);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
