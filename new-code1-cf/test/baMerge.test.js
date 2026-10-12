import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergeBaFilesToPdf } from '../src/baMerge.js';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
function png() { return Uint8Array.from(atob(PNG_1x1), (c) => c.charCodeAt(0)); }
async function pdf(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  return await d.save();
}
const BA = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-10-20' };

describe('mergeBaFilesToPdf', () => {
  it('menggabungkan gambar & PDF, sampul + pembatas, hitungan halaman benar', async () => {
    const out = await mergeBaFilesToPdf({
      ba: BA,
      peserta: [{ urutan: 1, nama: 'Aisyah', npm: '2201', halaman: 3 }],
      groups: [{
        peserta: { urutan: 1, nama: 'Aisyah', npm: '2201', blok: 'A' },
        files: [{ bytes: png(), mime: 'image/png' }, { bytes: await pdf(2), mime: 'application/pdf' }]
      }]
    });
    expect(out.sourcePages).toBe(3);
    expect(out.outputPages).toBe(5); // sampul(1) + pembatas(1) + 3 halaman sumber
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(5);
  });

  it('tanpa add-in saat ba tidak diberikan dan peserta kosong', async () => {
    const out = await mergeBaFilesToPdf({
      ba: null,
      peserta: [],
      groups: [{ peserta: {}, files: [{ bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
    expect(out.outputPages).toBe(1);
  });

  it('melewati berkas tanpa byte', async () => {
    const out = await mergeBaFilesToPdf({
      ba: null,
      groups: [{ peserta: {}, files: [{ bytes: new Uint8Array(0) }, { bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
  });

  it('melewati PDF rusak tetapi tetap memakai halaman valid lain', async () => {
    const brokenPdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]);
    const out = await mergeBaFilesToPdf({
      ba: null,
      groups: [{ peserta: {}, files: [{ bytes: brokenPdf, mime: 'application/pdf' }, { bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
  });

  it('melempar bila tidak ada halaman valid', async () => {
    await expect(mergeBaFilesToPdf({ ba: null, groups: [] })).rejects.toThrow();
  });

  it('melanjutkan daftar peserta sampul ke halaman berikutnya, tidak terpotong', async () => {
    const peserta = [];
    for (let i = 0; i < 80; i += 1) peserta.push({ urutan: i + 1, nama: 'P' + i, npm: '200' + i, halaman: 0 });
    const out = await mergeBaFilesToPdf({
      ba: BA,
      peserta,
      groups: [{
        peserta: { urutan: 1, nama: 'P0', npm: '2000', blok: 'A' },
        files: [{ bytes: png(), mime: 'image/png' }]
      }]
    });
    expect(out.sourcePages).toBe(1);
    expect(out.outputPages).toBeGreaterThanOrEqual(4);
  });
});
