<?php
/**
 * Pembacaan artefak CSV hasil `scripts/backup-snapshot.mjs`.
 *
 * Semua fungsi hanya membaca berkas: tidak ada penulisan, penghapusan, atau
 * query SQL. Nama tabel selalu divalidasi sebelum dipakai membentuk path.
 */

declare(strict_types=1);

const BV_MANIFEST = 'manifest.csv';
const BV_PER_PAGE = [50, 100, 250];

/** Nama tabel yang aman dipakai sebagai nama berkas. */
function bv_safe_table(string $name): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_]+$/', $name);
}

/** Label = nama subfolder di `data/` yang berisi manifest.csv. */
function bv_labels(string $dataDir): array
{
    $out = [];
    if (!is_dir($dataDir)) {
        return $out;
    }
    foreach (scandir($dataDir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $dir = $dataDir . DIRECTORY_SEPARATOR . $entry;
        if (!is_dir($dir) || !is_file($dir . DIRECTORY_SEPARATOR . BV_MANIFEST)) {
            continue;
        }
        $tables = bv_manifest_rows($dir . DIRECTORY_SEPARATOR . BV_MANIFEST);
        $rows = 0;
        foreach ($tables as $table) {
            $rows += (int) $table['baris'];
        }
        $out[] = ['label' => $entry, 'tables' => count($tables), 'rows' => $rows];
    }
    usort($out, static fn(array $a, array $b): int => strcmp($b['label'], $a['label']));
    return $out;
}

/** Isi manifest.csv sebagai daftar asosiatif (tabel, file, baris, kolom, bytes, sha256). */
function bv_manifest_rows(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        return [];
    }
    $header = fgetcsv($handle, 0, ',', '"', '\\');
    $out = [];
    if (is_array($header)) {
        $header = array_map(static fn($v): string => strtolower(trim((string) $v)), $header);
        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            if (!is_array($row) || count($row) === 0) {
                continue;
            }
            $item = [];
            foreach ($header as $index => $key) {
                $item[$key] = isset($row[$index]) ? (string) $row[$index] : '';
            }
            if (isset($item['tabel']) && bv_safe_table($item['tabel'])) {
                $out[] = $item;
            }
        }
    }
    fclose($handle);
    return $out;
}

/** Path CSV untuk satu tabel, atau '' bila tidak valid/tidak ada. */
function bv_table_path(string $dir, string $table): string
{
    if (!bv_safe_table($table)) {
        return '';
    }
    $path = $dir . DIRECTORY_SEPARATOR . $table . '.csv';
    return is_file($path) ? $path : '';
}

/**
 * Membaca satu tabel dengan header + pencarian + paginasi.
 *
 * @return array{header: array<int,string>, rows: array<int,array<int,string>>, total: int, matched: int}
 */
function bv_read_table(string $path, string $query, int $offset, int $limit): array
{
    $result = ['header' => [], 'rows' => [], 'total' => 0, 'matched' => 0];
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        return $result;
    }

    $header = fgetcsv($handle, 0, ',', '"', '\\');
    $result['header'] = is_array($header) ? array_map(static fn($v): string => (string) $v, $header) : [];
    $needle = function_exists('mb_strtolower') ? mb_strtolower($query) : strtolower($query);
    $index = 0;

    while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
        if (!is_array($row) || (count($row) === 1 && $row[0] === null)) {
            continue;
        }
        $result['total']++;
        $cells = array_map(static fn($v): string => (string) $v, $row);

        if ($needle !== '') {
            $haystack = function_exists('mb_strtolower') ? mb_strtolower(implode(' ', $cells)) : strtolower(implode(' ', $cells));
            if (strpos($haystack, $needle) === false) {
                continue;
            }
        }

        $result['matched']++;
        if ($result['matched'] > $offset && count($result['rows']) < $limit) {
            $result['rows'][] = $cells;
        }
    }

    fclose($handle);
    return $result;
}

/** Ukuran berkas dalam bentuk manusiawi. */
function bv_human_bytes(int $bytes): string
{
    if ($bytes <= 0) {
        return '0 B';
    }
    if ($bytes < 1024) {
        return $bytes . ' B';
    }
    if ($bytes < 1024 * 1024) {
        return number_format($bytes / 1024, 1, ',', '.') . ' KB';
    }
    return number_format($bytes / (1024 * 1024), 2, ',', '.') . ' MB';
}

/** Perhitungan paginasi sederhana. */
function bv_paginate(int $total, int $perPage, int $page): array
{
    $perPage = $perPage > 0 ? $perPage : 100;
    $pages = max(1, (int) ceil($total / $perPage));
    $current = min(max(1, $page), $pages);
    return [
        'pages' => $pages,
        'page' => $current,
        'offset' => ($current - 1) * $perPage,
        'perPage' => $perPage,
        'hasPrev' => $current > 1,
        'hasNext' => $current < $pages,
    ];
}

/** Escape HTML singkat. */
function bv_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
