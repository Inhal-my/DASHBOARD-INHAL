<?php

namespace App\Models;

use CodeIgniter\Model;

class ConfigModel extends Model
{
    protected $table            = 'config';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'config_key','config_value',
    ];

    public function get(string $key, $default = null)
    {
        $row = $this->where('config_key', $key)->first();

        return $row ? $row['config_value'] : $default;
    }

    public function set($key, $value = '', ?bool $escape = null)
    {
        if (!is_string($key)) {
            return parent::set($key, $value, $escape);
        }

        if ($this->where('config_key', $key)->countAllResults() > 0) {
            $this->where('config_key', $key)->update(null, ['config_value' => $value]);
        } else {
            $this->insert(['config_key' => $key, 'config_value' => $value]);
        }

        return $this;
    }
}
