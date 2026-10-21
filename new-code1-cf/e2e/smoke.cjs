const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = (process.env.E2E_BASE_URL || 'https://inhal-form-staging.prodi.workers.dev').replace(/\/+$/, '');
const password = process.env.STAGING_ADMIN_PASSWORD || '';

async function main() {
  if (!password) {
    throw new Error('Set STAGING_ADMIN_PASSWORD sebelum menjalankan E2E.');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(await page.title(), 'Pengajuan INHAL');
    await page.getByRole('heading', { name: 'Pengajuan INHAL' }).waitFor();
    await page.getByLabel('NPM (Nomor Pokok Mahasiswa)').fill('0000000000');
    await page.getByRole('button', { name: 'Periksa Pengajuan INHAL' }).click();
    await page.getByText(/tidak ditemukan|periksa kembali|gagal terhubung/i).first().waitFor({ timeout: 15000 });
    console.log('OK portal publik dan validasi NPM');

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(await page.title(), 'Dashboard');
    await page.getByLabel('Password Admin').fill(password);
    await page.getByRole('button', { name: 'Masuk' }).click();

    const sidebar = page.locator('aside').filter({ hasText: 'INHAL Admin' });
    await sidebar.waitFor({ timeout: 20000 });
    await page.getByRole('heading', { name: 'Verifikasi Pengajuan' }).waitFor();
    console.log('OK login admin');

    await sidebar.getByRole('link', { name: 'Statistik' }).click();
    await page.getByRole('heading', { name: 'Statistik Pendaftaran' }).waitFor();
    await sidebar.getByRole('link', { name: 'Berita Acara' }).click();
    await page.getByRole('heading', { name: 'Berita Acara', exact: true }).waitFor();
    await sidebar.getByRole('link', { name: 'Master Data' }).click();
    await page.getByRole('heading', { name: 'Master Data', exact: true }).waitFor();
    console.log('OK navigasi dashboard');

    await page.getByRole('button', { name: 'Audit' }).click();
    await page.getByRole('heading', { name: 'Audit Integritas Data' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Tutup', exact: true }).last().click();
    console.log('OK audit integritas data');

    await page.getByTitle('Keamanan Akun').click();
    await page.getByRole('heading', { name: 'Keamanan Akun' }).waitFor({ timeout: 10000 });
    await page.getByText(/MFA aktif|Autentikasi dua faktor/).first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Tutup', exact: true }).last().click();
    console.log('OK modal keamanan akun');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await sidebar.getByRole('link', { name: 'Pengajuan' }).click();
    await page.getByRole('heading', { name: 'Verifikasi Pengajuan' }).waitFor();
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await sidebar.getByTitle('Keluar').click();
    await page.getByLabel('Password Admin').waitFor({ timeout: 10000 });
    console.log('OK navigasi mobile dan logout');

    if (pageErrors.length) {
      throw new Error(`Error halaman: ${pageErrors.join(' | ')}`);
    }
    console.log(`E2E smoke lulus terhadap ${baseUrl}`);
  } catch (error) {
    await page.screenshot({ path: '/tmp/inhal-e2e-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`E2E gagal: ${error.message}`);
  process.exit(1);
});
