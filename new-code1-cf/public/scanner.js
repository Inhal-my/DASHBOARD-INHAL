(function () {
    'use strict';

    var OPENCV_URL = '/vendor/opencv-4.11.0.js';
    var MAX_OUTPUT_DIM = 1600;

    var enginePromise = null;
    var activeClose = null;

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
            function bad(err) {
                if (settled) return;
                settled = true;
                enginePromise = null;
                reject(err instanceof Error ? err : new Error('OpenCV gagal dimuat'));
            }

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
            '.scn-frame{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(80%,380px);aspect-ratio:1/1.414;pointer-events:none}',
            '.scn-corner{position:absolute;width:30px;height:30px;border:3px solid #fbbf24;transition:border-color .4s}',
            '.scn-frame.locked .scn-corner{border-color:#34d399}',
            '.scn-corner.tl{top:-2px;left:-2px;border-right:0;border-bottom:0;border-radius:9px 0 0 0}',
            '.scn-corner.tr{top:-2px;right:-2px;border-left:0;border-bottom:0;border-radius:0 9px 0 0}',
            '.scn-corner.bl{bottom:-2px;left:-2px;border-right:0;border-top:0;border-radius:0 0 0 9px}',
            '.scn-corner.br{bottom:-2px;right:-2px;border-left:0;border-top:0;border-radius:0 0 9px 0}',
            '.scn-scanline{position:absolute;left:8%;right:8%;height:3px;border-radius:99px;background:linear-gradient(90deg,transparent,#34d399,transparent);opacity:0}',
            '.scn-frame.locked .scn-scanline{opacity:.95;animation:scn-scanline 2.2s ease-in-out infinite}',
            '@keyframes scn-scanline{0%{top:8%}50%{top:88%}100%{top:8%}}',
            '.scn-pill{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.78);border:1px solid #334155;color:#cbd5e1;font-size:11.5px;font-weight:600;padding:7px 13px;border-radius:999px;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}',
            '.scn-fallback{position:absolute;inset:0;z-index:2;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;color:#e2e8f0;text-align:center;background:rgba(11,17,32,.92)}',
            '.scn-bottom{background:#0f172a;border-top:1px solid #1e293b;padding:10px 14px calc(12px + env(safe-area-inset-bottom));color:#cbd5e1}',
            '.scn-pages{display:flex;gap:8px;overflow-x:auto;min-height:64px;margin-bottom:10px;padding:2px 0}',
            '.scn-page{position:relative;width:48px;height:64px;flex:0 0 auto;border-radius:6px;border:2px solid #334155;overflow:hidden;background:#1e293b}',
            '.scn-page img{width:100%;height:100%;object-fit:cover;display:block}',
            '.scn-page .no{position:absolute;left:2px;top:2px;background:rgba(15,23,42,.8);color:#fff;font-size:9px;font-weight:800;padding:0 4px;border-radius:4px}',
            '.scn-page .del{position:absolute;right:1px;top:1px;width:16px;height:16px;border-radius:999px;background:#e11d48;color:#fff;font-size:10px;border:0;cursor:pointer}',
            '.scn-page .mv{position:absolute;left:0;right:0;bottom:1px;display:flex;justify-content:center;gap:4px}',
            '.scn-page .mv button{background:rgba(15,23,42,.74);color:#fff;font-size:11px;line-height:1;width:16px;height:16px;border:0;border-radius:5px;cursor:pointer}',
            '.scn-page .mv button:disabled{opacity:.3;cursor:default}',
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
                var approx = null;
                try {
                    var area = cv.contourArea(c);
                    if (area > frameArea * 0.15 && area > bestArea) {
                        var peri = cv.arcLength(c, true);
                        approx = new cv.Mat();
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
                    }
                } finally {
                    if (approx) approx.delete();
                    c.delete();
                }
            }
        } finally {
            src.delete(); gray.delete(); blur.delete(); edges.delete();
            kernel.delete(); contours.delete(); hierarchy.delete();
        }
        return quad;
    }

    function processFrame(cv, canvas, quad) {
        var src = cv.imread(canvas);
        var flat = null;
        var gray = new cv.Mat();
        var thr = new cv.Mat();
        try {
            if (quad) {
                var pts = quad.map(function (p) {
                    return { x: Math.round(p.x * (canvas.width - 1)), y: Math.round(p.y * (canvas.height - 1)) };
                });
                var size = outputSize(pts, MAX_OUTPUT_DIM);
                var srcTri = null, dstTri = null, m = null;
                flat = new cv.Mat();
                try {
                    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                        pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y
                    ]);
                    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                        0, 0, size.width - 1, 0, size.width - 1, size.height - 1, 0, size.height - 1
                    ]);
                    m = cv.getPerspectiveTransform(srcTri, dstTri);
                    cv.warpPerspective(src, flat, m, new cv.Size(size.width, size.height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
                } finally {
                    if (srcTri) srcTri.delete();
                    if (dstTri) dstTri.delete();
                    if (m) m.delete();
                }
            }
            cv.cvtColor(quad ? flat : src, gray, cv.COLOR_RGBA2GRAY);
            cv.adaptiveThreshold(gray, thr, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
            var out = document.createElement('canvas');
            out.width = thr.cols;
            out.height = thr.rows;
            cv.imshow(out, thr);
            var dataUrl = out.toDataURL('image/jpeg', 0.8);
            return { bytes: dataUrlToBytes(dataUrl), width: out.width, height: out.height };
        } finally {
            src.delete(); if (flat) flat.delete(); gray.delete(); thr.delete();
        }
    }

    function processPlain(canvas) {
        if (!canvas) return null;
        var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return { bytes: dataUrlToBytes(dataUrl), width: canvas.width, height: canvas.height };
    }

    /* ---------- overlay ---------- */

    function open(opts) {
        opts = opts || {};
        if (typeof activeClose === 'function') {
            try { activeClose(); } catch (e) { /* abaikan */ }
        }
        var state = { stream: null, facing: 'environment', pages: [], quad: null, engine: null, busy: false, timer: null, closed: false, engineFailed: false };

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
                '<div class="scn-frame" data-role="frame">' +
                    '<div class="scn-corner tl"></div><div class="scn-corner tr"></div>' +
                    '<div class="scn-corner bl"></div><div class="scn-corner br"></div>' +
                    '<div class="scn-scanline"></div>' +
                '</div>' +
                '<div class="scn-pill" data-role="pill"></div>' +
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
        var frameEl = ov.querySelector('[data-role="frame"]');
        var pillEl = ov.querySelector('[data-role="pill"]');
        var shootBtn = ov.querySelector('[data-act="shoot"]');

        function setStatus(text, ok) {
            statusEl.textContent = text;
            statusEl.className = 'scn-badge' + (ok ? ' ok' : '');
        }

        function renderPages() {
            if (pillEl) {
                pillEl.textContent = state.pages.length
                    ? state.pages.length + ' halaman siap digabung'
                    : 'Tekan tombol putih untuk menangkap halaman';
            }
            if (!state.pages.length) {
                pagesEl.innerHTML = '<div class="scn-empty">Belum ada halaman. Tekan tombol putih untuk menangkap.</div>';
                return;
            }
            pagesEl.innerHTML = state.pages.map(function (p, i) {
                var last = state.pages.length - 1;
                return '<div class="scn-page">' +
                    '<img src="' + p.preview + '" alt="Halaman ' + (i + 1) + '">' +
                    '<span class="no">' + (i + 1) + '</span>' +
                    '<button class="del" data-del="' + i + '" title="Hapus">x</button>' +
                    '<div class="mv">' +
                        '<button data-move="' + i + '" data-dir="-1" title="Geser ke kiri"' + (i === 0 ? ' disabled' : '') + '>&#8249;</button>' +
                        '<button data-move="' + i + '" data-dir="1" title="Geser ke kanan"' + (i === last ? ' disabled' : '') + '>&#8250;</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
        }

        function stopCamera() {
            if (state.stream) {
                try { state.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* abaikan */ }
                state.stream = null;
            }
        }

        function releasePages() {
            if (!state || !state.pages) return;
            state.pages.forEach(function (p) {
                if (p && p.preview) {
                    try { URL.revokeObjectURL(p.preview); } catch (e) { /* abaikan */ }
                    p.preview = null;
                }
            });
        }

        function close() {
            if (state.closed) return;
            state.closed = true;
            if (state.timer) clearInterval(state.timer);
            stopCamera();
            releasePages();
            ov.remove();
            if (activeClose === close) activeClose = null;
        }
        activeClose = close;

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
            shootBtn.disabled = true;
            state.quad = null;
            if (frameEl) frameEl.classList.remove('locked');
            video.addEventListener('loadeddata', function () { shootBtn.disabled = false; }, { once: true });
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
            var stage = ov.querySelector('.scn-stage');
            var sw = stage ? stage.clientWidth : 0;
            var sh = stage ? stage.clientHeight : 0;
            if (!vw || !vh || !sw || !sh) return;
            overlay.width = sw;
            overlay.height = sh;
            var ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, sw, sh);
            if (!quad) return;
            // object-fit: cover -> scale to fill the stage, centered & cropped
            var scale = Math.max(sw / vw, sh / vh);
            var dw = vw * scale, dh = vh * scale;
            var ox = (sw - dw) / 2, oy = (sh - dh) / 2;
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = Math.max(2, Math.round(sw / 320));
            ctx.beginPath();
            quad.forEach(function (p, i) {
                var x = ox + p.x * dw, y = oy + p.y * dh;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
        }

        function startDetector() {
            if (state.timer) clearInterval(state.timer);
            state.timer = setInterval(async function () {
                if (state.closed || state.busy || !video.videoWidth) return;
                if (state.engineFailed) return;
                if (!state.engine) {
                    state.engine = await loadEngine().catch(function () { return null; });
                    if (!state.engine) {
                        state.engineFailed = true;
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
                    if (frameEl) frameEl.classList.toggle('locked', !!state.quad);
                    setStatus(state.quad ? 'Dokumen terdeteksi' : 'Mencari tepi…', !!state.quad);
                } catch (e) {
                    state.quad = null;
                    if (frameEl) frameEl.classList.remove('locked');
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
                var result = state.engine ? processFrame(state.engine, full, state.quad) : processPlain(full);
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
                shootBtn.disabled = !(video && video.videoWidth);
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
            var el = e.target;
            if (!el || !el.getAttribute) return;
            var moveIdx = el.getAttribute('data-move');
            if (moveIdx != null) {
                var i = parseInt(moveIdx, 10);
                var dir = parseInt(el.getAttribute('data-dir'), 10);
                var j = i + dir;
                if (isNaN(i) || isNaN(dir) || j < 0 || j >= state.pages.length) return;
                var tmp = state.pages[i];
                state.pages[i] = state.pages[j];
                state.pages[j] = tmp;
                renderPages();
                return;
            }
            var idx = el.getAttribute('data-del');
            if (idx == null) return;
            var d = parseInt(idx, 10);
            if (isNaN(d) || !state.pages[d]) return;
            try { URL.revokeObjectURL(state.pages[d].preview); } catch (err) { /* abaikan */ }
            state.pages.splice(d, 1);
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

    window.Scanner = {
        loadEngine: loadEngine,
        isSupported: isSupported,
        open: open,
        __test: { orderCorners: orderCorners, outputSize: outputSize }
    };
})();
