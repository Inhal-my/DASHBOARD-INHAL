import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadPortalHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/portal.html'));
  return res.text();
}

describe('guard template portal', () => {
  it('tidak menyebut Diterima dan tidak meminta berkas ACC INHAL', async () => {
    const html = await loadPortalHtml();
    expect(html).not.toContain('diterima');
    expect(html).not.toContain('accFile');
  });

  it('form unggah hanya mengirim buktiFile dan tampil saat status approved', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('buktiFile: await this.readFileAsBase64');
    expect(html).toContain("detailItem.statusCode === 'approved' && !detailItem.hasUpload");
  });
});
