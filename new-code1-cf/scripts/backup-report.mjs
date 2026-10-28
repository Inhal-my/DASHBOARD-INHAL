import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Menyusun ringkasan backup untuk halaman run GitHub Actions sekaligus menjaga
 * ambang ukuran D1. Keluar dengan kode 1 bila ukuran melewati batas paket.
 *
 * Pemakaian:
 *   node scripts/backup-report.mjs <dir-out> [--summary=<file>]
 */

function argOf(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (err) { return null; }
}

function mb(bytes) {
  return (Number(bytes || 0) / (1024 * 1024)).toFixed(2) + ' MB';
}

/** Menentukan tindakan berdasarkan ambang: `fail`, `warn`, atau `ok`. */
export function limitState(size) {
  const bytes = Number(size && size.estimatedBytes) || 0;
  const maxBytes = Number(size && size.maxBytes) || 0;
  if (maxBytes && bytes >= maxBytes) return 'fail';
  if (String((size && size.status) || 'ok') === 'warn') return 'warn';
  return 'ok';
}

/** Menyusun baris markdown ringkasan dari manifest (dan verify.json bila ada). */
export function buildLines(manifest, verify) {
  const size = manifest.size || {};
  const planLabel = manifest.plan && manifest.plan.label ? manifest.plan.label : String(manifest.plan || '-');

  const lines = [];
  lines.push('## Backup D1 ' + manifest.label);
  lines.push('');
  lines.push('- Database: `' + manifest.database + '`');
  lines.push('- Paket: ' + planLabel);
  lines.push('- Ukuran perkiraan data: **' + (size.estimatedHuman || mb(size.estimatedBytes)) +
    '** dari batas ' + mb(size.maxBytes) + ' (' + (size.status || 'ok') + ')');
  lines.push('- Dump SQL: ' + mb(manifest.source && manifest.source.bytes) +
    ' | sha256 `' + String((manifest.source && manifest.source.sha256) || '').slice(0, 16) + '...`');
  lines.push('- Integritas: `' + String((manifest.verification && manifest.verification.integrity) || '?') + '`');
  lines.push('- Total baris: ' + manifest.totalRows);
  if (manifest.uploads && manifest.uploads.present) {
    lines.push('- `uploads`: ' + manifest.uploads.rows + ' baris, kolom `content` ' +
      mb(manifest.uploads.contentBytes));
  }
  if (verify) {
    lines.push('- Verifikasi bisnis: ' + (verify.ok ? 'LULUS' : 'GAGAL - ' + (verify.failures || []).join('; ')));
  }
  if (manifest.excludedColumns && Object.keys(manifest.excludedColumns).length) {
    const parts = Object.keys(manifest.excludedColumns)
      .map((t) => t + '(' + manifest.excludedColumns[t].join(',') + ')');
    lines.push('- Kolom besar dikecualikan dari snapshot/XLSX (tetap ada di dump): ' + parts.join(', '));
  }
  lines.push('');
  lines.push('### Jumlah baris per tabel');
  lines.push('');
  lines.push('| Tabel | Baris |');
  lines.push('| --- | --- |');
  const counts = manifest.counts || {};
  for (const table of Object.keys(counts).sort()) {
    lines.push('| ' + table + ' | ' + counts[table] + ' |');
  }
  lines.push('');
  return lines;
}

function main() {
  const argv = process.argv.slice(2);
  const outDir = argv.find((a) => !a.startsWith('--'));
  if (!outDir) {
    console.error('Pemakaian: node scripts/backup-report.mjs <dir-out> [--summary=<file>]');
    process.exitCode = 2;
    return;
  }

  const manifest = readJson(join(outDir, 'manifest.json'));
  if (!manifest) {
    console.error('manifest.json tidak ditemukan di ' + outDir);
    process.exitCode = 1;
    return;
  }
  const verify = readJson(join(outDir, 'verify.json'));

  const text = buildLines(manifest, verify).join('\n') + '\n';
  const summaryPath = argOf(argv, 'summary', process.env.GITHUB_STEP_SUMMARY || '');
  if (summaryPath) appendFileSync(summaryPath, text);
  console.log(text.trimEnd());

  const state = limitState(manifest.size);
  if (state === 'fail') {
    console.error('::error title=Batas D1 terlampaui::Perkiraan ukuran ' +
      (manifest.size.estimatedHuman || mb(manifest.size.estimatedBytes)) + ' >= batas ' +
      mb(manifest.size.maxBytes) + '. Jalankan pembersihan sebelum penulisan berhenti.');
    process.exitCode = 1;
    return;
  }
  if (state === 'warn') {
    console.log('::warning title=Ukuran D1 mendekati batas::' +
      (manifest.size.estimatedHuman || mb(manifest.size.estimatedBytes)) +
      ' sudah melewati ambang ' + mb(manifest.size.warnBytes) + '.');
  }
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();