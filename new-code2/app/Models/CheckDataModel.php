<?php

namespace App\Models;

use CodeIgniter\Model;

class CheckDataModel extends Model
{
    protected $table            = 'check_data';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'check_id','pengajuan_id','id_pengajuan','timestamp','npm','nama_lengkap',
        'blok','jenis_kegiatan','pilihan','detail','tanggal_pelaksanaan','bagian',
        'dosen','hadir','catatan','biaya',
    ];
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
