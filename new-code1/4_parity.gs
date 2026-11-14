// =================================================================
// PARITY LAYER (CF -> GAS)
// Fungsi tambahan untuk menyamakan perilaku aplikasi Cloudflare dengan
// Apps Script tanpa mengubah skema database D1.
// =================================================================

function _parityEnsureSheet(sheetName) {
    const ss = getGlobalSpreadsheet();
    if (SCHEMAS[sheetName]) ensureSheetWithHeaders(ss, sheetName, SCHEMAS[sheetName]);
    return ss.getSheetByName(sheetName);
}

// ---------- Autentikasi admin berbasis Google ----------
function authenticateAdminGoogle() {
    const email = String(getCurrentUserEmail() || '').trim().toLowerCase();
    if (!email) {
        return { ok: false, message: 'Akun Google tidak terdeteksi. Pastikan Anda login dengan akun UMSU.' };
    }
    const rows = getAllRows('Admin');
    for (let i = 0; i < rows.length; i++) {
        const rowEmail = String(rows[i].Email || '').trim().toLowerCase();
        if (rowEmail && rowEmail === email) {
            const nama = String(rows[i].Nama || '').trim() || 'Admin';
            const token = createSession({ role: 'admin', nama: nama, email: email, auth: 'google' });
            writeAuditLog({
                actor: email,
                action: 'LOGIN_ADMIN_GOOGLE',
                target: 'Admin',
                detail: JSON.stringify({ email: email }),
                alasan: ''
            });
            return { ok: true, token: token, nama: nama, email: email, auth: 'google' };
        }
    }
    return { ok: false, message: 'Email ' + email + ' belum terdaftar sebagai admin.' };
}

function getAdminSession(token) {
    const s = getSession(token);
    if (!s) return { ok: false, message: 'Sesi tidak valid atau sudah kedaluwarsa.' };
    return { ok: true, role: s.role || '', nama: s.nama || '', email: s.email || '', auth: s.auth || 'password' };
}

// ---------- Dosen (master + relasi) ----------
function _masterDosenCanonicalMap() {
    const map = {};
    getMasterOptions('Dosen').forEach(function(name) {
        const key = _dosenKey(name);
        if (key && !map[key]) map[key] = String(name).trim();
    });
    return map;
}

function _resolveDosenForWrite(input, existing) {
    const strict = Array.isArray(input);
    const list = _normalizeDosenList(input);
    if (list.length > MAX_DOSEN) {
        return { ok: false, message: 'Maksimal ' + MAX_DOSEN + ' dosen per jadwal/BA.' };
    }
    const master = _masterDosenCanonicalMap();
    const allowed = {};
    _normalizeDosenList(existing).forEach(function(name) { allowed[_dosenKey(name)] = true; });
    const invalid = [];
    const out = [];
    list.forEach(function(name) {
        const key = _dosenKey(name);
        if (master[key]) out.push(master[key]);
        else if (allowed[key]) out.push(String(name).trim());
        else {
            invalid.push(String(name).trim());
            out.push(String(name).trim());
        }
    });
    if (strict && invalid.length) {
        return { ok: false, message: 'Dosen belum terdaftar di Master Dosen: ' + invalid.join(', ') + '.' };
    }
    return { ok: true, list: out };
}

function _writeDosenRelation(sheetName, keyColumn, keyValue, list, ts) {
    _parityEnsureSheet(sheetName);
    const key = String(keyValue || '').trim();
    if (!key) return;
    deleteRowsByMatch(sheetName, function(r) {
        return String(r[keyColumn] || '').trim() === key;
    }, 'Perbarui relasi dosen', getActorName());
    _normalizeDosenList(list).forEach(function(name, index) {
        const row = {
            Timestamp: ts || new Date(),
            Nama: name,
            'Nama Key': _dosenKey(name),
            Urutan: index + 1
        };
        row[keyColumn] = key;
        appendRowSafe(sheetName, row);
    });
    invalidateSheetCache(sheetName);
}

function _jadwalBaId(jadwalId) {
    const id = String(jadwalId || '').trim();
    if (!id) return '';
    const jadwal = getAllRows('JadwalPelaksanaan').filter(function(r) {
        return String(r['Jadwal ID'] || '').trim() === id;
    })[0];
    if (!jadwal) return '';
    if (String(jadwal.Active === false ? '0' : (jadwal.Active == null ? '1' : jadwal.Active)).trim() === '0') return '';
    const direct = getAllRows('BeritaAcara').filter(function(r) {
        return String(r['Jadwal ID'] || '').trim() === id;
    })[0];
    if (direct) return String(direct['BA ID'] || '').trim();
    const linked = getAllRows('BeritaAcaraSesi').filter(function(r) {
        return String(r['Jadwal ID'] || '').trim() === id;
    })[0];
    return linked ? String(linked['BA ID'] || '').trim() : '';
}

function _normalizeJadwalIds(payload) {
    const p = payload || {};
    let raw = [];
    if (Array.isArray(p.jadwalIds)) raw = p.jadwalIds;
    else if (Array.isArray(p.sesi)) raw = p.sesi;
    else if (p.jadwalId) raw = [p.jadwalId];
    const seen = {};
    const out = [];
    raw.forEach(function(item) {
        const id = String(item && typeof item === 'object' ? (item.jadwalId || item.JadwalID || item.id || '') : item).trim();
        if (id && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
}

function _resolveBaSesiForWrite(payload, currentBaId) {
    const ids = _normalizeJadwalIds(payload);
    const current = String(currentBaId || '').trim();
    const rows = [];
    for (let i = 0; i < ids.length; i++) {
        const jadwal = getRowByKey('JadwalPelaksanaan', 'Jadwal ID', ids[i]);
        if (!jadwal || String(jadwal.Active === false ? '0' : (jadwal.Active == null ? '1' : jadwal.Active)).trim() === '0') {
            return { ok: false, message: 'Jadwal ' + ids[i] + ' tidak ditemukan atau sudah dibatalkan.' };
        }
        const linkedBa = _jadwalBaId(ids[i]);
        if (linkedBa && linkedBa !== current) {
            return { ok: false, message: 'Jadwal ' + ids[i] + ' sudah memiliki berita acara (' + linkedBa + ').' };
        }
        rows.push(jadwal);
    }
    let dosenList = [];
    rows.forEach(function(jadwal) {
        const list = _loadJadwalDosenList(String(jadwal['Jadwal ID'] || '').trim());
        const fallback = list.length ? list : _normalizeDosenList(jadwal.Dosen);
        fallback.forEach(function(name) {
            if (!_dosenKey(name)) return;
            if (!dosenList.some(function(x) { return _dosenKey(x) === _dosenKey(name); })) dosenList.push(name);
        });
    });
    return { ok: true, ids: ids, jadwalRows: rows, dosenList: dosenList };
}

function _writeBaSesiRelation(baId, jadwalIds, ts) {
    _parityEnsureSheet('BeritaAcaraSesi');
    const id = String(baId || '').trim();
    if (!id) return;
    deleteRowsByMatch('BeritaAcaraSesi', function(r) {
        return String(r['BA ID'] || '').trim() === id;
    }, 'Perbarui sesi BA', getActorName());
    (jadwalIds || []).forEach(function(jadwalId, index) {
        appendRowSafe('BeritaAcaraSesi', {
            Timestamp: ts || new Date(),
            'BA ID': id,
            'Jadwal ID': jadwalId,
            Urutan: index + 1
        });
    });
    invalidateSheetCache('BeritaAcaraSesi');
}

// ---------- BA pendukung: PDF bersama ----------
function _requireBagianOrAdmin(token, kategori, bagian) {
    const s = getSession(token);
    if (!s) throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
    if (s.role === 'bagian') return requireBaginaSession(kategori, bagian, token);
    if (s.role === 'admin') return requireAdmin(token);
    throw new Error('Sesi tidak memiliki akses.');
}

function setBaAdminSharedFile(baId, file) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const id = _baAdminStr(baId);
        const ba = getRowByKey('BeritaAcaraAdmin', 'BA ID', id);
        if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
        const aktif = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
            return _baAdminStr(r['BA ID']) === id && _baAdminActive(r);
        }).length;
        if (!aktif) return { success: false, message: 'Tambahkan peserta terlebih dahulu.' };
        if (!file || !file.data) return { success: false, message: 'Tidak ada berkas yang diunggah.' };
        const mime = _baAdminMime(file);
        if (!mime) return { success: false, message: 'Format berkas harus PDF, JPG, atau PNG.' };
        const name = _baAdminStr(file.name) || ('ba-shared-' + id + '.pdf');
        const pageCount = Math.max(1, Math.min(200, Number(file.pageCount) || 1));
        const byteSize = Math.floor(String(file.data).length * 3 / 4);
        const url = _saveFileToDrive(String(file.data), mime, name, 'ba-admin-' + id + '-shared');
        const now = new Date();
        updateRowsByMatch('BeritaAcaraAdminBerkas', function(r) {
            return _baAdminStr(r['BA ID']) === id && _baAdminActive(r) && _baAdminStr(r.Scope) === 'shared';
        }, { Active: '0', 'Superseded At': now });
        appendRowSafe('BeritaAcaraAdminBerkas', {
            Timestamp: now,
            'BA ID': id,
            'ID Pengajuan': '',
            'NPM': '',
            'Urutan': 0,
            'Page Index': 0,
            'File Name': name,
            'File URL': url,
            'Page Count': pageCount,
            'Byte Size': byteSize,
            'Active': '1',
            'Superseded At': '',
            'Scope': 'shared'
        });
        updateRowByKey('BeritaAcaraAdmin', 'BA ID', id, { 'Needs Regen': '1', 'Updated At': now });
        writeAuditLog({
            actor: getActorName(),
            action: 'BA_UPDATE',
            target: id,
            detail: JSON.stringify({ jenis: 'Pendukung', aksi: 'shared_upload', pages: pageCount }),
            alasan: ''
        });
        return { success: true, pages: pageCount, fileUrl: url, needsRegen: true, message: 'PDF BA bersama disimpan. Jalankan Regenerate PDF.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function removeBaAdminSharedFile(baId) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const id = _baAdminStr(baId);
        const ba = getRowByKey('BeritaAcaraAdmin', 'BA ID', id);
        if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
        const now = new Date();
        updateRowsByMatch('BeritaAcaraAdminBerkas', function(r) {
            return _baAdminStr(r['BA ID']) === id && _baAdminActive(r) && _baAdminStr(r.Scope) === 'shared';
        }, { Active: '0', 'Superseded At': now });
        updateRowByKey('BeritaAcaraAdmin', 'BA ID', id, { 'Needs Regen': '1', 'Updated At': now });
        writeAuditLog({
            actor: getActorName(),
            action: 'BA_UPDATE',
            target: id,
            detail: JSON.stringify({ jenis: 'Pendukung', aksi: 'shared_remove' }),
            alasan: ''
        });
        return { success: true, needsRegen: true, message: 'PDF BA bersama dihapus. Jalankan Regenerate PDF.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function baAdminSetSharedFile(baId, file) { return setBaAdminSharedFile(baId, file, arguments[arguments.length - 1]); }
function baAdminRemoveSharedFile(baId) { return removeBaAdminSharedFile(baId, arguments[arguments.length - 1]); }
function baAdminSetBaseFile(baId, file) { return setBaAdminBaseFile(baId, file, arguments[arguments.length - 1]); }
function baAdminRemoveBaseFile(baId) { return removeBaAdminBaseFile(baId, arguments[arguments.length - 1]); }

// ---------- Notifikasi bagian ----------
function _computeBagianNotifikasi(rows, days) {
    const scope = {};
    (rows || []).forEach(function(r) {
        const id = String(r.idPengajuan || '').trim();
        if (!id) return;
        if (!scope[id]) scope[id] = { row: r, kegiatan: [] };
        const nama = String(r.pilihan || '').trim() + (String(r.detail || '').trim() ? ' - ' + String(r.detail || '').trim() : '');
        if (nama && scope[id].kegiatan.indexOf(nama) === -1) scope[id].kegiatan.push(nama);
    });
    const ids = Object.keys(scope);
    if (!ids.length) return [];
    const cutoff = new Date(Date.now() - (Number(days || 30) * 24 * 60 * 60 * 1000)).getTime();
    const latest = {};
    getAllRows('StatusHistory').forEach(function(h) {
        const id = String(h['ID Pengajuan'] || '').trim();
        if (!scope[id] || String(h.Status || '').trim() !== 'ACC') return;
        const ts = new Date(h.Timestamp).getTime();
        if (isNaN(ts) || ts < cutoff) return;
        if (!latest[id] || ts > latest[id].ts) latest[id] = { ts: ts, row: h };
    });
    const out = [];
    Object.keys(latest).forEach(function(id) {
        const entry = scope[id];
        const r = entry.row;
        if (String(r.status || '').trim() !== 'ACC') return;
        const h = latest[id].row;
        out.push({
            id: String(h.Timestamp || '') + ':' + id,
            idPengajuan: id,
            npm: String(r.npm || '').trim(),
            nama: String(r.namaLengkap || '').trim(),
            blok: String(r.blok || '').trim(),
            jenis: String(r.jenis || '').trim(),
            kegiatan: entry.kegiatan.join(', '),
            aktor: String(h['Actor Email'] || '').trim(),
            waktu: _isoUtc(h.Timestamp)
        });
    });
    out.sort(function(a, b) { return String(b.waktu || '').localeCompare(String(a.waktu || '')); });
    return out.slice(0, 40);
}

function _isoUtc(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (v instanceof Date) return _clientDate(v);
    return s.replace(' ', 'T');
}

// ---------- Kalender bagian ----------
function _kalenderTimeKey(v) {
    const m = String(v || '').match(/(\d{1,2})[.:](\d{2})/);
    return m ? String(Number(m[1])).padStart(2, '0') + ':' + m[2] : String(v || '');
}

function _kalenderMarkBentrok(entries, pesertaByJadwal) {
    const bySlot = {};
    entries.forEach(function(entry) {
        const tanggal = String(entry.Tanggal || '').trim();
        if (!tanggal) return;
        const jam = _kalenderTimeKey(entry.Jam);
        const seen = {};
        (pesertaByJadwal[entry.JadwalID] || []).forEach(function(p) {
            const npm = String(p && p.npm || '').trim();
            if (!npm || seen[npm]) return;
            seen[npm] = true;
            const key = tanggal + '|' + jam + '|' + npm;
            if (!bySlot[key]) bySlot[key] = { npm: npm, entries: [] };
            if (!bySlot[key].entries.some(function(e) { return e.JadwalID === entry.JadwalID; })) bySlot[key].entries.push(entry);
        });
    });
    const bentrok = {};
    Object.keys(bySlot).forEach(function(key) {
        const slot = bySlot[key];
        if (slot.entries.length < 2) return;
        const detail = slot.entries.map(function(e) {
            return { JadwalID: e.JadwalID, Bagian: e.Bagian, Blok: e.Blok, NamaKegiatan: e.NamaKegiatan };
        });
        slot.entries.forEach(function(entry) {
            if (!bentrok[entry.JadwalID]) bentrok[entry.JadwalID] = {};
            const sample = (pesertaByJadwal[entry.JadwalID] || []).filter(function(p) {
                return String(p && p.npm || '').trim() === slot.npm;
            })[0] || {};
            bentrok[entry.JadwalID][slot.npm] = {
                npm: slot.npm,
                namaLengkap: String(sample.namaLengkap || '').trim(),
                blok: String(sample.blok || '').trim(),
                jadwal: detail
            };
        });
    });
    return entries.map(function(entry) {
        const bucket = bentrok[entry.JadwalID] || {};
        const list = Object.keys(bucket).map(function(npm) { return bucket[npm]; });
        return Object.assign({}, entry, { bentrok: list.length > 0, pesertaBentrok: list });
    });
}

function getKalenderBagianPelaksanaan(token) {
    try {
        const s = getSession(token);
        if (!s || s.role !== 'bagian') return { ok: false, message: 'Sesi tidak valid atau sudah kedaluwarsa.', entries: [], readOnly: true };
        _CURRENT_SESSION = s;
        const pesertaByJadwal = {};
        const list = _computeJadwalList('', '').map(function(j) {
            const id = String(j.JadwalID || '').trim();
            if (id && !pesertaByJadwal[id]) pesertaByJadwal[id] = j.peserta || [];
            const dosenList = _loadJadwalDosenList(id);
            return {
                JadwalID: id,
                Bagian: String(j.Bagian || '').trim(),
                Blok: String(j.Blok || '').trim(),
                NamaKegiatan: String(j.NamaKegiatan || '').trim(),
                kegiatan_key: String(j.kegiatan_key || '').trim(),
                Tanggal: String(j.Tanggal || '').slice(0, 10),
                Jam: String(j.Jam || '').trim(),
                Dosen: dosenList.length ? dosenList[0] : String(j.Dosen || '').trim(),
                DosenList: dosenList,
                jumlahPeserta: (j.peserta || []).length,
                punyaBa: !!j.punyaBa,
                baId: String(j.baId || '').trim(),
                readOnly: true
            };
        }).filter(function(r) { return !!r.Tanggal; });
        const entries = _kalenderMarkBentrok(list, pesertaByJadwal).sort(function(a, b) {
            const byDate = a.Tanggal.localeCompare(b.Tanggal);
            if (byDate !== 0) return byDate;
            const byTime = _kalenderTimeKey(a.Jam).localeCompare(_kalenderTimeKey(b.Jam));
            if (byTime !== 0) return byTime;
            return (a.Bagian + '|' + a.NamaKegiatan).localeCompare(b.Bagian + '|' + b.NamaKegiatan);
        });
        return { ok: true, message: '', entries: entries, readOnly: true };
    } catch (e) {
        return { ok: false, message: (e && e.message) ? e.message : String(e), entries: [], readOnly: true };
    }
}

// ---------- Activity log ----------
function _activityKind(aksi) {
    const a = String(aksi || '').toUpperCase();
    if (a.indexOf('BA_') === 0) {
        if (a.indexOf('DELETE') !== -1) return 'BaDelete';
        if (a.indexOf('CREATE') !== -1) return 'BaCreate';
        return 'BaUpdate';
    }
    if (a.indexOf('JADWAL') !== -1) return 'BaUpdate';
    if (a.indexOf('RENAME_MASTER') !== -1) return 'RenameMaster';
    if (a.indexOf('LOGIN') !== -1) return 'Lainnya';
    if (a.indexOf('ACC') === 0) return 'ACC';
    if (a.indexOf('TOLAK') === 0) return 'Tolak';
    if (a.indexOf('BATAL') === 0) return 'Batal';
    return 'Lainnya';
}

function _activityGroup(jenis) {
    const map = {
        ACC: ['keputusan'], Tolak: ['keputusan'], Batal: ['keputusan'],
        BaCreate: ['ba'], BaUpdate: ['ba'], BaDelete: ['ba', 'kritis'],
        RenameMaster: ['master'], Lainnya: ['data']
    };
    return map[jenis] || [];
}

function getActivityLog(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const p = payload || {};
    const perPage = Math.min(100, Math.max(5, parseInt(p.perPage, 10) || 25));
    const kindFilter = String(p.jenis || '').trim();
    const groupFilter = String(p.grup || '').trim();
    const actorFilter = String(p.aktor || '').trim().toLowerCase();
    const targetFilter = String(p.target || '').trim().toLowerCase();
    const q = String(p.q || '').trim().toLowerCase();
    const dari = String(p.dari || '').trim();
    const sampai = String(p.sampai || '').trim();

    const events = [];
    getAllRows('AuditLog').forEach(function(r) {
        const ts = _clientDate(r.Timestamp) || String(r.Timestamp || '').trim();
        const day = ts.slice(0, 10);
        if (dari && day && day < dari) return;
        if (sampai && day && day > sampai) return;
        const jenis = _activityKind(r.Aksi);
        const actor = String(r['Actor Email'] || '').trim();
        const target = String(r.Target || '').trim();
        if (kindFilter && jenis !== kindFilter) return;
        if (groupFilter && _activityGroup(jenis).indexOf(groupFilter) === -1) return;
        if (actorFilter && actor.toLowerCase().indexOf(actorFilter) === -1) return;
        if (targetFilter && target.toLowerCase().indexOf(targetFilter) === -1) return;
        const detail = String(r.Detail || '');
        if (q && (actor + ' ' + target + ' ' + detail + ' ' + String(r.Aksi || '')).toLowerCase().indexOf(q) === -1) return;
        events.push({
            id: 'audit:' + ts + ':' + target,
            jenis: jenis,
            grup: _activityGroup(jenis),
            waktu: _isoUtc(ts),
            aktor: actor || 'Sistem',
            aksi: String(r.Aksi || '').trim(),
            target: target,
            detail: detail,
            alasan: String(r.Alasan || '')
        });
    });
    events.sort(function(a, b) { return String(b.waktu || '').localeCompare(String(a.waktu || '')); });
    const total = events.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    let page = parseInt(p.page, 10) || 1;
    if (page < 1) page = 1;
    if (page > pages) page = pages;
    const start = (page - 1) * perPage;
    const actors = {};
    events.forEach(function(e) {
        if (!actors[e.aktor]) actors[e.aktor] = { aktor: e.aktor, total: 0 };
        actors[e.aktor].total++;
    });
    const kinds = {};
    events.forEach(function(e) {
        if (!kinds[e.jenis]) kinds[e.jenis] = { jenis: e.jenis, total: 0 };
        kinds[e.jenis].total++;
    });
    return {
        rows: events.slice(start, start + perPage),
        total: total,
        page: page,
        perPage: perPage,
        pages: pages,
        truncated: false,
        range: { dari: dari, sampai: sampai },
        actors: Object.keys(actors).map(function(k) { return actors[k]; }),
        kinds: Object.keys(kinds).map(function(k) { return kinds[k]; }),
        groups: _activityGroupSummaries(events),
        ok: true
    };
}

function _activityGroupSummaries(events) {
    const labels = { keputusan: 'Keputusan', unggahan: 'Unggahan', bayar: 'Verifikasi Bayar', ba: 'Berita Acara', kritis: 'Kritis', master: 'Master', data: 'Data' };
    const sums = {};
    events.forEach(function(e) {
        (e.grup || []).forEach(function(g) {
            if (!sums[g]) sums[g] = { key: g, label: labels[g] || g, total: 0 };
            sums[g].total++;
        });
    });
    return Object.keys(sums).map(function(k) { return sums[k]; });
}

// ---------- Master rename (Blok) ----------
const PARITY_BLOK_REF_SHEETS = ['Pengajuan', 'Mahasiswa', 'BeritaAcara', 'BeritaAcaraPeserta', 'BeritaAcaraAdmin', 'BeritaAcaraAdminPeserta', 'JadwalPelaksanaan', 'JadwalPeserta', 'LogUpload'];
const PARITY_KEGIATAN_KEY_SHEETS = ['BeritaAcara', 'BeritaAcaraAdmin', 'JadwalPelaksanaan'];

function _masterRowByNumber(sheetName, rowNumber) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return null;
    return _readSheetRowAt(sheet, Number(rowNumber));
}

function _blokUsageCounts(value) {
    const out = {};
    const target = String(value || '').trim().toLowerCase();
    let total = 0;
    PARITY_BLOK_REF_SHEETS.forEach(function(name) {
        let rows = [];
        try { rows = _getRowsOptional(name); } catch (e) { rows = []; }
        const n = rows.filter(function(r) {
            return String(r.Blok || '').trim().toLowerCase() === target;
        }).length;
        out[name] = n;
        total += n;
    });
    out.total = total;
    return out;
}

function previewMasterRename(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const p = payload || {};
    const rowNumber = Number(p.id || p._row || p.rowIndex) || 0;
    const newValue = String(p.newValue || p.nilai || '').trim();
    if (!rowNumber) return { success: false, message: 'Baris master tidak valid.' };
    if (!newValue) return { success: false, message: 'Nama baru wajib diisi.' };
    const row = _masterRowByNumber('MasterKegiatan', rowNumber);
    if (!row) return { success: false, message: 'Baris master tidak ditemukan.' };
    if (String(row.Kategori || '').trim().toLowerCase() !== 'blok') {
        return { success: false, message: 'Rename massal hanya didukung untuk kategori Blok.' };
    }
    const oldValue = String(row.Nilai || '').trim();
    const impact = _blokUsageCounts(oldValue);
    const targetUsage = _blokUsageCounts(newValue);
    let masterConflict = false;
    if (oldValue.toLowerCase() !== newValue.toLowerCase()) {
        getAllRows('MasterKegiatan').forEach(function(r) {
            if (String(r.Kategori || '').trim().toLowerCase() !== 'blok') return;
            if (String(r.Nilai || '').trim().toLowerCase() !== newValue.toLowerCase()) return;
            masterConflict = true;
        });
    }
    return {
        success: true,
        id: rowNumber,
        oldValue: oldValue,
        newValue: newValue,
        impact: impact,
        total: impact.total,
        baRegen: 'BeritaAcaraAdmin' in impact ? impact.BeritaAcaraAdmin : 0,
        conflicts: { master: masterConflict, data: targetUsage.total > 0 && oldValue.toLowerCase() !== newValue.toLowerCase() }
    };
}

function renameMasterValue(payload) {
    const token = arguments[arguments.length - 1];
    requireAuthorized(token);
    return _lockMutate(function() {
        const plan = previewMasterRename(payload, token);
        if (!plan.success) return plan;
        if (plan.conflicts.master) {
            return { success: false, message: 'Blok "' + plan.newValue + '" sudah ada di master. Gunakan nama lain.', oldValue: plan.oldValue, newValue: plan.newValue, impact: plan.impact, total: plan.total };
        }
        if (plan.conflicts.data) {
            return { success: false, message: 'Blok "' + plan.newValue + '" sudah dipakai data lain. Selesaikan manual terlebih dahulu.', oldValue: plan.oldValue, newValue: plan.newValue, impact: plan.impact, total: plan.total };
        }
        if (plan.total > 5000) {
            return { success: false, message: 'Terlalu banyak baris terdampak (maks 5000).' };
        }
        const now = new Date();
        PARITY_BLOK_REF_SHEETS.forEach(function(name) {
            let sheet = null;
            try { sheet = getGlobalSpreadsheet().getSheetByName(name); } catch (e) { sheet = null; }
            if (!sheet) return;
            const headers = getHeadersFromSheet(sheet);
            const idx = headers.indexOf('Blok');
            if (idx === -1) return;
            const last = sheet.getLastRow();
            if (last < 2) return;
            const range = sheet.getRange(2, idx + 1, last - 1, 1);
            const values = range.getValues();
            let changed = false;
            for (let i = 0; i < values.length; i++) {
                if (String(values[i][0] || '').trim().toLowerCase() === plan.oldValue.toLowerCase()) {
                    values[i][0] = plan.newValue;
                    changed = true;
                }
            }
            if (changed) {
                range.setValues(values);
                invalidateSheetCache(name);
            }
        });
        PARITY_KEGIATAN_KEY_SHEETS.forEach(function(name) {
            let sheet = null;
            try { sheet = getGlobalSpreadsheet().getSheetByName(name); } catch (e) { sheet = null; }
            if (!sheet) return;
            const headers = getHeadersFromSheet(sheet);
            const iBagian = headers.indexOf('Bagian');
            const iBlok = headers.indexOf('Blok');
            const iNama = headers.indexOf('Nama Kegiatan');
            const iKey = headers.indexOf('Kegiatan Key');
            if (iBagian === -1 || iBlok === -1 || iNama === -1 || iKey === -1) return;
            const last = sheet.getLastRow();
            if (last < 2) return;
            const range = sheet.getRange(2, 1, last - 1, headers.length);
            const values = range.getValues();
            let changed = false;
            for (let i = 0; i < values.length; i++) {
                if (String(values[i][iBlok] || '').trim().toLowerCase() !== plan.newValue.toLowerCase()) continue;
                values[i][iKey] = _kegiatanKey(values[i][iBagian], plan.newValue, values[i][iNama]);
                changed = true;
            }
            if (changed) {
                range.setValues(values);
                invalidateSheetCache(name);
            }
        });
        const sheet = getGlobalSpreadsheet().getSheetByName('MasterKegiatan');
        const row = _masterRowByNumber('MasterKegiatan', plan.id);
        if (sheet && row) {
            _writeSheetRowAt('MasterKegiatan', sheet, plan.id, Object.assign({}, row, { Nilai: plan.newValue }));
        }
        writeAuditLog({
            actor: getActorName(),
            action: 'RENAME_MASTER',
            target: 'Blok: ' + plan.oldValue + ' -> ' + plan.newValue,
            detail: JSON.stringify(plan.impact),
            alasan: ''
        });
        invalidateSheetCache('MasterKegiatan');
        return {
            success: true,
            message: 'Blok diubah menjadi "' + plan.newValue + '". ' + plan.total + ' baris diperbarui.',
            oldValue: plan.oldValue,
            newValue: plan.newValue,
            impact: plan.impact,
            total: plan.total,
            baRegen: plan.baRegen
        };
    });
}

// ---------- Draft BA bagian ----------
function deleteDraftBeritaAcaraBagian(baId, kategori) {
    const token = arguments[arguments.length - 1];
    return _lockMutate(function() {
        const id = String(baId || '').trim();
        if (!id) return { success: false, message: 'BA ID wajib diisi.' };
        const existing = getRowByKey('BeritaAcara', 'BA ID', id);
        if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
        _requireBagianOrAdmin(token, kategori, existing.Bagian);
        _parityEnsureSheet('BaDosen');
        _parityEnsureSheet('BeritaAcaraSesi');
        if (String(existing['File URL'] || '').trim()) {
            return { success: false, message: 'BA yang sudah berberkas hanya dapat dihapus oleh admin dashboard.' };
        }
        const peserta = getAllRows('BeritaAcaraPeserta').filter(function(r) {
            return String(r['BA ID'] || '').trim() === id;
        });
        const pesertaCount = peserta.length;
        deleteRowsByMatch('BaDosen', function(r) {
            return String(r['BA ID'] || '').trim() === id;
        }, 'Hapus dosen BA', getActorName());
        deleteRowsByMatch('BeritaAcaraSesi', function(r) {
            return String(r['BA ID'] || '').trim() === id;
        }, 'Hapus sesi BA', getActorName());
        deleteRowsByMatch('BeritaAcaraPeserta', function(r) {
            return String(r['BA ID'] || '').trim() === id;
        }, 'Hapus peserta BA', getActorName());
        deleteRowByKey('BeritaAcara', 'BA ID', id, 'Hapus draft BA', getActorName());
        writeAuditLog({
            actor: getActorName(),
            action: 'BA_DELETE',
            target: id,
            detail: JSON.stringify({ jenis: 'Pelaksanaan', oleh: 'Bagian', jumlahPeserta: pesertaCount }),
            alasan: ''
        });
        return { success: true, message: 'Draft berita acara berhasil dihapus.' };
    });
}

// ---------- Lengkapi BA bagian ----------
function lengkapiBeritaAcaraBagian(baId, payload, kategori) {
    const token = arguments[arguments.length - 1];
    const id = String(baId || '').trim();
    if (!id) return { success: false, message: 'BA ID wajib diisi.' };
    const existing = getRowByKey('BeritaAcara', 'BA ID', id);
    if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
    _requireBagianOrAdmin(token, kategori, existing.Bagian);
    const p = payload || {};
    const merged = {
        tanggal: p.tanggal !== undefined ? p.tanggal : existing['Tanggal Pelaksanaan'],
        jam: p.jam !== undefined ? p.jam : existing.Jam,
        dosenList: p.dosenList !== undefined ? p.dosenList : undefined,
        dosen: p.dosen !== undefined ? p.dosen : undefined,
        catatan: p.catatan !== undefined ? p.catatan : existing.Catatan,
        kategori: kategori || ''
    };
    if (p.peserta !== undefined) merged.peserta = p.peserta;
    if (p.pesertaIds !== undefined) merged.pesertaIds = p.pesertaIds;
    const result = updateBeritaAcaraBagian(id, merged, kategori, token);
    if (!result.success) return result;
    if (p.file && p.file.data) {
        const fileUrl = _saveFileToDrive(p.file.data, p.file.mimeType, p.file.name, 'ba-' + id);
        updateRowByKey('BeritaAcara', 'BA ID', id, {
            'File URL': fileUrl,
            'File Name': String(p.file.name || '').trim()
        });
        return { success: true, message: 'Berita acara dilengkapi.', fileUrl: fileUrl };
    }
    return result;
}

// ---------- Export database ----------
const PARITY_SENSITIVE_COLUMNS = { Password: true, Pass: true, Token: true, Content: true };

function getDatabaseExport(scope) {
    requireAuthorized(arguments[arguments.length - 1]);
    try {
        const all = String(scope || 'master') === 'all';
        const systemSheets = { AuditLog: true, LogUpload: true, Admin: true, BagianStaff: true, Config: true, NomorSurat: true };
        const tables = [];
        getGlobalSpreadsheet().getSheets().forEach(function(sheet) {
            const name = sheet.getName();
            if (!all && systemSheets[name]) return;
            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            if (lastRow < 1 || lastCol < 1) return;
            const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
            const headers = values[0].map(function(h) { return String(h || '').trim(); });
            const keep = [];
            headers.forEach(function(h, i) {
                if (!h || PARITY_SENSITIVE_COLUMNS[h]) return;
                keep.push({ index: i, key: h, label: h });
            });
            if (!keep.length) return;
            const rows = values.slice(1).filter(function(row) {
                return row.some(function(cell) { return cell !== '' && cell != null; });
            }).map(function(row) {
                const out = {};
                keep.forEach(function(col) { out[col.key] = row[col.index]; });
                return out;
            });
            tables.push({ name: name, columns: keep.map(function(c) { return { key: c.key, label: c.label, numeric: false }; }), rows: rows });
        });
        const d = new Date();
        const p = function(n) { return String(n).padStart(2, '0'); };
        return {
            success: true,
            filename: 'inhal-database-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.xlsx',
            tables: tables
        };
    } catch (e) {
        return { success: false, message: 'Gagal menyiapkan database: ' + (e && e.message ? e.message : String(e)) };
    }
}

// ---------- Alias nama RPC CF ----------
function baAdminUploadBerkas(baId, idPengajuan, files) {
    return addBaAdminPesertaBerkas({ baId: baId, idPengajuan: idPengajuan, files: files }, arguments[arguments.length - 1]);
}

function baAdminAddPesertaBerkas(baId, idPengajuan, files) {
    return addBaAdminPesertaBerkas({ baId: baId, idPengajuan: idPengajuan, files: files }, arguments[arguments.length - 1]);
}

function baAdminRemovePeserta(baId, idPengajuan) {
    return removeBaAdminPeserta(baId, idPengajuan, arguments[arguments.length - 1]);
}

function baAdminDetail(baId) {
    return getBaAdminDetail(baId, arguments[arguments.length - 1]);
}

function baAdminSaveMergedPdf(baId, file) {
    return saveBaAdminMergedPdf(baId, file, arguments[arguments.length - 1]);
}

function baAdminGetFileBase64(baId, fileUrl) {
    return getBaAdminFileBase64(baId, fileUrl, arguments[arguments.length - 1]);
}

// =================================================================
// ======== BA PENDUKUNG (admin) — parity RPC dashboard CF =========
// =================================================================

const BA_ADMIN_MAX_PAGES = 100;
const BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024;

function _baAdminListCandidates(kegiatan) {
    const k = kegiatan || {};
    const jenis = norm(k.jenis);
    const pilihan = norm(k.pilihan);
    const detailText = norm(k.detail);
    const blokNorm = _baAdminStr(k.blok).replace(/\s+/g, ' ');
    const bagian = _baAdminStr(k.bagian);
    const idSet = {};
    getAllRows('DetailKegiatan').forEach(function(d) {
        if (norm(d['Jenis Kegiatan']) !== jenis) return;
        if (norm(d.Pilihan) !== pilihan) return;
        if (norm(d.Detail) !== detailText) return;
        const pid = _baAdminStr(d['ID Pengajuan']);
        if (pid) idSet[pid] = true;
    });
    const out = [];
    getAllRows('Pengajuan').forEach(function(p) {
        const pid = _baAdminStr(p['ID Pengajuan']);
        if (!pid || !idSet[pid]) return;
        if (_baAdminStr(p.Blok).replace(/\s+/g, ' ') !== blokNorm) return;
        out.push({
            idPengajuan: pid,
            npm: _baAdminStr(p.NPM),
            namaLengkap: _baAdminStr(p['Nama Lengkap']),
            blok: _baAdminStr(p.Blok),
            bagian: bagian,
            statusPengajuan: _baAdminStr(p.Status)
        });
    });
    out.sort(function(a, b) { return a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()); });
    return out;
}

function baAdminGet(idPengajuan) {
    requireAdmin(arguments[arguments.length - 1]);
    try {
        const pid = _baAdminStr(idPengajuan);
        if (!pid) return { success: false, message: 'Pengajuan wajib diisi.' };
        const p = getRowByKey('Pengajuan', 'ID Pengajuan', pid);
        if (!p) return { success: false, message: 'Pengajuan tidak ditemukan.' };
        const details = getAllRows('DetailKegiatan').filter(function(d) {
            return _baAdminStr(d['ID Pengajuan']) === pid;
        });
        const d0 = details[0] || {};
        const jenis = _baAdminStr(d0['Jenis Kegiatan']);
        const pilihan = _baAdminStr(d0.Pilihan);
        const detail = _baAdminStr(d0.Detail);
        const nama = detail ? (pilihan + ' - ' + detail) : pilihan;
        const labs = getMasterOptions('Lab');
        let bagian = jenis || 'Admin';
        if (norm(jenis) === 'praktikum') {
            bagian = _resolveBagian12('Praktikum', pilihan, nama, labs) || 'Praktikum';
        }
        const blok = _baAdminStr(p.Blok);
        const tanggal = _baAdminStr(d0['Tanggal Pelaksanaan']) || _baAdminStr(p['Tanggal Pelaksanaan']);
        const kegiatan = {
            bagian: bagian,
            blok: blok,
            namaKegiatan: nama,
            jenis: jenis,
            pilihan: pilihan,
            detail: detail,
            tanggalPelaksanaan: tanggal
        };
        const key = _kegiatanKey(bagian, blok, nama);
        const baRow = getAllRows('BeritaAcaraAdmin').filter(function(b) {
            return _baAdminBaKey(b) === key;
        })[0] || null;
        let ba = null;
        let peserta = [];
        let candidates = [];
        if (baRow) {
            const detailRes = getBaAdminDetail(_baAdminStr(baRow['BA ID']), arguments[arguments.length - 1]);
            if (!detailRes || !detailRes.success) return detailRes;
            ba = detailRes.data.ba;
            peserta = (detailRes.data.peserta || []).map(function(x) {
                const copy = Object.assign({}, x);
                copy.isCurrent = x.idPengajuan === pid;
                return copy;
            });
            candidates = detailRes.data.candidates || [];
            ba.jumlahPeserta = peserta.length;
        } else {
            candidates = _baAdminListCandidates(kegiatan);
        }
        return { success: true, data: { kegiatan: kegiatan, ba: ba, peserta: peserta, candidates: candidates } };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function baAdminCreate(kegiatan) {
    const token = arguments[arguments.length - 1];
    return _lockMutate(function() {
        try {
            requireAdmin(token);
            const k = kegiatan || {};
            const bagian = _baAdminStr(k.bagian) || 'Admin';
            const blok = _baAdminStr(k.blok);
            const nama = _baAdminStr(k.namaKegiatan);
            const key = _kegiatanKey(bagian, blok, nama);
            const dup = getAllRows('BeritaAcaraAdmin').filter(function(b) {
                return _baAdminBaKey(b) === key;
            })[0];
            if (dup) return { success: true, baId: _baAdminStr(dup['BA ID']), created: false };
            const sheet = getGlobalSpreadsheet().getSheetByName('BeritaAcaraAdmin');
            if (!sheet) return { success: false, message: 'Sheet BeritaAcaraAdmin tidak ditemukan. Jalankan setupDatabase() dahulu.' };
            const baId = generateBaId(sheet);
            const now = new Date();
            appendRowSafe('BeritaAcaraAdmin', {
                Timestamp: now,
                'BA ID': baId,
                'Bagian': bagian,
                'Blok': blok,
                'Nama Kegiatan': nama,
                'Tanggal Pelaksanaan': _baAdminStr(k.tanggalPelaksanaan),
                'Jumlah Peserta': 0,
                'File Name': '',
                'File URL': '',
                'Catatan': _baAdminStr(k.catatan),
                'Sumber': 'Admin',
                'Kegiatan Key': key,
                'Base File URL': '',
                'Base File Name': '',
                'Needs Regen': '0',
                'Dosen': '',
                'Updated At': now
            });
            writeAuditLog({
                actor: getActorName(),
                action: 'BA_CREATE',
                target: baId,
                detail: JSON.stringify({ jenis: 'Pendukung', aksi: 'create' }),
                alasan: ''
            });
            return { success: true, baId: baId, created: true };
        } catch (e) {
            return { success: false, message: (e && e.message) ? e.message : String(e) };
        }
    });
}

function _baAdminAddPesertaBulk(baId, ids, token, requireShared) {
    return _lockMutate(function() {
        try {
            requireAdmin(token);
            const id = _baAdminStr(baId);
            const list = Array.isArray(ids) ? ids.map(function(x) { return _baAdminStr(x); }).filter(Boolean) : [];
            if (!id || !list.length) return { success: true, added: 0, skipped: 0 };
            const ba = getRowByKey('BeritaAcaraAdmin', 'BA ID', id);
            if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

            const allBerkas = _baAdminBerkasRows(id);
            const sharedCount = allBerkas.filter(function(r) {
                return _baAdminStr(r.Scope).toLowerCase() === 'shared';
            }).length;
            if (requireShared && !sharedCount) {
                return { success: false, message: 'Unggah dulu PDF-nya ya...!' };
            }

            const allPeserta = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
                return _baAdminStr(r['BA ID']) === id;
            });
            const beforeCount = allPeserta.filter(_baAdminActive).length;
            const have = {};
            const inactive = {};
            allPeserta.forEach(function(r) {
                const k = _baAdminStr(r['ID Pengajuan']);
                if (!k) return;
                if (_baAdminActive(r)) have[k] = true;
                else if (!inactive[k]) inactive[k] = r;
            });

            const labs = getMasterOptions('Lab');
            const detailMap = {};
            getAllRows('DetailKegiatan').forEach(function(d) {
                const pid = _baAdminStr(d['ID Pengajuan']);
                if (!pid) return;
                if (!detailMap[pid]) detailMap[pid] = [];
                detailMap[pid].push(d);
            });
            let urutan = 0;
            allPeserta.forEach(function(r) { urutan = Math.max(urutan, Number(r.Urutan) || 0); });

            let added = 0;
            let skipped = 0;
            list.forEach(function(pid) {
                if (have[pid]) { skipped += 1; return; }
                const p = getRowByKey('Pengajuan', 'ID Pengajuan', pid);
                if (!p) { skipped += 1; return; }
                if (!_baAdminPengajuanMatches(p, ba, detailMap, labs)) { skipped += 1; return; }
                if (inactive[pid]) {
                    updateRowsByMatch('BeritaAcaraAdminPeserta', function(r) {
                        return _baAdminStr(r['BA ID']) === id && _baAdminStr(r['ID Pengajuan']) === pid;
                    }, { Active: '1' });
                } else {
                    urutan += 1;
                    appendRowSafe('BeritaAcaraAdminPeserta', {
                        Timestamp: new Date(),
                        'BA ID': id,
                        'NPM': _baAdminStr(p.NPM),
                        'Nama Lengkap': _baAdminStr(p['Nama Lengkap']),
                        'Blok': _baAdminStr(p.Blok),
                        'Bagian': _baAdminStr(ba.Bagian),
                        'Status Pengajuan': _baAdminStr(p.Status),
                        'ID Pengajuan': pid,
                        'Urutan': urutan,
                        'Active': '1'
                    });
                }
                have[pid] = true;
                added += 1;
            });

            const result = { success: true, added: added, skipped: skipped };
            if (added) {
                const count = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
                    return _baAdminStr(r['BA ID']) === id && _baAdminActive(r);
                }).length;
                updateRowByKey('BeritaAcaraAdmin', 'BA ID', id, {
                    'Jumlah Peserta': count,
                    'Updated At': new Date()
                });
                if (sharedCount) result.needsRegen = true;
            }
            if (added || skipped) {
                writeAuditLog({
                    actor: getActorName(),
                    action: beforeCount === 0 ? 'BA_CREATE' : 'BA_UPDATE',
                    target: id,
                    detail: JSON.stringify({ jenis: 'Pendukung', aksi: 'peserta', added: added, skipped: skipped }),
                    alasan: ''
                });
            }
            return result;
        } catch (e) {
            return { success: false, message: (e && e.message) ? e.message : String(e) };
        }
    });
}

function baAdminAddPeserta(baId, ids) {
    return _baAdminAddPesertaBulk(baId, ids, arguments[arguments.length - 1], false);
}

function baAdminAddPesertaMassal(baId, ids) {
    return _baAdminAddPesertaBulk(baId, ids, arguments[arguments.length - 1], true);
}

function baAdminRegenerate(baId) {
    const args = Array.prototype.slice.call(arguments);
    const token = args.length ? args[args.length - 1] : '';
    const maybeFile = args.length >= 3 ? args[1] : null;
    try {
        requireAdmin(token);
        const id = _baAdminStr(baId);
        if (!id) return { success: false, message: 'BA ID wajib diisi.' };
        const ba = getRowByKey('BeritaAcaraAdmin', 'BA ID', id);
        if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
        if (maybeFile && maybeFile.data) {
            const saved = saveBaAdminMergedPdf(id, maybeFile, token);
            return saved;
        }
        const allBerkas = _baAdminBerkasRows(id);
        const sharedRows = allBerkas.filter(function(r) {
            return _baAdminStr(r.Scope).toLowerCase() === 'shared';
        }).sort(function(a, b) {
            return (Number(a['Page Index']) || 0) - (Number(b['Page Index']) || 0);
        });
        const pesertaBerkas = allBerkas.filter(function(r) {
            return _baAdminStr(r.Scope).toLowerCase() !== 'shared';
        });
        const filesByPid = {};
        pesertaBerkas.forEach(function(r) {
            const pid = _baAdminStr(r['ID Pengajuan']);
            if (!filesByPid[pid]) filesByPid[pid] = [];
            filesByPid[pid].push({
                fileUrl: _baAdminStr(r['File URL']),
                fileName: _baAdminStr(r['File Name']),
                pageCount: Number(r['Page Count']) || 1,
                pageIndex: Number(r['Page Index']) || 0
            });
        });
        Object.keys(filesByPid).forEach(function(pid) {
            filesByPid[pid].sort(function(a, b) { return a.pageIndex - b.pageIndex; });
        });
        const pesertaRows = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
            return _baAdminStr(r['BA ID']) === id && _baAdminActive(r);
        }).sort(function(a, b) { return (Number(a.Urutan) || 0) - (Number(b.Urutan) || 0); });
        const peserta = [];
        const groups = [];
        pesertaRows.forEach(function(r) {
            const pid = _baAdminStr(r['ID Pengajuan']);
            const files = filesByPid[pid] || [];
            const halaman = files.reduce(function(n, f) { return n + (Number(f.pageCount) || 1); }, 0);
            peserta.push({
                urutan: Number(r.Urutan) || 0,
                nama: _baAdminStr(r['Nama Lengkap']),
                npm: _baAdminStr(r.NPM),
                blok: _baAdminStr(r.Blok),
                halaman: halaman,
                shared: sharedRows.length > 0
            });
            if (files.length) {
                groups.push({
                    peserta: {
                        urutan: Number(r.Urutan) || 0,
                        nama: _baAdminStr(r['Nama Lengkap']),
                        npm: _baAdminStr(r.NPM),
                        blok: _baAdminStr(r.Blok)
                    },
                    files: files
                });
            }
        });
        const baseUrl = _baAdminStr(ba['Base File URL']);
        const baseName = _baAdminStr(ba['Base File Name']);
        const sharedPages = sharedRows.reduce(function(n, r) { return n + (Number(r['Page Count']) || 1); }, 0);
        const pesertaPages = pesertaBerkas.reduce(function(n, r) { return n + (Number(r['Page Count']) || 1); }, 0);
        const sourcePages = pesertaPages + sharedPages + (baseUrl ? 1 : 0);
        if (sourcePages > BA_ADMIN_MAX_PAGES) {
            updateRowByKey('BeritaAcaraAdmin', 'BA ID', id, { 'Needs Regen': '1' });
            return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman terlampaui.' };
        }
        return {
            success: true,
            mode: 'client',
            baId: id,
            plan: {
                ba: {
                    baId: id,
                    bagian: _baAdminStr(ba.Bagian),
                    blok: _baAdminStr(ba.Blok),
                    namaKegiatan: _baAdminStr(ba['Nama Kegiatan']),
                    tanggal: _clientDate(ba['Tanggal Pelaksanaan']),
                    jam: _clientTime(ba.Jam),
                    catatan: _baAdminStr(ba.Catatan)
                },
                peserta: peserta,
                groups: groups,
                sharedFiles: sharedRows.map(function(r) {
                    return {
                        fileUrl: _baAdminStr(r['File URL']),
                        fileName: _baAdminStr(r['File Name']),
                        pageCount: Number(r['Page Count']) || 1
                    };
                }),
                base: baseUrl ? { fileUrl: baseUrl, fileName: baseName } : null,
                sourcePages: sourcePages,
                maxPages: BA_ADMIN_MAX_PAGES,
                maxBytes: BA_ADMIN_MAX_BYTES,
                hasShared: sharedRows.length > 0
            },
            message: 'Rencana penggabungan siap diproses di dashboard.'
        };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

// =================================================================
// ============ AUDIT INTEGRITAS MASTER & KUALITAS DATA ============
// =================================================================

function auditMasterIntegrity() {
    requireAdmin(arguments[arguments.length - 1]);
    try {
        const masterRows = _getRowsOptional('MasterKegiatan');
        const groups = {};
        masterRows.forEach(function(r) {
            const kategori = _baAdminStr(r.Kategori);
            const nilai = _baAdminStr(r.Nilai);
            const key = norm(kategori) + '|' + norm(nilai);
            if (!groups[key]) groups[key] = { kategori: kategori, nilai: norm(nilai), count: 0 };
            groups[key].count += 1;
        });
        const duplicates = Object.keys(groups).map(function(k) { return groups[k]; }).filter(function(g) { return g.count > 1; });

        const blokMaster = {};
        masterRows.forEach(function(r) {
            if (norm(r.Kategori) === 'blok') blokMaster[norm(r.Nilai)] = true;
        });

        const orphans = [];
        const blanks = [];
        (PARITY_BLOK_REF_SHEETS || []).forEach(function(sheetName) {
            const rows = _getRowsOptional(sheetName);
            let blankCount = 0;
            const counts = {};
            const labels = {};
            rows.forEach(function(r) {
                const blok = _baAdminStr(r.Blok);
                if (!blok) { blankCount += 1; return; }
                const key = norm(blok);
                if (!counts[key]) { counts[key] = 0; labels[key] = blok; }
                counts[key] += 1;
            });
            blanks.push({ table: sheetName, count: blankCount });
            Object.keys(counts).forEach(function(key) {
                if (!blokMaster[key]) orphans.push({ table: sheetName, blok: labels[key], count: counts[key] });
            });
        });

        const keyDrift = {};
        let keyDriftTotal = 0;
        (PARITY_KEGIATAN_KEY_SHEETS || []).forEach(function(sheetName) {
            const rows = _getRowsOptional(sheetName);
            const samples = [];
            let count = 0;
            rows.forEach(function(r) {
                const expected = _kegiatanKey(r.Bagian, r.Blok, r['Nama Kegiatan']);
                if (_baAdminStr(r['Kegiatan Key']) !== expected) {
                    count += 1;
                    if (samples.length < 5) {
                        samples.push({ id: _baAdminStr(r['BA ID']) || _baAdminStr(r['Jadwal ID']) || '', expected: expected, actual: _baAdminStr(r['Kegiatan Key']) });
                    }
                }
            });
            keyDrift[sheetName] = { count: count, samples: samples };
            keyDriftTotal += count;
        });

        const dataQuality = _auditDataQuality();

        return {
            duplicates: duplicates,
            orphans: orphans,
            blanks: blanks,
            keyDrift: keyDrift,
            dataQuality: dataQuality,
            totals: {
                duplicates: duplicates.length,
                orphans: orphans.reduce(function(sum, o) { return sum + o.count; }, 0),
                blanks: blanks.reduce(function(sum, b) { return sum + b.count; }, 0),
                keyDrift: keyDriftTotal
            }
        };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    }
}

function _auditDataQuality() {
    const mahasiswaRows = _getRowsOptional('Mahasiswa');
    const mahasiswaBlankRows = mahasiswaRows.filter(function(r) { return !_baAdminStr(r.Blok); });
    const mahasiswaBlankSamples = mahasiswaBlankRows.slice(0, 10).map(function(r) {
        return { npm: _baAdminStr(r.NPM), nama_lengkap: _baAdminStr(r['Nama Lengkap']) };
    });

    const adminPesertaActive = {};
    _getRowsOptional('BeritaAcaraAdminPeserta').forEach(function(r) {
        if (!_baAdminActive(r)) return;
        adminPesertaActive[_baAdminStr(r['BA ID'])] = true;
    });
    const baAdminOrphanRows = _getRowsOptional('BeritaAcaraAdmin').filter(function(r) {
        return !adminPesertaActive[_baAdminStr(r['BA ID'])];
    });
    const baAdminOrphanSamples = baAdminOrphanRows.slice(0, 10).map(function(r) {
        return {
            ba_id: _baAdminStr(r['BA ID']),
            bagian: _baAdminStr(r.Bagian),
            blok: _baAdminStr(r.Blok),
            nama_kegiatan: _baAdminStr(r['Nama Kegiatan'])
        };
    });

    const bagianPeserta = {};
    _getRowsOptional('BeritaAcaraPeserta').forEach(function(r) {
        bagianPeserta[_baAdminStr(r['BA ID'])] = true;
    });
    const baBagianOrphanRows = _getRowsOptional('BeritaAcara').filter(function(r) {
        return !bagianPeserta[_baAdminStr(r['BA ID'])];
    });
    const baBagianOrphanSamples = baBagianOrphanRows.slice(0, 10).map(function(r) {
        return {
            ba_id: _baAdminStr(r['BA ID']),
            bagian: _baAdminStr(r.Bagian),
            blok: _baAdminStr(r.Blok),
            nama_kegiatan: _baAdminStr(r['Nama Kegiatan'])
        };
    });

    const jadwalPeserta = {};
    _getRowsOptional('JadwalPeserta').forEach(function(r) {
        const jid = _baAdminStr(r['Jadwal ID']);
        if (!jid) return;
        if (!jadwalPeserta[jid]) jadwalPeserta[jid] = [];
        jadwalPeserta[jid].push({ idPengajuan: _baAdminStr(r['ID Pengajuan']), npm: _baAdminStr(r.NPM) });
    });
    const groups = {};
    _getRowsOptional('JadwalPelaksanaan').forEach(function(r) {
        if (String(r.Active || '1') === '0') return;
        const jid = _baAdminStr(r['Jadwal ID']);
        const row = {
            JadwalID: jid,
            Bagian: _baAdminStr(r.Bagian),
            Blok: _baAdminStr(r.Blok),
            NamaKegiatan: _baAdminStr(r['Nama Kegiatan']),
            Tanggal: _baAdminStr(r.Tanggal),
            Jam: _baAdminStr(r.Jam),
            Dosen: _baAdminStr(r.Dosen),
            peserta: jadwalPeserta[jid] || []
        };
        const key = _jadwalIdentity(row);
        if (!groups[key]) groups[key] = { key: key, count: 0, jadwalIds: [], contoh: row };
        groups[key].count += 1;
        if (groups[key].jadwalIds.length < 10) groups[key].jadwalIds.push(jid);
    });
    const jadwalDuplikat = Object.keys(groups).map(function(k) { return groups[k]; }).filter(function(g) { return g.count > 1; });
    const jadwalDuplikatRows = jadwalDuplikat.reduce(function(sum, g) { return sum + (g.count - 1); }, 0);

    const baNeedsRegenRows = _getRowsOptional('BeritaAcaraAdmin').filter(function(r) {
        return String(r['Needs Regen'] || '') === '1';
    });
    const baNeedsRegenSamples = baNeedsRegenRows.slice(0, 10).map(function(r) {
        return {
            ba_id: _baAdminStr(r['BA ID']),
            bagian: _baAdminStr(r.Bagian),
            blok: _baAdminStr(r.Blok),
            nama_kegiatan: _baAdminStr(r['Nama Kegiatan'])
        };
    });

    const baPesertaNonaktif = _getRowsOptional('BeritaAcaraAdminPeserta').filter(function(r) {
        return !_baAdminActive(r);
    }).length;

    return {
        mahasiswaBlokKosong: { count: mahasiswaBlankRows.length, samples: mahasiswaBlankSamples },
        baAdminOrphan: { count: baAdminOrphanRows.length, samples: baAdminOrphanSamples },
        baBagianOrphan: { count: baBagianOrphanRows.length, samples: baBagianOrphanSamples },
        jadwalDuplikat: { count: jadwalDuplikatRows, groups: jadwalDuplikat },
        baNeedsRegen: { count: baNeedsRegenRows.length, samples: baNeedsRegenSamples },
        baPesertaNonaktif: { count: baPesertaNonaktif },
        totals: {
            mahasiswaBlokKosong: mahasiswaBlankRows.length,
            baOrphan: baAdminOrphanRows.length + baBagianOrphanRows.length,
            jadwalDuplikat: jadwalDuplikatRows,
            baNeedsRegen: baNeedsRegenRows.length,
            baPesertaNonaktif: baPesertaNonaktif
        }
    };
}
