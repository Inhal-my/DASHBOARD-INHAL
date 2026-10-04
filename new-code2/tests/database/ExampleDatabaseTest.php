<?php

use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

/**
 * @internal
 */
final class ExampleDatabaseTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $migrate = false;

    public function testSeedDataPresentInTestsDatabase(): void
    {
        $this->seeInDatabase('admin', ['nama' => 'admin']);
        $this->seeInDatabase('master_biaya', ['kegiatan' => 'UTS', 'biaya' => 50000]);
    }
}
