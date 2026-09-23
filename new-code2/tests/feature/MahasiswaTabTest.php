<?php

use App\Models\MahasiswaModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;

final class MahasiswaTabTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $migrate = false;

    private $npm;

    private const ADMIN = ['role' => 'admin', 'nama' => 'Admin Test'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->npm = '8' . substr((string) hrtime(true), -9);
    }

    private function session(): array
    {
        return ['auth' => self::ADMIN];
    }

    private function decoded(TestResponse $res): array
    {
        $raw = $res->getJSON();

        return is_string($raw) ? (json_decode($raw, true) ?? []) : [];
    }

    public function testGetRequiresAdminSession(): void
    {
        $res = $this->get('api/pengaturan/mahasiswa');

        $res->assertStatus(401);
    }

    public function testGetListOk(): void
    {
        $res = $this->withSession($this->session())->get('api/pengaturan/mahasiswa');

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->assertIsArray($body['data']);
    }

    public function testSaveAddsNewMahasiswa(): void
    {
        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [
                    ['npm' => $this->npm, 'nama_lengkap' => 'Mahasiswa Tambah'],
                ],
            ]);

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->assertSame(1, $body['data']['added']);
        $this->assertSame([], $body['data']['skipped']);
        $addedRow = null;
        foreach ($body['data']['list'] as $row) {
            if ($row['npm'] === $this->npm) {
                $addedRow = $row;
                break;
            }
        }
        $this->assertNotNull($addedRow);
        $this->assertSame('Mahasiswa Tambah', $addedRow['nama_lengkap']);
        $this->seeInDatabase('mahasiswa', ['npm' => $this->npm, 'nama_lengkap' => 'Mahasiswa Tambah']);

        $this->cleanup();
    }

    public function testSaveSkipsDuplicateDatabaseNpm(): void
    {
        (new MahasiswaModel())->insert(['npm' => $this->npm, 'nama_lengkap' => 'Sudah Ada']);

        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [
                    ['npm' => $this->npm, 'nama_lengkap' => 'Coba Lagi'],
                ],
            ]);

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->assertSame(0, $body['data']['added']);
        $this->assertCount(1, $body['data']['skipped']);
        $this->assertSame($this->npm, $body['data']['skipped'][0]['npm']);
        $this->assertStringContainsString('terdaftar', $body['data']['skipped'][0]['alasan']);
        $this->seeInDatabase('mahasiswa', ['npm' => $this->npm, 'nama_lengkap' => 'Sudah Ada']);
        $this->dontSeeInDatabase('mahasiswa', ['npm' => $this->npm, 'nama_lengkap' => 'Coba Lagi']);

        $this->cleanup();
    }

    public function testSaveSkipsIntraBatchDuplicate(): void
    {
        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [
                    ['npm' => $this->npm, 'nama_lengkap' => 'Pertama'],
                    ['npm' => $this->npm, 'nama_lengkap' => 'Duplikat'],
                ],
            ]);

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->assertSame(1, $body['data']['added']);
        $this->assertCount(1, $body['data']['skipped']);
        $this->assertSame(1, (new MahasiswaModel())->where('npm', $this->npm)->countAllResults());

        $this->cleanup();
    }

    public function testSaveSkipsDuplicateNpmCaseInsensitive(): void
    {
        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [['npm' => 'ABC' . $this->npm, 'nama_lengkap' => 'Huruf Besar']],
            ]);
        $res->assertStatus(200);

        $res2 = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [['npm' => strtolower('ABC' . $this->npm), 'nama_lengkap' => 'huruf kecil']],
            ]);
        $res2->assertStatus(200);
        $body2 = $this->decoded($res2);
        $this->assertSame(0, $body2['data']['added']);
        $this->assertCount(1, $body2['data']['skipped']);

        $this->cleanup();
    }

    public function testSaveValidationMissingNamaReturns422(): void
    {
        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [['npm' => $this->npm, 'nama_lengkap' => '']],
            ]);

        $res->assertStatus(422);
        $this->assertFalse($this->decoded($res)['ok']);
        $this->dontSeeInDatabase('mahasiswa', ['npm' => $this->npm]);
    }

    public function testSaveValidationInvalidNpmReturns422(): void
    {
        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [['npm' => 'npm tidak valid !!', 'nama_lengkap' => 'Nama']],
            ]);

        $res->assertStatus(422);
        $this->assertFalse($this->decoded($res)['ok']);
    }

    public function testSaveUpdateExistingRow(): void
    {
        (new MahasiswaModel())->insert(['npm' => $this->npm, 'nama_lengkap' => 'Nama Lama']);
        $id = (new MahasiswaModel())->where('npm', $this->npm)->first()['id'];

        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [
                    ['id' => $id, 'npm' => $this->npm, 'nama_lengkap' => 'Nama Baru'],
                ],
            ]);

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->seeInDatabase('mahasiswa', ['id' => $id, 'npm' => $this->npm, 'nama_lengkap' => 'Nama Baru']);

        $this->cleanup();
    }

    public function testSaveDeleteRow(): void
    {
        (new MahasiswaModel())->insert(['npm' => $this->npm, 'nama_lengkap' => 'Akan Dihapus']);
        $id = (new MahasiswaModel())->where('npm', $this->npm)->first()['id'];

        $res = $this->withBodyFormat('json')->withSession($this->session())
            ->put('api/pengaturan/mahasiswa', [
                'items' => [
                    ['id' => $id, 'npm' => $this->npm, 'nama_lengkap' => 'Akan Dihapus', '_delete' => true],
                ],
            ]);

        $res->assertStatus(200);
        $body = $this->decoded($res);
        $this->assertTrue($body['ok']);
        $this->dontSeeInDatabase('mahasiswa', ['id' => $id]);

        $this->cleanup();
    }

    private function cleanup(): void
    {
        (new MahasiswaModel())->like('npm', $this->npm, 'both', null, true)->delete();
        db_connect()->table('audit_log')->where('aksi', 'save_mahasiswa')->delete();
    }
}
