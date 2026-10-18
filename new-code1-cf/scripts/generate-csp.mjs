import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const EXTERNAL = {
  style: ['https://fonts.googleapis.com'],
  font: ['https://fonts.gstatic.com']
};

function hash(text) {
  return "'sha256-" + createHash('sha256').update(text, 'utf8').digest('base64') + "'";
}

function collect() {
  const scripts = new Set();
  for (const file of readdirSync(publicDir).filter((f) => f.endsWith('.html')).sort()) {
    const html = readFileSync(join(publicDir, file), 'utf8');
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) scripts.add(hash(match[2]));
    }
  }
  return [...scripts].sort();
}

export function buildCsp() {
  const scripts = collect();
  return [
    "default-src 'self'",
    ["script-src 'self' 'unsafe-eval'", ...scripts].join(' '),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    ["font-src", ...EXTERNAL.font].join(' '),
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

const csp = buildCsp();

const headerLines = [
  '/*',
  `  Content-Security-Policy: ${csp}`,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '  Cross-Origin-Opener-Policy: same-origin',
  ''
].join('\n');

const moduleSource = [
  '// AUTO-GENERATED oleh scripts/generate-csp.mjs. Jangan diedit manual.',
  '// Jalankan `npm run csp:generate` setelah mengubah script/style inline di public/*.html.',
  `export const CSP = ${JSON.stringify(csp)};`,
  ''
].join('\n');

writeFileSync(join(publicDir, '_headers'), headerLines);
writeFileSync(join(root, 'src', 'security', 'csp.js'), moduleSource);
console.log('CSP diperbarui:', csp);
