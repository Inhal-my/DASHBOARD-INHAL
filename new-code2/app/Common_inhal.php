<?php

if (!function_exists('config_get')) {
    function config_get(string $key, $default = null)
    {
        $row = db_connect()->table('config')->where('config_key', $key)->get()->getRow();
        return $row ? $row->config_value : $default;
    }
}

if (!function_exists('config_set')) {
    function config_set(string $key, $value): void
    {
        $db = db_connect();
        $exists = $db->table('config')->where('config_key', $key)->countAllResults() > 0;
        if ($exists) {
            $db->table('config')->where('config_key', $key)->update(['config_value' => $value]);
        } else {
            $db->table('config')->insert(['config_key' => $key, 'config_value' => $value]);
        }
    }
}

if (!function_exists('inhal_id')) {
    function inhal_id(string $prefix): string
    {
        return $prefix . '-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }
}

if (!function_exists('audit_log_add')) {
    function audit_log_add($actor, $aksi, $target = null, $detail = null, $alasan = null): void
    {
        db_connect()->table('audit_log')->insert([
            'timestamp'   => date('Y-m-d H:i:s'),
            'actor_email' => $actor,
            'aksi'        => $aksi,
            'target'      => $target,
            'detail'      => $detail,
            'alasan'      => $alasan,
        ]);
    }
}
