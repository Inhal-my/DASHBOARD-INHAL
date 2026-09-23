<?php

namespace App\Commands;

use App\Libraries\SheetImportService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class SheetImport extends BaseCommand
{
    protected $group       = 'INHAL';
    protected $name        = 'sheet:import';
    protected $description = 'Impor data dari Google Spreadsheet ke MySQL (replace-all).';
    protected $usage       = 'sheet:import [--dry-run] [--tabs=Pengajuan,Mahasiswa] [--no-files] [--sheet-id=...]';
    protected $options     = [
        '--dry-run'   => 'Hanya tampilkan rencana dan jumlah baris, tidak menulis ke database.',
        '--tabs'      => 'Batasi ke tab tertentu (dipisah koma), mis. "Pengajuan,Mahasiswa".',
        '--no-files'  => 'Lewati pengunduhan berkas Google Drive.',
        '--sheet-id'  => 'Ganti ID spreadsheet sumber.',
    ];

    public function run(array $params)
    {
        $dryRun   = (bool) CLI::getOption('dry-run');
        $noFiles  = (bool) CLI::getOption('no-files');
        $sheetId  = (string) (CLI::getOption('sheet-id') ?? '');
        $tabsRaw  = (string) (CLI::getOption('tabs') ?? '');
        $tabs     = $tabsRaw === '' ? null : array_values(array_filter(array_map('trim', explode(',', $tabsRaw))));

        $service = new SheetImportService($sheetId !== '' ? $sheetId : null);

        CLI::write('Sheet ID: ' . ($sheetId !== '' ? $sheetId : SheetImportService::DEFAULT_SHEET_ID), 'yellow');
        if ($dryRun) {
            CLI::write('Mode: DRY-RUN (tidak menulis)', 'yellow');
        }
        if ($tabs !== null) {
            CLI::write('Tab: ' . implode(', ', $tabs), 'yellow');
        }

        $started = microtime(true);
        try {
            $result = $service->run([
                'dryRun'        => $dryRun,
                'downloadFiles' => !$noFiles,
                'tabs'          => $tabs,
            ]);
        } catch (\Throwable $e) {
            CLI::error('Import gagal: ' . $e->getMessage());

            return EXIT_ERROR;
        }

        CLI::newLine();
        $rows = [];
        foreach ($result['stats'] as $table => $count) {
            $rows[] = [$table, (string) $count];
        }
        CLI::table($rows, ['Tabel', 'Baris']);

        if (!$dryRun) {
            CLI::write('Berkas diunduh: ' . $result['files']['downloaded'] . ', gagal: ' . $result['files']['failed'], 'green');
        }
        foreach ($result['warnings'] as $warning) {
            CLI::write('PERINGATAN: ' . $warning, 'red');
        }
        CLI::write('Selesai dalam ' . number_format(microtime(true) - $started, 2) . ' detik.', 'green');

        return EXIT_SUCCESS;
    }
}
