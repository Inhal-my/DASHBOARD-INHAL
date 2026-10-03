(function () {
  'use strict';

  var A4_SHORT = 595.28;
  var A4_LONG = 841.89;
  var PAGE_MARGIN = 24;

  function buildPdf(jpegs) {
    if (!jpegs || !jpegs.length) throw new Error('Tidak ada halaman untuk dibuat PDF.');

    var encoder = new TextEncoder();
    var parts = [];
    var length = 0;
    var objOffsets = [];

    function push(data) {
      var bytes = typeof data === 'string' ? encoder.encode(data) : data;
      parts.push(bytes);
      length += bytes.length;
    }

    function startObj(num) {
      objOffsets[num] = length;
      push(num + ' 0 obj\n');
    }

    function endObj() {
      push('endobj\n');
    }

    var n = jpegs.length;

    push('%PDF-1.4\n');

    startObj(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    var kids = [];
    for (var k = 0; k < n; k += 1) kids.push((3 + k * 3) + ' 0 R');
    startObj(2);
    push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\n');
    endObj();

    for (var i = 0; i < n; i += 1) {
      var pageId = 3 + i * 3;
      var contentId = pageId + 1;
      var imgId = pageId + 2;
      var img = jpegs[i];
      var iw = img.width;
      var ih = img.height;

      var landscape = iw > ih;
      var pw = landscape ? A4_LONG : A4_SHORT;
      var ph = landscape ? A4_SHORT : A4_LONG;
      var availW = pw - PAGE_MARGIN * 2;
      var availH = ph - PAGE_MARGIN * 2;
      var scale = Math.min(availW / iw, availH / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var x = (pw - dw) / 2;
      var y = (ph - dh) / 2;

      var contentBytes = encoder.encode(
        'q\n' +
        dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm\n' +
        '/Im0 Do\n' +
        'Q\n'
      );

      startObj(pageId);
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw.toFixed(2) + ' ' + ph.toFixed(2) + '] ' +
        '/Resources << /XObject << /Im0 ' + imgId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>\n');
      endObj();

      startObj(contentId);
      push('<< /Length ' + contentBytes.length + ' >>\nstream\n');
      push(contentBytes);
      push('endstream\n');
      endObj();

      startObj(imgId);
      push('<< /Type /XObject /Subtype /Image /Width ' + iw + ' /Height ' + ih + ' ' +
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.bytes.length + ' >>\nstream\n');
      push(img.bytes);
      push('\nendstream\n');
      endObj();
    }

    var objCount = 2 + n * 3;
    var xrefStart = length;
    var xref = 'xref\n0 ' + (objCount + 1) + '\n0000000000 65535 f \n';
    for (var id = 1; id <= objCount; id += 1) {
      xref += String(objOffsets[id] || 0).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref);
    push('trailer\n<< /Size ' + (objCount + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n');

    return new Blob(parts, { type: 'application/pdf' });
  }

  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Gagal membaca gambar.'));
      };
      img.src = url;
    });
  }

  async function compressToJpeg(file, options) {
    var opts = options || {};
    var maxDim = opts.maxDim || 1600;
    var quality = typeof opts.quality === 'number' ? opts.quality : 0.72;

    var img = await loadImageElement(file);
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('Gambar tidak valid.');

    var scale = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));

    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob) throw new Error('Gagal mengompres gambar.');

    var buf = await blob.arrayBuffer();
    return { bytes: new Uint8Array(buf), width: cw, height: ch };
  }

  window.ScanPdf = { buildPdf: buildPdf, compressToJpeg: compressToJpeg };
})();
