<?php

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Libraries\BiayaService;
use App\Libraries\NomorSuratService;
use App\Models\CheckDataModel;
use App\Models\DetailKegiatanModel;
use App\Models\MasterBagianModel;
use App\Models\MasterBiayaModel;
use App\Models\MasterKegiatanModel;
use App\Models\MasterMatakuliahModel;
use App\Models\PengajuanModel;
use App\Models\StatusHistoryModel;

class DashboardApi extends BaseApi
{
    private const ALLOWED_STATUS = ['Menunggu', 'Diterima', 'Ditolak', 'ACC', 'Dibatalkan'];
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    private const CATEGORIES = ['SGD', 'KKD', 'Ujian', 'Praktikum'];

    public function bootstrap()
    {
        $this->requireAdmin();

        $pengajuan = (new PengajuanModel())->orderBy('timestamp', 'DESC')->findAll();
        $ids = array_map(static fn ($p) => (int) $p['id'], $pengajuan);
        $biayaMap = (new BiayaService())->allMapped();
        $overrideMap = $this->overrideMap($ids);
        $detailsByPengajuan = $this->loadDetailMap($pengajuan);
        $labs = (new MasterKegiatanModel())->valuesFor('Lab');

        $rows = [];
        foreach ($pengajuan as $p) {
            $details = $detailsByPengajuan[$p['id_pengajuan']] ?? [];
            $kegiatan = $this->biayaKegiatanOf($p, $details, $biayaMap);
            $override = $overrideMap[$p['id']] ?? null;
            $resolved = $override !== null
                ? (float) $override
                : ($kegiatan !== null && isset($biayaMap[$kegiatan]) ? (float) $biayaMap[$kegiatan] : 0.0);
            $rows[] = $this->clientPengajuanRow($p, $resolved, $override);
        }

        $detailMap = [];
        foreach ($detailsByPengajuan as $key => $list) {
            $detailMap[$key] = array_map([$this, 'clientDetailRow'], $list);
        }

        $stats = $this->computeStats($pengajuan, $detailsByPengajuan, $rows, $labs);
        $matkul = (new MasterMatakuliahModel())->where('aktif', 1)->orderBy('nama', 'ASC')->findAll();
        $masterBiaya = (new MasterBiayaModel())->orderBy('biaya', 'ASC')->findAll();

        return $this->respondOk([
            'nama'         => $this->actor(),
            'stats'        => $stats,
            'pengajuan'    => $rows,
            'detailMap'    => $detailMap,
            'masterBiaya'  => array_map(static fn ($m) => ['kegiatan' => $m['kegiatan'], 'biaya' => (float) $m['biaya']], $masterBiaya),
            'dosen'        => (new MasterKegiatanModel())->valuesFor('Dosen'),
            'matakuliah'   => array_map(static fn ($m) => $m['nama'], $matkul),
            'config'       => ['statuses' => self::ALLOWED_STATUS],
        ]);
    }

    public function stats()
    {
        $this->requireAdmin();
        $pengajuan = (new PengajuanModel())->orderBy('timestamp', 'DESC')->findAll();
        $detailsByPengajuan = $this->loadDetailMap($pengajuan);
        $biayaMap = (new BiayaService())->allMapped();
        $overrideMap = $this->overrideMap(array_map(static fn ($p) => (int) $p['id'], $pengajuan));
        $rows = [];
        foreach ($pengajuan as $p) {
            $details = $detailsByPengajuan[$p['id_pengajuan']] ?? [];
            $kegiatan = $this->biayaKegiatanOf($p, $details, $biayaMap);
            $override = $overrideMap[$p['id']] ?? null;
            $resolved = $override !== null
                ? (float) $override
                : ($kegiatan !== null && isset($biayaMap[$kegiatan]) ? (float) $biayaMap[$kegiatan] : 0.0);
            $rows[] = ['biaya' => $resolved];
        }
        $labs = (new MasterKegiatanModel())->valuesFor('Lab');

        return $this->respondOk($this->computeStats($pengajuan, $detailsByPengajuan, $rows, $labs));
    }

    public function pengajuanDetail(string $idPengajuan)
    {
        $this->requireAdmin();
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $details = (new DetailKegiatanModel())
            ->where('id_pengajuan', $idPengajuan)
            ->orderBy('timestamp', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        $biayaMap = (new BiayaService())->allMapped();
        $kegiatan = $this->biayaKegiatanOf($p, $details, $biayaMap);
        $biaya = (new BiayaService())->resolve((int) $p['id'], $kegiatan);
        $override = (new BiayaService())->override((int) $p['id']);
        $row = $this->clientPengajuanRow($p, $biaya ?? 0.0, $override);
        $row['details'] = array_map([$this, 'clientDetailRow'], $details);

        $history = (new StatusHistoryModel())
            ->where('id_pengajuan', $idPengajuan)
            ->orderBy('timestamp', 'ASC')
            ->findAll();
        $history = array_map(static fn ($h) => [
            'timestamp'  => $h['timestamp'],
            'status'     => $h['status'],
            'catatan'    => $h['catatan'],
            'actorEmail' => $h['actor_email'],
        ], $history);

        return $this->respondOk([
            'pengajuan' => $row,
            'history'   => $history,
        ]);
    }

    public function updateStatus(string $idPengajuan)
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        $status = trim((string) ($r['status'] ?? ''));
        $catatan = trim((string) ($r['catatan'] ?? ''));
        if (!in_array($status, self::ALLOWED_STATUS, true)) {
            return $this->respondErr('Status tidak valid: ' . $status);
        }
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $upd = ['status' => $status];
        if ($catatan !== '') {
            $upd['catatan_admin'] = $catatan;
        }
        if ($status === 'ACC' && trim((string) ($p['nomor_surat'] ?? '')) === '') {
            $upd['nomor_surat'] = (new NomorSuratService())->next('ACC');
        }
        $pm->update($p['id'], $upd);
        if ($p['status'] !== $status) {
            (new StatusHistoryModel())->insert([
                'pengajuan_id' => $p['id'],
                'id_pengajuan' => $idPengajuan,
                'timestamp'    => date('Y-m-d H:i:s'),
                'status'       => $status,
                'catatan'      => $catatan,
                'actor_email'  => $this->actor(),
            ]);
        }
        audit_log_add($this->actor(), 'update_status', $idPengajuan, 'status=' . $status, $catatan);

        return $this->respondOk([
            'message'     => 'Status diperbarui.',
            'nomor_surat' => $upd['nomor_surat'] ?? null,
        ]);
    }

    public function updateFields(string $idPengajuan)
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $map = [
            'email'              => 'email',
            'noHp'               => 'no_hp_wa',
            'namaLengkap'        => 'nama_lengkap',
            'blok'               => 'blok',
            'jenisKegiatan'      => 'jenis_kegiatan',
            'matakuliah'         => 'matakuliah',
            'dosen'              => 'dosen',
            'tanggalPelaksanaan' => 'tanggal_pelaksanaan',
        ];
        $upd = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $r)) {
                $value = trim((string) $r[$field]);
                if ($field === 'tanggalPelaksanaan') {
                    $upd[$column] = $this->dateOnlyOrNull($value);
                } else {
                    $upd[$column] = $value === '' ? null : $value;
                }
            }
        }
        if (isset($upd['email']) && $upd['email'] !== null && !filter_var($upd['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->respondErr('Format email tidak valid.');
        }
        if ($upd !== []) {
            $pm->update($p['id'], $upd);
            audit_log_add($this->actor(), 'update_pengajuan', $idPengajuan, 'fields=' . implode(',', array_keys($upd)));
        }

        return $this->respondOk(['message' => 'Data pengajuan diperbarui.']);
    }

    public function updateDetail(string $idPengajuan, string $detailId)
    {
        $this->requireAdmin();
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $dm = new DetailKegiatanModel();
        $d = $dm->find((int) $detailId);
        if (!$d || $d['id_pengajuan'] !== $idPengajuan) {
            return $this->respondErr('Detail kegiatan tidak ditemukan.', 404);
        }
        $r = $this->request->getJSON(true) ?? [];
        $map = [
            'jenisKegiatan'      => 'jenis_kegiatan',
            'pilihan'            => 'pilihan',
            'detail'             => 'detail',
            'tanggalPelaksanaan' => 'tanggal_pelaksanaan',
        ];
        $upd = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $r)) {
                $value = trim((string) $r[$field]);
                $upd[$column] = $field === 'tanggalPelaksanaan' ? $this->dateOnlyOrNull($value) : ($value === '' ? null : $value);
            }
        }
        $jenis = $upd['jenis_kegiatan'] ?? $d['jenis_kegiatan'];
        $pilihan = $upd['pilihan'] ?? $d['pilihan'];
        $det = $upd['detail'] ?? $d['detail'];
        if ($jenis === 'Praktikum') {
            $upd['bagian'] = $this->resolveBagian($pilihan, $det);
        }
        if ($upd !== []) {
            $dm->update($d['id'], $upd);
            audit_log_add($this->actor(), 'update_detail_kegiatan', $idPengajuan, 'detail_id=' . $detailId);
        }

        return $this->respondOk(['message' => 'Detail kegiatan diperbarui.']);
    }

    public function deleteDetail(string $idPengajuan, string $detailId)
    {
        $this->requireAdmin();
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $dm = new DetailKegiatanModel();
        $d = $dm->find((int) $detailId);
        if (!$d || $d['id_pengajuan'] !== $idPengajuan) {
            return $this->respondErr('Detail kegiatan tidak ditemukan.', 404);
        }
        $dm->delete($d['id']);
        audit_log_add($this->actor(), 'delete_detail_kegiatan', $idPengajuan, 'detail_id=' . $detailId);

        return $this->respondOk(['message' => 'Detail kegiatan dihapus.']);
    }

    public function deletePengajuan(string $idPengajuan)
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        $alasan = trim((string) ($r['alasan'] ?? ''));
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $db = db_connect();
        $related = $db->table('detail_kegiatan')->where('id_pengajuan', $idPengajuan)->countAllResults()
            + $db->table('status_history')->where('id_pengajuan', $idPengajuan)->countAllResults()
            + $db->table('log_upload')->where('id_pengajuan', $idPengajuan)->countAllResults()
            + $db->table('check_data')->where('id_pengajuan', $idPengajuan)->countAllResults();
        $db->table('log_upload')->where('id_pengajuan', $idPengajuan)->delete();
        $db->table('check_data')->where('pengajuan_id', $p['id'])->delete();
        $pm->delete($p['id']);
        audit_log_add($this->actor(), 'delete_pengajuan', $idPengajuan, 'related=' . $related, $alasan);

        return $this->respondOk(['message' => 'Pengajuan beserta data terkait berhasil dihapus (' . $related . ' baris terkait).']);
    }

    public function updateBiaya(string $idPengajuan)
    {
        $this->requireAdmin();
        $r = $this->request->getJSON(true) ?? [];
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $raw = trim((string) ($r['biaya'] ?? ''));
        $kegiatan = trim((string) ($r['kegiatan'] ?? ''));
        $biaya = $raw === '' ? null : (float) $raw;
        $svc = new BiayaService();
        $svc->setOverride((int) $p['id'], $kegiatan, $biaya);
        $message = $biaya === null || $biaya <= 0
            ? 'Biaya kembali ke default MasterBiaya.'
            : 'Biaya pengajuan disimpan.';
        audit_log_add($this->actor(), 'update_biaya', $idPengajuan, 'biaya=' . ($raw === '' ? 'default' : $raw));

        return $this->respondOk(['message' => $message]);
    }

    private function loadDetailMap(array $pengajuan): array
    {
        $map = [];
        if ($pengajuan === []) {
            return $map;
        }
        $rows = (new DetailKegiatanModel())
            ->whereIn('id_pengajuan', array_column($pengajuan, 'id_pengajuan'))
            ->orderBy('timestamp', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        foreach ($rows as $d) {
            $map[$d['id_pengajuan']][] = $d;
        }
        return $map;
    }

    private function overrideMap(array $ids): array
    {
        $map = [];
        if ($ids === []) {
            return $map;
        }
        $rows = (new CheckDataModel())
            ->where('detail', 'BIAYA-OVERRIDE')
            ->whereIn('pengajuan_id', $ids)
            ->findAll();
        foreach ($rows as $r) {
            if ($r['biaya'] !== null) {
                $map[$r['pengajuan_id']] = (float) $r['biaya'];
            }
        }
        return $map;
    }

    private function computeStats(array $pengajuan, array $detailsByPengajuan, array $rows, array $labs): array
    {
        $perStatus = [];
        $perJenis = [];
        $perBlok = [];
        $trend = [];
        $totalBiaya = 0.0;
        foreach ($pengajuan as $i => $p) {
            $status = trim((string) $p['status']);
            $perStatus[$status === '' ? 'Lainnya' : $status] = ($perStatus[$status === '' ? 'Lainnya' : $status] ?? 0) + 1;
            $jenis = trim((string) $p['jenis_kegiatan']);
            $perJenis[$jenis === '' ? 'Lainnya' : $jenis] = ($perJenis[$jenis === '' ? 'Lainnya' : $jenis] ?? 0) + 1;
            $blok = trim((string) $p['blok']);
            $perBlok[$blok === '' ? '-' : $blok] = ($perBlok[$blok === '' ? '-' : $blok] ?? 0) + 1;
            $totalBiaya += (float) ($rows[$i]['biaya'] ?? 0.0);
            $ts = (string) ($p['timestamp'] ?? '');
            if (preg_match('/^(\d{4})-(\d{2})/', $ts, $m)) {
                $label = self::MONTHS[(int) $m[2] - 1] . ' ' . $m[1];
                $trend[$label] = ($trend[$label] ?? 0) + 1;
            }
        }
        $perBagian = [];
        foreach ($detailsByPengajuan as $list) {
            foreach ($list as $d) {
                $label = $this->bagianLabelOf($d['jenis_kegiatan'] ?? '', $d['bagian'] ?? '', $labs);
                $perBagian[$label] = ($perBagian[$label] ?? 0) + 1;
            }
        }

        return [
            'total'       => count($pengajuan),
            'perStatus'   => $perStatus,
            'perJenis'    => $perJenis,
            'perBlok'     => $perBlok,
            'trend'       => $trend,
            'perBagian'   => $perBagian,
            'totalBiaya'  => $totalBiaya,
        ];
    }

    private function bagianLabelOf(?string $jenis, ?string $bagian, array $labs): string
    {
        $raw = trim((string) $bagian);
        if ($raw === '') {
            $raw = trim((string) $jenis);
        }
        if ($raw === '') {
            return 'Lainnya';
        }
        $key = $this->normKey($raw);
        foreach (self::CATEGORIES as $cat) {
            if ($this->normKey($cat) === $key) {
                return $cat;
            }
        }
        foreach ($labs as $lab) {
            if ($this->normKey($lab) === $key) {
                return 'Praktikum';
            }
        }
        return 'Lainnya';
    }

    private function biayaKegiatanOf(array $p, array $details, array $biayaMap): ?string
    {
        foreach ($details as $d) {
            foreach (['pilihan', 'detail', 'jenis_kegiatan'] as $col) {
                $v = trim((string) ($d[$col] ?? ''));
                if ($v !== '' && isset($biayaMap[$v])) {
                    return $v;
                }
            }
        }
        $jenis = trim((string) ($p['jenis_kegiatan'] ?? ''));
        return $jenis !== '' && isset($biayaMap[$jenis]) ? $jenis : null;
    }

    private function clientPengajuanRow(array $p, float $biaya, ?float $override): array
    {
        return [
            'id'               => (int) $p['id'],
            'idPengajuan'      => $p['id_pengajuan'],
            'timestamp'        => $p['timestamp'],
            'npm'              => $p['npm'],
            'namaLengkap'      => $p['nama_lengkap'],
            'email'            => $p['email'],
            'noHp'             => $p['no_hp_wa'],
            'blok'             => $p['blok'],
            'jenisKegiatan'    => $p['jenis_kegiatan'],
            'matakuliah'       => $p['matakuliah'],
            'dosen'            => $p['dosen'],
            'tanggalPelaksanaan' => $p['tanggal_pelaksanaan'],
            'keterangan'       => $p['keterangan'],
            'status'           => $p['status'],
            'catatanAdmin'     => $p['catatan_admin'],
            'nomorSurat'       => $p['nomor_surat'],
            'statusNotifEmail' => $p['status_notifikasi_email'],
            'notifTerkirimPada'=> $p['notifikasi_terkirim_pada'],
            'errorNotifEmail'  => $p['error_notifikasi_email'],
            'emailBagian'      => $p['email_bagian'],
            'linkSurat'        => $p['link_surat_keterangan'],
            'linkAcc'          => $p['path_acc_inhal'],
            'linkBukti'        => $p['path_bukti_bayar'],
            'linkFinal'        => $p['path_final'],
            'hasSurat'         => !empty($p['link_surat_keterangan']),
            'hasAcc'           => !empty($p['path_acc_inhal']),
            'hasBukti'         => !empty($p['path_bukti_bayar']),
            'hasFinal'         => !empty($p['path_final']),
            'biaya'            => $biaya,
            'biayaOverride'    => $override,
        ];
    }

    private function clientDetailRow(array $d): array
    {
        return [
            'id'               => (int) $d['id'],
            'jenisKegiatan'    => $d['jenis_kegiatan'],
            'pilihan'          => $d['pilihan'],
            'detail'           => $d['detail'],
            'tanggalPelaksanaan' => $d['tanggal_pelaksanaan'],
            'bagian'           => $d['bagian'],
        ];
    }

    private function resolveBagian(?string $pilihan, ?string $detail): string
    {
        $lab = $this->normKey($pilihan);
        $kegiatan = $this->normKey($detail);
        if ($lab === '') {
            return '';
        }
        $rows = (new MasterBagianModel())->findAll();
        foreach ($rows as $r) {
            if ($this->normKey($r['lab']) === $lab && $this->normKey($r['kegiatan_lab']) === $kegiatan) {
                return (string) $r['bagian'];
            }
        }
        return '';
    }

    private function dateOnlyOrNull(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $value, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }
        return null;
    }

    private function normKey($v): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', (string) $v));
    }

    private function actor(): string
    {
        return (string) ((new AuthService())->sessionAuth()['nama'] ?? 'admin');
    }
}
