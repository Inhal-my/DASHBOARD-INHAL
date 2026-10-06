<?php

namespace App\Controllers;

use App\Libraries\AuthService;
use App\Models\BeritaAcaraAdminModel;
use App\Models\BeritaAcaraModel;
use App\Models\PengajuanModel;

class FileApi extends Api\BaseApi
{
    public function index(string $jenis, string $idPengajuan)
    {
        $allowed = ['acc', 'bukti', 'ba', 'final'];
        if (!in_array($jenis, $allowed, true)) {
            return $this->respondErr('Jenis file tidak dikenal.', 404);
        }
        $auth = new AuthService();
        $admin = $auth->isAdmin();
        $bagian = $auth->isBagian();

        if ($jenis === 'ba') {
            return $this->serveBa($auth, $idPengajuan);
        }
        if (!$admin && !$bagian) {
            return $this->serveOwnFile($idPengajuan, $jenis);
        }

        $p = (new PengajuanModel())->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $col = 'path_' . ($jenis === 'acc' ? 'acc_inhal' : ($jenis === 'bukti' ? 'bukti_bayar' : $jenis));
        $path = $p[$col] ?? null;
        if (!$path) {
            return $this->respondErr('File belum tersedia.', 404);
        }
        return $this->sendFile($path);
    }

    private function serveBa(AuthService $auth, string $baId)
    {
        if (!$auth->isAdmin() && !$auth->isBagian()) {
            return $this->respondErr('Tidak diizinkan.', 403);
        }
        $rows = [];
        $ba = (new BeritaAcaraModel())->where('ba_id', $baId)->first();
        if ($ba) {
            $rows[] = $ba;
        }
        $baAdmin = (new BeritaAcaraAdminModel())->where('ba_id', $baId)->first();
        if ($baAdmin) {
            $rows[] = $baAdmin;
        }
        if ($rows === []) {
            return $this->respondErr('Berita acara tidak ditemukan.', 404);
        }
        foreach ($rows as $row) {
            if (!empty($row['file_path'])) {
                return $this->sendFile($row['file_path']);
            }
        }
        return $this->respondErr('File belum tersedia.', 404);
    }

    private function serveOwnFile(string $idPengajuan, string $jenis)
    {
        $cols = ['bukti' => 'path_bukti_bayar', 'final' => 'path_final'];
        if (!isset($cols[$jenis])) {
            return $this->respondErr('Tidak diizinkan.', 403);
        }
        $p = (new PengajuanModel())->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $npm = trim((string) ($this->request->getGet('npm') ?? ''));
        if ($npm === '' || $npm !== $p['npm']) {
            return $this->respondErr('Tidak diizinkan.', 403);
        }
        $path = $p[$cols[$jenis]] ?? null;
        if (empty($path)) {
            return $this->respondErr('File belum tersedia.', 404);
        }
        return $this->sendFile($path);
    }

    private function sendFile(string $path): \CodeIgniter\HTTP\ResponseInterface
    {
        $full = WRITEPATH . 'uploads/' . ltrim($path, '/');
        $real = realpath($full);
        if ($real === false || !is_file($real)) {
            return $this->respondErr('File tidak ditemukan di server.', 404);
        }
        $mime = function_exists('mime_content_type') ? mime_content_type($real) : 'application/octet-stream';
        if (!$mime) {
            $mime = 'application/octet-stream';
        }
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename($path));
        return $this->response
            ->setHeader('Content-Type', $mime)
            ->setHeader('Content-Disposition', 'inline; filename="' . $safeName . '"')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setBody((string) file_get_contents($real));
    }
}
