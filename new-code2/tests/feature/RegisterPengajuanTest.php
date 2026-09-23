<?php

use App\Models\PengajuanModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;

final class RegisterPengajuanTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $migrate = false;

    protected $npm;

    protected function setUp(): void
    {
        parent::setUp();

        $this->npm = '2' . substr((string) hrtime(true), -9);
    }

    private function payload(): array
    {
        return [
            'npm'             => $this->npm,
            'namaLengkap'     => 'Mahasiswa Registrasi',
            'email'           => $this->npm . '@inhal.test',
            'noHp'            => '081298765432',
            'blok'            => 'Blok 1',
            'jenisKegiatan'   => 'Ujian',
            'matakuliah'      => 'KIM101',
            'dosen'           => 'Dr. Andi, M.Pd.',
            'tanggalKegiatan' => '2026-01-15',
            'detailKegiatan'  => 'UTS',
        ];
    }

    private function decoded(TestResponse $res): array
    {
        $raw = $res->getJSON();

        return is_string($raw) ? (json_decode($raw, true) ?? []) : [];
    }

    public function testRegisterValid(): void
    {
        $res = $this->withBodyFormat('json')->post('api/pengajuan', $this->payload());

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $idPengajuan = $body['data']['id_pengajuan'];
        $this->assertNotEmpty($idPengajuan);
        $this->seeInDatabase('pengajuan', ['id_pengajuan' => $idPengajuan, 'status' => 'Menunggu']);
        $this->seeInDatabase('detail_kegiatan', ['id_pengajuan' => $idPengajuan, 'pilihan' => 'UTS']);
        $this->seeInDatabase('status_history', ['id_pengajuan' => $idPengajuan]);

        $this->cleanupPengajuan($idPengajuan);
    }

    public function testRegisterValidationError(): void
    {
        $p = $this->payload();
        $p['email'] = 'bukan-email';
        $p['noHp'] = 'abc';

        $res = $this->withBodyFormat('json')->post('api/pengajuan', $p);

        $res->assertStatus(422);
        $body = $this->decoded($res);
        $this->assertFalse($body['ok']);
        $this->assertArrayHasKey('email', $body['errors']);
        $this->assertArrayHasKey('noHp', $body['errors']);
        $this->dontSeeInDatabase('pengajuan', ['npm' => $this->npm]);
    }

    public function testRegisterDuplicateRejected(): void
    {
        $first = $this->withBodyFormat('json')->post('api/pengajuan', $this->payload());
        $first->assertStatus(200);
        $idPengajuan = $this->decoded($first)['data']['id_pengajuan'];

        $dup = $this->withBodyFormat('json')->post('api/pengajuan', $this->payload());
        $dup->assertStatus(409);
        $this->assertFalse($this->decoded($dup)['ok']);

        $count = (new PengajuanModel())->where('npm', $this->npm)->countAllResults();
        $this->assertSame(1, $count);

        $this->cleanupPengajuan($idPengajuan);
    }

    public function testUpdateStatusEmptyCatatanDoesNotOverwriteCatatanAdmin(): void
    {
        $res = $this->withBodyFormat('json')->post('api/pengajuan', $this->payload());
        $res->assertStatus(200);
        $idPengajuan = $this->decoded($res)['data']['id_pengajuan'];

        $session = ['auth' => ['role' => 'admin', 'nama' => 'Admin Test']];
        $pm = new PengajuanModel();
        $row = $pm->where('id_pengajuan', $idPengajuan)->first();

        $put1 = $this->withBodyFormat('json')->withSession($session)
            ->put('api/pengajuan/' . $idPengajuan . '/status', ['status' => 'Diterima', 'catatan' => 'Catatan Awal']);
        $put1->assertStatus(200);

        $put2 = $this->withBodyFormat('json')->withSession($session)
            ->put('api/pengajuan/' . $idPengajuan . '/status', ['status' => 'ACC', 'catatan' => '']);
        $put2->assertStatus(200);

        $this->seeInDatabase('pengajuan', ['id' => $row['id'], 'status' => 'ACC', 'catatan_admin' => 'Catatan Awal']);

        $this->cleanupPengajuan($idPengajuan);
    }

    private function cleanupPengajuan(string $idPengajuan): void
    {
        db_connect()->table('audit_log')->where('target', $idPengajuan)->delete();
        (new PengajuanModel())->where('id_pengajuan', $idPengajuan)->delete();
    }
}
