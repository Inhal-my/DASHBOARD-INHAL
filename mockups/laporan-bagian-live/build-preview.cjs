#!/usr/bin/env node
// Bangun preview statis tab Laporan Bagian dari detail-laporan.html asli.
// Jalankan: node mockups/laporan-bagian-live/build-preview.cjs
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../new-code1-cf/public/detail-laporan.html');
const OUT = path.join(__dirname, 'index.html');
const ASSETS = ['app-common.js', 'bukti-preview.css', 'gs-shim.js'];

let src = fs.readFileSync(SRC, 'utf8');
src = src.replace(
  '<script src="/gs-shim.js"></script>',
  '<script src="mock-data.js"></script>\n    <script src="mock-boot.js"></script>\n    <script src="gs-shim.js"></script>'
);
src = src.replace(/href="\/(vendor\/bootstrap-icons\.min\.css)"/g, 'href="$1"')
  .replace(/href="\/(bukti-preview\.css)"/g, 'href="$1"')
  .replace(/src="\/(gs-shim\.js|app-common\.js|vendor\/vue\.global\.prod\.js)"/g, 'src="$1"');
fs.writeFileSync(OUT, src);

const pub = path.resolve(__dirname, '../../new-code1-cf/public');
ASSETS.forEach((name) => fs.copyFileSync(path.join(pub, name), path.join(__dirname, name)));
fs.cpSync(path.join(pub, 'vendor'), path.join(__dirname, 'vendor'), { recursive: true });

console.log('preview siap: index.html (' + src.length + ' byte) + aset tersalin');
