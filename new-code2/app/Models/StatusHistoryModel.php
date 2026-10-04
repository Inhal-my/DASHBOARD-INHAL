<?php

namespace App\Models;

use CodeIgniter\Model;

class StatusHistoryModel extends Model
{
    protected $table            = 'status_history';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'pengajuan_id','id_pengajuan','timestamp','status','catatan','actor_email',
    ];
}
