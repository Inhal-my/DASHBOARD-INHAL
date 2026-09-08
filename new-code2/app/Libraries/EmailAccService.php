<?php

namespace App\Libraries;

use App\Models\EmailTemplateModel;
use App\Models\MasterBagianModel;
use App\Models\PengajuanModel;

class EmailAccService
{
    private \Config\Email $config;

    public function __construct()
    {
        $this->config = new \Config\Email();
    }

    public function sendStatus(string $kodeTemplate, array $vars): array
    {
        $tpl = (new EmailTemplateModel())->where('kode', $kodeTemplate)->first();
        if (!$tpl || !$tpl['aktif']) {
            return ['ok' => false, 'message' => 'Template email tidak tersedia atau nonaktif.'];
        }
        try {
            $email = \Config\Services::email();
            $email->setFrom($this->config->fromEmail, $this->config->fromName);
            $email->setTo($vars['email']);
            $email->setSubject($this->fill($tpl['subjek'], $vars));
            $email->setMessage($this->fill($tpl['body_html'], $vars));
            if (!$email->send()) {
                return ['ok' => false, 'message' => $email->printDebugger(['headers'])];
            }
            return ['ok' => true, 'message' => 'Email terkirim.'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    public function sendFinal(array $pengajuan, array $details): array
    {
        $nomor = $this->ensureNomorSurat($pengajuan);
        $vars = $this->varsFor($pengajuan, $nomor);

        $studentEmail = trim((string) ($pengajuan['email'] ?? ''));
        $studentSent = false;
        $studentNote = '';
        if ($studentEmail === '') {
            $studentNote = 'Email mahasiswa tidak ditemukan.';
        } else {
            $res = $this->sendTemplate('acc_final', $vars, $studentEmail, $this->finalAttachments($pengajuan));
            $studentSent = $res['ok'];
            if (!$studentSent) {
                $studentNote = 'Email mahasiswa tidak terkirim: ' . $res['message'];
            }
        }

        $bagian = $this->resolveBagianEmail($pengajuan, $details);
        $bagianSent = false;
        $bagianNote = '';
        if ($bagian['email'] === '') {
            $bagianNote = "Email untuk Bagian '" . ($bagian['nama'] !== '' ? $bagian['nama'] : '-') . "' tidak ditemukan.";
        } else {
            $bv = $vars;
            $bv['nama'] = 'Admin Bagian ' . $bagian['nama'];
            $res = $this->sendTemplate('acc_final', $bv, $bagian['email'], $this->finalAttachments($pengajuan));
            $bagianSent = $res['ok'];
            if (!$bagianSent) {
                $bagianNote = 'Email Bagian tidak terkirim: ' . $res['message'];
            }
        }

        $notes = [];
        if (!$studentSent) {
            $notes[] = $studentNote;
        }
        if (!$bagianSent) {
            $notes[] = $bagianNote;
        }

        return [
            'ok'               => $studentSent || $bagianSent,
            'message'          => $notes !== [] ? implode(' ', $notes) : 'Email final terkirim.',
            'nomorSurat'       => $nomor,
            'studentEmailSent' => $studentSent,
            'bagianEmailSent'  => $bagianSent,
            'bagianName'       => $bagian['nama'],
            'bagianEmail'      => $bagian['email'],
        ];
    }

    public function sendAccFinalToBagian(array $pengajuan, array $details): array
    {
        $nomor = $this->ensureNomorSurat($pengajuan);
        $bagian = $this->resolveBagianEmail($pengajuan, $details);
        if ($bagian['email'] === '') {
            return [
                'ok'          => false,
                'message'     => "Email Bagian untuk '" . ($bagian['nama'] !== '' ? $bagian['nama'] : '-') . "' tidak ditemukan. Cek Master Bagian / Master Data.",
                'nomorSurat'  => $nomor,
                'bagianName'  => $bagian['nama'],
                'bagianEmail' => '',
            ];
        }
        $vars = $this->varsFor($pengajuan, $nomor);
        $vars['nama'] = 'Admin Bagian ' . $bagian['nama'];
        $res = $this->sendTemplate('acc_final', $vars, $bagian['email'], $this->finalAttachments($pengajuan));
        if (!$res['ok']) {
            return [
                'ok'          => false,
                'message'     => 'Gagal mengirim email: ' . $res['message'],
                'nomorSurat'  => $nomor,
                'bagianName'  => $bagian['nama'],
                'bagianEmail' => $bagian['email'],
            ];
        }
        return [
            'ok'          => true,
            'message'     => "Email final terkirim ke Bagian '" . $bagian['nama'] . "' (" . $bagian['email'] . ').',
            'nomorSurat'  => $nomor,
            'bagianName'  => $bagian['nama'],
            'bagianEmail' => $bagian['email'],
        ];
    }

    private function ensureNomorSurat(array $pengajuan): string
    {
        $nomor = trim((string) ($pengajuan['nomor_surat'] ?? ''));
        if ($nomor === '') {
            $nomor = (new NomorSuratService())->next('INHAL');
            (new PengajuanModel())->update((int) $pengajuan['id'], ['nomor_surat' => $nomor]);
        }
        return $nomor;
    }

    private function sendTemplate(string $kodeTemplate, array $vars, string $recipient, array $attachments = []): array
    {
        $tpl = (new EmailTemplateModel())->where('kode', $kodeTemplate)->first();
        if (!$tpl || !$tpl['aktif']) {
            return ['ok' => false, 'message' => 'Template email tidak tersedia atau nonaktif.'];
        }
        try {
            $email = \Config\Services::email();
            $email->setFrom($this->config->fromEmail, $this->config->fromName);
            $email->setTo($recipient);
            $email->setSubject($this->fill($tpl['subjek'], $vars));
            $email->setMessage($this->fill($tpl['body_html'], $vars));
            foreach ($attachments as $attachPath) {
                $full = WRITEPATH . 'uploads/' . ltrim($attachPath, '/');
                $real = realpath($full);
                if ($real !== false && is_file($real)) {
                    $email->attach($real);
                }
            }
            if (!$email->send()) {
                return ['ok' => false, 'message' => (string) $email->printDebugger(['headers'])];
            }
            return ['ok' => true, 'message' => 'Email terkirim.'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    private function finalAttachments(array $pengajuan): array
    {
        $final = trim((string) ($pengajuan['path_final'] ?? ''));
        $acc = trim((string) ($pengajuan['path_acc_inhal'] ?? ''));
        $attachments = [];
        foreach ([$final, $acc] as $rel) {
            if ($rel === '') {
                continue;
            }
            $full = WRITEPATH . 'uploads/' . ltrim($rel, '/');
            if (is_file($full)) {
                $attachments[] = $rel;
            }
        }
        return $attachments;
    }

    private function varsFor(array $pengajuan, string $nomor): array
    {
        return [
            'nama'       => (string) ($pengajuan['nama_lengkap'] ?? ''),
            'npm'        => (string) ($pengajuan['npm'] ?? ''),
            'email'      => (string) ($pengajuan['email'] ?? ''),
            'nomor_surat'=> $nomor,
            'catatan'    => (string) ($pengajuan['catatan_admin'] ?? ''),
            'blok'       => (string) ($pengajuan['blok'] ?? ''),
        ];
    }

    private function resolveBagianEmail(array $pengajuan, array $details): array
    {
        $map = [];
        foreach ((new MasterBagianModel())->findAll() as $row) {
            $email = trim((string) ($row['email'] ?? ''));
            if ($email === '') {
                continue;
            }
            foreach (['lab', 'kegiatan_lab', 'bagian'] as $field) {
                $value = trim((string) ($row[$field] ?? ''));
                if ($value !== '') {
                    $map[$this->norm($value)] = ['nama' => $value, 'email' => $email];
                }
            }
        }

        $candidates = [];
        if (trim((string) ($pengajuan['blok'] ?? '')) !== '') {
            $candidates[] = trim((string) $pengajuan['blok']);
        }
        foreach ($details as $d) {
            foreach (['bagian', 'pilihan', 'detail'] as $field) {
                $value = trim((string) ($d[$field] ?? ''));
                if ($value !== '') {
                    $candidates[] = $value;
                }
            }
        }
        if (trim((string) ($pengajuan['jenis_kegiatan'] ?? '')) !== '') {
            $candidates[] = trim((string) $pengajuan['jenis_kegiatan']);
        }

        $seen = [];
        foreach ($candidates as $candidate) {
            $key = $this->norm($candidate);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            if (isset($map[$key])) {
                return $map[$key];
            }
        }
        return ['nama' => $candidates[0] ?? '', 'email' => ''];
    }

    private function norm($value): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', (string) $value));
    }

    private function fill(string $text, array $vars): string
    {
        foreach ($vars as $k => $v) {
            $text = str_replace('{' . strtoupper($k) . '}', (string) $v, $text);
        }
        return $text;
    }
}
