import { getSession, authenticateAdmin, authenticateBagian, logoutSession, adminBagianBypass } from './session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from './read/bagian.js';
import { getLaporanBootstrap } from './read/laporan.js';
import {
  getDashboardBootstrap, getDashboardStats, getPengajuanList, getBagianAggregation,
  getBeritaAcaraAdminList, getLabOptions, getMasterDataMonitor, getPengajuanWithDetails,
  getBaUploadOptions, diagnosticData, getBagianBaSettingsHandler, uploadSuratKeterangan
} from './read/dashboard.js';

const HANDLERS = {
  authenticateAdmin: (db, args, ctx) => authenticateAdmin(db, args[0], ctx.ip),
  authenticateBagian: (db, args, ctx) => authenticateBagian(db, args[0], args[1], args[2], ctx.ip),
  logoutSession: (db, args, ctx) => logoutSession(db, ctx.token),
  adminBagianBypass: (db, args, ctx) => adminBagianBypass(db, args[0], args[1], ctx.token),
  getBaginaConfig: (db, args, ctx) => getBaginaConfig(db, ctx),
  getBagianBaSettings: (db, args, ctx) => getBagianBaSettingsHandler(db, ctx),
  getBagianBootstrap: (db, args, ctx) => getBagianBootstrap(db, args[0], args[1], ctx),
  getBeritaAcaraList: (db, args, ctx) => getBeritaAcaraList(db, args[0], args[1], ctx),
  getLaporanBootstrap: (db, args, ctx) => getLaporanBootstrap(db, ctx),
  getDashboardBootstrap: (db, args, ctx) => getDashboardBootstrap(db, ctx),
  getDashboardStats: (db, args, ctx) => getDashboardStats(db, ctx),
  getPengajuanList: (db, args, ctx) => getPengajuanList(db, args[0], ctx),
  getBagianAggregation: (db, args, ctx) => getBagianAggregation(db, ctx),
  getBeritaAcaraAdminList: (db, args, ctx) => getBeritaAcaraAdminList(db, ctx),
  getLabOptions: (db, args, ctx) => getLabOptions(db, ctx),
  getMasterDataMonitor: (db, args, ctx) => getMasterDataMonitor(db, ctx),
  getPengajuanWithDetails: (db, args, ctx) => getPengajuanWithDetails(db, args[0], ctx),
  getBaUploadOptions: (db, args, ctx) => getBaUploadOptions(db, ctx),
  uploadSuratKeterangan: (db, args, ctx) => uploadSuratKeterangan(db, args[0], args[1], ctx),
  diagnosticData: (db, args, ctx) => diagnosticData(db, ctx)
};

export async function extractToken(db, args) {
  const list = Array.isArray(args) ? args.slice() : [];
  const last = list[list.length - 1];
  if (typeof last === 'string' && last) {
    const session = await getSession(db, last);
    if (session) {
      list.pop();
      return { token: last, rest: list, session };
    }
  }
  return { token: '', rest: list, session: null };
}

export async function dispatchRpc(db, fn, args, ip) {
  const handler = HANDLERS[String(fn)];
  if (!handler) {
    return { success: false, message: 'Fitur ' + String(fn) + ' belum tersedia pada tahap ini.' };
  }
  const { token, rest, session } = await extractToken(db, args);
  try {
    return await handler(db, rest, { token, session, ip });
  } catch (e) {
    return { error: (e && e.message) ? e.message : String(e) };
  }
}
