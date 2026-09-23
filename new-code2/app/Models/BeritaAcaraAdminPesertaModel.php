<?php

namespace App\Models;

use CodeIgniter\Model;

class BeritaAcaraAdminPesertaModel extends Model
{
    protected $table            = 'berita_acara_admin_peserta';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'timestamp','ba_id','npm','nama_lengkap','blok','bagian','status_pengajuan',
    ];
}
