<?php

namespace App\Controllers\Api;

use App\Models\DetailKegiatanModel;
use App\Models\PengajuanModel;
use App\Models\StatusHistoryModel;

class PengajuanApi extends BaseApi
{
    public function register()
    {
        $r = $this->request->getJSON(true) ?? [];
        $npm = trim($r['npm'] ?? '');
        $nama = trim($r['namaLengkap'] ?? '');
        $email = trim($r['email'] ?? '');
        $noHp = trim($r['noHp'] ?? '');
        $errors = [];
        if ($npm === '' || $nama === '') {
            $errors['npm'] = 'NPM dan Nama Lengkap wajib diisi.';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Email aktif wajib diisi dengan format yang benar.';
        }
        if (!preg_match('/^[0-9+\-\s().]{8,20}$/', $noHp)) {
            $errors['noHp'] = 'No. HP/WhatsApp wajib diisi dengan format yang benar.';
        }
        if ($errors) {
            return $this->respondValidation($errors);
        }

        $jenis = trim($r['jenisKegiatan'] ?? '');
        $rows = $this->detailRows($r, $jenis);
        if (!$rows) {
            return $this->respondErr('Detail kegiatan tidak valid.', 400);
        }
        $tanggal = $rows[0]['tanggal'] ?? null;

        $pm = new PengajuanModel();
        $dups = $pm->where('npm', $npm)
            ->where('jenis_kegiatan', $jenis)
            ->where('matakuliah', trim($r['matakuliah'] ?? ''))
            ->where('tanggal_pelaksanaan', $tanggal)
            ->findAll();
        if ($dups) {
            return $this->respondErr('Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.', 409);
        }

        $idPengajuan = inhal_id('INHAL');
        $now = date('Y-m-d H:i:s');
        $pm->insert([
            'id_pengajuan'         => $idPengajuan,
            'timestamp'            => $now,
            'npm'                  => $npm,
            'nama_lengkap'         => $nama,
            'email'                => $email,
            'no_hp_wa'             => $noHp,
            'blok'                 => trim($r['blok'] ?? ''),
            'jenis_kegiatan'       => $jenis,
            'matakuliah'           => trim($r['matakuliah'] ?? ''),
            'dosen'                => trim($r['dosen'] ?? ''),
            'tanggal_pelaksanaan'  => $tanggal,
            'keterangan'           => trim($r['keterangan'] ?? ''),
            'status'               => 'Menunggu',
        ]);
        $pengajuanId = $pm->getInsertID();

        $dm = new DetailKegiatanModel();
        foreach ($rows as $row) {
            $dm->insert([
                'pengajuan_id'        => $pengajuanId,
                'id_pengajuan'        => $idPengajuan,
                'timestamp'           => $now,
                'jenis_kegiatan'      => $jenis,
                'pilihan'             => $row['pilihan'],
                'detail'              => $row['detail'],
                'tanggal_pelaksanaan' => $row['tanggal'],
                'bagian'              => '',
            ]);
        }

        (new StatusHistoryModel())->insert([
            'pengajuan_id' => $pengajuanId,
            'id_pengajuan' => $idPengajuan,
            'timestamp'    => $now,
            'status'       => 'Menunggu',
            'catatan'      => 'Pendaftaran baru',
            'actor_email'  => $email,
        ]);

        return $this->respondOk([
            'id_pengajuan' => $idPengajuan,
            'message'      => 'Pengajuan berhasil dikirim.',
        ]);
    }

    private function detailRows(array $r, string $jenis): array
    {
        $rows = [];
        $tanggal = $r['tanggalKegiatan'] ?? null;
        if ($jenis === 'Ujian') {
            $rows[] = ['pilihan' => trim($r['detailKegiatan'] ?? ''), 'detail' => '', 'tanggal' => $tanggal];
        } elseif ($jenis === 'SGD') {
            $rows[] = [
                'pilihan' => trim($r['pilihanSgd'] ?? ''),
                'detail'  => trim($r['detailSgd'] ?? ''),
                'tanggal' => $tanggal,
            ];
        } elseif ($jenis === 'KKD') {
            $rows[] = [
                'pilihan' => trim($r['pilihanKkd'] ?? ''),
                'detail'  => trim($r['detailKkd'] ?? ''),
                'tanggal' => $tanggal,
            ];
        } elseif ($jenis === 'Praktikum') {
            foreach (($r['praktikum'] ?? []) as $p) {
                $lab = trim($p['lab'] ?? '');
                $kegiatan = trim($p['kegiatanLab'] ?? '');
                if ($lab !== '' || $kegiatan !== '') {
                    $rows[] = ['pilihan' => $lab, 'detail' => $kegiatan, 'tanggal' => $p['tanggal'] ?? null];
                }
            }
        }

        return $rows;
    }
}
