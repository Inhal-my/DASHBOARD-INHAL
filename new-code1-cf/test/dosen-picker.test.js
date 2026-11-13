import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

async function loadPicker() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dosen-picker.js'));
  expect(res.status).toBe(200);
  const src = await res.text();
  const fake = {};
  new Function('window', src)(fake);
  return fake.DosenPicker;
}

describe('DosenPicker', () => {
  it('menormalkan nama untuk pencarian dan deteksi master', async () => {
    const D = await loadPicker();
    expect(D.normalize('  Dr.  Andi ')).toBe('dr. andi');
    expect(D.isMaster('dr. andi', ['dr. Andi', 'dr. Budi'])).toBe(true);
    expect(D.isMaster('dr. asing', ['dr. Andi'])).toBe(false);
  });

  it('memakai tombol baca-saja dan search yang hanya memfilter', async () => {
    const D = await loadPicker();
    const t = D.component.template;
    expect(t).toContain('role="combobox"');
    expect(t).toContain('v-model="query"');
    expect(t).not.toContain('v-model="modelValue"');
    expect(t).toContain('@click="choose(o)"');
    expect(D.component.emits).toContain('update:modelValue');
  });
});
