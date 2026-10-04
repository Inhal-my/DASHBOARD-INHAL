<?php

namespace App\Libraries;

use Config\Database;

class SheetImportService
{
    public const DEFAULT_SHEET_ID = '1awscv3N22hW9XMddsgk21p135Q8NOFXUcylH6BcJ518';

    private string $sheetId;
    private string $uploadsDir;
    private array $log = [];
    private array $warnings = [];
    private array $pengajuanMap = [];

    public function __construct(?string $sheetId = null, ?string $uploadsDir = null)
    {
        $this->sheetId    = $sheetId !== null && $sheetId !== '' ? $sheetId : self::DEFAULT_SHEET_ID;
        $this->uploadsDir = $uploadsDir !== null && $uploadsDir !== ''
            ? rtrim($uploadsDir, '/')
            : (defined('WRITEPATH') ? WRITEPATH . 'uploads' : sys_get_temp_dir());
    }

    public function getLog(): array
    {
        return $this->log;
    }

    public function getWarnings(): array
    {
        return $this->warnings;
    }

    public function specs(): array
    {
        return [
            'mahasiswa' => [
                'tab'   => 'Mahasiswa',
                'map'   => [
                    'npm'          => 'NPM',
                    'nama_lengkap' => 'Nama Lengkap',
                    'email'        => 'Email',
                    'blok'         => 'Blok',
                    'keterangan'   => 'Keterangan',
                ],
            ],
            'master_kegiatan' => [
                'tab' => 'MasterKegiatan',
                'map' => ['kategori' => 'Kategori', 'nilai' => 'Nilai'],
            ],
            'master_bagian' => [
                'tab' => 'MasterBagian',
                'map' => [
                    'lab'          => 'Lab',
                    'kegiatan_lab' => 'Kegiatan Lab',
                    'bagian'       => 'Bagian',
                    'email'        => 'Email',
                ],
            ],
            'master_biaya' => [
                'tab'     => 'MasterBiaya',
                'map'     => ['kegiatan' => 'Kegiatan', 'biaya' => 'Biaya'],
                'decimal' => ['biaya'],
            ],
            'config' => [
                'tab' => 'Config',
                'map' => ['config_key' => 'Key', 'config_value' => 'Value'],
            ],
            'admin' => [
                'tab'        => 'Admin',
                'positional' => ['password_hash' => 0, 'nama' => 1],
                'hash'       => ['password_hash'],
            ],
            'bagian_staff' => [
                'tab'        => 'BagianStaff',
                'positional' => ['email' => 0, 'kategori' => 1, 'nama' => 2, 'password_hash' => 3],
                'hash'       => ['password_hash'],
            ],
            'pengajuan' => [
                'tab'          => 'Pengajuan',
                'map'          => [
                    'timestamp'              => 'Timestamp',
                    'id_pengajuan'           => 'ID Pengajuan',
                    'npm'                    => 'NPM',
                    'nama_lengkap'           => 'Nama Lengkap',
                    'email'                  => 'Email',
                    'no_hp_wa'               => 'No. HP/WA',
                    'blok'                   => 'Blok',
                    'jenis_kegiatan'         => 'Jenis Kegiatan',
                    'keterangan'             => 'Keterangan',
                    'link_surat_keterangan'  => 'Link Surat Keterangan',
                    'status'                 => 'Status',
                    'catatan_admin'          => 'Catatan Admin',
                    'notifikasi_terkirim_pada' => 'Notifikasi Terkirim Pada',
                    'status_notifikasi_email'  => 'Status Notifikasi Email',
                    'error_notifikasi_email'   => 'Error Notifikasi Email',
                    'nomor_surat'            => 'Nomor Surat',
                    'path_acc_inhal'         => 'Link ACC INHAL',
                    'path_bukti_bayar'       => 'Link Bukti Bayar',
                    'path_final'             => 'Link Final',
                    'status_info_bagian'     => 'Status Info Bagian',
                    'waktu_info_bagian'      => 'Waktu Info Bagian',
                    'email_bagian'           => 'Email Bagian',
                    'catatan_info_bagian'    => 'Catatan Info Bagian',
                    'updated_at'             => 'UpdatedAt',
                    'dosen'                  => 'Dosen',
                    'tanggal_pelaksanaan'    => 'Tanggal Pelaksanaan',
                    'lampiran_email'         => 'Lampiran Email',
                ],
                'date'         => ['tanggal_pelaksanaan'],
                'datetime'     => ['timestamp', 'notifikasi_terkirim_pada', 'waktu_info_bagian', 'updated_at'],
                'files'        => ['path_acc_inhal' => 'acc', 'path_bukti_bayar' => 'bukti', 'path_final' => 'final'],
                'fileBase'     => 'ID Pengajuan',
                'defaults'     => ['status' => 'Menunggu'],
                'normalize'    => ['status_notifikasi_email' => ['berhasil' => 'Terkirim']],
            ],
            'detail_kegiatan' => [
                'tab'      => 'DetailKegiatan',
                'map'      => [
                    'timestamp'           => 'Timestamp',
                    'id_pengajuan'        => 'ID Pengajuan',
                    'jenis_kegiatan'      => 'Jenis Kegiatan',
                    'pilihan'             => 'Pilihan',
                    'detail'              => 'Detail',
                    'tanggal_pelaksanaan' => 'Tanggal Pelaksanaan',
                    'bagian'              => 'Bagian',
                ],
                'datetime' => ['timestamp'],
                'date'     => ['tanggal_pelaksanaan'],
                'fk'       => ['pengajuan_id' => 'ID Pengajuan'],
            ],
            'status_history' => [
                'tab'      => 'StatusHistory',
                'map'      => [
                    'timestamp'    => 'Timestamp',
                    'id_pengajuan' => 'ID Pengajuan',
                    'status'       => 'Status',
                    'catatan'      => 'Catatan',
                    'actor_email'  => 'Actor Email',
                ],
                'datetime' => ['timestamp'],
                'fk'       => ['pengajuan_id' => 'ID Pengajuan'],
            ],
            'check_data' => [
                'tab'      => 'CheckData',
                'map'      => [
                    'check_id'            => 'Check ID',
                    'id_pengajuan'        => 'ID Pengajuan',
                    'timestamp'           => 'Timestamp',
                    'npm'                 => 'NPM',
                    'nama_lengkap'        => 'Nama Lengkap',
                    'blok'                => 'Blok',
                    'jenis_kegiatan'      => 'Jenis Kegiatan',
                    'pilihan'             => 'Pilihan',
                    'detail'              => 'Detail',
                    'tanggal_pelaksanaan' => 'Tanggal Pelaksanaan',
                    'bagian'              => 'Bagian',
                    'dosen'               => 'Dosen',
                    'hadir'               => 'Hadir',
                    'catatan'             => 'Catatan',
                    'biaya'               => 'Biaya',
                    'updated_at'          => 'UpdatedAt',
                ],
                'datetime' => ['timestamp', 'updated_at'],
                'date'     => ['tanggal_pelaksanaan'],
                'int'      => ['hadir'],
                'decimal'  => ['biaya'],
                'fk'       => ['pengajuan_id' => 'ID Pengajuan'],
            ],
            'berita_acara' => [
                'tab'      => 'BeritaAcara',
                'map'      => [
                    'timestamp'           => 'Timestamp',
                    'ba_id'               => 'BA ID',
                    'bagian'              => 'Bagian',
                    'blok'                => 'Blok',
                    'nama_kegiatan'       => 'Nama Kegiatan',
                    'tanggal_pelaksanaan' => 'Tanggal Pelaksanaan',
                    'jumlah_peserta'      => 'Jumlah Peserta',
                    'file_name'           => 'File Name',
                    'file_path'           => 'File URL',
                    'catatan'             => 'Catatan',
                    'sumber'              => 'Sumber',
                ],
                'datetime' => ['timestamp'],
                'date'     => ['tanggal_pelaksanaan'],
                'int'      => ['jumlah_peserta'],
                'files'    => ['file_path' => 'ba'],
                'fileBase' => 'BA ID',
                'remap'    => ['source' => 'BA ID', 'key' => 'ba_id'],
                'defaults' => ['sumber' => 'Bagian', 'jumlah_peserta' => 0],
            ],
            'berita_acara_peserta' => [
                'tab'        => 'BeritaAcaraPeserta',
                'remapApply' => 'ba_id',
                'map' => [
                    'timestamp'        => 'Timestamp',
                    'ba_id'            => 'BA ID',
                    'npm'              => 'NPM',
                    'nama_lengkap'     => 'Nama Lengkap',
                    'blok'             => 'Blok',
                    'bagian'           => 'Bagian',
                    'status_pengajuan' => 'Status Pengajuan',
                ],
                'datetime' => ['timestamp'],
            ],
            'berita_acara_admin' => [
                'tab'      => 'BeritaAcaraAdmin',
                'map'      => [
                    'timestamp'           => 'Timestamp',
                    'ba_id'               => 'BA ID',
                    'bagian'              => 'Bagian',
                    'blok'                => 'Blok',
                    'nama_kegiatan'       => 'Nama Kegiatan',
                    'tanggal_pelaksanaan' => 'Tanggal Pelaksanaan',
                    'jumlah_peserta'      => 'Jumlah Peserta',
                    'file_name'           => 'File Name',
                    'file_path'           => 'File URL',
                    'catatan'             => 'Catatan',
                    'sumber'              => 'Sumber',
                ],
                'datetime' => ['timestamp'],
                'date'     => ['tanggal_pelaksanaan'],
                'int'      => ['jumlah_peserta'],
                'files'    => ['file_path' => 'ba'],
                'fileBase' => 'BA ID',
                'defaults' => ['sumber' => 'Admin', 'jumlah_peserta' => 0],
            ],
            'berita_acara_admin_peserta' => [
                'tab' => 'BeritaAcaraAdminPeserta',
                'map' => [
                    'timestamp'        => 'Timestamp',
                    'ba_id'            => 'BA ID',
                    'npm'              => 'NPM',
                    'nama_lengkap'     => 'Nama Lengkap',
                    'blok'             => 'Blok',
                    'bagian'           => 'Bagian',
                    'status_pengajuan' => 'Status Pengajuan',
                ],
                'datetime' => ['timestamp'],
            ],
            'audit_log' => [
                'tab'      => 'AuditLog',
                'map'      => [
                    'timestamp'   => 'Timestamp',
                    'actor_email' => 'Actor Email',
                    'aksi'        => 'Aksi',
                    'target'      => 'Target',
                    'detail'      => 'Detail',
                    'alasan'      => 'Alasan',
                ],
                'datetime' => ['timestamp'],
            ],
            'nomor_surat' => [
                'tab' => 'NomorSurat',
                'map' => [
                    'type'        => 'Type',
                    'tahun'       => 'Tahun',
                    'last_number' => 'LastNumber',
                    'updated_at'  => 'UpdatedAt',
                ],
                'int'      => ['tahun', 'last_number'],
                'datetime' => ['updated_at'],
            ],
        ];
    }

    public function deleteOrder(): array
    {
        return [
            'berita_acara_peserta',
            'berita_acara_admin_peserta',
            'berita_acara_admin',
            'berita_acara',
            'check_data',
            'status_history',
            'detail_kegiatan',
            'pengajuan',
            'audit_log',
            'nomor_surat',
            'config',
            'master_biaya',
            'master_bagian',
            'master_kegiatan',
            'mahasiswa',
            'bagian_staff',
            'admin',
        ];
    }

    public function insertOrder(): array
    {
        return [
            'mahasiswa',
            'master_kegiatan',
            'master_bagian',
            'master_biaya',
            'config',
            'admin',
            'bagian_staff',
            'pengajuan',
            'detail_kegiatan',
            'status_history',
            'check_data',
            'berita_acara',
            'berita_acara_peserta',
            'berita_acara_admin',
            'berita_acara_admin_peserta',
            'audit_log',
            'nomor_surat',
        ];
    }

    public function uniqueKeys(): array
    {
        return [
            'mahasiswa'       => [['npm']],
            'master_kegiatan' => [['kategori', 'nilai']],
            'config'          => [['config_key']],
            'bagian_staff'    => [['email']],
            'pengajuan'       => [['id_pengajuan']],
            'check_data'      => [['check_id']],
            'berita_acara'    => [['ba_id'], ['bagian', 'blok', 'nama_kegiatan', 'tanggal_pelaksanaan']],
            'berita_acara_admin' => [['ba_id']],
            'nomor_surat'     => [['type', 'tahun']],
        ];
    }

    public function requiredColumns(): array
    {
        return [
            'pengajuan'     => ['id_pengajuan', 'timestamp', 'npm', 'nama_lengkap', 'email', 'no_hp_wa', 'status'],
            'check_data'    => ['check_id', 'timestamp'],
            'berita_acara'  => ['ba_id', 'timestamp'],
            'berita_acara_admin' => ['ba_id', 'timestamp'],
            'berita_acara_peserta' => ['ba_id', 'timestamp'],
            'berita_acara_admin_peserta' => ['ba_id', 'timestamp'],
            'detail_kegiatan' => ['id_pengajuan', 'timestamp', 'pengajuan_id'],
            'status_history' => ['id_pengajuan', 'timestamp', 'pengajuan_id'],
            'admin'         => ['password_hash', 'nama'],
            'bagian_staff'  => ['email', 'password_hash'],
        ];
    }

    public function run(array $opts = []): array
    {
        $dryRun      = !empty($opts['dryRun']);
        $download    = array_key_exists('downloadFiles', $opts) ? (bool) $opts['downloadFiles'] : true;
        $onlyTabs    = $opts['tabs'] ?? null;
        $stats       = [];
        $fileStats   = ['downloaded' => 0, 'failed' => 0];
        $specs       = $this->specs();

        $prepared = [];
        foreach ($this->insertOrder() as $table) {
            $spec = $specs[$table];
            if (is_array($onlyTabs) && $onlyTabs !== [] && !in_array($spec['tab'], $onlyTabs, true) && !in_array($table, $onlyTabs, true)) {
                continue;
            }
            $tableData = $this->fetchTab($spec['tab']);
            $records   = isset($spec['positional'])
                ? $this->tableToPositional($tableData, $spec['positional'])
                : $this->tableToRecords($tableData);
            $prepared[$table] = $records;
            $stats[$table]    = count($records);
        }

        $result = [
            'dryRun'    => $dryRun,
            'sheetId'   => $this->sheetId,
            'stats'     => $stats,
            'files'     => $fileStats,
            'warnings'  => [],
            'log'       => [],
        ];

        if ($dryRun) {
            $this->log[]        = 'Dry-run: tidak ada perubahan pada database.';
            $result['warnings'] = $this->warnings;
            $result['log']      = $this->log;

            return $result;
        }

        $db = Database::connect();
        $db->query('SET FOREIGN_KEY_CHECKS=0');
        foreach ($this->deleteOrder() as $table) {
            if (!array_key_exists($table, $prepared)) {
                continue;
            }
            $db->query('DELETE FROM `' . $table . '`');
        }
        $db->query('SET FOREIGN_KEY_CHECKS=1');

        $remaps = [];
        foreach ($this->insertOrder() as $table) {
            if (!array_key_exists($table, $prepared)) {
                continue;
            }
            $spec         = $specs[$table];
            $rows         = [];
            $seen         = [];
            $skipped      = 0;
            $uniqueGroups = $this->uniqueKeys()[$table] ?? [];
            foreach ($prepared[$table] as $record) {
                $row = $this->buildRow($table, $spec, $record, $download, $fileStats);
                if ($row === null) {
                    $skipped++;
                    continue;
                }
                if (isset($spec['remapApply'])) {
                    $remapKey = $spec['remapApply'];
                    $current  = (string) ($row[$remapKey] ?? '');
                    if (isset($remaps[$remapKey][$current])) {
                        $row[$remapKey] = $remaps[$remapKey][$current];
                    }
                }
                $duplicate = false;
                $dupKey    = null;
                foreach ($uniqueGroups as $group) {
                    $groupKey = $this->dedupeKey($table, $group, $row);
                    if (isset($seen[$groupKey])) {
                        $duplicate = true;
                        $dupKey    = $groupKey;
                        break;
                    }
                }
                if ($duplicate) {
                    if (isset($spec['remap']) && $dupKey !== null && $seen[$dupKey] !== true) {
                        $old = (string) ($record[$spec['remap']['source']] ?? '');
                        if ($old !== '') {
                            $remaps[$spec['remap']['key']][$old] = $seen[$dupKey];
                        }
                    }
                    $skipped++;
                    continue;
                }
                foreach ($uniqueGroups as $group) {
                    $groupKey        = $this->dedupeKey($table, $group, $row);
                    $seen[$groupKey] = isset($spec['remap']) ? ($row[$spec['remap']['key']] ?? true) : true;
                }
                $rows[] = $row;
            }
            if ($skipped > 0) {
                $this->warnings[] = $table . ': ' . $skipped . ' baris dilewati (duplikat/kolom wajib kosong).';
            }
            try {
                if ($rows !== []) {
                    $db->table($table)->insertBatch($rows);
                }
                $stats[$table] = count($rows);
            } catch (\Throwable $e) {
                $this->warnings[] = 'Gagal impor tabel ' . $table . ': ' . $e->getMessage();
                $stats[$table]    = 0;
            }
            if ($table === 'pengajuan') {
                $this->pengajuanMap = [];
                foreach ($db->table('pengajuan')->select('id, id_pengajuan')->get()->getResultArray() as $r) {
                    $this->pengajuanMap[(string) $r['id_pengajuan']] = (int) $r['id'];
                }
            }
            $this->log[] = $table . ': ' . $stats[$table] . ' baris';
        }

        $result['stats']    = $stats;
        $result['files']    = $fileStats;
        $result['warnings'] = $this->warnings;
        $result['log']      = $this->log;

        return $result;
    }

    public function fetchTab(string $tab): array
    {
        $url = 'https://docs.google.com/spreadsheets/d/' . rawurlencode($this->sheetId)
            . '/gviz/tq?tqx=out:json&sheet=' . rawurlencode($tab);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_USERAGENT      => 'Mozilla/5.0',
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($body === false || $body === '') {
            throw new \RuntimeException('Gagal mengambil tab ' . $tab . ': ' . ($err !== '' ? $err : 'respons kosong'));
        }
        $start = strpos($body, '{');
        $end   = strrpos($body, '}');
        if ($start === false || $end === false || $end <= $start) {
            throw new \RuntimeException('Respons gviz tidak valid untuk tab ' . $tab);
        }
        $json = json_decode(substr($body, $start, $end - $start + 1), true);
        if (!is_array($json) || !isset($json['table'])) {
            throw new \RuntimeException('Tabel gviz tidak ditemukan pada tab ' . $tab);
        }

        return $json['table'];
    }

    public function tableToRecords(array $table): array
    {
        $cols   = $table['cols'] ?? [];
        $labels = array_map(static fn ($c) => (string) ($c['label'] ?? ''), $cols);
        $hasLabels = false;
        foreach ($labels as $label) {
            if (trim($label) !== '') {
                $hasLabels = true;
                break;
            }
        }
        $rows = $table['rows'] ?? [];
        if ($rows === []) {
            return [];
        }
        if ($hasLabels) {
            $records = [];
            foreach ($rows as $row) {
                $record = [];
                foreach ($labels as $i => $label) {
                    if (trim($label) === '') {
                        continue;
                    }
                    $record[$label] = $this->cellValue($row['c'][$i] ?? null);
                }
                $records[] = $record;
            }

            return $records;
        }

        $header  = array_map(fn ($c) => $this->cellValue($c), $rows[0]['c'] ?? []);
        $records = [];
        foreach (array_slice($rows, 1) as $row) {
            $record = [];
            foreach ($header as $i => $label) {
                if ($label === '') {
                    continue;
                }
                $record[$label] = $this->cellValue($row['c'][$i] ?? null);
            }
            $records[] = $record;
        }

        return $records;
    }

    public function tableToPositional(array $table, array $map): array
    {
        $rows = $table['rows'] ?? [];
        if ($rows === []) {
            return [];
        }
        $records = [];
        foreach (array_slice($rows, 1) as $row) {
            $record = [];
            foreach ($map as $col => $idx) {
                $record[$col] = $this->cellValue($row['c'][$idx] ?? null);
            }
            $records[] = $record;
        }

        return $records;
    }

    public function cellValue($cell): string
    {
        if (!is_array($cell) || !array_key_exists('v', $cell) || $cell['v'] === null || $cell['v'] === '') {
            return '';
        }
        $v = $cell['v'];
        if (is_string($v) && preg_match('/^Date\((\d+),(\d+)(?:,(\d+))?(?:,(\d+),(\d+),(\d+))?\)$/', $v, $m)) {
            $pad  = static fn ($n) => str_pad((string) (int) $n, 2, '0', STR_PAD_LEFT);
            $base = sprintf('%04d-%s-%s', (int) $m[1], $pad((int) $m[2] + 1), $pad(isset($m[3]) && $m[3] !== '' ? (int) $m[3] : 1));
            if (isset($m[4]) && $m[4] !== '') {
                return $base . ' ' . $pad($m[4]) . ':' . $pad($m[5]) . ':' . $pad($m[6]);
            }

            return $base;
        }
        if (isset($cell['f']) && $cell['f'] !== null && $cell['f'] !== '') {
            return (string) $cell['f'];
        }
        if (is_bool($v)) {
            return $v ? '1' : '0';
        }
        if (is_int($v)) {
            return (string) $v;
        }
        if (is_float($v)) {
            if (abs($v - round($v)) < 1e-9) {
                return number_format($v, 0, '', '');
            }

            return rtrim(rtrim(sprintf('%.10F', $v), '0'), '.');
        }

        return (string) $v;
    }

    private function dedupeKey(string $table, array $group, array $row): string
    {
        $parts = [];
        foreach ($group as $key) {
            $parts[] = strtolower((string) ($row[$key] ?? ''));
        }

        return $table . '|' . implode('|', $parts);
    }

    private function buildRow(string $table, array $spec, array $record, bool $download, array &$fileStats): ?array
    {
        $row       = [];
        $columns   = isset($spec['positional'])
            ? array_keys($spec['positional'])
            : array_keys($spec['map']);
        $fileBase  = '';
        if (isset($spec['fileBase'])) {
            $fileBase = trim((string) ($record[$spec['fileBase']] ?? ''));
        }

        foreach ($columns as $col) {
            $value = isset($spec['positional'])
                ? (string) ($record[$col] ?? '')
                : (string) ($record[$spec['map'][$col]] ?? '');
            $value = $this->applyType($spec, $col, $value);
            if (isset($spec['normalize'][$col]) && $value !== null) {
                $key = strtolower((string) $value);
                if (isset($spec['normalize'][$col][$key])) {
                    $value = $spec['normalize'][$col][$key];
                }
            }
            if (isset($spec['files']) && isset($spec['files'][$col])) {
                $raw = isset($spec['positional']) ? (string) ($record[$col] ?? '') : (string) ($record[$spec['map'][$col]] ?? '');
                $value = ($download && $raw !== '') ? $this->downloadDrive($raw, $spec['files'][$col], $fileBase, $fileStats) : null;
            }
            if (($value === '' || $value === null) && isset($spec['defaults'][$col])) {
                $value = $spec['defaults'][$col];
            }
            $row[$col] = $value;
        }

        if (isset($spec['fk'])) {
            foreach ($spec['fk'] as $fkCol => $srcCol) {
                $idp          = trim((string) ($record[$srcCol] ?? ''));
                $row[$fkCol]  = $idp !== '' ? ($this->pengajuanMap[$idp] ?? null) : null;
            }
        }

        foreach ($this->requiredColumns()[$table] ?? [] as $col) {
            if (!array_key_exists($col, $row) || $row[$col] === null || $row[$col] === '') {
                return null;
            }
        }

        return $row;
    }

    private function applyType(array $spec, string $col, string $value)
    {
        if (in_array($col, $spec['date'] ?? [], true)) {
            return $this->normalizeDate($value, false);
        }
        if (in_array($col, $spec['datetime'] ?? [], true)) {
            return $this->normalizeDate($value, true);
        }
        if (in_array($col, $spec['int'] ?? [], true)) {
            return $this->toInt($value);
        }
        if (in_array($col, $spec['decimal'] ?? [], true)) {
            return $this->toDecimal($value);
        }
        if (in_array($col, $spec['hash'] ?? [], true)) {
            return $this->toHash($value);
        }

        return $value;
    }

    public function normalizeDate(string $value, bool $withTime): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/', $value, $m)) {
            return $withTime
                ? "{$m[1]}-{$m[2]}-{$m[3]} {$m[4]}:{$m[5]}:{$m[6]}"
                : "{$m[1]}-{$m[2]}-{$m[3]}";
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
            return $withTime ? "{$m[1]}-{$m[2]}-{$m[3]} 00:00:00" : "{$m[1]}-{$m[2]}-{$m[3]}";
        }

        return $withTime ? $value : substr($value, 0, 10);
    }

    public function toInt(string $value): ?int
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/-?\d+/', $value, $m)) {
            return (int) $m[0];
        }

        return null;
    }

    public function toDecimal(string $value)
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        $negative = str_contains($value, '-');
        $value    = preg_replace('/[^0-9,\.]/', '', $value);
        if (str_contains($value, ',')) {
            $value = str_replace('.', '', $value);
            $value = str_replace(',', '.', $value);
        } else {
            $value = str_replace('.', '', $value);
        }
        if ($value === '') {
            return null;
        }

        return ($negative ? '-' : '') . $value;
    }

    public function toHash(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^\$2[aby]\$/', $value) || str_starts_with($value, '$argon2')) {
            return $value;
        }

        return password_hash($value, PASSWORD_DEFAULT);
    }

    private function downloadDrive(string $url, string $subdir, string $base, array &$fileStats): ?string
    {
        if (!preg_match('#(?:/d/|id=)([A-Za-z0-9_-]{10,})#', $url, $m)) {
            $this->warnings[] = 'URL file tidak dikenali: ' . $url;
            $fileStats['failed']++;

            return null;
        }
        $fileId = $m[1];
        $dir    = $this->uploadsDir . '/' . $subdir;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            $this->warnings[] = 'Tidak bisa membuat direktori ' . $dir;
            $fileStats['failed']++;

            return null;
        }

        $ch = curl_init('https://drive.usercontent.google.com/download?id=' . $fileId . '&export=download&confirm=t');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 180,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_USERAGENT      => 'Mozilla/5.0',
            CURLOPT_HEADER         => true,
        ]);
        $response = curl_exec($ch);
        $error    = curl_error($ch);
        $code     = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerLength = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($response === false || $code >= 400) {
            $this->warnings[] = 'Gagal mengunduh ' . $url . ($error !== '' ? ' (' . $error . ')' : '');
            $fileStats['failed']++;

            return null;
        }

        $headers = substr($response, 0, $headerLength);
        $body    = substr($response, $headerLength);
        if ($body === '' || (strlen($body) < 1024 && stripos($body, '<!DOCTYPE html') !== false)) {
            $this->warnings[] = 'Konten Drive bukan berkas: ' . $url;
            $fileStats['failed']++;

            return null;
        }

        $ext = 'pdf';
        if (preg_match('/filename\*?=(?:UTF-8\'\')?"?([^";\r\n]+)"?/i', $headers, $fm)) {
            $parsedExt = strtolower(pathinfo(trim($fm[1]), PATHINFO_EXTENSION));
            if ($parsedExt !== '') {
                $ext = preg_replace('/[^a-z0-9]/', '', $parsedExt) ?: 'pdf';
            }
        }
        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $base !== '' ? $base : $fileId);
        $name = $safe . '.' . $ext;
        if (@file_put_contents($dir . '/' . $name, $body) === false) {
            $this->warnings[] = 'Gagal menulis berkas ' . $dir . '/' . $name;
            $fileStats['failed']++;

            return null;
        }
        $fileStats['downloaded']++;

        return $subdir . '/' . $name;
    }
}
