import { getSession, authenticateAdmin, authenticateBagian, logoutSession, adminBagianBypass } from './session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from './read/bagian.js';
import { getLaporanBootstrap } from './read/laporan.js';
import {
  getDashboardBootstrap, getDashboardStats, getPengajuanList, getBagianAggregation,
  getBeritaAcaraAdminList, getLabOptions, getMasterDataMonitor, getPengajuanWithDetails,
  getBaUploadOptions, diagnosticData, getBagianBaSettingsHandler, uploadSuratKeterangan
} from './read/dashboard.js';
import {
  saveMasterKegiatan, saveMasterBagian, saveMasterBiaya, saveConfig,
  saveBagianStaff, saveAdminList, saveBagianBaSettings
} from './write/master.js';
import {
  saveBeritaAcaraAdmin, deleteBeritaAcaraAdmin, saveBeritaAcaraBagian
} from './write/beritaAcara.js';
import {
  updatePengajuanFields, updateDetailKegiatan, deleteDetailKegiatan,
  updatePengajuanStatus, deletePengajuanAdmin, syncLogDataToPengajuan
} from './write/pengajuanAdmin.js';
import {
  sendStatusNotificationEmail, sendFinalEmail, sendAccFinalToBagian
} from './write/email.js';

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
  diagnosticData: (db, args, ctx) => diagnosticData(db, ctx),
  saveMasterKegiatan: (db, args, ctx) => saveMasterKegiatan(db, args[0], ctx),
  saveMasterBagian: (db, args, ctx) => saveMasterBagian(db, args[0], ctx),
  saveMasterBiaya: (db, args, ctx) => saveMasterBiaya(db, args[0], ctx),
  saveConfig: (db, args, ctx) => saveConfig(db, args[0], ctx),
  saveBagianStaff: (db, args, ctx) => saveBagianStaff(db, args[0], ctx),
  saveAdminList: (db, args, ctx) => saveAdminList(db, args[0], ctx),
  saveBagianBaSettings: (db, args, ctx) => saveBagianBaSettings(db, args[0], ctx),
  updatePengajuanFields: (db, args, ctx) => updatePengajuanFields(db, args[0], args[1], ctx),
  updateDetailKegiatan: (db, args, ctx) => updateDetailKegiatan(db, args[0], args[1], args[2], ctx),
  deleteDetailKegiatan: (db, args, ctx) => deleteDetailKegiatan(db, args[0], args[1], ctx),
  updatePengajuanStatus: (db, args, ctx) => updatePengajuanStatus(db, args[0], args[1], args[2], args[3], ctx),
  deletePengajuanAdmin: (db, args, ctx) => deletePengajuanAdmin(db, args[0], args[1], ctx),
  syncLogDataToPengajuan: (db, args, ctx) => syncLogDataToPengajuan(db, ctx),
  sendStatusNotificationEmail: (db, args, ctx) => sendStatusNotificationEmail(db, args[0], ctx),
  sendFinalEmail: (db, args, ctx) => sendFinalEmail(db, args[0], ctx),
  sendAccFinalToBagian: (db, args, ctx) => sendAccFinalToBagian(db, args[0], ctx),
  uploadBeritaAcaraAdmin: (db, args, ctx) => saveBeritaAcaraAdmin(db, args[0], ctx),
  deleteBeritaAcaraAdmin: (db, args, ctx) => deleteBeritaAcaraAdmin(db, args[0], ctx),
  uploadBeritaAcaraBagian: (db, args, ctx) => saveBeritaAcaraBagian(db, args[0], args[1], ctx)
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

export async function dispatchRpc(db, fn, args, ip, env) {
  const handler = HANDLERS[String(fn)];
  if (!handler) {
    return { success: false, message: 'Fitur ' + String(fn) + ' belum tersedia pada tahap ini.' };
  }
  const { token, rest, session } = await extractToken(db, args);
  try {
    return await handler(db, rest, { token, session, ip, env });
  } catch (e) {
    return { error: (e && e.message) ? e.message : String(e) };
  }
}
