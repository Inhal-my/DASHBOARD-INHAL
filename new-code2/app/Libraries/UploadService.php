<?php

namespace App\Libraries;

use Config\UploadConfig;
use CodeIgniter\HTTP\Files\UploadedFile;

class UploadService
{
    private array $dirs = ['acc' => 'acc', 'bukti' => 'bukti', 'ba' => 'ba', 'final' => 'final'];
    private array $mimeOk = ['application/pdf', 'image/jpeg', 'image/png'];

    private function mimeWhitelist(): array
    {
        $raw = config_get('UPLOAD_MIME_WHITELIST', null);
        if ($raw !== null) {
            $decoded = json_decode((string) $raw, true);
            if (is_array($decoded) && $decoded !== []) {
                $list = array_values(array_filter(array_map('strval', $decoded), static fn ($m) => $m !== ''));
                if ($list !== []) {
                    return $list;
                }
            }
        }
        return $this->mimeOk;
    }

    public function store(string $jenis, string $idRef, UploadedFile $file): array
    {
        if (!$file->isValid() || $file->hasMoved()) {
            return ['ok' => false, 'message' => 'File tidak valid.'];
        }
        if ($file->getSize() > (int) (config_get('UPLOAD_MAX_BYTES', 5242880))) {
            return ['ok' => false, 'message' => 'Ukuran file melebihi batas maksimal.'];
        }
        $mimeOk = $this->mimeWhitelist();
        if (!in_array($file->getMimeType(), $mimeOk, true)) {
            return ['ok' => false, 'message' => 'Tipe file tidak diizinkan. Gunakan PDF/JPG/PNG.'];
        }
        $dir = $this->dirs[$jenis] ?? 'acc';
        $ext  = $file->getClientExtension();
        if (in_array(strtolower($ext), ['php', 'phtml', 'phar', 'php3', 'php4', 'php5'], true)) {
            return ['ok' => false, 'message' => 'Ekstensi file tidak diizinkan.'];
        }
        $folder = WRITEPATH . 'uploads/' . $dir . '/';
        if (!is_dir($folder)) {
            mkdir($folder, 0775, true);
        }
        $fileName = $idRef . '_' . $dir . '_' . uniqid() . '.' . $ext;
        if (!$file->move($folder, $fileName)) {
            return ['ok' => false, 'message' => 'Gagal menyimpan file.'];
        }
        return ['ok' => true, 'path' => $dir . '/' . $fileName, 'file_name' => $file->getClientName()];
    }
}
