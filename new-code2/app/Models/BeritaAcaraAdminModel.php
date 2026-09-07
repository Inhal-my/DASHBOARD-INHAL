<?php

namespace App\Models;

use CodeIgniter\Model;

class BeritaAcaraAdminModel extends Model
{
    protected $table            = 'berita_acara_admin';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'timestamp','ba_id','bagian','blok','nama_kegiatan','tanggal_pelaksanaan',
        'jumlah_peserta','file_name','file_path','catatan','sumber',
    ];
}
