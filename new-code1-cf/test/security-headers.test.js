import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index.js';
import { SECURITY_HEADERS, CSP } from '../src/security/headers.js';

async function asset(path) {
  const res = await env.ASSETS.fetch(new Request('https://example.com' + path));
  return { status: res.status, text: await res.text(), headers: res.headers };
}

async function sha256Base64(text) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...digest));
}

function inlineHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) hashes.push(match[2]);
  }
  return hashes;
}

describe('security headers', () => {
  it('menambahkan header keamanan pada respons aplikasi', async () => {
    const res = await app.request('http://example.com/api/health', {}, { DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) } });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('content-security-policy')).toBe(CSP);
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('CSP memuat hash semua script inline di halaman', async () => {
    expect(CSP).toContain("'unsafe-eval'");
    expect(CSP).toContain('https://fonts.gstatic.com');
    expect(CSP).toContain("img-src 'self' data: blob:");
    for (const path of ['/dashboard.html', '/portal.html', '/bagian.html', '/index.html', '/detail-laporan.html']) {
      const { status, text } = await asset(path);
      expect(status).toBe(200);
      for (const block of inlineHashes(text)) {
        expect(CSP).toContain(`'sha256-${await sha256Base64(block)}'`);
      }
    }
  });
});
