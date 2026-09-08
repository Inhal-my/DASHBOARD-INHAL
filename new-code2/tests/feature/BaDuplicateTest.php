<?php

use App\Models\BeritaAcaraModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

final class BaDuplicateTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;

    private const BA_ID = 'BA-TEST-DUP';

    public function testDuplicateDetectedRegardlessOfDatetimeString(): void
    {
        $model = new BeritaAcaraModel();
        $now = date('Y-m-d H:i:s');
        $model->insert([
            'timestamp'           => $now,
            'ba_id'               => self::BA_ID,
            'bagian'              => 'SGD',
            'blok'                => 'Blok 1',
            'nama_kegiatan'       => 'SGD 1',
            'tanggal_pelaksanaan' => '2026-01-15',
            'jumlah_peserta'      => 2,
        ]);

        $dupDateOnly = $model->where('bagian', 'SGD')
            ->where('blok', 'Blok 1')
            ->where('nama_kegiatan', 'SGD 1')
            ->where('tanggal_pelaksanaan', '2026-01-15')
            ->first();
        $this->assertNotNull($dupDateOnly);

        $dupDatetime = $model->where('bagian', 'SGD')
            ->where('blok', 'Blok 1')
            ->where('nama_kegiatan', 'SGD 1')
            ->where('tanggal_pelaksanaan', '2026-01-15 00:00:00')
            ->first();
        $this->assertNotNull($dupDatetime);

        $differentDate = $model->where('bagian', 'SGD')
            ->where('blok', 'Blok 1')
            ->where('nama_kegiatan', 'SGD 1')
            ->where('tanggal_pelaksanaan', '2026-01-16')
            ->first();
        $this->assertNull($differentDate);

        $model->where('ba_id', self::BA_ID)->delete();
    }
}
