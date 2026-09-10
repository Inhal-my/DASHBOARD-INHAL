<?php

use App\Libraries\FinalPdfService;
use CodeIgniter\Test\CIUnitTestCase;

final class FinalPdfServiceTest extends CIUnitTestCase
{
    private function samplePengajuan(): array
    {
        return [
            'id_pengajuan'        => 'INHAL-TEST-FINAL',
            'nomor_surat'         => '001/INHAL/FKIK-UMSU/I/2026',
            'npm'                 => '2201010001',
            'nama_lengkap'        => 'Budi & <Santoso>',
            'email'               => 'budi@example.com',
            'no_hp_wa'            => '08123456789',
            'blok'                => 'Blok 1',
            'jenis_kegiatan'      => 'Ujian',
            'dosen'               => 'Dr. Andi, M.Pd.',
            'tanggal_pelaksanaan' => '2026-01-15',
            'keterangan'          => 'Keterangan uji',
            'catatan_admin'       => 'Catatan admin',
            'status'              => 'ACC',
            'timestamp'           => '2026-01-10 08:00:00',
        ];
    }

    private function sampleDetails(): array
    {
        return [
            ['pilihan' => 'UTS', 'detail' => 'Modul 1', 'tanggal_pelaksanaan' => '2026-01-15'],
        ];
    }

    public function testEnhanceMapsFieldsAndFormatsDates(): void
    {
        $service = new FinalPdfService();
        $data = $service->enhance($this->samplePengajuan(), $this->sampleDetails());

        $this->assertSame('001/INHAL/FKIK-UMSU/I/2026', $data['NomorSurat']);
        $this->assertSame('2201010001', $data['NPM']);
        $this->assertSame('Budi & <Santoso>', $data['Nama Lengkap']);
        $this->assertSame('UTS - Modul 1', $data['DetailKegiatan']);
        $this->assertSame('15 Januari 2026', $data['TanggalKegiatan']);
        $this->assertSame('10 Januari 2026', $data['TanggalPengajuan']);
        $this->assertArrayHasKey('TanggalSurat', $data);
    }

    public function testRenderHtmlReplacesEscapedTokensAndStripsPreview(): void
    {
        $service = new FinalPdfService();
        $html = $service->renderHtml($this->samplePengajuan(), $this->sampleDetails());

        $this->assertStringNotContainsString('{{NPM}}', $html);
        $this->assertStringContainsString('2201010001', $html);
        $this->assertStringContainsString('Budi &amp; &lt;Santoso&gt;', $html);
        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('class="preview-bar no-print"', $html);
        $this->assertStringNotContainsString('class="hint no-print"', $html);
    }

    public function testGenerateProducesPdfBytes(): void
    {
        $service = new FinalPdfService();
        $res = $service->generate($this->samplePengajuan(), $this->sampleDetails());

        $this->assertTrue($res['ok'], $res['message'] ?? '');
        $this->assertStringStartsWith('%PDF', $res['bytes']);
        $this->assertGreaterThan(1000, strlen($res['bytes']));
    }
}
