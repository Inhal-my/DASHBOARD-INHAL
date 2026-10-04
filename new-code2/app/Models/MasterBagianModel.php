<?php

namespace App\Models;

use CodeIgniter\Model;

class MasterBagianModel extends Model
{
    protected $table            = 'master_bagian';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'lab','kegiatan_lab','bagian','email',
    ];
}
