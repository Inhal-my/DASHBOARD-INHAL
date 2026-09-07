<?php

namespace App\Controllers\Api;

use App\Libraries\EmailAccService;
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

    public function emailStatus(string $idPengajuan)
    {
        $this->requireAdmin();
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        $status = trim((string) ($p['status'] ?? ''));
        if ($status !== 'Diterima' && $status !== 'Ditolak') {
            return $this->respondErr('Email notifikasi hanya untuk status Diterima/Ditolak. Status saat ini: ' . ($status !== '' ? $status : '-'), 400);
        }
        $kode = $status === 'Ditolak' ? 'acc_ditolak' : 'acc_diterima';
        $res = (new EmailAccService())->sendStatus($kode, [
            'nama'       => trim((string) ($p['nama_lengkap'] ?? '')),
            'npm'        => trim((string) ($p['npm'] ?? '')),
            'email'      => trim((string) ($p['email'] ?? '')),
            'nomor_surat'=> trim((string) ($p['nomor_surat'] ?? '')),
            'catatan'    => trim((string) ($p['catatan_admin'] ?? '')),
        ]);
        $upd = $res['ok']
            ? ['status_notifikasi_email' => 'Terkirim', 'notifikasi_terkirim_pada' => date('Y-m-d H:i:s'), 'error_notifikasi_email' => null]
            : ['status_notifikasi_email' => 'Gagal', 'error_notifikasi_email' => $res['message']];
        $pm->update($p['id'], $upd);
        audit_log_add($this->actor(), 'EMAIL_STATUS', $idPengajuan, $kode . '=' . ($res['ok'] ? 'Terkirim' : 'Gagal'));
        if ($res['ok']) {
            return $this->respondOk(['message' => 'Email terkirim.']);
        }
        return $this->respondErr('Gagal mengirim email: ' . $res['message'], 500);
    }

    public function emailFinal(string $idPengajuan)
    {
        $this->requireAdmin();
        $pm = new PengajuanModel();
        $p = $pm->findByIdPengajuan($idPengajuan);
        if (!$p) {
            return $this->respondErr('Pengajuan tidak ditemukan.', 404);
        }
        if (trim((string) ($p['status'] ?? '')) !== 'ACC') {
            return $this->respondErr('Email final hanya untuk pengajuan berstatus ACC. Status saat ini: ' . trim((string) ($p['status'] ?? '-')), 409);
        }
        $details = (new DetailKegiatanModel())
            ->where('id_pengajuan', $idPengajuan)
            ->orderBy('timestamp', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        $res = (new EmailAccService())->sendFinal($p, $details);
        $nomor = trim((string) ($res['nomorSurat'] ?? ''));
        $bagianStatus = $res['bagianEmailSent'] ? 'Terkirim' : ($res['bagianEmail'] !== '' ? 'Gagal' : 'Belum dikirim');
        $pm->update($p['id'], [
            'email_bagian'       => trim((string) ($res['bagianEmail'] ?? '')),
            'status_info_bagian' => $bagianStatus,
            'waktu_info_bagian'  => date('Y-m-d H:i:s'),
            'catatan_info_bagian'=> $res['bagianEmailSent'] ? '' : (string) ($res['message'] ?? ''),
        ]);
        audit_log_add($this->actor(), 'EMAIL_FINAL', $idPengajuan, 'nomor=' . $nomor . ', mahasiswa=' . ($res['studentEmailSent'] ? 'Terkirim' : 'Gagal') . ', bagian=' . $bagianStatus);
        if ($res['ok']) {
            return $this->respondOk([
                'message'           => $res['message'],
                'nomorSurat'        => $nomor,
                'studentEmailSent'  => $res['studentEmailSent'],
                'bagianEmailSent'   => $res['bagianEmailSent'],
            ]);
        }
        return $this->respondErr('Gagal mengirim email final: ' . $res['message'], 500);
    }

    public function emailBagian(string $idPengajuan)
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
        $res = (new EmailAccService())->sendAccFinalToBagian($p, $details);
        $bagianStatus = $res['ok'] ? 'Terkirim' : 'Gagal';
        $pm->update($p['id'], [
            'email_bagian'       => trim((string) ($res['bagianEmail'] ?? '')),
            'status_info_bagian' => $bagianStatus,
            'waktu_info_bagian'  => date('Y-m-d H:i:s'),
            'catatan_info_bagian'=> $res['ok'] ? 'Dikirim ulang khusus ke Bagian oleh Admin' : (string) ($res['message'] ?? ''),
        ]);
        audit_log_add($this->actor(), 'EMAIL_BAGIAN', $idPengajuan, 'status=' . $bagianStatus);
        if ($res['ok']) {
            return $this->respondOk(['message' => $res['message'], 'bagianEmail' => $res['bagianEmail']]);
        }
        return $this->respondErr('Gagal mengirim email: ' . $res['message'], 500);
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

    private function actor(): string
    {
        return (string) ((new \App\Libraries\AuthService())->sessionAuth()['nama'] ?? 'admin');
    }
}
