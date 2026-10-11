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

describe('scanner.js kontrak modul', () => {
  it('mengekspos API yang dipakai host', () => {
    const S = loadScanner();
    expect(typeof S.open).toBe('function');
    expect(typeof S.loadEngine).toBe('function');
    expect(typeof S.isSupported).toBe('function');
  });
});
