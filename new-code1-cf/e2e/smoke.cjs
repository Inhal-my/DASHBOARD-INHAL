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
    console.log('OK portal publik');

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(await page.title(), 'Dashboard');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor();
    await passwordInput.fill(password);
    await page.getByRole('button', { name: 'Masuk' }).click();

    const sidebar = page.locator('aside').filter({ hasText: 'INHAL Admin' });
    await sidebar.waitFor({ timeout: 20000 });
    console.log('OK login admin');

    await page.getByTitle('Keamanan Akun').click();
    await page.getByRole('heading', { name: 'Keamanan Akun' }).waitFor({ timeout: 10000 });
    await page.getByText(/MFA aktif|Autentikasi dua faktor/).first().waitFor({ timeout: 10000 });
    console.log('OK modal keamanan');

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
