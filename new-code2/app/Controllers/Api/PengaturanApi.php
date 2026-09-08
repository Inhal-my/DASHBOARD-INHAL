<?php

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Models\AdminModel;
use App\Models\AuditLogModel;
use App\Models\BagianStaffModel;
use App\Models\EmailTemplateModel;
use App\Models\MasterBagianModel;
use App\Models\MasterBiayaModel;
use App\Models\MasterKegiatanModel;
use App\Models\MasterMatakuliahModel;
use App\Models\NomorSuratModel;

class PengaturanApi extends BaseApi
{
    private const ALLOWED_STATUS = ['Menunggu', 'Diterima', 'Ditolak', 'ACC', 'Dibatalkan'];
    private const DEFAULT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

    public function umumGet()
    {
        $this->requireAdmin();

        return $this->respondOk($this->umumPayload());
    }

    public function umumSave()
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];

        $buktiMode = trim((string) ($r['buktiMode'] ?? ''));
        if ($buktiMode !== '' && !in_array($buktiMode, ['strict', 'lenggang'], true)) {
            return $this->respondErr('BUKTI_MODE harus strict atau lenggang.');
        }

        $mapping = [
            'appName'            => 'APP_NAME',
            'timezone'           => 'TIMEZONE',
            'buktiMode'          => 'BUKTI_MODE',
            'bagianBaFinalOnly'  => 'BAGIAN_BA_FINAL_ONLY',
        ];
        foreach ($mapping as $field => $key) {
            if (array_key_exists($field, $r)) {
                config_set($key, (string) $r[$field]);
            }
        }
        if (array_key_exists('bagianBaStatuses', $r)) {
            $bagianBaStatuses = $r['bagianBaStatuses'];
            if (!is_array($bagianBaStatuses)) {
                return $this->respondErr('BAGIAN_BA_STATUSES wajib array.');
            }
            config_set('BAGIAN_BA_STATUSES', json_encode(array_values($bagianBaStatuses)));
        }
        audit_log_add($this->actor(), 'save_config', 'config', 'section=umum');

        return $this->respondOk($this->umumPayload());
    }

    public function kegiatanGet()
    {
        $this->requireAdmin();
        $rows = (new MasterKegiatanModel())->orderBy('kategori', 'ASC')->orderBy('nilai', 'ASC')->findAll();

        return $this->respondOk($rows);
    }

    public function kegiatanSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new MasterKegiatanModel();
        $result = $this->upsertRows($m, $items, ['kategori', 'nilai'], ['kategori', 'nilai']);
        if (!$result['ok']) {
            return $this->respondErr($result['message']);
        }
        audit_log_add($this->actor(), 'save_master', 'master_kegiatan', 'items=' . count($items));

        return $this->respondOk($m->orderBy('kategori', 'ASC')->orderBy('nilai', 'ASC')->findAll());
    }

    public function matakuliahGet()
    {
        $this->requireAdmin();
        $rows = (new MasterMatakuliahModel())->orderBy('nama', 'ASC')->findAll();

        return $this->respondOk($rows);
    }

    public function matakuliahSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new MasterMatakuliahModel();
        $result = $this->upsertRows($m, $items, ['kode', 'nama', 'blok', 'sks', 'aktif'], ['nama']);
        if (!$result['ok']) {
            return $this->respondErr($result['message']);
        }
        audit_log_add($this->actor(), 'save_master', 'master_matakuliah', 'items=' . count($items));

        return $this->respondOk($m->orderBy('nama', 'ASC')->findAll());
    }

    public function bagianGet()
    {
        $this->requireAdmin();
        $rows = (new MasterBagianModel())->orderBy('id', 'ASC')->findAll();

        return $this->respondOk($rows);
    }

    public function bagianSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new MasterBagianModel();
        $result = $this->upsertRows($m, $items, ['lab', 'kegiatan_lab', 'bagian', 'email'], ['bagian']);
        if (!$result['ok']) {
            return $this->respondErr($result['message']);
        }
        audit_log_add($this->actor(), 'save_master', 'master_bagian', 'items=' . count($items));

        return $this->respondOk($m->orderBy('id', 'ASC')->findAll());
    }

    public function biayaGet()
    {
        $this->requireAdmin();
        $rows = (new MasterBiayaModel())->orderBy('biaya', 'ASC')->orderBy('kegiatan', 'ASC')->findAll();

        return $this->respondOk($rows);
    }

    public function biayaSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new MasterBiayaModel();
        $result = $this->upsertRows($m, $items, ['kegiatan', 'biaya'], ['kegiatan']);
        if (!$result['ok']) {
            return $this->respondErr($result['message']);
        }
        audit_log_add($this->actor(), 'save_master', 'master_biaya', 'items=' . count($items));

        return $this->respondOk($m->orderBy('biaya', 'ASC')->orderBy('kegiatan', 'ASC')->findAll());
    }

    public function penggunaGet()
    {
        $this->requireAdmin();
        $admin = (new AdminModel())->orderBy('id', 'ASC')->findAll();
        $staf = (new BagianStaffModel())->orderBy('id', 'ASC')->findAll();
        $admin = array_map(static fn ($a) => ['id' => (int) $a['id'], 'nama' => $a['nama']], $admin);
        $staf = array_map(static fn ($s) => [
            'id'       => (int) $s['id'],
            'email'    => $s['email'],
            'kategori' => $s['kategori'],
            'nama'     => $s['nama'],
        ], $staf);

        return $this->respondOk(['admin' => $admin, 'staf' => $staf]);
    }

    public function penggunaSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $adminModel = new AdminModel();
        $stafModel = new BagianStaffModel();
        $db = db_connect();
        $db->transStart();
        try {
            foreach ($items as $it) {
                $kind = trim((string) ($it['kind'] ?? ''));
                if ($kind === 'admin') {
                    $data = ['nama' => trim((string) ($it['nama'] ?? ''))];
                    if ($data['nama'] === '') {
                        throw new \RuntimeException('Nama admin wajib diisi.');
                    }
                    $pw = (string) ($it['password'] ?? '');
                    if ($pw !== '') {
                        $data['password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
                    }
                    if (!empty($it['_delete'])) {
                        $adminModel->delete((int) $it['id']);
                        continue;
                    }
                    if (!empty($it['id'])) {
                        $adminModel->update((int) $it['id'], $data);
                    } else {
                        if ($pw === '') {
                            throw new \RuntimeException('Password admin baru wajib diisi.');
                        }
                        $adminModel->insert($data);
                    }
                    continue;
                }
                if ($kind === 'staf') {
                    $email = trim((string) ($it['email'] ?? ''));
                    $data = [
                        'email'    => $email,
                        'kategori' => trim((string) ($it['kategori'] ?? '')) ?: null,
                        'nama'     => trim((string) ($it['nama'] ?? '')) ?: null,
                    ];
                    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        throw new \RuntimeException('Email staf wajib valid.');
                    }
                    $pw = (string) ($it['password'] ?? '');
                    if ($pw !== '') {
                        $data['password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
                    }
                    if (!empty($it['_delete'])) {
                        $stafModel->delete((int) $it['id']);
                        continue;
                    }
                    if (!empty($it['id'])) {
                        $stafModel->update((int) $it['id'], $data);
                    } else {
                        if ($pw === '') {
                            throw new \RuntimeException('Password staf baru wajib diisi.');
                        }
                        $stafModel->insert($data);
                    }
                    continue;
                }
                throw new \RuntimeException('Jenis pengguna tidak dikenali: ' . $kind);
            }
        } catch (\Throwable $e) {
            $db->transRollback();
            return $this->respondErr($e->getMessage());
        }
        $db->transComplete();
        audit_log_add($this->actor(), 'save_master', 'pengguna', 'items=' . count($items));

        return $this->penggunaGet();
    }

    public function emailGet()
    {
        $this->requireAdmin();
        $templates = (new EmailTemplateModel())->orderBy('kode', 'ASC')->findAll();
        $email = new \Config\Email();

        return $this->respondOk([
            'templates' => $templates,
            'smtp'      => [
                'protocol'  => $email->protocol,
                'host'      => $email->SMTPHost,
                'port'      => $email->SMTPPort,
                'user'      => $email->SMTPUser,
                'crypto'    => $email->SMTPCrypto,
                'fromEmail' => $email->fromEmail,
                'fromName'  => $email->fromName,
            ],
        ]);
    }

    public function emailSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new EmailTemplateModel();
        $db = db_connect();
        $db->transStart();
        try {
            foreach ($items as $it) {
                $kode = trim((string) ($it['kode'] ?? ''));
                if ($kode === '') {
                    throw new \RuntimeException('Kode template wajib diisi.');
                }
                $data = [
                    'kode'      => $kode,
                    'subjek'    => trim((string) ($it['subjek'] ?? '')),
                    'body_html' => (string) ($it['body_html'] ?? ''),
                    'aktif'     => isset($it['aktif']) ? (int) $it['aktif'] : 1,
                ];
                if ($data['subjek'] === '') {
                    throw new \RuntimeException('Subjek template wajib diisi: ' . $kode);
                }
                if (!empty($it['_delete'])) {
                    $m->delete((int) $it['id']);
                    continue;
                }
                if (!empty($it['id'])) {
                    $m->update((int) $it['id'], $data);
                } else {
                    $m->insert($data);
                }
            }
        } catch (\Throwable $e) {
            $db->transRollback();
            return $this->respondErr($e->getMessage());
        }
        $db->transComplete();
        audit_log_add($this->actor(), 'save_email_template', 'email_templates', 'items=' . count($items));

        return $this->emailGet();
    }

    public function nomorSuratGet()
    {
        $this->requireAdmin();
        $rows = (new NomorSuratModel())->orderBy('type', 'ASC')->orderBy('tahun', 'ASC')->findAll();

        return $this->respondOk($rows);
    }

    public function nomorSuratSave()
    {
        $this->requireAdmin();
        $items = $this->itemsFromPayload();
        if ($items === null) {
            return $this->respondErr('Payload items wajib array.');
        }
        $m = new NomorSuratModel();
        $db = db_connect();
        $db->transStart();
        try {
            foreach ($items as $it) {
                $type = strtoupper(trim((string) ($it['type'] ?? '')));
                $tahun = (int) ($it['tahun'] ?? 0);
                $lastNumber = max(0, (int) ($it['last_number'] ?? 0));
                if ($type === '' || $tahun < 2000 || $tahun > 2100) {
                    throw new \RuntimeException('Data nomor surat tidak valid.');
                }
                $row = $m->where('type', $type)->where('tahun', $tahun)->first();
                if ($row) {
                    $m->update($row['id'], ['last_number' => $lastNumber, 'updated_at' => date('Y-m-d H:i:s')]);
                } else {
                    $m->insert(['type' => $type, 'tahun' => $tahun, 'last_number' => $lastNumber]);
                }
            }
        } catch (\Throwable $e) {
            $db->transRollback();
            return $this->respondErr($e->getMessage());
        }
        $db->transComplete();
        audit_log_add($this->actor(), 'save_nomor_surat', 'nomor_surat', 'items=' . count($items));

        return $this->nomorSuratGet();
    }

    public function uploadGet()
    {
        $this->requireAdmin();
        $whitelist = config_get('UPLOAD_MIME_WHITELIST', null);
        $whitelist = $whitelist !== null ? json_decode((string) $whitelist, true) : null;
        if (!is_array($whitelist)) {
            $whitelist = self::DEFAULT_MIME;
        }

        return $this->respondOk([
            'uploadMaxBytes'      => (int) config_get('UPLOAD_MAX_BYTES', 5242880),
            'uploadMimeWhitelist' => array_values($whitelist),
        ]);
    }

    public function uploadSave()
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        if (array_key_exists('uploadMaxBytes', $r)) {
            $bytes = (int) $r['uploadMaxBytes'];
            if ($bytes < 1) {
                return $this->respondErr('UPLOAD_MAX_BYTES wajib bilangan positif.');
            }
            config_set('UPLOAD_MAX_BYTES', (string) $bytes);
        }
        if (array_key_exists('uploadMimeWhitelist', $r)) {
            $whitelist = $r['uploadMimeWhitelist'];
            if (!is_array($whitelist) || $whitelist === []) {
                return $this->respondErr('UPLOAD_MIME_WHITELIST wajib array tidak kosong.');
            }
            config_set('UPLOAD_MIME_WHITELIST', json_encode(array_values(array_map('strval', $whitelist))));
        }
        audit_log_add($this->actor(), 'save_config', 'config', 'section=upload');

        return $this->uploadGet();
    }

    public function statusGet()
    {
        $this->requireAdmin();
        $bagianStatuses = $this->decodeJsonArray(config_get('BAGIAN_BA_STATUSES', null), self::ALLOWED_STATUS);
        $statusRoles = $this->decodeJsonObject(config_get('STATUS_ROLES', null), $this->defaultStatusRoles());

        return $this->respondOk([
            'statuses'         => self::ALLOWED_STATUS,
            'bagianBaStatuses' => $bagianStatuses,
            'statusRoles'      => $statusRoles,
        ]);
    }

    public function statusSave()
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        if (array_key_exists('bagianBaStatuses', $r)) {
            $bagianBaStatuses = $r['bagianBaStatuses'];
            if (!is_array($bagianBaStatuses)) {
                return $this->respondErr('BAGIAN_BA_STATUSES wajib array.');
            }
            $bagianBaStatuses = array_values(array_map('strval', $bagianBaStatuses));
            foreach ($bagianBaStatuses as $s) {
                if (!in_array($s, self::ALLOWED_STATUS, true)) {
                    return $this->respondErr('Status BA tidak dikenal: ' . $s);
                }
            }
            config_set('BAGIAN_BA_STATUSES', json_encode($bagianBaStatuses));
        }
        if (array_key_exists('statusRoles', $r)) {
            $statusRoles = $r['statusRoles'];
            if (!is_array($statusRoles)) {
                return $this->respondErr('STATUS_ROLES wajib objek.');
            }
            $normalized = [];
            foreach ($statusRoles as $status => $roles) {
                if (!in_array($status, self::ALLOWED_STATUS, true)) {
                    return $this->respondErr('Status tidak dikenal: ' . $status);
                }
                $normalized[$status] = is_array($roles) ? array_values(array_map('strval', $roles)) : [];
            }
            config_set('STATUS_ROLES', json_encode($normalized));
        }
        audit_log_add($this->actor(), 'save_config', 'config', 'section=status');

        return $this->statusGet();
    }

    public function audit()
    {
        $this->requireAdmin();
        $logs = (new AuditLogModel())->orderBy('id', 'DESC')->limit(200)->findAll();
        $tables = [
            'mahasiswa', 'pengajuan', 'detail_kegiatan', 'status_history', 'check_data',
            'master_kegiatan', 'master_matakuliah', 'master_bagian', 'master_biaya',
            'nomor_surat', 'admin', 'bagian_staff', 'log_upload',
            'berita_acara', 'berita_acara_peserta', 'berita_acara_admin', 'berita_acara_admin_peserta',
            'email_templates', 'audit_log', 'config',
        ];
        $counts = [];
        foreach ($tables as $table) {
            $counts[$table] = (int) db_connect()->table($table)->countAllResults();
        }

        return $this->respondOk(['logs' => $logs, 'counts' => $counts]);
    }

    private function umumPayload(): array
    {
        $bagianStatuses = $this->decodeJsonArray(config_get('BAGIAN_BA_STATUSES', null), ['Diterima', 'ACC']);

        return [
            'appName'           => config_get('APP_NAME', 'INHAL'),
            'timezone'          => config_get('TIMEZONE', 'Asia/Jakarta'),
            'buktiMode'         => config_get('BUKTI_MODE', 'strict'),
            'bagianBaStatuses'  => $bagianStatuses,
            'bagianBaFinalOnly' => (int) config_get('BAGIAN_BA_FINAL_ONLY', '0'),
        ];
    }

    private function itemsFromPayload(): ?array
    {
        $items = $this->request->getJSON(true)['items'] ?? null;
        return is_array($items) ? $items : null;
    }

    private function upsertRows($model, array $items, array $fields, array $skipWhen = []): array
    {
        $db = db_connect();
        $db->transStart();
        try {
            foreach ($items as $it) {
                if (!empty($it['_delete'])) {
                    if (!empty($it['id'])) {
                        $model->delete((int) $it['id']);
                    }
                    continue;
                }
                $data = [];
                foreach ($fields as $field) {
                    $raw = $it[$field] ?? null;
                    if ($field === 'biaya') {
                        $data[$field] = $raw === null || $raw === '' ? 0 : (float) $raw;
                    } elseif ($field === 'sks') {
                        $data[$field] = $raw === null || $raw === '' ? null : (int) $raw;
                    } elseif ($field === 'aktif') {
                        $data[$field] = $raw === null ? 1 : (int) $raw;
                    } else {
                        $data[$field] = trim((string) $raw) === '' ? null : trim((string) $raw);
                    }
                }
                $skipped = false;
                foreach ($skipWhen as $col) {
                    if (($data[$col] ?? null) === null || trim((string) $data[$col]) === '') {
                        $skipped = true;
                        break;
                    }
                }
                if ($skipped) {
                    continue;
                }
                if ($data === array_filter($data, static fn ($v) => $v === null)) {
                    continue;
                }
                if (!empty($it['id'])) {
                    $model->update((int) $it['id'], $data);
                } else {
                    $model->insert($data);
                }
            }
        } catch (\Throwable $e) {
            $db->transRollback();
            return ['ok' => false, 'message' => $e->getMessage()];
        }
        $db->transComplete();
        return ['ok' => true, 'message' => ''];
    }

    private function decodeJsonArray(?string $value, array $default): array
    {
        if ($value === null) {
            return $default;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? array_values(array_map('strval', $decoded)) : $default;
    }

    private function decodeJsonObject(?string $value, array $default): array
    {
        if ($value === null) {
            return $default;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $default;
    }

    private function defaultStatusRoles(): array
    {
        return [
            'Menunggu'  => ['sistem'],
            'Diterima'  => ['admin'],
            'Ditolak'   => ['admin'],
            'ACC'       => ['admin', 'bagian'],
            'Dibatalkan'=> ['admin'],
        ];
    }

    private function actor(): string
    {
        return (string) ((new AuthService())->sessionAuth()['nama'] ?? 'admin');
    }
}
