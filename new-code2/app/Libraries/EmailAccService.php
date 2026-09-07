<?php

namespace App\Libraries;

use App\Models\EmailTemplateModel;

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
        $email = \Config\Services::email();
        $email->setFrom($this->config->fromEmail, $this->config->fromName);
        $email->setTo($vars['email']);
        $email->setSubject($this->fill($tpl['subjek'], $vars));
        $email->setMessage($this->fill($tpl['body_html'], $vars));
        if (!$email->send()) {
            return ['ok' => false, 'message' => $email->printDebugger(['headers'])];
        }
        return ['ok' => true, 'message' => 'Email terkirim.'];
    }

    private function fill(string $text, array $vars): string
    {
        foreach ($vars as $k => $v) {
            $text = str_replace('{' . strtoupper($k) . '}', (string) $v, $text);
        }
        return $text;
    }
}
