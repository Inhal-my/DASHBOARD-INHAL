<?php

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;

class BaseApi extends \CodeIgniter\Controller
{
    protected function respondOk($data): ResponseInterface
    {
        return $this->response->setStatusCode(200)->setJSON(['ok' => true, 'data' => $data]);
    }

    protected function respondErr(string $message, int $code = 400): ResponseInterface
    {
        return $this->response->setStatusCode($code)->setJSON(['ok' => false, 'message' => $message]);
    }

    protected function respondValidation(array $errors): ResponseInterface
    {
        return $this->response->setStatusCode(422)->setJSON(['ok' => false, 'message' => 'Validasi gagal.', 'errors' => $errors]);
    }

    protected function requireAdmin()
    {
        (new \App\Libraries\AuthService())->requireAdmin();
    }

    protected function requireBagian()
    {
        (new \App\Libraries\AuthService())->requireBagian();
    }
}
