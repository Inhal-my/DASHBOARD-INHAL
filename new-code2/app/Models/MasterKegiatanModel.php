<?php

namespace App\Models;

use CodeIgniter\Model;

class MasterKegiatanModel extends Model
{
    protected $table            = 'master_kegiatan';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'kategori','nilai',
    ];

    public function valuesFor(string $kategori): array
    {
        $rows = $this->where('kategori', $kategori)->orderBy('nilai', 'ASC')->findAll();

        return array_column($rows, 'nilai');
    }
}
