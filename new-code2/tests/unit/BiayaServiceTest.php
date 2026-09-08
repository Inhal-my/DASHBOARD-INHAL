<?php

use App\Libraries\BiayaService;
use App\Models\CheckDataModel;
use App\Models\PengajuanModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

final class BiayaServiceTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;

    protected $npmCounter = 2000000000;

    public function testResolveUsesOverrideAboveMaster(): void
    {
        $pm = new PengajuanModel();
        $idA = $this->makePengajuan($pm);
        $idB = $this->makePengajuan($pm);

        $service = new BiayaService();
        $service->setOverride((int) $idA, 'UTS', 75000);

        $this->assertSame(75000.0, $service->override((int) $idA));
        $this->assertSame(75000.0, $service->resolve((int) $idA, 'UTS'));

        $this->assertNull($service->override((int) $idB));
        $this->assertSame(50000.0, $service->resolve((int) $idB, 'UTS'));
        $this->assertNull($service->resolve((int) $idB, 'Kegiatan Tidak Ada'));

        (new CheckDataModel())->where('pengajuan_id', (int) $idA)->delete();
        $pm->delete($idA);
        $pm->delete($idB);
    }

    private function makePengajuan(PengajuanModel $pm): int
    {
        $npm = (string) ($this->npmCounter++);
        $pm->insert([
            'id_pengajuan'        => 'INHAL-' . $npm,
            'timestamp'           => date('Y-m-d H:i:s'),
            'npm'                 => $npm,
            'nama_lengkap'        => 'Mahasiswa Test',
            'email'               => $npm . '@inhal.test',
            'no_hp_wa'            => '081234567890',
            'blok'                => 'Blok 1',
            'jenis_kegiatan'      => 'Ujian',
            'matakuliah'          => 'KIM101',
            'dosen'               => 'Dr. Andi, M.Pd.',
            'tanggal_pelaksanaan' => '2026-01-15',
            'keterangan'          => '',
            'status'              => 'Menunggu',
        ]);

        return (int) $pm->getInsertID();
    }
}
