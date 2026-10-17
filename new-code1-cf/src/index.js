import { Hono } from 'hono';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm } from './repo.js';
import { registerPengajuan } from './pengajuan.js';
import { getStudentPortalData, uploadBuktiFiles } from './portal.js';
import { dispatchRpc } from './rpc.js';
import { getUpload, base64ToBytes, decodeBase64Size } from './uploads.js';
import { getSession } from './session.js';
import { exportDatabase } from './databaseExport.js';
import { BackupWorkflow } from './backup/workflow.js';
import { logEvent, logError } from './obs/log.js';

const app = new Hono();

app.use('/api/*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  const started = Date.now();
  await next();
  const status = c.res.status;
  const fields = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs: Date.now() - started
  };
  if (status >= 500) logEvent('error', 'http_request_failed', fields);
  else if (status >= 400) logEvent('warn', 'http_request_rejected', fields);
});

app.onError((err, c) => {
  logError('unhandled_error', err, {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path
  });
  return c.json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi.' }, 500);
});

app.get('/api/health', async (c) => {
  const started = Date.now();
  const ts = new Date().toISOString();
  try {
    const row = await c.env.DB.prepare('SELECT 1 AS ok').first();
    if (!row || Number(row.ok) !== 1) throw new Error('database check returned unexpected result');
    return c.json(
      { ok: true, db: 'ok', latencyMs: Date.now() - started, ts },
      200,
      { 'cache-control': 'no-store' }
    );
  } catch (e) {
    logError('health_check_failed', e, {
      requestId: c.get('requestId'),
      durationMs: Date.now() - started
    });
    return c.json({ ok: false, db: 'error', ts }, 503, { 'cache-control': 'no-store' });
  }
});

app.get('/', (c) => c.redirect('/portal', 302));
app.get('/index.html', (c) => c.redirect('/portal', 302));

app.get('/api/registration-options', async (c) => {
  const db = c.env.DB;
  const [blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode] = await Promise.all([
    getMasterOptions(db, 'Blok'),
    getMasterOptions(db, 'Ujian'),
    getMasterOptions(db, 'SGD'),
    getMasterOptions(db, 'Detail SGD'),
    getMasterOptions(db, 'KKD'),
    getMasterOptions(db, 'Detail KKD'),
    getMasterOptions(db, 'Lab'),
    getMasterOptions(db, 'Kegiatan Lab'),
    getMasterOptions(db, 'Dosen'),
    getBuktiMode(db)
  ]);
  return c.json({ blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode });
});

app.get('/api/mahasiswa/:npm', async (c) => {
  const name = await getStudentNameByNpm(c.env.DB, c.req.param('npm'));
  return c.json(name);
});

app.post('/api/pengajuan', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Data tidak valid.' }, 400);
  }
  const result = await registerPengajuan(c.env.DB, body, c.env);
  return c.json(result, result.success ? 200 : 400);
});

app.get('/api/portal/:npm', async (c) => {
  const data = await getStudentPortalData(c.env.DB, c.req.param('npm'));
  return c.json(data);
});

app.post('/api/portal/upload', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Data tidak valid.' }, 400);
  }
  const result = await uploadBuktiFiles(c.env.DB, body, c.env);
  if (!result.success) {
    const meta = (f) => (f && f.data) ? { mime: String(f.mimeType || ''), bytes: decodeBase64Size(f.data) } : null;
    logEvent('warn', 'portal_upload_failed', {
      requestId: c.get('requestId'),
      acc: meta(body && body.accFile),
      bukti: meta(body && body.buktiFile),
      message: result.message
    });
  }
  return c.json(result, result.success ? 200 : 400);
});

app.get('/api/files/:id', async (c) => {
  const row = await getUpload(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Berkas tidak ditemukan.' }, 404);
  const header = c.req.header('Authorization') || '';
  const token = c.req.query('token') || header.replace(/^Bearer\s+/i, '');
  const session = await getSession(c.env.DB, token);
  if (!session || session.role !== 'admin') {
    return c.json({ error: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.' }, 401);
  }
  const name = String(row.file_name || row.id).replace(/"/g, '');
  return new Response(base64ToBytes(row.content), {
    headers: {
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Disposition': 'inline; filename="' + name + '"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=600'
    }
  });
});

app.post('/api/rpc', async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'local';
  const result = await dispatchRpc(c.env.DB, body.fn, body.args, ip, c.env, {
    requestId: c.get('requestId')
  });
  return c.json(result);
});

app.post('/api/database-export', async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }
  const result = await exportDatabase(c.env.DB, body.token, body.scope);
  if (result.json) return c.json(result.json, result.status);
  return new Response(result.body, { status: result.status, headers: result.headers });
});

export { BackupWorkflow };
export default app;
