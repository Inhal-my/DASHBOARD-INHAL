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
