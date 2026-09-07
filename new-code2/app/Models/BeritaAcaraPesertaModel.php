<?php

namespace App\Models;

use CodeIgniter\Model;

class BeritaAcaraPesertaModel extends Model
{
    protected $table            = 'berita_acara_peserta';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'timestamp','ba_id','npm','nama_lengkap','blok','bagian','status_pengajuan',
    ];

    public function forBa(string $baId): array
    {
        return $this->where('ba_id', $baId)->orderBy('id', 'ASC')->findAll();
    }
}
