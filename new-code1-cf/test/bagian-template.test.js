import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  if (start === -1) throw new Error('#app root not found');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) { end = re.lastIndex; break; }
    } else {
      depth += 1;
    }
  }
  if (end === -1) throw new Error('#app root close not found');
  return slice.slice(0, end);
}

function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => {
      const el = {
        _html: '',
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html; },
        get textContent() { return this._html; },
        get children() {
          const match = this._html.match(/^<div foo="([\s\S]*)">$/);
          const value = match ? match[1] : this._html;
          return [{ getAttribute: () => value }];
        }
      };
      return el;
    }
  };
}

async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('bagian template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    const template = extractAppTemplate(html);
    const errors = [];
    compile(template, {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });

  it('shell melebar penuh dengan konten dibatasi max-w-7xl', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="flex min-h-screen w-full flex-col bg-slate-50"');
    expect(html).toContain('mx-auto flex min-h-screen w-full max-w-md flex-col');
    expect(html).toContain('mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-8');
    expect(html).toContain('<div class="mx-auto w-full max-w-7xl">');
  });

  it('memakai shell workspace dengan bottom nav', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="space-y-5"');
    expect(html).toContain('class="workspace"');
    expect(html).toContain('class="bottom-nav"');
  });

  it('kartu Upload BA hanya tampil pada tab Berita Acara', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain(`v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"`);
  });

  it('input file BA punya tombol pilih file yang terlihat dan target sentuh cukup', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ref="baFile"');
    expect(html).toContain('Pilih File PDF');
    expect(html).toContain('class="hidden" @change="onBaFile"');
    expect(html).not.toContain('text-[11px] text-transparent');
  });

  it('konfirmasi upload tetap terbuka dan menampilkan progres sampai selesai', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Mengunggah file... mohon tunggu.');
    expect(html).toContain(':disabled="loading" @click="ba.confirm=false"');
    const start = html.indexOf('async doUploadBa()');
    const end = html.indexOf('async doUploadBa()') + 1800;
    const body = html.slice(start, end);
    expect(body).not.toContain('this.ba.confirm = false;\n                    this.loading = true;');
    expect(body).toContain('const fileEl = this.$refs.baFile;');
  });

  it('menampilkan BA Pendukung admin sebagai informasi read-only', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('baPendukungList');
    expect(html).toContain('selectedPendukung');
    expect(html).toContain('BA Pendukung belum ada');
    expect(html).toContain('Belum diunggah admin dashboard.');
    expect(html).toContain('rel="noopener noreferrer" class="font-semibold text-indigo-600 hover:underline" @click.stop');
  });
});

describe('guard BA Pelaksanaan multi', () => {
  it('menyediakan input label dan menyaring baMember', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ba.label');
    expect(html).toContain('/bagian-state.js');
    expect(html).not.toContain('Diterima / ACC');
  });
});
