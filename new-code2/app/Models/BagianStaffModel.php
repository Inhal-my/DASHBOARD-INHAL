<?php

namespace App\Models;

use CodeIgniter\Model;

class BagianStaffModel extends Model
{
    protected $table            = 'bagian_staff';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'email','kategori','nama','password_hash',
    ];

    public function findByEmail(string $email): ?array
    {
        return $this->where('email', $email)->first();
    }
}
