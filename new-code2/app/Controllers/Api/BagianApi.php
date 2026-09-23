<?php

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Libraries\UploadService;
use App\Models\BeritaAcaraModel;
use App\Models\BeritaAcaraPesertaModel;
use App\Models\MasterKegiatanModel;

class BagianApi extends BaseApi
{
    private const CATEGORIES = ['SGD', 'KKD', 'Ujian', 'Praktikum'];

    public function bootstrap()
    {
        $bagian = $this->sessionBagian();
        $scope = $this->scope($bagian);
        $config = $this->baConfig();

        return $this->respondOk([
            'nama'       => $bagian['nama'],
            'kategori'   => $scope['kategori'],
            'subBagian'  => $scope['subBagian'],
            'config'     => $config,
            'rows'       => $this->scopeRows($scope),
            'ba'         => $this->baPayload($scope),
        ]);
    }

    public function config()
    {
        return $this->respondOk([
            'categories'          => self::CATEGORIES,
            'labOptions'          => (new MasterKegiatanModel())->valuesFor('Lab'),
            'kegiatanLabOptions'  => (new MasterKegiatanModel())->valuesFor('Kegiatan Lab'),
            'ba'                  => $this->baConfig(),
        ]);
    }

    public function ba()
    {
        $bagian = $this->sessionBagian();
        $scope = $this->scope($bagian);

        return $this->respondOk($this->baPayload($scope));
    }

    public function store()
    {
        $bagian = $this->sessionBagian();
        $scope = $this->scope($bagian);
        $req = $this->request;

        $namaKegiatan = trim((string) $req->getPost('namaKegiatan'));
        $blok = trim((string) $req->getPost('blok'));
        $tanggal = trim((string) $req->getPost('tanggalPelaksanaan'));
        $tanggal = substr($tanggal, 0, 10);
        $kategori = $scope['kategori'];
        $bagianLabel = $scope['subBagian'] !== '' ? $scope['subBagian'] : $kategori;
        $bagianInput = trim((string) $req->getPost('bagian'));
        if ($bagianInput !== '' && $this->normKey($bagianInput) !== $this->normKey($bagianLabel)) {
            return $this->respondErr('Bagian tidak sesuai dengan sesi login.', 403);
        }

        $pesertaRaw = $req->getPost('peserta') ?? '[]';
        $peserta = json_decode($pesertaRaw, true);
        if (!is_array($peserta)) {
            $peserta = [];
        }
        if ($namaKegiatan === '' || $blok === '' || $tanggal === '' || count($peserta) === 0) {
            return $this->respondValidation(['ba' => 'Data BA belum lengkap (nama kegiatan, blok, tanggal, peserta).']);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
            return $this->respondValidation(['tanggalPelaksanaan' => 'Tanggal pelaksanaan tidak valid.']);
        }

        $allowed = $this->allowedStatuses();
        $finalOnly = $this->finalOnly();

        $rows = $this->scopeRows($scope);
        $group = [];
        foreach ($rows as $r) {
            if ($this->namaKegiatanOf($r) === $namaKegiatan
                && $this->dateOnly($r['tanggal']) === $tanggal
                && trim((string) $r['blok']) === $blok
            ) {
                $group[] = $r;
            }
        }
        if (!$group) {
            return $this->respondErr('Kegiatan tidak ditemukan pada bagian ini.', 404);
        }

        if ($finalOnly) {
            foreach ($group as $r) {
                if (trim((string) $r['status']) === 'Menunggu') {
                    return $this->respondErr('Upload dibatalkan: masih ada peserta berstatus Menunggu pada kegiatan ini. Tunggu hingga seluruh peserta Diterima / ACC.', 409);
                }
            }
        }

        $blocked = [];
        $validPeserta = [];
        $seen = [];
        foreach ($peserta as $p) {
            $id = trim((string) ($p['idPengajuan'] ?? ''));
            if ($id === '' || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $match = null;
            foreach ($group as $r) {
                if ($r['idPengajuan'] === $id) {
                    $match = $r;
                    break;
                }
            }
            if (!$match) {
                return $this->respondErr('Ada peserta yang tidak sesuai dengan kegiatan terpilih.', 409);
            }
            $status = trim((string) $match['status']);
            if ($status === '' || !in_array($status, $allowed, true)) {
                $blocked[] = trim((string) $match['namaLengkap']) . ' (' . $status . ')';
                continue;
            }
            $validPeserta[] = [
                'idPengajuan'     => $id,
                'npm'             => $match['npm'],
                'namaLengkap'     => $match['namaLengkap'],
                'blok'            => $match['blok'],
                'statusPengajuan' => $status,
            ];
        }

        if ($blocked) {
            return $this->respondErr('Upload dibatalkan: peserta belum berstatus ' . implode(' / ', $allowed) . ' — ' . implode(', ', $blocked) . '. Muat ulang data terlebih dahulu.', 409);
        }
        if (!$validPeserta) {
            return $this->respondErr('Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.', 409);
        }

        $baModel = new BeritaAcaraModel();
        $dup = $baModel->where('bagian', $bagianLabel)
            ->where('blok', $blok)
            ->where('nama_kegiatan', $namaKegiatan)
            ->where('tanggal_pelaksanaan', $tanggal)
            ->first();
        if ($dup) {
            $msg = 'Upload dibatalkan: sudah ada berita acara untuk "' . $dup['nama_kegiatan']
                . '" (Bagian ' . $dup['bagian'] . ', Blok ' . $dup['blok'] . ') pada '
                . $this->dateOnly($dup['tanggal_pelaksanaan'])
                . '. Jika ini revisi, hubungi admin untuk menghapus BA lama.';
            return $this->respondErr($msg, 409);
        }

        $baId = inhal_id('BA');
        $now = date('Y-m-d H:i:s');
        $saved = ['file_name' => null, 'file_path' => null];
        $file = $req->getFile('file');
        if ($file && $file->isValid()) {
            $up = new UploadService();
            $res = $up->store('ba', $baId, $file);
            if (!$res['ok']) {
                return $this->respondErr($res['message']);
            }
            $saved = ['file_name' => $res['file_name'], 'file_path' => $res['path']];
        }

        $db = db_connect();
        $db->transStart();
        $baModel->insert([
            'timestamp'            => $now,
            'ba_id'                => $baId,
            'bagian'               => $bagianLabel,
            'blok'                 => $blok,
            'nama_kegiatan'        => $namaKegiatan,
            'tanggal_pelaksanaan'  => $tanggal,
            'jumlah_peserta'       => count($validPeserta),
            'file_name'            => $saved['file_name'],
            'file_path'            => $saved['file_path'],
            'catatan'              => trim((string) $req->getPost('catatan')),
            'sumber'               => 'Bagian',
        ]);
        $bp = new BeritaAcaraPesertaModel();
        foreach ($validPeserta as $vp) {
            $bp->insert([
                'timestamp'        => $now,
                'ba_id'            => $baId,
                'npm'              => $vp['npm'],
                'nama_lengkap'     => $vp['namaLengkap'],
                'blok'             => $vp['blok'],
                'bagian'           => $bagianLabel,
                'status_pengajuan' => $vp['statusPengajuan'],
            ]);
        }
        $db->transComplete();
        if (!$db->transStatus()) {
            return $this->respondErr('Gagal menyimpan berita acara.', 500);
        }

        audit_log_add($this->actorEmail($bagian), 'BA_BAGIAN_UPLOAD', $baId, $namaKegiatan . ' | ' . $tanggal);

        return $this->respondOk(['baId' => $baId, 'message' => 'Berita acara berhasil diunggah.']);
    }

    public function updateStatus(string $id)
    {
        $bagian = $this->sessionBagian();
        $scope = $this->scope($bagian);
        $bagianLabel = $scope['subBagian'] !== '' ? $scope['subBagian'] : $scope['kategori'];

        $baModel = new BeritaAcaraModel();
        $ba = $baModel->where('sumber', 'Bagian')
            ->groupStart()
                ->where('ba_id', $id)
                ->orWhere('id', is_numeric($id) ? (int) $id : -1)
            ->groupEnd()
            ->where('bagian', $bagianLabel)
            ->first();
        if (!$ba) {
            return $this->respondErr('Berita acara tidak ditemukan.', 404);
        }

        $r = $this->request->getJSON(true) ?? [];
        $catatan = trim((string) ($r['catatan'] ?? ''));
        $rows = $this->scopeRows($scope);
        $detailMap = [];
        foreach ($rows as $row) {
            if ($this->namaKegiatanOf($row) === $ba['nama_kegiatan']
                && $this->dateOnly($row['tanggal']) === $this->dateOnly($ba['tanggal_pelaksanaan'])
                && trim((string) $row['blok']) === trim((string) $ba['blok'])
            ) {
                $detailMap[$row['npm']] = trim((string) $row['status']);
            }
        }

        $db = db_connect();
        $db->transStart();
        $update = ['timestamp' => date('Y-m-d H:i:s')];
        if ($catatan !== '') {
            $update['catatan'] = $catatan;
        }
        $baModel->update($ba['id'], $update);
        $bp = new BeritaAcaraPesertaModel();
        $updated = 0;
        foreach ($bp->where('ba_id', $ba['ba_id'])->findAll() as $peserta) {
            if (isset($detailMap[$peserta['npm']]) && $detailMap[$peserta['npm']] !== $peserta['status_pengajuan']) {
                $bp->update($peserta['id'], [
                    'status_pengajuan' => $detailMap[$peserta['npm']],
                    'timestamp'        => date('Y-m-d H:i:s'),
                ]);
                $updated++;
            }
        }
        $db->transComplete();
        if (!$db->transStatus()) {
            return $this->respondErr('Gagal memperbarui status berita acara.', 500);
        }

        audit_log_add($this->actorEmail($bagian), 'BA_BAGIAN_STATUS', $ba['ba_id'], 'sinkron ' . $updated . ' peserta');

        return $this->respondOk([
            'baId'        => $ba['ba_id'],
            'updated'     => $updated,
            'message'     => 'Status peserta berita acara diperbarui.',
        ]);
    }

    private function sessionBagian(): array
    {
        $s = (new AuthService())->sessionBagian();
        if ($s === null) {
            $this->response->setStatusCode(401)->setJSON(['ok' => false, 'message' => 'Sesi bagian tidak ditemukan.'])->send();
            exit;
        }

        return $s;
    }

    private function scope(array $bagian): array
    {
        return [
            'kategori'  => trim((string) ($bagian['kategori'] ?? '')),
            'subBagian' => trim((string) ($bagian['subBagian'] ?? '')),
        ];
    }

    private function allowedStatuses(): array
    {
        $raw = json_decode((string) config_get('BAGIAN_BA_STATUSES', '["Diterima","ACC"]'), true);
        $list = is_array($raw) ? array_values(array_filter($raw, 'is_string')) : [];

        return $list ? $list : ['Diterima', 'ACC'];
    }

    private function finalOnly(): bool
    {
        $raw = strtolower(trim((string) config_get('BAGIAN_BA_FINAL_ONLY', '')));

        return $raw !== '0' && $raw !== 'false' && $raw !== '';
    }

    private function baConfig(): array
    {
        return [
            'statuses'  => $this->allowedStatuses(),
            'finalOnly' => $this->finalOnly(),
        ];
    }

    private function normKey($v): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', (string) $v));
    }

    private function dateOnly($v): string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string) $v, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }

        return '';
    }

    private function namaKegiatanOf(array $r): string
    {
        $label = trim((string) $r['pilihan']);
        if (trim((string) $r['detail']) !== '') {
            $label .= ' - ' . trim((string) $r['detail']);
        }

        return $label;
    }

    private function scopeRows(array $scope): array
    {
        $db = db_connect();
        $rows = $db->table('detail_kegiatan d')
            ->select("d.id_pengajuan AS idPengajuan, p.npm, p.nama_lengkap AS namaLengkap, p.blok, p.status, d.jenis_kegiatan AS jenis, d.pilihan, d.detail, d.tanggal_pelaksanaan AS tanggal, d.bagian AS bagian, p.link_surat_keterangan AS linkSurat, p.path_final AS pathFinal")
            ->join('pengajuan p', 'p.id_pengajuan = d.id_pengajuan')
            ->orderBy('d.tanggal_pelaksanaan', 'ASC')
            ->get()->getResultArray();

        $kat = $this->normKey($scope['kategori']);
        $sub = $this->normKey($scope['subBagian']);
        $isPraktikum = $kat === 'praktikum';
        $out = [];
        foreach ($rows as $r) {
            if ($kat !== '' && $this->normKey($r['jenis']) !== $kat) {
                continue;
            }
            if ($isPraktikum && $sub !== ''
                && $this->normKey($r['bagian']) !== $sub
                && $this->normKey($r['pilihan']) !== $sub
            ) {
                continue;
            }
            $out[] = [
                'idPengajuan' => $r['idPengajuan'],
                'npm'         => $r['npm'],
                'namaLengkap' => $r['namaLengkap'],
                'blok'        => $r['blok'],
                'jenis'       => $r['jenis'],
                'pilihan'     => $r['pilihan'],
                'detail'      => $r['detail'],
                'tanggal'     => $this->dateOnly($r['tanggal']),
                'bagian'      => $r['bagian'],
                'status'      => $r['status'],
                'linkSurat'   => $r['linkSurat'],
                'linkFinal'   => !empty($r['pathFinal'])
                    ? '/files/final/' . $r['idPengajuan']
                    : '',
            ];
        }

        return $out;
    }

    private function baPayload(array $scope): array
    {
        $list = $this->baList($scope);
        $summary = [
            'jumlahBa'     => count($list),
            'jumlahPeserta'=> 0,
            'terakhir'     => null,
        ];
        foreach ($list as $ba) {
            $summary['jumlahPeserta'] += $ba['jumlahPeserta'];
            if ($summary['terakhir'] === null || strtotime($ba['timestamp']) > strtotime($summary['terakhir'])) {
                $summary['terakhir'] = $ba['timestamp'];
            }
        }

        return ['list' => $list, 'summary' => $summary];
    }

    private function baList(array $scope): array
    {
        $bagianLabel = $scope['subBagian'] !== '' ? $scope['subBagian'] : $scope['kategori'];
        $db = db_connect();
        $rows = $db->table('berita_acara')
            ->where('sumber', 'Bagian')
            ->orderBy('tanggal_pelaksanaan', 'DESC')
            ->get()->getResultArray();
        $label = $this->normKey($bagianLabel);
        $matched = [];
        foreach ($rows as $r) {
            if ($label !== '' && $this->normKey($r['bagian']) === $label) {
                $matched[] = $r;
            }
        }

        $pesertaAll = $db->table('berita_acara_peserta')
            ->whereIn('ba_id', array_column($matched, 'ba_id') ?: [''])
            ->orderBy('npm', 'ASC')
            ->get()->getResultArray();
        $pesertaMap = [];
        foreach ($pesertaAll as $p) {
            $pesertaMap[$p['ba_id']][] = [
                'npm'             => $p['npm'],
                'namaLengkap'     => $p['nama_lengkap'],
                'blok'            => $p['blok'],
                'statusPengajuan' => $p['status_pengajuan'],
            ];
        }

        $out = [];
        foreach ($matched as $r) {
            $out[] = [
                'baId'               => $r['ba_id'],
                'bagian'             => $r['bagian'],
                'blok'               => $r['blok'],
                'namaKegiatan'       => $r['nama_kegiatan'],
                'tanggalPelaksanaan' => $this->dateOnly($r['tanggal_pelaksanaan']),
                'jumlahPeserta'      => (int) $r['jumlah_peserta'],
                'file_name'          => $r['file_name'],
                'file_path'          => $r['file_path'],
                'catatan'            => $r['catatan'],
                'sumber'             => $r['sumber'],
                'timestamp'          => $r['timestamp'],
                'peserta'            => $pesertaMap[$r['ba_id']] ?? [],
            ];
        }

        return $out;
    }

    private function actorEmail(array $bagian): string
    {
        $email = trim((string) ($bagian['email'] ?? ''));

        return $email !== '' ? $email : ($bagian['nama'] ?? 'bagian');
    }
}
