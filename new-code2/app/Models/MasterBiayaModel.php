<?php

namespace App\Models;

use CodeIgniter\Model;

class MasterBiayaModel extends Model
{
    protected $table            = 'master_biaya';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'kegiatan','biaya',
    ];
}
