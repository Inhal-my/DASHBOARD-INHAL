<?php

use App\Libraries\FinalPdfService;
use App\Models\DetailKegiatanModel;
use App\Models\PengajuanModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;

final class FinalAccessTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $migrate = false;

    private string $npm;

    /** @var string[] */
    private array $createdIds = [];

    /** @var string[] */
    private array $createdFiles = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->npm = '9' . substr((string) hrtime(true), -9);
        $this->createdIds = [];
        $this->createdFiles = [];
    }

    protected function tearDown(): void
    {
        foreach ($this->createdIds as $id) {
            $this->cleanup($id, null);
        }
        foreach ($this->createdFiles as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }

        parent::tearDown();
    }

    private function seedPengajuan(?string $pathFinal): string
    {
        $id = 'INHAL-TEST-' . strtoupper(bin2hex(random_bytes(3)));
        (new PengajuanModel())->insert([
            'id_pengajuan'   => $id,
            'timestamp'      => date('Y-m-d H:i:s'),
            'npm'            => $this->npm,
            'nama_lengkap'   => 'Mahasiswa Final',
            'email'          => $this->npm . '@inhal.test',
            'no_hp_wa'       => '08123456780',
            'blok'           => 'Blok 1',
            'jenis_kegiatan' => 'Ujian',
            'status'         => 'ACC',
            'path_final'     => $pathFinal,
        ]);
        $this->createdIds[] = $id;

        return $id;
    }

    private function decoded(TestResponse $res): array
    {
        $raw = $res->getJSON();

        return is_string($raw) ? (json_decode($raw, true) ?? []) : [];
    }

    private function cleanup(string $id, ?string $file): void
    {
        db_connect()->table('audit_log')->where('target', $id)->delete();
        db_connect()->table('detail_kegiatan')->where('id_pengajuan', $id)->delete();
        (new PengajuanModel())->where('id_pengajuan', $id)->delete();
        if ($file !== null && is_file($file)) {
            unlink($file);
        }
    }

    public function testPortalExposesFinalLinkWhenAvailable(): void
    {
        $id = $this->seedPengajuan('final/sample.pdf');
        $res = $this->get('api/portal/' . $this->npm);
        $res->assertStatus(200);
        $body = $this->decoded($res);
        $item = null;
        foreach ($body['data']['history'] as $h) {
            if ($h['idPengajuan'] === $id) {
                $item = $h;
                break;
            }
        }
        $this->assertNotNull($item);
        $this->assertSame('/files/final/' . $id . '?npm=' . $this->npm, $item['linkFinal']);

        $this->cleanup($id, null);
    }

    public function testPortalHidesFinalLinkWhenMissing(): void
    {
        $id = $this->seedPengajuan(null);
        $res = $this->get('api/portal/' . $this->npm);
        $res->assertStatus(200);
        $body = $this->decoded($res);
        $item = null;
        foreach ($body['data']['history'] as $h) {
            if ($h['idPengajuan'] === $id) {
                $item = $h;
                break;
            }
        }
        $this->assertNotNull($item);
        $this->assertSame('', $item['linkFinal']);

        $this->cleanup($id, null);
    }

    public function testStudentCanDownloadOwnFinal(): void
    {
        $rel = 'final/test-' . uniqid() . '.pdf';
        $full = WRITEPATH . 'uploads/' . $rel;
        if (!is_dir(dirname($full))) {
            mkdir(dirname($full), 0775, true);
        }
        file_put_contents($full, "%PDF-1.4\n% test\n");
        $this->createdFiles[] = $full;

        $id = $this->seedPengajuan($rel);
        $res = $this->get('files/final/' . $id . '?npm=' . $this->npm);
        $res->assertStatus(200);
        $this->assertStringStartsWith('%PDF', (string) $res->response()->getBody());

        $this->cleanup($id, $full);
    }

    public function testStudentCannotDownloadOtherFinal(): void
    {
        $rel = 'final/test-' . uniqid() . '.pdf';
        $full = WRITEPATH . 'uploads/' . $rel;
        if (!is_dir(dirname($full))) {
            mkdir(dirname($full), 0775, true);
        }
        file_put_contents($full, "%PDF-1.4\n% test\n");
        $this->createdFiles[] = $full;

        $id = $this->seedPengajuan($rel);
        $res = $this->get('files/final/' . $id . '?npm=0000000000');
        $res->assertStatus(403);

        $this->cleanup($id, $full);
    }

    public function testEnsurePdfGeneratesFileAndPersistsPath(): void
    {
        $id = $this->seedPengajuan(null);
        $p = (new PengajuanModel())->where('id_pengajuan', $id)->first();

        $res = (new FinalPdfService())->ensurePdf($p, [
            ['pilihan' => 'UTS', 'detail' => 'Modul 1', 'tanggal_pelaksanaan' => '2026-01-15'],
        ]);

        $this->assertTrue($res['ok'], $res['message'] ?? '');
        $this->assertTrue($res['generated']);
        $full = WRITEPATH . 'uploads/' . $res['path'];
        $this->assertFileExists($full);
        $this->createdFiles[] = $full;

        $updated = (new PengajuanModel())->where('id_pengajuan', $id)->first();
        $this->assertSame($res['path'], $updated['path_final']);

        $this->cleanup($id, $full);
    }

    public function testBagianRowsExposeFinalUrl(): void
    {
        $id = $this->seedPengajuan('final/sample.pdf');
        $row = (new PengajuanModel())->where('id_pengajuan', $id)->first();
        (new DetailKegiatanModel())->insert([
            'pengajuan_id'        => $row['id'],
            'id_pengajuan'        => $id,
            'jenis_kegiatan'      => 'Ujian',
            'pilihan'             => 'UTS',
            'detail'              => 'Modul 1',
            'tanggal_pelaksanaan' => '2026-01-15',
            'bagian'              => '',
            'timestamp'           => date('Y-m-d H:i:s'),
        ]);

        $session = ['auth' => [
            'role' => 'bagian', 'email' => 'petugas@inhal.test', 'nama' => 'Petugas',
            'kategori' => 'Ujian', 'kategoris' => ['Ujian'],
        ]];
        $res = $this->withSession($session)->get('api/bagian/bootstrap');
        $res->assertStatus(200);
        $body = json_decode((string) $res->response()->getBody(), true);

        $row = null;
        foreach (($body['data']['rows'] ?? []) as $r) {
            if ($r['idPengajuan'] === $id) {
                $row = $r;
                break;
            }
        }
        $this->assertNotNull($row);
        $this->assertSame('/files/final/' . $id, $row['linkFinal']);

        $this->cleanup($id, null);
    }
}
