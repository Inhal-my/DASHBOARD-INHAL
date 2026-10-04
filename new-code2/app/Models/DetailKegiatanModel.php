<?php

namespace App\Models;

use CodeIgniter\Model;

class DetailKegiatanModel extends Model
{
    protected $table            = 'detail_kegiatan';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'pengajuan_id','id_pengajuan','timestamp','jenis_kegiatan','pilihan',
        'detail','tanggal_pelaksanaan','bagian',
    ];
}
