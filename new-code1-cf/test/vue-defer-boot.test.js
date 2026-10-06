import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

const PAGES = [
  ['dashboard.html', 'bootDashboard'],
  ['portal.html', 'bootPortal'],
  ['index.html', 'bootIndex'],
  ['bagian.html', 'bootBagian']
];

async function loadHtml(name) {
  const res = await env.ASSETS.fetch(new Request(`https://example.com/${name}`));
  expect(res.status).toBe(200);
  return res.text();
}

function inlineScript(html) {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('inline app script not found');
  return match[1];
}

describe('Vue dimuat di head dengan defer + boot gating', () => {
  for (const [name, boot] of PAGES) {
    it(`${name}: tepat satu tag Vue, defer, di dalam head`, async () => {
      const html = await loadHtml(name);
      const total = (html.match(/vue\.global\.prod\.js/g) || []).length;
      expect(total).toBe(1);
      const headEnd = html.indexOf('</head>');
      const vueAt = html.indexOf('vue.global.prod.js');
      expect(vueAt).toBeGreaterThan(-1);
      expect(vueAt).toBeLessThan(headEnd);
      expect(html).toContain('vue.global.prod.js" defer></script>');
      expect(html).not.toContain('vue.global.prod.js"></script>');
    });

    it(`${name}: app dibungkus ${boot} dengan gate window.Vue`, async () => {
      const html = await loadHtml(name);
      expect(html).toContain(`function ${boot}()`);
      expect(html).toContain(`if (window.Vue) {\n            ${boot}();`);
      expect(html).toContain(`window.addEventListener('DOMContentLoaded', ${boot});`);
    });

    it(`${name}: inline script lolos syntax check`, async () => {
      const html = await loadHtml(name);
      const script = inlineScript(html);
      expect(() => new Function(script)).not.toThrow();
    });
  }
});
