<?php

use App\Libraries\AuthService;
use CodeIgniter\Test\CIUnitTestCase;

final class AuthServiceTest extends CIUnitTestCase
{
    public function testAdminLoginSuccess(): void
    {
        $res = (new AuthService())->adminLogin('admin123');

        $this->assertTrue($res['ok']);
        $this->assertSame('admin', $res['nama']);
    }

    public function testAdminLoginFailure(): void
    {
        $res = (new AuthService())->adminLogin('password-salah');

        $this->assertFalse($res['ok']);
        $this->assertStringContainsString('Password admin salah', $res['message']);
    }

    public function testBagianLoginSuccess(): void
    {
        $res = (new AuthService())->bagianLogin('staf.sgd@inhal.test', 'admin123');

        $this->assertTrue($res['ok']);
        $this->assertSame('SGD', $res['kategori']);
    }

    public function testBagianLoginFailure(): void
    {
        $res = (new AuthService())->bagianLogin('staf.sgd@inhal.test', 'password-salah');

        $this->assertFalse($res['ok']);
        $this->assertStringContainsString('Email atau password salah', $res['message']);
    }
}
