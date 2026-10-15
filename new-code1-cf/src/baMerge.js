import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 24;
const TEXT_DARK = rgb(0.1, 0.1, 0.1);
const FOOTER_GRAY = rgb(0.55, 0.55, 0.55);

function toBytes(b) {
  if (!b) return null;
  if (b instanceof Uint8Array) return b;
  try { return new Uint8Array(b); } catch (e) { return null; }
}
function looksPng(bytes) { return bytes && bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47; }
function looksPdf(bytes) { return bytes && bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; }

function isPdfFile(file) {
  const mime = String((file && file.mime) || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return looksPdf(toBytes(file && file.bytes));
}

async function addImagePage(doc, bytes, mime) {
  const isPng = mime === 'image/png' || looksPng(bytes);
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
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
}

async function copyPdfPages(doc, bytes) {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const copied = await doc.copyPages(src, src.getPageIndices());
  for (const p of copied) doc.addPage(p);
  return copied.length;
}

function fitText(text, font, size, maxWidth) {
  const str = String(text == null ? '' : text);
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(str.slice(0, mid) + '\u2026', size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return str.slice(0, lo) + '\u2026';
}

function addCoverPages(doc, ba, peserta, helv, helvBold) {
  const pw = A4_SHORT;
  const ph = A4_LONG;
  const left = MARGIN + 16;
  const maxW = pw - left * 2;
  const pages = [];
  let page = doc.addPage([pw, ph]);
  pages.push(page);
  let y = ph - 90;
  page.drawText('BERITA ACARA PENDUKUNG', { x: left, y: y, size: 16, font: helvBold, color: TEXT_DARK });
  y -= 40;
  const lines = [
    'Bagian: ' + (ba.bagian || '-'),
    'Blok: ' + (ba.blok || '-'),
    'Kegiatan: ' + (ba.namaKegiatan || '-'),
    'Tanggal: ' + (ba.tanggal || '-')
  ];
  for (const ln of lines) {
    page.drawText(fitText(ln, helv, 11, maxW), { x: left, y: y, size: 11, font: helv, color: TEXT_DARK });
    y -= 20;
  }
  y -= 20;
  page.drawText('Daftar Peserta', { x: left, y: y, size: 12, font: helvBold, color: TEXT_DARK });
  y -= 22;
  let no = 0;
  for (const pe of (peserta || [])) {
    if (y < MARGIN + 40) {
      page = doc.addPage([pw, ph]);
      pages.push(page);
      y = ph - 80;
      page.drawText('Daftar Peserta (lanjutan)', { x: left, y: y, size: 12, font: helvBold, color: TEXT_DARK });
      y -= 22;
    }
    no += 1;
    const halaman = pe.halaman ? (pe.halaman + ' hal.') : 'belum ada berkas';
    const row = no + '. ' + (pe.nama || pe.npm || '-') + ' (' + (pe.npm || '-') + ') - ' + halaman;
    page.drawText(fitText(row, helv, 10, maxW), { x: left, y: y, size: 10, font: helv, color: TEXT_DARK });
    y -= 16;
  }
  return pages;
}

function addSeparatorPage(doc, pe, index, total, helv, helvBold) {
  const pw = A4_SHORT;
  const ph = A4_LONG;
  const page = doc.addPage([pw, ph]);
  const left = MARGIN + 16;
  const maxW = pw - left * 2;
  let y = ph - 120;
  page.drawText('PESERTA ' + index + ' / ' + total, { x: left, y: y, size: 12, font: helvBold, color: TEXT_DARK });
  y -= 30;
  const lines = ['Nama: ' + (pe.nama || '-'), 'NPM: ' + (pe.npm || '-'), 'Blok: ' + (pe.blok || '-')];
  for (const ln of lines) {
    page.drawText(fitText(ln, helv, 12, maxW), { x: left, y: y, size: 12, font: helv, color: TEXT_DARK });
    y -= 20;
  }
  return page;
}

export async function mergeBaFilesToPdf(input) {
  const cfg = input || {};
  const groups = Array.isArray(cfg.groups) ? cfg.groups : [];
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const generated = [];

  if (cfg.ba) {
    for (const p of addCoverPages(doc, cfg.ba, cfg.peserta || [], helv, helvBold)) generated.push(p);
  }

  let sourcePages = 0;
  const base = cfg.baseFile;
  if (base && base.bytes && base.bytes.length) {
    try {
      const baseBytes = toBytes(base.bytes);
      if (isPdfFile(base)) sourcePages += await copyPdfPages(doc, baseBytes);
      else { await addImagePage(doc, baseBytes, String(base.mime || '')); sourcePages += 1; }
    } catch (e) {
      // dokumen dasar rusak diabaikan; berkas peserta tetap diproses
    }
  }

  const withFiles = groups.filter((g) => g && Array.isArray(g.files) && g.files.length);
  let sepIndex = 0;
  for (const g of withFiles) {
    const pe = g.peserta || {};
    if (pe.nama || pe.npm) {
      sepIndex += 1;
      generated.push(addSeparatorPage(doc, pe, sepIndex, withFiles.length, helv, helvBold));
    }
    for (const f of g.files) {
      const bytes = toBytes(f && f.bytes);
      if (!bytes || !bytes.length) continue;
      try {
        if (isPdfFile(f)) sourcePages += await copyPdfPages(doc, bytes);
        else { await addImagePage(doc, bytes, String((f && f.mime) || '')); sourcePages += 1; }
      } catch (e) {
        continue;
      }
    }
  }
  if (!sourcePages) throw new Error('Tidak ada halaman gambar yang valid.');

  const all = doc.getPages();
  const total = all.length;
  for (const page of generated) {
    const idx = all.indexOf(page) + 1;
    if (idx > 0) page.drawText('Hal. ' + idx + '/' + total, { x: MARGIN + 16, y: 20, size: 8, font: helv, color: FOOTER_GRAY });
  }

  const bytes = await doc.save();
  return { bytes: bytes, sourcePages: sourcePages, outputPages: total };
}
