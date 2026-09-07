<?php

namespace App\Libraries;

use App\Models\NomorSuratModel;

class NomorSuratService
{
    public function next(string $type, ?int $tahun = null): string
    {
        $tahun = $tahun ?? (int) date('Y');
        $db = db_connect();
        $db->transStart();
        $row = (new NomorSuratModel())->where('type', $type)->where('tahun', $tahun)->first();
        $num = $row ? ((int) $row['last_number'] + 1) : 1;
        if ($row) {
            (new NomorSuratModel())->update($row['id'], ['last_number' => $num, 'updated_at' => date('Y-m-d H:i:s')]);
        } else {
            (new NomorSuratModel())->insert(['type' => $type, 'tahun' => $tahun, 'last_number' => $num]);
        }
        $db->transComplete();
        return str_pad((string) $num, 4, '0', STR_PAD_LEFT) . '/' . $type . '/' . $tahun;
    }
}
