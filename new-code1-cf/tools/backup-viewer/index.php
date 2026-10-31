<?php
/**
 * Viewer arsip backup INHAL — read-only, untuk server lokal (XAMPP/php -S).
 *
 * Membaca artefak CSV hasil `new-code1-cf/scripts/backup-snapshot.mjs`:
 *   data/<label>/manifest.csv
 *   data/<label>/<tabel>.csv
 *
 * Tidak ada penulisan, penghapusan, SQL, atau unggah berkas.
 */

declare(strict_types=1);

require __DIR__ . '/lib/guard.php';
require __DIR__ . '/lib/csv.php';

bv_guard_loopback();

$dataDir = __DIR__ . '/data';
$label = isset($_GET['label']) ? trim((string) $_GET['label']) : '';
$table = isset($_GET['t']) ? trim((string) $_GET['t']) : '';
$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
$perPage = isset($_GET['per']) ? (int) $_GET['per'] : 100;
if (!in_array($perPage, BV_PER_PAGE, true)) {
    $perPage = 100;
}

$labelDir = ($label !== '' && bv_safe_table($label)) ? $dataDir . DIRECTORY_SEPARATOR . $label : '';
if ($labelDir !== '' && !is_dir($labelDir)) {
    $labelDir = '';
    $label = '';
}

// Ekspor CSV asli (streaming, tanpa menulis berkas baru).
if ($labelDir !== '' && $table !== '' && isset($_GET['export'])) {
    $exportPath = bv_table_path($labelDir, $table);
    if ($exportPath !== '') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $table . '.csv"');
        header('Content-Length: ' . (string) filesize($exportPath));
        header('Cache-Control: no-store, max-age=0');
        readfile($exportPath);
        exit;
    }
}

bv_send_headers();
$labels = bv_labels($dataDir);
$tables = $labelDir !== '' ? bv_manifest_rows($labelDir . DIRECTORY_SEPARATOR . BV_MANIFEST) : [];
$tableNames = array_map(static fn(array $t): string => (string) $t['tabel'], $tables);

$activeTable = in_array($table, $tableNames, true) ? $table : '';
$data = ['header' => [], 'rows' => [], 'total' => 0, 'matched' => 0];
$pager = bv_paginate(0, $perPage, 1);
if ($activeTable !== '') {
    $activePath = bv_table_path($labelDir, $activeTable);
    if ($activePath !== '') {
        $probe = bv_read_table($activePath, $query, 0, 0);
        $pager = bv_paginate($probe['matched'], $perPage, $page);
        $data = bv_read_table($activePath, $query, $pager['offset'], $perPage);
        $pager = bv_paginate($data['matched'], $perPage, $pager['page']);
    }
}

function bv_url(array $params): string
{
    $clean = array_filter($params, static fn($v): bool => $v !== '' && $v !== null);
    return '?' . http_build_query($clean);
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arsip Backup INHAL</title>
<style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;background:#f1f5f9;color:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px}
    a{color:#4f46e5;text-decoration:none}
    a:hover{text-decoration:underline}
    .wrap{max-width:74rem;margin:0 auto;padding:1.25rem}
    .card{background:#fff;border-radius:1rem;box-shadow:0 1px 2px rgba(15,23,42,.06);padding:1rem 1.15rem;margin-bottom:1rem}
    h1{font-size:1.05rem;margin:0 0 .15rem}
    .sub{font-size:.75rem;color:#64748b;margin:0}
    .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
    .chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;background:#eef2ff;color:#4338ca;border-radius:999px;padding:.2rem .6rem}
    .chip.grey{background:#f1f5f9;color:#475569}
    .chip.amber{background:#fffbeb;color:#b45309}
    input[type=search]{flex:1 1 16rem;min-width:12rem;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:.6rem;font:inherit}
    button,.btn{font:inherit;font-weight:700;font-size:.78rem;padding:.4rem .8rem;border-radius:.6rem;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;display:inline-block}
    button:hover,.btn:hover{background:#f8fafc}
    .btn.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}
    table{width:100%;border-collapse:collapse;font-size:.78rem}
    th,td{text-align:left;padding:.4rem .55rem;border-bottom:1px solid #eef2f7;vertical-align:top}
    th{position:sticky;top:0;background:#f8fafc;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
    td{max-width:26rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .scroll{max-height:65vh;overflow:auto;border:1px solid #eef2f7;border-radius:.75rem}
    .tables{display:flex;flex-wrap:wrap;gap:.4rem}
    .tables a{font-size:.75rem;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.55rem;padding:.3rem .6rem;color:#334155}
    .tables a.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
    .empty{padding:1.5rem;text-align:center;color:#64748b;font-size:.85rem}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem}
</style>
</head>
<body>
<div class="wrap">
    <div class="card">
        <h1>Arsip Backup INHAL</h1>
        <p class="sub">Baca-saja dari artefak <code>&lt;label&gt;-csv/</code>. Tidak ada penulisan ke data apa pun.</p>
        <div class="row" style="margin-top:.6rem">
            <span class="chip grey">Label: <?= bv_h($label !== '' ? $label : '-') ?></span>
            <span class="chip grey">Tabel: <?= bv_h((string) count($tables)) ?></span>
            <?php if ($activeTable !== ''): ?>
                <span class="chip">Baris: <?= bv_h((string) $data['total']) ?></span>
                <?php if ($query !== ''): ?><span class="chip amber">Cocok: <?= bv_h((string) $data['matched']) ?></span><?php endif; ?>
                <a class="btn" href="<?= bv_h(bv_url(['label' => $label, 't' => $activeTable, 'export' => '1'])) ?>">Unduh CSV</a>
            <?php endif; ?>
            <?php if ($label !== ''): ?><a class="btn" href="./">Ganti label</a><?php endif; ?>
        </div>
    </div>

    <?php if (!$labels): ?>
        <div class="card">
            <div class="empty">
                Belum ada arsip. Salin folder <code>&lt;label&gt;-csv/</code> hasil backup ke
                <code>tools/backup-viewer/data/&lt;label&gt;/</code> (harus berisi <code>manifest.csv</code>).
            </div>
        </div>
    <?php elseif ($label === ''): ?>
        <div class="card">
            <div class="row" style="margin-bottom:.6rem"><strong style="font-size:.85rem">Pilih arsip</strong></div>
            <table>
                <thead><tr><th>Label</th><th>Tabel</th><th>Total baris</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($labels as $item): ?>
                    <tr>
                        <td><strong><?= bv_h($item['label']) ?></strong></td>
                        <td><?= bv_h((string) $item['tables']) ?></td>
                        <td><?= bv_h((string) $item['rows']) ?></td>
                        <td><a href="<?= bv_h(bv_url(['label' => $item['label']])) ?>">Buka</a></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="card">
            <div class="tables">
                <?php foreach ($tables as $item): ?>
                    <a class="<?= $item['tabel'] === $activeTable ? 'active' : '' ?>"
                       href="<?= bv_h(bv_url(['label' => $label, 't' => $item['tabel']])) ?>">
                        <?= bv_h($item['tabel']) ?> <span style="opacity:.65">(<?= bv_h($item['baris']) ?>)</span>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
        <?php if ($activeTable === ''): ?>
            <div class="card"><div class="empty">Pilih tabel di atas untuk melihat isinya.</div></div>
        <?php else: ?>
            <div class="card">
                <form method="get" class="row" style="margin-bottom:.7rem">
                    <input type="hidden" name="label" value="<?= bv_h($label) ?>">
                    <input type="hidden" name="t" value="<?= bv_h($activeTable) ?>">
                    <input type="hidden" name="per" value="<?= bv_h((string) $perPage) ?>">
                    <input type="search" name="q" value="<?= bv_h($query) ?>" placeholder="Cari di tabel <?= bv_h($activeTable) ?>...">
                    <button type="submit" class="primary">Cari</button>
                    <?php if ($query !== ''): ?>
                        <a class="btn" href="<?= bv_h(bv_url(['label' => $label, 't' => $activeTable])) ?>">Reset</a>
                    <?php endif; ?>
                    <span class="chip grey">Halaman <?= bv_h((string) $pager['page']) ?>/<?= bv_h((string) $pager['pages']) ?></span>
                    <?php if ($pager['hasPrev']): ?>
                        <a class="btn" href="<?= bv_h(bv_url(['label' => $label, 't' => $activeTable, 'q' => $query, 'per' => (string) $perPage, 'page' => (string) ($pager['page'] - 1)])) ?>">&laquo; Sebelumnya</a>
                    <?php endif; ?>
                    <?php if ($pager['hasNext']): ?>
                        <a class="btn" href="<?= bv_h(bv_url(['label' => $label, 't' => $activeTable, 'q' => $query, 'per' => (string) $perPage, 'page' => (string) ($pager['page'] + 1)])) ?>">Berikutnya &raquo;</a>
                    <?php endif; ?>
                </form>

                <?php if (!$data['header']): ?>
                    <div class="empty">Tabel kosong atau berkas tidak ditemukan.</div>
                <?php else: ?>
                    <div class="scroll">
                        <table>
                            <thead><tr>
                                <th>#</th>
                                <?php foreach ($data['header'] as $column): ?><th><?= bv_h((string) $column) ?></th><?php endforeach; ?>
                            </tr></thead>
                            <tbody>
                            <?php if (!$data['rows']): ?>
                                <tr><td colspan="<?= bv_h((string) (count($data['header']) + 1)) ?>">
                                    <div class="empty">Tidak ada baris yang cocok.</div>
                                </td></tr>
                            <?php endif; ?>
                            <?php foreach ($data['rows'] as $index => $row): ?>
                                <tr>
                                    <td style="color:#94a3b8"><?= bv_h((string) ($pager['offset'] + $index + 1)) ?></td>
                                    <?php foreach ($data['header'] as $position => $column): ?>
                                        <?php $cell = isset($row[$position]) ? (string) $row[$position] : ''; ?>
                                        <td title="<?= bv_h($cell) ?>"><?= bv_h($cell === '' ? '—' : $cell) ?></td>
                                    <?php endforeach; ?>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    <?php endif; ?>

    <p class="sub" style="text-align:center;padding:.5rem 0 1rem">
        Data arsip bersifat rahasia. Jangan menaruh folder ini di server yang dapat diakses publik.
    </p>
</div>
</body>
</html>
