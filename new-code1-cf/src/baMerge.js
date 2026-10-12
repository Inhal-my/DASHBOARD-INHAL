import { PDFDocument } from 'pdf-lib';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 24;

function looksPng(bytes) {
  return bytes && bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export async function mergeImagesToPdf(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const doc = await PDFDocument.create();
  let added = 0;
  for (const p of list) {
    const bytes = p && p.bytes instanceof Uint8Array ? p.bytes : (p && p.bytes ? new Uint8Array(p.bytes) : null);
    if (!bytes || !bytes.length) continue;
    const isPng = (p && p.mime === 'image/png') || looksPng(bytes);
    let img;
    try {
      img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch (e) {
      continue;
    }
    const w = img.width;
    const h = img.height;
    const landscape = w > h;
    const pw = landscape ? A4_LONG : A4_SHORT;
    const ph = landscape ? A4_SHORT : A4_LONG;
    const aw = pw - MARGIN * 2;
    const ah = ph - MARGIN * 2;
    const scale = Math.min(aw / w, ah / h);
    const dw = w * scale;
    const dh = h * scale;
    const page = doc.addPage([pw, ph]);
    page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    added += 1;
  }
  if (!added) throw new Error('Tidak ada halaman gambar yang valid.');
  const bytes = await doc.save();
  return { bytes, pages: added };
}
