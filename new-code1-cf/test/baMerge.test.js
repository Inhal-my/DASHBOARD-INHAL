import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergeImagesToPdf } from '../src/baMerge.js';

// JPEG 1x1 px (base64) untuk keperluan tes.
const JPEG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
function png() { return Uint8Array.from(atob(JPEG_1x1), (c) => c.charCodeAt(0)); }

describe('mergeImagesToPdf', () => {
  it('menggabungkan beberapa gambar menjadi PDF multi-halaman', async () => {
    const out = await mergeImagesToPdf([
      { bytes: png(), mime: 'image/png' },
      { bytes: png(), mime: 'image/png' }
    ]);
    expect(out.bytes.length).toBeGreaterThan(0);
    expect(out.pages).toBe(2);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('melewati halaman tanpa byte dan tetap jalan bila ada satu valid', async () => {
    const out = await mergeImagesToPdf([{ bytes: new Uint8Array(0) }, { bytes: png(), mime: 'image/png' }]);
    expect(out.pages).toBe(1);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('melempar bila tidak ada halaman valid', async () => {
    await expect(mergeImagesToPdf([])).rejects.toThrow();
  });
});
