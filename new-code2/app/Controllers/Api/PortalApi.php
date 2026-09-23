<?php

namespace App\Controllers\Api;

use App\Libraries\UploadService;
use App\Models\DetailKegiatanModel;
use App\Models\LogUploadModel;
use App\Models\MahasiswaModel;
use App\Models\PengajuanModel;
use CodeIgniter\HTTP\Files\UploadedFile;

class PortalApi extends BaseApi
{
    public function data(string $npm)
    {
        $npm = trim($npm);
        if ($npm === '') {
            return $this->respondErr('NPM tidak boleh kosong');
        }
        $pm = new PengajuanModel();
        $rows = $pm->where('npm', $npm)->orderBy('timestamp', 'DESC')->findAll();
        $dm = new DetailKegiatanModel();
        $nama = '';
        $history = [];
        foreach ($rows as $p) {
            if ($nama === '' && !empty($p['nama_lengkap'])) {
                $nama = $p['nama_lengkap'];
            }
            $details = $dm->where('id_pengajuan', $p['id_pengajuan'])->findAll();
            $history[] = [
                'id'           => $p['id_pengajuan'],
                'idPengajuan'  => $p['id_pengajuan'],
                'tanggalAjuan' => $p['timestamp'],
                'blok'         => $p['blok'],
                'jenis'        => $p['jenis_kegiatan'],
                'matakuliah'   => $p['matakuliah'],
                'detail'       => $this->detailSummary($details)['detail'],
                'tanggal'      => $p['tanggal_pelaksanaan'],
                'status'       => $p['status'],
                'catatan'      => $p['catatan_admin'],
                'hasUpload'    => !empty($p['path_acc_inhal']) || !empty($p['path_bukti_bayar']),
                'linkFinal'    => !empty($p['path_final'])
                    ? '/files/final/' . $p['id_pengajuan'] . '?npm=' . rawurlencode((string) $p['npm'])
                    : '',
            ];
        }
        if ($nama === '') {
            $m = (new MahasiswaModel())->where('npm', $npm)->first();
            $nama = $m['nama_lengkap'] ?? '';
        }
        if ($history === [] && $nama === '') {
            return $this->respondErr('Data pengajuan tidak ditemukan untuk NPM ' . $npm . '.', 404);
        }

        return $this->respondOk([
            'nama'      => $nama !== '' ? $nama : 'Mahasiswa',
            'npm'       => $npm,
            'buktiMode' => config_get('BUKTI_MODE', 'strict'),
            'history'   => $history,
        ]);
    }

    public function uploadBukti(string $idPengajuan)
    {
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $postedNpm = trim((string) $this->request->getPost('npm'));
        if ($postedNpm === '' || $postedNpm !== (string) $p['npm']) {
            return $this->respondErr('NPM tidak cocok dengan pengajuan.', 403);
        }
        $acc = $this->request->getFile('accFile');
        $bukti = $this->request->getFile('buktiFile');
        if (!$acc && !$bukti) {
            return $this->respondErr('Tidak ada file yang diunggah.');
        }
        if ($bukti && config_get('BUKTI_MODE', 'strict') === 'strict' && !$this->isStrictPdf($bukti)) {
            return $this->respondErr('cek berkas gagal, gunakan file pdf dari portal mahasiswa');
        }
        $up = new UploadService();
        $resAcc = ['ok' => true, 'path' => null];
        if ($acc) {
            $resAcc = $up->store('acc', 'acc-' . $idPengajuan, $acc);
            if (!$resAcc['ok']) {
                return $this->respondErr($resAcc['message']);
            }
        }
        $resBukti = ['ok' => true, 'path' => null];
        if ($bukti) {
            $resBukti = $up->store('bukti', 'bukti-' . $idPengajuan, $bukti);
            if (!$resBukti['ok']) {
                return $this->respondErr($resBukti['message']);
            }
        }
        $upd = [];
        if (!empty($resAcc['path'])) {
            $upd['path_acc_inhal'] = $resAcc['path'];
        }
        if (!empty($resBukti['path'])) {
            $upd['path_bukti_bayar'] = $resBukti['path'];
        }
        if ($upd) {
            $pm->update($p['id'], $upd);
        }
        $details = (new DetailKegiatanModel())->where('id_pengajuan', $idPengajuan)->findAll();
        $summary = $this->detailSummary($details);
        (new LogUploadModel())->insert([
            'timestamp'        => date('Y-m-d H:i:s'),
            'pengajuan_id'     => $p['id'],
            'id_pengajuan'     => $idPengajuan,
            'npm'              => $p['npm'],
            'nama_lengkap'     => $p['nama_lengkap'],
            'blok'             => $p['blok'],
            'jenis_kegiatan'   => $p['jenis_kegiatan'],
            'detail'           => $summary['detail'] !== '' ? $summary['detail'] : null,
            'tanggal'          => $summary['tanggal'],
            'path_acc_inhal'   => $resAcc['path'] ?? null,
            'path_bukti_bayar' => $resBukti['path'] ?? null,
        ]);

        return $this->respondOk(['message' => 'Bukti berhasil disimpan.']);
    }

    private function detailSummary(array $details): array
    {
        $parts = [];
        foreach ($details as $d) {
            $bits = array_values(array_filter([$d['pilihan'] ?? '', $d['detail'] ?? '']));
            if ($bits !== []) {
                $parts[] = implode(' - ', $bits);
            }
        }
        $tanggal = isset($details[0]['tanggal_pelaksanaan']) ? $details[0]['tanggal_pelaksanaan'] : null;

        return ['detail' => implode('; ', $parts), 'tanggal' => $tanggal];
    }

    private function isStrictPdf(UploadedFile $file): bool
    {
        if ($file->getMimeType() !== 'application/pdf') {
            return false;
        }
        $head = (string) @file_get_contents($file->getTempName(), false, null, 0, 4);

        return strncmp($head, '%PDF', 4) === 0;
    }
}
