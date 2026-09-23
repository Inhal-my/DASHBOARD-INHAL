<?php

namespace App\Models;

use CodeIgniter\Model;

class MasterMatakuliahModel extends Model
{
    protected $table            = 'master_matakuliah';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'kode','nama','blok','sks','aktif',
    ];
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
