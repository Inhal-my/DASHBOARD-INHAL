<?php

namespace App\Controllers\Api;

use App\Models\MahasiswaModel;
use App\Models\MasterKegiatanModel;
use App\Models\MasterMatakuliahModel;

class MasterApi extends BaseApi
{
    public function registrationOptions()
    {
        $master = function (string $kategori): array {
            return (new MasterKegiatanModel())->valuesFor($kategori);
        };
        $matkul = (new MasterMatakuliahModel())->where('aktif', 1)->orderBy('nama', 'ASC')->findAll();

        return $this->respondOk([
            'blok'        => $master('Blok'),
            'ujian'       => $master('Ujian'),
            'sgd'         => $master('SGD'),
            'detailSgd'   => $master('Detail SGD'),
            'kkd'         => $master('KKD'),
            'detailKkd'   => $master('Detail KKD'),
            'lab'         => $master('Lab'),
            'kegiatanLab' => $master('Kegiatan Lab'),
            'dosen'       => $master('Dosen'),
            'matakuliah'  => array_map(static fn ($m) => $m['nama'], $matkul),
            'buktiMode'   => config_get('BUKTI_MODE', 'strict'),
        ]);
    }

    public function mahasiswa(string $npm)
    {
        $m = (new MahasiswaModel())->where('npm', trim($npm))->first();

        return $this->respondOk(['nama_lengkap' => $m['nama_lengkap'] ?? '']);
    }
}
