<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Email as EmailConfig;

class EmailTest extends BaseCommand
{
    protected $group       = 'INHAL';
    protected $name        = 'email:test';
    protected $description = 'Kirim email uji memakai konfigurasi SMTP yang aktif.';
    protected $usage       = 'email:test <tujuan>';
    protected $arguments   = [
        'tujuan' => 'Alamat email tujuan pengujian.',
    ];

    public function run(array $params)
    {
        $to = trim((string) ($params[0] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            CLI::error('Alamat tujuan tidak valid: ' . ($to !== '' ? $to : '(kosong)'));

            return EXIT_ERROR;
        }

        $config = new EmailConfig();
        if ($config->fromEmail === '') {
            CLI::error('email.fromEmail belum diisi pada .env.');

            return EXIT_ERROR;
        }

        $email = \Config\Services::email();
        $email->setFrom($config->fromEmail, $config->fromName);
        $email->setTo($to);
        $email->setSubject('Uji Email INHAL');
        $email->setMessage('<p>Ini email uji dari aplikasi INHAL. Jika Anda menerima pesan ini, konfigurasi SMTP sudah benar.</p>');

        if ($email->send()) {
            CLI::write('Email uji terkirim ke ' . $to . '.', 'green');

            return EXIT_SUCCESS;
        }

        CLI::error('Gagal mengirim email uji.');
        CLI::write($email->printDebugger(['headers']));

        return EXIT_ERROR;
    }
}
