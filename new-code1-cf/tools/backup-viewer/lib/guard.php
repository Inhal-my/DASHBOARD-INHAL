<?php
/**
 * Pembatas akses viewer arsip backup.
 *
 * Viewer ini hanya untuk dijalankan di mesin operator (XAMPP/`php -S`), bukan
 * untuk dipublikasikan. Karena itu akses dibatasi ke loopback dan semua respons
 * diberi header yang mencegah cache/frame.
 */

declare(strict_types=1);

/** True bila alamat remote adalah loopback (127.0.0.0/8 atau ::1). */
function bv_is_loopback(string $ip): bool
{
    $value = trim($ip);
    if ($value === '') {
        return false;
    }
    if ($value === '::1' || $value === '0:0:0:0:0:0:0:1') {
        return true;
    }
    if (strpos($value, '::ffff:') === 0) {
        $value = substr($value, 7);
    }
    return strpos($value, '127.') === 0;
}

function bv_client_ip(): string
{
    return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
}

/** Menghentikan permintaan bila bukan dari loopback. */
function bv_guard_loopback(): void
{
    if (PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server') {
        return; // `php -S 127.0.0.1:8080` sudah membatasi ke loopback.
    }
    if (!bv_is_loopback(bv_client_ip())) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Viewer arsip hanya dapat dibuka dari komputer lokal (127.0.0.1).\n";
        exit;
    }
}

function bv_send_headers(): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
}
