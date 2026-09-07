<?php

namespace App\Models;

use CodeIgniter\Model;

class NomorSuratModel extends Model
{
    protected $table            = 'nomor_surat';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'type','tahun','last_number','updated_at',
    ];
}
