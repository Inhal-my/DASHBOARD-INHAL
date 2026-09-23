<?php

use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\FeatureTestTrait;

final class PageRenderTest extends CIUnitTestCase
{
    use FeatureTestTrait;

    protected $migrate = false;

    public function testPortalPageRenders(): void
    {
        $res = $this->get('/portal');
        $res->assertStatus(200);
        $this->assertStringContainsString('Portal Mahasiswa', (string) $res->response()->getBody());
    }

    public function testBagianPageRenders(): void
    {
        $res = $this->get('/bagian');
        $res->assertStatus(200);
        $this->assertStringContainsString('id="app"', (string) $res->response()->getBody());
    }

    public function testDashboardPageRendersForAdmin(): void
    {
        $res = $this->withSession(['auth' => ['role' => 'admin', 'nama' => 'Admin Test']])->get('/dashboard');
        $res->assertStatus(200);
        $this->assertStringContainsString('Kirim Ulang Email ACC Final', (string) $res->response()->getBody());
    }
}
