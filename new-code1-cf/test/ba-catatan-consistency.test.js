import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadHtml(pathName) {
  const res = await env.ASSETS.fetch(new Request('https://example.com/' + pathName));
  expect(res.status).toBe(200);
  return res.text();
}

describe('konsistensi catatan BA di UI', () => {
  it('bagian: form lengkapi mengirim catatan dan panel draft menampilkannya', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain('v-model="ba.lengkapi.catatan"');
    expect(html).toContain('<th class="px-4 py-3">Catatan</th>');
    expect(html).toContain('Catatan admin:');
    expect(html).toContain('<span class="font-bold">Catatan:</span>');
  });

  it('bagian: catatan BA terkirim saat simpan draft dan saat data draft dimuat', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain("catatan: String(d.catatan || '').trim()");
    expect(html).toContain("catatan: r.Catatan || ''");
  });

  it('bagian: catatan jadwal mengisi otomatis form BA dan data lama direset', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain("label: '', catatan: String(j.Catatan || '').trim(), file: null, fileName: ''");
  });

  it('dashboard: catatan BA tampil di unit, riwayat proses, dan drawer detail', async () => {
    const html = await loadHtml('dashboard.html');
    expect(html).toContain("b.sumber === 'Bagian' ? 'Catatan bagian:' : 'Catatan admin:'");
    expect(html).toContain("note: b.catatan || ''");
    expect(html).toContain('Berita Acara &amp; Catatan');
    expect(html).toContain('loadDetailBa(id)');
    expect(html).toContain("'Temuan Pemeriksaan'");
    // Filter cepat unit yang punya catatan BA.
    expect(html).toContain("setBagianChip('catatan')");
    expect(html).toContain('unitHasCatatanBa(u)');
  });

  it('detail laporan: kolom, kartu, dan ekspor memuat catatan BA', async () => {
    const html = await loadHtml('detail-laporan.html');
    expect(html).toContain('<th class="px-3 py-2.5 text-left">Catatan</th>');
    expect(html).toContain("'Catatan BA'");
    expect(html).toContain("catatan: (b && b.Catatan) || ''");
    expect(html).toContain("'Temuan Pemeriksaan'");
  });
});