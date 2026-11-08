import { Hono } from 'hono';
import app from '../../src/index.js';
import { blockedRequest } from './guard.mjs';

/**
 * Pembungkus baca-saja untuk aplikasi INHAL lokal.
 *
 * Memakai seluruh kode worker produksi (`src/index.js`) tanpa perubahan, lalu
 * menambahkan penjaga di depan `/api/*`:
 *   - GET/HEAD/OPTIONS selalu diizinkan (semua endpoint baca);
 *   - POST hanya untuk RPC yang ada di daftar baca-saja;
 *   - endpoint tulis (pengajuan publik, unggah portal, ekspor database) ditolak.
 *
 * Tujuannya: admin bisa menelusuri isi dump backup tanpa risiko mengubah data
 * salinan atau memicu efek samping (Drive/email).
 */

async function rpcName(req) {
  try {
    const body = await req.clone().json();
    return String((body && body.fn) || '');
  } catch (err) {
    return '';
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const readOnly = String(env.BACKUP_APP_READONLY || 'true') !== 'false';
    if (readOnly && url.pathname.startsWith('/api/')) {
      const method = request.method.toUpperCase();
      const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
      if (!isRead) {
        const fn = url.pathname === '/api/rpc' ? await rpcName(request) : '';
        const reason = blockedRequest(method, url.pathname, fn);
        if (reason) {
          return Response.json(
            { error: reason, readOnly: true },
            { status: 403, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }
    }
    return app.fetch(request, env, ctx);
  }
};
