<?php

namespace App\Libraries;

use App\Models\PengajuanModel;
use Dompdf\Dompdf;
use Dompdf\Options;

class FinalPdfService
{
    private const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    private const TEMPLATE = 'acc_final.html';

    public function enhance(array $pengajuan, array $details): array
    {
        $data = [
            'NomorSurat'       => $this->str($pengajuan['nomor_surat'] ?? ''),
            'NPM'              => $this->str($pengajuan['npm'] ?? ''),
            'Nama Lengkap'     => $this->str($pengajuan['nama_lengkap'] ?? ''),
            'Email'            => $this->str($pengajuan['email'] ?? ''),
            'No. HP/WA'        => $this->str($pengajuan['no_hp_wa'] ?? ''),
            'Blok'             => $this->str($pengajuan['blok'] ?? ''),
            'Jenis Kegiatan'   => $this->str($pengajuan['jenis_kegiatan'] ?? ''),
            'Status'           => 'Final',
            'Catatan Admin'    => $this->str($pengajuan['catatan_admin'] ?? ''),
            'Keterangan'       => $this->str($pengajuan['keterangan'] ?? ''),
            'TanggalPengajuan' => $this->formatDate($pengajuan['timestamp'] ?? null),
            'TanggalSurat'     => $this->formatDate(null),
        ];

        $parts = [];
        $tanggal = '';
        foreach ($details as $d) {
            $pil = $this->str($d['pilihan'] ?? '');
            $det = $this->str($d['detail'] ?? '');
            $tgl = $this->str($d['tanggal_pelaksanaan'] ?? '');
            if ($pil !== '' || $det !== '') {
                $parts[] = implode(' - ', array_values(array_filter([$pil, $det], static fn ($v) => $v !== '')));
            }
            if ($tanggal === '' && $tgl !== '') {
                $tanggal = $tgl;
            }
        }
        $data['DetailKegiatan'] = implode('; ', $parts);
        $data['TanggalKegiatan'] = $tanggal !== '' ? $this->formatDate($tanggal) : '';

        return $data;
    }

    public function renderHtml(array $pengajuan, array $details): string
    {
        $path = APPPATH . 'Templates/' . self::TEMPLATE;
        $html = (string) @file_get_contents($path);

        foreach ($this->enhance($pengajuan, $details) as $key => $value) {
            $html = str_replace('{{' . $key . '}}', $this->escape($value), $html);
        }

        $html = $this->injectLogo($html);

        return $this->stripPreviewArtifacts($html);
    }

    public function generate(array $pengajuan, array $details): array
    {
        try {
            $options = new Options();
            $options->set('isRemoteEnabled', false);
            $options->set('isHtml5ParserEnabled', true);
            $options->set('chroot', realpath(APPPATH . 'Templates') ?: APPPATH . 'Templates');

            $dompdf = new Dompdf($options);
            $dompdf->loadHtml($this->renderHtml($pengajuan, $details));
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            $bytes = (string) $dompdf->output();
            if (!str_starts_with($bytes, '%PDF')) {
                return ['ok' => false, 'bytes' => '', 'message' => 'Output PDF tidak valid.'];
            }

            return ['ok' => true, 'bytes' => $bytes, 'message' => 'PDF berhasil dibuat.'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'bytes' => '', 'message' => 'Gagal membuat PDF: ' . $e->getMessage()];
        }
    }

    public function ensurePdf(array $pengajuan, array $details): array
    {
        $existing = $this->str($pengajuan['path_final'] ?? '');
        if ($existing !== '' && is_file(WRITEPATH . 'uploads/' . ltrim($existing, '/'))) {
            return ['ok' => true, 'path' => $existing, 'generated' => false, 'message' => 'PDF final sudah tersedia.'];
        }

        $res = $this->generate($pengajuan, $details);
        if (!$res['ok']) {
            return ['ok' => false, 'path' => '', 'generated' => false, 'message' => $res['message']];
        }

        $dir = WRITEPATH . 'uploads/final';
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            return ['ok' => false, 'path' => '', 'generated' => false, 'message' => 'Folder penyimpanan PDF tidak dapat dibuat.'];
        }

        $base = $this->str($pengajuan['id_pengajuan'] ?? 'pengajuan');
        $name = 'final-' . preg_replace('/[^A-Za-z0-9._-]+/', '_', $base) . '-' . bin2hex(random_bytes(4)) . '.pdf';
        if (@file_put_contents($dir . '/' . $name, $res['bytes']) === false) {
            return ['ok' => false, 'path' => '', 'generated' => false, 'message' => 'Gagal menyimpan PDF final.'];
        }

        $rel = 'final/' . $name;
        if (!empty($pengajuan['id'])) {
            (new PengajuanModel())->update((int) $pengajuan['id'], ['path_final' => $rel]);
        }

        return ['ok' => true, 'path' => $rel, 'generated' => true, 'message' => 'PDF final dibuat.'];
    }

    private function injectLogo(string $html): string
    {
        $logo = APPPATH . 'Templates/assets/umsu-logo.png';
        if (!is_file($logo)) {
            return $html;
        }
        $data = 'data:image/png;base64,' . base64_encode((string) file_get_contents($logo));
        $html = preg_replace('/src="https:\/\/drive\.google\.com\/thumbnail\?id=[^"]*"/i', 'src="' . $data . '"', $html);
        $html = preg_replace('/\s+onerror="[^"]*"/i', '', (string) $html);

        return (string) $html;
    }

    private function stripPreviewArtifacts(string $html): string
    {
        $html = preg_replace('/<div class="preview-bar no-print">[\s\S]*?<\/div>/i', '', $html);
        $html = preg_replace('/<p class="hint no-print">[\s\S]*?<\/p>/i', '', (string) $html);
        $html = preg_replace('/<script[\s\S]*?<\/script>/i', '', (string) $html);

        return (string) $html;
    }

    private function formatDate($value): string
    {
        if ($value === null || $value === '') {
            $ts = time();
        } elseif ($value instanceof \DateTimeInterface) {
            $ts = $value->getTimestamp();
        } else {
            $ts = strtotime((string) $value);
            if ($ts === false) {
                return '';
            }
        }

        return date('j', $ts) . ' ' . self::MONTHS[(int) date('n', $ts) - 1] . ' ' . date('Y', $ts);
    }

    private function escape(string $value): string
    {
        return str_replace(
            ["\r\n", "\r", "\n", '&', '<', '>', '"', "'"],
            ['<br />', '<br />', '<br />', '&amp;', '&lt;', '&gt;', '&quot;', '&#39;'],
            $value
        );
    }

    private function str($value): string
    {
        return trim((string) ($value ?? ''));
    }
}
