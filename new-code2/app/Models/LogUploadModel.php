<?php

namespace App\Models;

use CodeIgniter\Model;

class LogUploadModel extends Model
{
    protected $table            = 'log_upload';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'timestamp','pengajuan_id','id_pengajuan','npm','nama_lengkap','blok',
        'jenis_kegiatan','detail','tanggal','path_acc_inhal','path_bukti_bayar',
    ];
}
