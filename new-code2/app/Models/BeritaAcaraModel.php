<?php

namespace App\Models;

use CodeIgniter\Model;

class BeritaAcaraModel extends Model
{
    protected $table            = 'berita_acara';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'timestamp','ba_id','bagian','blok','nama_kegiatan','tanggal_pelaksanaan',
        'jumlah_peserta','file_name','file_path','catatan','sumber',
    ];

    public function findByDuplikatKey($bagian, $blok, $namaKegiatan, $tanggal): ?array
    {
        return $this->where('bagian', $bagian)
            ->where('blok', $blok)
            ->where('nama_kegiatan', $namaKegiatan)
            ->where('tanggal_pelaksanaan', $tanggal)
            ->first();
    }
}
