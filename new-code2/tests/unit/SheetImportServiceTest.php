<?php

use App\Libraries\SheetImportService;
use CodeIgniter\Test\CIUnitTestCase;

final class SheetImportServiceTest extends CIUnitTestCase
{
    private function service(): SheetImportService
    {
        return new SheetImportService('dummy-sheet', sys_get_temp_dir());
    }

    public function testCellValueConvertsGvizDateTimes(): void
    {
        $service = $this->service();
        $this->assertSame('2026-08-16 20:52:51', $service->cellValue(['v' => 'Date(2026,7,16,20,52,51)']));
        $this->assertSame('2026-08-22', $service->cellValue(['v' => 'Date(2026,7,22)']));
    }

    public function testCellValuePrefersFormattedNumber(): void
    {
        $service = $this->service();
        $this->assertSame('2408260111', $service->cellValue(['v' => 2.408260111e9, 'f' => '2408260111']));
        $this->assertSame('82162445517', $service->cellValue(['v' => 8.2162445517e10]));
    }

    public function testCellValueHandlesEmptyAndBooleans(): void
    {
        $service = $this->service();
        $this->assertSame('', $service->cellValue(null));
        $this->assertSame('', $service->cellValue(['v' => null]));
        $this->assertSame('1', $service->cellValue(['v' => true]));
        $this->assertSame('0', $service->cellValue(['v' => false]));
    }

    public function testTableToRecordsUsesLabels(): void
    {
        $service = $this->service();
        $table = [
            'cols' => [
                ['label' => 'NPM'],
                ['label' => 'Nama Lengkap'],
            ],
            'rows' => [
                ['c' => [['v' => '2201010001'], ['v' => 'Aisyah']]],
            ],
        ];
        $records = $service->tableToRecords($table);
        $this->assertSame([['NPM' => '2201010001', 'Nama Lengkap' => 'Aisyah']], $records);
    }

    public function testTableToRecordsPromotesHeaderWhenNoLabels(): void
    {
        $service = $this->service();
        $table = [
            'cols' => [['label' => ''], ['label' => '']],
            'rows' => [
                ['c' => [['v' => 'Key'], ['v' => 'Value']]],
                ['c' => [['v' => 'BUKTI_MODE'], ['v' => 'lenggang']]],
            ],
        ];
        $this->assertSame([['Key' => 'BUKTI_MODE', 'Value' => 'lenggang']], $service->tableToRecords($table));
    }

    public function testTableToPositionalSkipsHeaderRow(): void
    {
        $service = $this->service();
        $table = [
            'rows' => [
                ['c' => [['v' => 'Email'], ['v' => 'Nama']]],
                ['c' => [['v' => 'satuduatiga'], ['v' => 'Yudha']]],
            ],
        ];
        $records = $service->tableToPositional($table, ['password_hash' => 0, 'nama' => 1]);
        $this->assertSame([['password_hash' => 'satuduatiga', 'nama' => 'Yudha']], $records);
    }

    public function testNormalizeDate(): void
    {
        $service = $this->service();
        $this->assertSame('2026-08-22', $service->normalizeDate('2026-08-22', false));
        $this->assertSame('2026-08-16 20:52:51', $service->normalizeDate('2026-08-16 20:52:51', true));
        $this->assertSame('2026-08-22 00:00:00', $service->normalizeDate('2026-08-22', true));
        $this->assertNull($service->normalizeDate('', false));
    }

    public function testToIntAndToDecimal(): void
    {
        $service = $this->service();
        $this->assertSame(2026, $service->toInt('2026'));
        $this->assertNull($service->toInt(''));
        $this->assertSame('300000', $service->toDecimal('Rp. 300.000'));
        $this->assertSame('300000', $service->toDecimal('300000'));
        $this->assertSame('1250.50', $service->toDecimal('1.250,50'));
        $this->assertNull($service->toDecimal(''));
    }

    public function testToHashHashesPlaintextAndKeepsExistingHash(): void
    {
        $service = $this->service();
        $hashed = $service->toHash('rahasia');
        $this->assertNotNull($hashed);
        $this->assertTrue(password_verify('rahasia', $hashed));
        $this->assertSame($hashed, $service->toHash($hashed));
    }

    public function testSpecsCoverExpectedTables(): void
    {
        $service = $this->service();
        $specs = $service->specs();
        foreach (['mahasiswa', 'pengajuan', 'detail_kegiatan', 'status_history', 'check_data', 'bagian_staff', 'admin'] as $table) {
            $this->assertArrayHasKey($table, $specs);
        }
        $this->assertNotContains('email_templates', array_keys($specs));
    }
}
