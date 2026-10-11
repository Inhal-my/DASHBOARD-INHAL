# Scanner In-App (Live Kamera + Deteksi Tepi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan scanner in-app (kamera langsung + deteksi tepi + koreksi perspektif + output abu-abu bersih) pada 4 titik scan produksi (`dashboard.html` 3 titik, `bagian.html` 1 titik).

**Architecture:** Modul framework-agnostic `public/scanner.js` (`window.Scanner`) mengelola overlay DOM + stream kamera + pipeline OpenCV.js. Library OpenCV.js di-vendor self-hosted (`public/vendor/opencv-4.11.0.js`, single-file wasm tertanam) dan lazy-load saat overlay dibuka. Hasil per halaman `{bytes,width,height}` di-push ke `scanItems` host yang sudah ada, sehingga grid pratinjau, geser/hapus, dan `scan-pdf.js` (`buildPdf`, batas 5 MB) tetap dipakai tanpa perubahan.

**Tech Stack:** HTML + Vue 3 (global) + Tailwind inline (halaman) + `scan-pdf.js` + OpenCV.js 4.11.0 (`@techstark/opencv-js`). Cloudflare Worker (Hono) `new-code1-cf`. Test: vitest (`?raw` + `new Function('window', src)`), pool `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Copy UI berbahasa Indonesia.
- **Tanpa langkah build / tanpa CDN saat runtime.** `scanner.js` adalah plain script. OpenCV.js di-host sendiri di `public/vendor/`.
- **Jangan ubah** backend/RPC/skema D1, alur unggah (1 file, maks 5 MB), atau `public/scan-pdf.js` (API `compressToJpeg`/`buildPdf` tetap).
- **Jangan sentuh** `public/detail-laporan.html`, `public/portal.html`, `public/index.html` (tidak punya scan).
- Pertahankan `<input type="file" ... capture="environment" multiple>` (fallback kamera OS) dan marker method scan lama, agar test lama tetap hijau.
- `scanner.js` tidak boleh menyentuh `document`/`navigator` di top-level (hanya di dalam fungsi), agar bisa dievaluasi dengan fake `window` di test.
- Overlay memakai CSS ber-namespace `.scn-*` yang disuntik `scanner.js` (bukan utility Tailwind), `z-index: 2000` (di atas sidebar/topbar yang sudah `z-[130]`).
- Setiap `cv.Mat` wajib di-`delete()`.
- Test: `npx vitest run` dari `new-code1-cf/`. Deploy: `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy` (worker `inhal-form`).
- Baseline test: 342 passed / 38 file. Jangan menurunkan angka ini.
- Setiap task berakhir commit kecil.

## File Structure

- Create: `public/vendor/opencv-4.11.0.js` — build OpenCV.js single-file (di-commit).
- Create: `public/scanner.js` — modul `window.Scanner` (loader, helper geometri, overlay, pipeline CV).
- Create: `test/scanner.test.js` — unit helper + guard template.
- Modify: `public/dashboard.html` — tambah `<script src="/scanner.js" defer>`, method `openScanner`/`scanAddPages`, wiring 3 tombol.
- Modify: `public/bagian.html` — tambah `<script src="/scanner.js" defer>`, method `openScanner`/`scanAddPages`, wiring 1 tombol.

---

### Task 1: Vendor OpenCV.js + inti `scanner.js` (loader + helper geometri)

**Files:**
- Create: `public/vendor/opencv-4.11.0.js`
- Create: `public/scanner.js`
- Test: `test/scanner.test.js`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `window.Scanner.loadEngine()` → `Promise<cv>` (resolve module OpenCV setelah `cv.Mat` tersedia; idempotent).
  - `window.Scanner.isSupported(navigatorLike)` → `boolean`.
  - `window.Scanner.__test.orderCorners(pts)` → `[{x,y}×4]` urut `[tl,tr,br,bl]`.
  - `window.Scanner.__test.outputSize(pts, maxDim)` → `{width,height}`.

- [ ] **Step 1: Tulis test yang gagal**

Create `test/scanner.test.js`:

```javascript
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import scannerSrc from '../public/scanner.js?raw';

function loadScanner() {
  const win = {};
  new Function('window', scannerSrc)(win);
  return win.Scanner;
}

async function loadHtml(name) {
  const res = await env.ASSETS.fetch(new Request(`https://example.com/${name}`));
  expect(res.status).toBe(200);
  return res.text();
}

describe('Scanner helper geometri', () => {
  it('mengurutkan 4 titik menjadi tl, tr, br, bl', () => {
    const S = loadScanner();
    const pts = [
      { x: 100, y: 100 },
      { x: 10, y: 100 },
      { x: 100, y: 10 },
      { x: 10, y: 10 }
    ];
    const out = S.__test.orderCorners(pts);
    expect(out[0]).toEqual({ x: 10, y: 10 });
    expect(out[1]).toEqual({ x: 100, y: 10 });
    expect(out[2]).toEqual({ x: 100, y: 100 });
    expect(out[3]).toEqual({ x: 10, y: 100 });
  });

  it('menolak jumlah titik selain 4', () => {
    const S = loadScanner();
    expect(() => S.__test.orderCorners([{ x: 0, y: 0 }])).toThrow();
  });

  it('menghitung ukuran output dengan skala maxDim', () => {
    const S = loadScanner();
    const pts = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 }
    ];
    const size = S.__test.outputSize(pts, 1600);
    expect(size.height).toBe(1600);
    expect(size.width).toBe(800);
  });
});

describe('Scanner.isSupported', () => {
  it('true bila ada mediaDevices.getUserMedia', () => {
    const S = loadScanner();
    expect(S.isSupported({ mediaDevices: { getUserMedia: () => {} } })).toBe(true);
  });

  it('false bila tidak ada kamera', () => {
    const S = loadScanner();
    expect(S.isSupported({})).toBe(false);
    expect(S.isSupported(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/scanner.test.js`
Expected: FAIL — modul `../public/scanner.js` belum ada.

- [ ] **Step 3: Vendor OpenCV.js**

```bash
cd "$(mktemp -d)" && npm pack @techstark/opencv-js@4.11.0-release.1 && tar -xzf techstark-opencv-js-4.11.0-release.1.tgz && mkdir -p /workspace/new-code1-cf/public/vendor && cp package/dist/opencv.js /workspace/new-code1-cf/public/vendor/opencv-4.11.0.js && ls -la /workspace/new-code1-cf/public/vendor/
```

Expected: `opencv-4.11.0.js` ada, ukuran ±11.4 MB.

- [ ] **Step 4: Buat `public/scanner.js` (inti)**

```javascript
(function () {
    'use strict';

    var OPENCV_URL = '/vendor/opencv-4.11.0.js';
    var MAX_OUTPUT_DIM = 1600;

    var enginePromise = null;

    /* ---------- helper geometri (murni) ---------- */

    function orderCorners(pts) {
        if (!Array.isArray(pts) || pts.length !== 4) {
            throw new Error('orderCorners butuh tepat 4 titik');
        }
        var bySum = pts.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
        var tl = bySum[0];
        var br = bySum[bySum.length - 1];
        var rest = [bySum[1], bySum[2]];
        var tr = rest[0].x >= rest[1].x ? rest[0] : rest[1];
        var bl = rest[0].x >= rest[1].x ? rest[1] : rest[0];
        return [tl, tr, br, bl];
    }

    function outputSize(pts, maxDim) {
        maxDim = maxDim || MAX_OUTPUT_DIM;
        var tl = pts[0], tr = pts[1], br = pts[2], bl = pts[3];
        function dist(a, b) {
            var dx = a.x - b.x, dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        var w = Math.max(dist(tl, tr), dist(bl, br));
        var h = Math.max(dist(tl, bl), dist(tr, br));
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        var scale = Math.min(1, maxDim / Math.max(w, h));
        return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
    }

    function isSupported(nav) {
        nav = nav || (typeof navigator !== 'undefined' ? navigator : null);
        return !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function');
    }

    /* ---------- loader engine ---------- */

    function loadEngine() {
        if (enginePromise) return enginePromise;
        if (typeof window !== 'undefined' && window.cv && window.cv.Mat) {
            enginePromise = Promise.resolve(window.cv);
            return enginePromise;
        }
        enginePromise = new Promise(function (resolve, reject) {
            var settled = false;
            function ok(cv) { if (settled) return; settled = true; resolve(cv); }
            function bad(err) { if (settled) return; settled = true; reject(err instanceof Error ? err : new Error('OpenCV gagal dimuat')); }

            function waitReady() {
                if (window.cv && window.cv.Mat) { ok(window.cv); return; }
                var tries = 0;
                var timer = setInterval(function () {
                    tries += 1;
                    if (window.cv && window.cv.Mat) { clearInterval(timer); ok(window.cv); }
                    else if (tries > 1000) { clearInterval(timer); bad(new Error('OpenCV init timeout')); }
                }, 30);
            }

            var script = document.createElement('script');
            script.src = OPENCV_URL;
            script.async = true;
            script.onload = function () {
                try {
                    if (window.cv && typeof window.cv.then === 'function') {
                        window.cv.then(function (mod) { window.cv = mod; waitReady(); }, bad);
                    } else {
                        waitReady();
                    }
                } catch (e) { bad(e); }
            };
            script.onerror = function () { bad(new Error('OpenCV gagal dimuat')); };
            document.head.appendChild(script);
        });
        return enginePromise;
    }

    function noop() {}

    window.Scanner = {
        loadEngine: loadEngine,
        isSupported: isSupported,
        open: noop,
        __test: { orderCorners: orderCorners, outputSize: outputSize }
    };
})();
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/scanner.test.js`
Expected: PASS (5 test).

- [ ] **Step 6: Commit**

```bash
git add public/vendor/opencv-4.11.0.js public/scanner.js test/scanner.test.js
git commit -m "feat(scanner): vendor OpenCV.js + inti modul Scanner (loader + geometri)"
```

---

### Task 2: Overlay scanner + pipeline CV + fallback

**Files:**
- Modify: `public/scanner.js` (ganti stub `open` dengan implementasi penuh; tambah helper)
- Test: `test/scanner.test.js` (hanya guard statis; perilaku DOM diverifikasi manual)

**Interfaces:**
- Consumes: `orderCorners`, `outputSize`, `loadEngine`, `isSupported` (Task 1).
- Produces: `window.Scanner.open({ title, onApply, onOsFallback })`:
  - `onApply(pages)` — dipanggil saat "Gunakan" dengan `pages = [{ bytes: Uint8Array (JPEG), width: number, height: number }]`.
  - `onOsFallback()` — dipanggil saat "Pakai kamera OS".

- [ ] **Step 1: Tambah guard statis (harus hijau setelah ini)**

Tambahkan di akhir `test/scanner.test.js`:

```javascript
describe('scanner.js kontrak modul', () => {
  it('mengekspos API yang dipakai host', () => {
    const S = loadScanner();
    expect(typeof S.open).toBe('function');
    expect(typeof S.loadEngine).toBe('function');
    expect(typeof S.isSupported).toBe('function');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan lulus saat ini**

Run: `npx vitest run test/scanner.test.js`
Expected: PASS.

- [ ] **Step 3: Implementasi overlay + pipeline**

Ganti baris `function noop() {}` dan objek `window.Scanner` di `public/scanner.js` dengan kode berikut (sisipkan sebelum baris `window.Scanner = {` yang lama, lalu ubah `open: noop` menjadi `open: open`):

```javascript
    /* ---------- util kecil ---------- */

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function injectStyle() {
        if (document.getElementById('scn-style')) return;
        var st = document.createElement('style');
        st.id = 'scn-style';
        st.textContent = [
            '.scn-overlay{position:fixed;inset:0;z-index:2000;background:#0b1120;display:flex;flex-direction:column;font-family:system-ui,sans-serif}',
            '.scn-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0f172a;border-bottom:1px solid #1e293b;color:#fff}',
            '.scn-head h3{margin:0;font-size:15px;font-weight:800}',
            '.scn-head .sub{font-size:11px;color:#94a3b8;margin-top:2px}',
            '.scn-badge{margin-left:auto;font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px;background:#3f2d0a;color:#fbbf24;white-space:nowrap}',
            '.scn-badge.ok{background:#052e22;color:#34d399}',
            '.scn-stage{flex:1;position:relative;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}',
            '.scn-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
            '.scn-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
            '.scn-fallback{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;color:#e2e8f0;text-align:center}',
            '.scn-bottom{background:#0f172a;border-top:1px solid #1e293b;padding:10px 14px calc(12px + env(safe-area-inset-bottom));color:#cbd5e1}',
            '.scn-pages{display:flex;gap:8px;overflow-x:auto;min-height:64px;margin-bottom:10px;padding:2px 0}',
            '.scn-page{position:relative;width:48px;height:64px;flex:0 0 auto;border-radius:6px;border:2px solid #334155;overflow:hidden;background:#1e293b}',
            '.scn-page img{width:100%;height:100%;object-fit:cover;display:block}',
            '.scn-page .no{position:absolute;left:2px;top:2px;background:rgba(15,23,42,.8);color:#fff;font-size:9px;font-weight:800;padding:0 4px;border-radius:4px}',
            '.scn-page .del{position:absolute;right:1px;top:1px;width:16px;height:16px;border-radius:999px;background:#e11d48;color:#fff;font-size:10px;border:0;cursor:pointer}',
            '.scn-empty{display:flex;align-items:center;justify-content:center;width:100%;color:#64748b;font-size:11px;text-align:center}',
            '.scn-actions{display:flex;align-items:center;justify-content:center;gap:14px}',
            '.scn-btn{background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:12px;font-weight:700;padding:9px 12px;border-radius:10px;cursor:pointer}',
            '.scn-btn.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}',
            '.scn-btn:disabled{opacity:.45;cursor:default}',
            '.scn-shutter{width:60px;height:60px;border-radius:999px;background:#fff;border:4px solid #94a3b8;cursor:pointer}',
            '.scn-shutter:disabled{opacity:.4}',
            '.scn-note{padding:8px 14px;text-align:center;font-size:11px;color:#94a3b8}'
        ].join('');
        document.head.appendChild(st);
    }

    function dataUrlToBytes(dataUrl) {
        var base64 = String(dataUrl).split(',')[1] || '';
        var bin = atob(base64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function grabCanvas(video, maxW) {
        var vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return null;
        var scale = Math.min(1, maxW / vw);
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vw * scale));
        c.height = Math.max(1, Math.round(vh * scale));
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        return c;
    }

    /* ---------- pipeline CV ---------- */

    function detectQuad(cv, canvas) {
        var src = cv.imread(canvas);
        var gray = new cv.Mat();
        var blur = new cv.Mat();
        var edges = new cv.Mat();
        var kernel = cv.Mat.ones(5, 5, cv.CV_8U);
        var contours = new cv.MatVector();
        var hierarchy = new cv.Mat();
        var quad = null;
        try {
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
            cv.Canny(blur, edges, 60, 180, 3, false);
            cv.dilate(edges, edges, kernel);
            cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
            var frameArea = canvas.width * canvas.height;
            var bestArea = 0;
            for (var i = 0; i < contours.size(); i += 1) {
                var c = contours.get(i);
                var area = cv.contourArea(c);
                if (area > frameArea * 0.15 && area > bestArea) {
                    var peri = cv.arcLength(c, true);
                    var approx = new cv.Mat();
                    cv.approxPolyDP(c, approx, 0.02 * peri, true);
                    if (approx.rows === 4 && cv.isContourConvex(approx)) {
                        var pts = [];
                        for (var j = 0; j < 4; j += 1) {
                            pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
                        }
                        quad = orderCorners(pts).map(function (p) {
                            return { x: p.x / canvas.width, y: p.y / canvas.height };
                        });
                        bestArea = area;
                    }
                    approx.delete();
                }
                c.delete();
            }
        } finally {
            src.delete(); gray.delete(); blur.delete(); edges.delete();
            kernel.delete(); contours.delete(); hierarchy.delete();
        }
        return quad;
    }

    function processFrame(cv, canvas, quad) {
        var src = cv.imread(canvas);
        var flat = new cv.Mat();
        var gray = new cv.Mat();
        var thr = new cv.Mat();
        try {
            if (quad) {
                var pts = quad.map(function (p) {
                    return { x: Math.round(p.x * (canvas.width - 1)), y: Math.round(p.y * (canvas.height - 1)) };
                });
                var size = outputSize(pts, MAX_OUTPUT_DIM);
                var srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y
                ]);
                var dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    0, 0, size.width - 1, 0, size.width - 1, size.height - 1, 0, size.height - 1
                ]);
                var m = cv.getPerspectiveTransform(srcTri, dstTri);
                cv.warpPerspective(src, flat, m, new cv.Size(size.width, size.height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
                srcTri.delete(); dstTri.delete(); m.delete();
            } else {
                cv.resize(src, flat, new cv.Size(src.cols, src.rows));
            }
            cv.cvtColor(flat, gray, cv.COLOR_RGBA2GRAY);
            cv.adaptiveThreshold(gray, thr, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
            var out = document.createElement('canvas');
            out.width = thr.cols;
            out.height = thr.rows;
            cv.imshow(out, thr);
            var dataUrl = out.toDataURL('image/jpeg', 0.8);
            return { bytes: dataUrlToBytes(dataUrl), width: out.width, height: out.height };
        } finally {
            src.delete(); flat.delete(); gray.delete(); thr.delete();
        }
    }

    function processPlain(video, quad) {
        var canvas = grabCanvas(video, MAX_OUTPUT_DIM);
        if (!canvas) return null;
        var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return { bytes: dataUrlToBytes(dataUrl), width: canvas.width, height: canvas.height };
    }

    /* ---------- overlay ---------- */

    function open(opts) {
        opts = opts || {};
        var state = { stream: null, facing: 'environment', pages: [], quad: null, engine: null, busy: false, timer: null, closed: false };

        var ov = document.createElement('div');
        ov.className = 'scn-overlay';
        ov.innerHTML =
            '<div class="scn-head">' +
                '<div><h3>' + escapeHtml(opts.title || 'Scan Dokumen') + '</h3>' +
                '<div class="sub">Arahkan kamera ke dokumen, tepi terdeteksi otomatis</div></div>' +
                '<span class="scn-badge" data-role="status">Menyiapkan…</span>' +
                '<button class="scn-btn" data-act="flip">Ganti</button>' +
            '</div>' +
            '<div class="scn-stage">' +
                '<video class="scn-video" autoplay playsinline muted></video>' +
                '<canvas class="scn-canvas"></canvas>' +
                '<div class="scn-fallback" data-role="fallback"></div>' +
            '</div>' +
            '<div class="scn-note" data-role="note"></div>' +
            '<div class="scn-bottom">' +
                '<div class="scn-pages" data-role="pages"></div>' +
                '<div class="scn-actions">' +
                    '<button class="scn-btn" data-act="reset">Reset</button>' +
                    '<button class="scn-shutter" data-act="shoot" title="Tangkap halaman"></button>' +
                    '<button class="scn-btn primary" data-act="use">Gunakan</button>' +
                    '<button class="scn-btn" data-act="close">Tutup</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(ov);
        injectStyle();

        var video = ov.querySelector('.scn-video');
        var overlay = ov.querySelector('.scn-canvas');
        var statusEl = ov.querySelector('[data-role="status"]');
        var pagesEl = ov.querySelector('[data-role="pages"]');
        var noteEl = ov.querySelector('[data-role="note"]');
        var fallbackEl = ov.querySelector('[data-role="fallback"]');
        var shootBtn = ov.querySelector('[data-act="shoot"]');

        function setStatus(text, ok) {
            statusEl.textContent = text;
            statusEl.className = 'scn-badge' + (ok ? ' ok' : '');
        }

        function renderPages() {
            if (!state.pages.length) {
                pagesEl.innerHTML = '<div class="scn-empty">Belum ada halaman. Tekan tombol putih untuk menangkap.</div>';
                return;
            }
            pagesEl.innerHTML = state.pages.map(function (p, i) {
                return '<div class="scn-page">' +
                    '<img src="' + p.preview + '" alt="Halaman ' + (i + 1) + '">' +
                    '<span class="no">' + (i + 1) + '</span>' +
                    '<button class="del" data-del="' + i + '" title="Hapus">x</button>' +
                    '</div>';
            }).join('');
        }

        function stopCamera() {
            if (state.stream) {
                try { state.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* abaikan */ }
                state.stream = null;
            }
        }

        function close() {
            if (state.closed) return;
            state.closed = true;
            if (state.timer) clearInterval(state.timer);
            stopCamera();
            ov.remove();
        }

        function showFallback(message, withOs) {
            fallbackEl.style.display = 'flex';
            fallbackEl.innerHTML =
                '<div>' + escapeHtml(message) + '</div>' +
                (withOs ? '<button class="scn-btn primary" data-act="os">Pakai kamera OS</button>' : '') +
                '<button class="scn-btn" data-act="close">Tutup</button>';
        }

        async function startCamera() {
            setStatus('Menyalakan kamera…', false);
            fallbackEl.style.display = 'none';
            if (!isSupported()) {
                state.engine = null;
                showFallback('Perangkat ini tidak menyediakan kamera in-app.', true);
                setStatus('Kamera tidak tersedia', false);
                return;
            }
            try {
                stopCamera();
                state.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: state.facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                video.srcObject = state.stream;
                var p = video.play();
                if (p && p.catch) p.catch(function () {});
                setStatus('Kamera aktif', true);
                startDetector();
            } catch (e) {
                showFallback('Kamera tidak dapat diakses (izin ditolak atau tidak ada kamera).', true);
                setStatus('Kamera tidak tersedia', false);
            }
        }

        function drawOverlay(quad) {
            var vw = video.videoWidth, vh = video.videoHeight;
            if (!vw || !vh) return;
            overlay.width = vw;
            overlay.height = vh;
            var ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, vw, vh);
            if (!quad) return;
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = Math.max(2, Math.round(vw / 320));
            ctx.beginPath();
            quad.forEach(function (p, i) {
                var x = p.x * vw, y = p.y * vh;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
        }

        function startDetector() {
            if (state.timer) clearInterval(state.timer);
            state.timer = setInterval(async function () {
                if (state.closed || state.busy || !video.videoWidth) return;
                if (!state.engine) {
                    state.engine = await loadEngine().catch(function () { return null; });
                    if (!state.engine) {
                        noteEl.textContent = 'Deteksi tepi tidak tersedia; foto diambil tanpa koreksi.';
                        setStatus('Kamera aktif (tanpa deteksi)', true);
                        return;
                    }
                }
                var small = grabCanvas(video, 640);
                if (!small) return;
                try {
                    state.quad = detectQuad(state.engine, small);
                    drawOverlay(state.quad);
                    setStatus(state.quad ? 'Dokumen terdeteksi' : 'Mencari tepi…', !!state.quad);
                } catch (e) {
                    state.quad = null;
                }
            }, 500);
        }

        async function shoot() {
            if (state.busy) return;
            state.busy = true;
            shootBtn.disabled = true;
            try {
                var full = grabCanvas(video, MAX_OUTPUT_DIM);
                if (!full) return;
                var result;
                if (state.engine) {
                    result = processFrame(state.engine, full, state.quad);
                } else {
                    result = processPlain(video, state.quad);
                }
                var blob = new Blob([result.bytes], { type: 'image/jpeg' });
                state.pages.push({
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                    preview: URL.createObjectURL(blob)
                });
                renderPages();
            } catch (e) {
                noteEl.textContent = 'Gagal memproses gambar: ' + (e && e.message ? e.message : e);
            } finally {
                state.busy = false;
                shootBtn.disabled = false;
            }
        }

        function usePages() {
            if (!state.pages.length) { noteEl.textContent = 'Belum ada halaman untuk dipakai.'; return; }
            var out = state.pages.map(function (p) {
                return { bytes: p.bytes, width: p.width, height: p.height };
            });
            if (typeof opts.onApply === 'function') opts.onApply(out);
            close();
        }

        pagesEl.addEventListener('click', function (e) {
            var idx = e.target && e.target.getAttribute && e.target.getAttribute('data-del');
            if (idx == null) return;
            var i = parseInt(idx, 10);
            if (isNaN(i) || !state.pages[i]) return;
            try { URL.revokeObjectURL(state.pages[i].preview); } catch (err) { /* abaikan */ }
            state.pages.splice(i, 1);
            renderPages();
        });

        ov.addEventListener('click', function (e) {
            var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'close') close();
            else if (act === 'flip') { state.facing = state.facing === 'environment' ? 'user' : 'environment'; startCamera(); }
            else if (act === 'reset') {
                state.pages.forEach(function (p) { try { URL.revokeObjectURL(p.preview); } catch (err) { /* abaikan */ } });
                state.pages = [];
                renderPages();
            } else if (act === 'use') usePages();
            else if (act === 'os') { if (typeof opts.onOsFallback === 'function') opts.onOsFallback(); close(); }
        });
        shootBtn.addEventListener('click', shoot);

        renderPages();
        startCamera();
    }
```

- [ ] **Step 4: Jalankan test untuk memastikan tetap lulus**

Run: `npx vitest run test/scanner.test.js`
Expected: PASS (top-level modul tetap tidak menyentuh DOM; helper tetap lulus).

- [ ] **Step 5: Verifikasi manual di preview**

Jalankan server (jika belum): dari root repo `python3 -m http.server 5500 --bind 0.0.0.0`, atau worker dev `npx wrangler dev`. Buka halaman di HTTPS preview, panggil dari console:
`Scanner.open({ title:'Uji Scan' })`. Expected: overlay terbuka, minta izin kamera, video tampil, quad hijau muncul saat ada dokumen, tombol putih menangkap halaman abu-abu, thumbnail muncul, "Gunakan" menutup overlay. Tanpa error console.

- [ ] **Step 6: Commit**

```bash
git add public/scanner.js test/scanner.test.js
git commit -m "feat(scanner): overlay kamera + pipeline deteksi tepi + fallback"
```

---

### Task 3: Integrasi ke `dashboard.html` (3 titik)

**Files:**
- Modify: `public/dashboard.html`
- Test: `test/scanner.test.js`

**Interfaces:**
- Consumes: `window.Scanner.open` (Task 2); `scanTarget`, `scanBuildPdf`, `scanItems` yang sudah ada di dashboard.
- Produces: method `openScanner(which)` dan `scanAddPages(pages, which)`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `test/scanner.test.js`:

```javascript
describe('dashboard.html integrasi scanner in-app', () => {
  it('memuat scanner.js dan menyediakan hook', async () => {
    const html = await loadHtml('dashboard.html');
    expect(html).toContain('<script src="/scanner.js" defer></script>');
    expect(html).toContain('openScanner(which) {');
    expect(html).toContain('scanAddPages(pages, which) {');
    expect(html).toContain("openScanner('pelaksanaan')");
    expect(html).toContain("openScanner('bukti')");
    expect(html).toContain("openScanner('pendukung')");
  });

  it('tetap mempertahankan fallback kamera OS', async () => {
    const html = await loadHtml('dashboard.html');
    expect(html).toContain('ref="pelaksanaanCamera"');
    expect(html).toContain('ref="buktiCamera"');
    expect(html).toContain('ref="pendukungCamera"');
    expect(html).toContain('capture="environment"');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/scanner.test.js -t "dashboard.html integrasi"`
Expected: FAIL.

- [ ] **Step 3: Muat `scanner.js`**

Di `public/dashboard.html`, tepat setelah baris `<script src="/scan-pdf.js" defer></script>` (line ~270), tambahkan:

```html
    <script src="/scanner.js" defer></script>
```

- [ ] **Step 4: Tambah method `openScanner` + `scanAddPages`**

Di `public/dashboard.html`, di dalam `methods`, tepat sebelum `scanTarget(which) {`, sisipkan:

```javascript
                openScanner(which) {
                    const self = this;
                    const titles = { pelaksanaan: 'Scan BA Pelaksanaan', bukti: 'Scan Bukti Bayar', pendukung: 'Scan BA Pendukung' };
                    if (!window.Scanner || typeof window.Scanner.open !== 'function') {
                        this.notify('Scanner in-app tidak tersedia. Memakai kamera OS.', false);
                        const refs = { pelaksanaan: 'pelaksanaanCamera', bukti: 'buktiCamera', pendukung: 'pendukungCamera' };
                        const el = this.$refs[refs[which]];
                        if (el) el.click();
                        return;
                    }
                    window.Scanner.open({
                        title: titles[which] || 'Scan Dokumen',
                        onApply: function (pages) { self.scanAddPages(pages, which); },
                        onOsFallback: function () {
                            const refs = { pelaksanaan: 'pelaksanaanCamera', bukti: 'buktiCamera', pendukung: 'pendukungCamera' };
                            const el = self.$refs[refs[which]];
                            if (el) el.click();
                        }
                    });
                },
                scanAddPages(pages, which) {
                    const t = this.scanTarget(which);
                    this.scanEnsure(t);
                    (pages || []).forEach(function (p) {
                        if (!p || !p.bytes) return;
                        const blob = new Blob([p.bytes], { type: 'image/jpeg' });
                        t.scanSeq += 1;
                        t.scanItems.push({
                            id: 'scan-' + which + '-' + t.scanSeq,
                            url: URL.createObjectURL(blob),
                            bytes: p.bytes,
                            width: p.width,
                            height: p.height
                        });
                    });
                    if (!t.scanItems.length) this.notify('Tidak ada halaman yang dihasilkan.', false);
                },
```

- [ ] **Step 5: Alihkan tombol "Scan Kamera" ke `openScanner`**

Ubah tiga handler (jangan hapus elemen `<input>` fallback):

- Line ~1214: `@click="$refs.pelaksanaanCamera.click()"` → `@click="openScanner('pelaksanaan')"`
- Line ~1646: `@click="$refs.buktiCamera.click()"` → `@click="openScanner('bukti')"`
- Line ~1883: `@click="$refs.pendukungCamera.click()"` → `@click="openScanner('pendukung')"`

- [ ] **Step 6: Jalankan test**

Run: `npx vitest run test/scanner.test.js test/scan-pdf.test.js test/dashboard-template.test.js`
Expected: PASS (termasuk marker lama `scanOnPhotos`, `capture="environment"`, `ref="*Camera"`).

- [ ] **Step 7: Commit**

```bash
git add public/dashboard.html test/scanner.test.js
git commit -m "feat(dashboard): pakai scanner in-app untuk 3 titik scan (fallback kamera OS tetap)"
```

---

### Task 4: Integrasi ke `bagian.html` (1 titik)

**Files:**
- Modify: `public/bagian.html`
- Test: `test/scanner.test.js`

**Interfaces:**
- Consumes: `window.Scanner.open` (Task 2); `ba.scanItems` yang sudah ada di bagian.
- Produces: method `openScanner()` dan `scanAddPages(pages)`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `test/scanner.test.js`:

```javascript
describe('bagian.html integrasi scanner in-app', () => {
  it('memuat scanner.js dan menyediakan hook', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain('<script src="/scanner.js" defer></script>');
    expect(html).toContain('openScanner() {');
    expect(html).toContain('scanAddPages(pages) {');
    expect(html).toContain('@click="openScanner()"');
  });

  it('tetap mempertahankan fallback kamera OS', async () => {
    const html = await loadHtml('bagian.html');
    expect(html).toContain('ref="scanCamera"');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('@change="onScanPhotos"');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/scanner.test.js -t "bagian.html integrasi"`
Expected: FAIL.

- [ ] **Step 3: Muat `scanner.js`**

Di `public/bagian.html`, tepat setelah `<script src="/scan-pdf.js" defer></script>` (line ~52), tambahkan:

```html
    <script src="/scanner.js" defer></script>
```

- [ ] **Step 4: Tambah method `openScanner` + `scanAddPages`**

Di `public/bagian.html`, di dalam `methods`, tepat sebelum `clearScanItems() {`, sisipkan:

```javascript
                openScanner() {
                    const self = this;
                    if (!window.Scanner || typeof window.Scanner.open !== 'function') {
                        this.showToast('Scanner in-app tidak tersedia. Memakai kamera OS.', 'error');
                        if (this.$refs.scanCamera) this.$refs.scanCamera.click();
                        return;
                    }
                    window.Scanner.open({
                        title: 'Scan Berita Acara',
                        onApply: function (pages) { self.scanAddPages(pages); },
                        onOsFallback: function () {
                            if (self.$refs.scanCamera) self.$refs.scanCamera.click();
                        }
                    });
                },
                scanAddPages(pages) {
                    const self = this;
                    (pages || []).forEach(function (p) {
                        if (!p || !p.bytes) return;
                        const blob = new Blob([p.bytes], { type: 'image/jpeg' });
                        self.ba.scanSeq += 1;
                        self.ba.scanItems.push({
                            id: 'scan-' + self.ba.scanSeq,
                            url: URL.createObjectURL(blob),
                            bytes: p.bytes,
                            width: p.width,
                            height: p.height
                        });
                    });
                    if (!this.ba.scanItems.length) this.showToast('Tidak ada halaman yang dihasilkan.', 'error');
                },
```

- [ ] **Step 5: Alihkan tombol "Scan Kamera"**

Line ~322: ubah `@click="$refs.scanCamera.click()"` → `@click="openScanner()"` (jangan hapus `<input ref="scanCamera">`).

- [ ] **Step 6: Jalankan test**

Run: `npx vitest run test/scanner.test.js test/scan-pdf.test.js`
Expected: PASS (termasuk marker lama `onScanPhotos`, `capture="environment"`).

- [ ] **Step 7: Commit**

```bash
git add public/bagian.html test/scanner.test.js
git commit -m "feat(bagian): pakai scanner in-app untuk BA (fallback kamera OS tetap)"
```

---

### Task 5: QA menyeluruh + deploy

**Files:**
- Test: `test/scanner.test.js` (tidak ada perubahan wajib)

- [ ] **Step 1: Jalankan seluruh suite**

Run: `npx vitest run`
Expected: seluruh PASS; jumlah test ≥ 342 (baseline) + tambahan baru. Tidak ada yang gagal.

- [ ] **Step 2: Verifikasi manual matrix di preview HTTPS**

Ambil preview worker (`wrangler dev` di 8787) atau preview platform. Uji:
1. Dashboard → BA Pelaksanaan → "Scan Kamera": overlay terbuka, quad hijau, jepret 3 halaman, "Gunakan", lalu "Buat PDF" menghasilkan file < 5 MB.
2. Ulangi untuk Bukti Bayar dan BA Pendukung.
3. `bagian` → BA → "Scan Kamera": alur sama.
4. Izin kamera ditolak → pesan + tombol "Pakai kamera OS" berfungsi.
5. Desktop tanpa kamera → fallback muncul.
6. Dokumen di latar ramai → quad tak terdeteksi → tetap bisa jepret (kotak penuh).
7. iOS Safari: overlay & kamera berfungsi.

- [ ] **Step 3: Deploy production**

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Expected: worker `inhal-form` sukses; asset `vendor/opencv-4.11.0.js` + `scanner.js` terunggah. Konfirmasi ukuran asset ≤ 25 MiB.

- [ ] **Step 4: Verifikasi produksi**

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://inhal-form.prodi.workers.dev/vendor/opencv-4.11.0.js
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://inhal-form.prodi.workers.dev/scanner.js
```

Expected: `200` untuk keduanya; ukuran opencv ±11.4 MB, scanner beberapa KB.

---

## Catatan Asumsi

1. Build `@techstark/opencv-js@4.11.0-release.1` self-contained (wasm tertanam) — sudah diverifikasi (file tunggal 11.4 MB, UMD men-set `window.cv`).
2. Batas asset Cloudflare ≤ 25 MiB/file — 11.4 MB aman.
3. Deteksi tepi gagal pada latar ramai ditangani fallback kotak penuh.
4. Koreksi 4 sudut manual dan mode warna/BW adalah iterasi berikutnya (di luar plan ini).

## Self-Review

**Spec coverage:**
- Library A (OpenCV.js self-hosted) → Task 1.
- Pipeline deteksi + threshold → Task 2 (`detectQuad`, `processFrame`).
- Overlay live + multi-halaman + reorder/remove + "Gunakan" → Task 2 (`open`).
- Integrasi 4 titik → Task 3 (dashboard 3) + Task 4 (bagian 1).
- Fallback (kamera OS, tanpa engine, tak terdeteksi) → Task 2.
- Ukuran/performa/deploy → Task 1 (vendor) + Task 5.
- Testing (unit helper + guard template + regression + manual) → Task 1-5.
- Non-tujuan (tak sentuh portal/index/detail-laporan, backend, scan-pdf.js) → dipatuhi.

**Placeholder scan:** Tidak ada TBD/TODO; setiap step berisi kode/command konkret.

**Type consistency:** `openScanner(which)`/`scanAddPages(pages, which)` (dashboard) dan `openScanner()`/`scanAddPages(pages)` (bagian) konsisten dengan `window.Scanner.open({title,onApply,onOsFallback})`; bentuk item `scanItems` (`id,url,bytes,width,height`) sama dengan `scanOnPhotos` lama.
