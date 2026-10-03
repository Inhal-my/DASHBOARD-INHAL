import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import scanPdfSrc from '../public/scan-pdf.js?raw';

function loadScanPdf() {
  const win = {};
  new Function('window', scanPdfSrc)(win);
  return win.ScanPdf;
}

function fakeJpeg(size, fill) {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes.fill(fill, 2);
  return { bytes, width: 1200, height: 1600 };
}

function pdfText(buf) {
  return Buffer.from(buf).toString('latin1');
}

async function loadHtml(name) {
  const res = await env.ASSETS.fetch(new Request(`https://example.com/${name}`));
  expect(res.status).toBe(200);
  return res.text();
}

describe('ScanPdf.buildPdf', () => {
  it('menolak daftar halaman kosong', () => {
    const ScanPdf = loadScanPdf();
    expect(() => ScanPdf.buildPdf([])).toThrow();
  });

  it('menghasilkan PDF multi-halaman dengan xref yang valid', async () => {
    const ScanPdf = loadScanPdf();
    const pages = [fakeJpeg(64, 1), fakeJpeg(128, 2), fakeJpeg(96, 3)];
    const blob = ScanPdf.buildPdf(pages);
    expect(blob.type).toBe('application/pdf');

    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(blob.size).toBe(buf.byteLength);
    const text = pdfText(buf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 3');

    const xrefStart = Number(text.match(/startxref\n(\d+)/)[1]);
    expect(text.slice(xrefStart, xrefStart + 4)).toBe('xref');

    const offsets = {};
    const objRe = /(\d+) 0 obj/g;
    let m;
    while ((m = objRe.exec(text))) offsets[Number(m[1])] = m.index;

    const entries = text
      .slice(xrefStart)
      .split('\n')
      .filter((line) => /^\d{10} 00000 n\s*$/.test(line));
    expect(entries.length).toBe(11);
    for (let id = 1; id <= 11; id += 1) {
      expect(Number(entries[id - 1].slice(0, 10))).toBe(offsets[id]);
    }
  });

  it('menyisipkan byte JPEG apa adanya pada XObject', async () => {
    const ScanPdf = loadScanPdf();
    const page = fakeJpeg(80, 7);
    const blob = ScanPdf.buildPdf([page]);
    const text = pdfText(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain('/Filter /DCTDecode /Length 80');
    const start = text.indexOf('stream\n', text.indexOf('/DCTDecode'));
    expect(text.slice(start + 'stream\n'.length, start + 'stream\n'.length + 2)).toBe('\u00ff\u00d8');
  });
});

describe('bagian.html integrasi scan kamera', () => {
  it('memuat scan-pdf.js dengan defer di head', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain('<script src="/scan-pdf.js" defer></script>');
  });

  it('menyediakan tombol scan, input kamera, dan metode PDF', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain('Scan Kamera');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('accept="image/*"');
    expect(html).toContain('@change="onScanPhotos"');
    expect(html).toContain('@click="buildScanPdf"');
    expect(html).toContain('onScanPhotos(e) {');
    expect(html).toContain('buildScanPdf() {');
    expect(html).toContain('window.ScanPdf.compressToJpeg');
    expect(html).toContain('window.ScanPdf.buildPdf');
  });
});
