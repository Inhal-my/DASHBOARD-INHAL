import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

async function asset(path) {
  const res = await env.ASSETS.fetch(new Request('https://example.com' + path));
  expect(res.status).toBe(200);
  return res.text();
}

async function loadCommon(win) {
  const src = await asset('/app-common.js');
  const fake = win || {
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: true }),
    innerWidth: 1440,
    innerHeight: 900
  };
  new Function('window', src)(fake);
  return fake.AppCommon;
}

function makeWindow(viewportW) {
  return {
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: true }),
    innerWidth: viewportW,
    innerHeight: 900
  };
}

function makeCtx(AppCommon, rectLeft, rectWidth) {
  const data = AppCommon.buktiPreviewMixin.data();
  data.buktiPreview.open = true;
  data.buktiPreview.rectLeft = rectLeft;
  data.buktiPreview.rectWidth = rectWidth;
  data.buktiPreview.rectTop = 300;
  data.buktiPreview.rectBottom = 330;
  data.$refs = { buktiPreview: { offsetHeight: 500, offsetWidth: 880 } };
  return data;
}

describe('preview bukti bersama', () => {
  it('mengambil ID file dari berbagai bentuk tautan Drive', async () => {
    const AppCommon = await loadCommon();
    const id = '14y2JloeLzhqRmesbEFXjyIgT9bVzzLTK';
    for (const url of [
      `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?id=${id}&export=download`,
      `https://lh3.googleusercontent.com/d/${id}=w1000`
    ]) {
      expect(AppCommon.driveFileId(url)).toBe(id);
      expect(AppCommon.driveThumbUrl(url, 800)).toBe(`https://drive.google.com/thumbnail?id=${id}&sz=w800`);
    }
    expect(AppCommon.driveFileId('https://example.com/file.pdf')).toBe('');
    expect(AppCommon.driveThumbUrl('')).toBe('');
  });

  it('memakai jeda 200ms dan lebar maksimum 880px', async () => {
    const AppCommon = await loadCommon();
    const src = await asset('/app-common.js');
    expect(src).toContain('onBuktiEnter(event, url, label)');
    expect(src).toContain("label: ''");
    expect(AppCommon.buktiPreview.delay).toBe(200);
    expect(AppCommon.buktiPreview.closeDelay).toBe(150);
    expect(AppCommon.buktiPreview.maxWidth).toBe(880);
    expect(AppCommon.buktiPreview.minWidth).toBe(360);
    expect(typeof AppCommon.buktiPreviewMixin.methods.onBuktiEnter).toBe('function');
    expect(typeof AppCommon.buktiPreviewMixin.methods.positionBuktiPreview).toBe('function');
  });

  it('mendahulukan sisi kiri lalu kanan lalu bawah', async () => {
    const run = async (viewportW, rectLeft, rectWidth) => {
      const AppCommon = await loadCommon(makeWindow(viewportW));
      const ctx = makeCtx(AppCommon, rectLeft, rectWidth);
      AppCommon.buktiPreviewMixin.methods.positionBuktiPreview.call(ctx);
      return ctx.buktiPreview;
    };

    const left = await run(1440, 1200, 80);
    expect(left.placement).toBe('left');
    expect(left.width).toBe(880);
    expect(left.left).toBe(308);
    expect(left.ready).toBe(true);

    const right = await run(1440, 200, 80);
    expect(right.placement).toBe('right');
    expect(right.width).toBe(880);

    const below = await run(700, 300, 100);
    expect(below.placement).toBe('below');
    expect(below.width).toBe(676);
  });

  it('CSS dan halaman memakai berkas preview bersama', async () => {
    const css = await asset('/bukti-preview.css');
    expect(css).toContain('.bukti-preview {');
    expect(css).toContain('width: 880px');
    expect(css).toContain('max-height: 84vh');
    expect(css).toContain('.bukti-preview.is-left::before');
    expect(css).toContain('@media (max-width:1023px){ .bukti-preview { display: none !important; } }');

    const dashboard = await asset('/dashboard.html');
    expect(dashboard).toContain('<link href="/bukti-preview.css" rel="stylesheet">');
    expect(dashboard).toContain('mixins: [AppCommon.buktiPreviewMixin]');
    expect(dashboard).toContain("onBuktiEnter($event, b.fileUrl, 'BA Pendukung')");
    expect(dashboard).toContain("onBuktiEnter($event, b.fileUrl, 'BA Pelaksanaan')");
    expect(dashboard).toContain('r.__pendukungBa');
    expect(dashboard).toContain('r.__pelaksanaanBa');
    expect(dashboard).toContain('class="bukti-preview"');
  });
});

describe('preview bukti viewport guard', () => {
  it('tidak memanggil contains untuk target non-Node', async () => {
    const AppCommon = await loadCommon();
    let closed = false;
    const ctx = {
      $refs: { buktiPreview: { contains() { throw new Error('contains should not be called'); } } },
      closeBuktiPreview() { closed = true; }
    };
    AppCommon.buktiPreviewMixin.methods.handleBuktiPreviewViewportChange.call(ctx, { target: {} });
    expect(closed).toBe(true);
  });
});
