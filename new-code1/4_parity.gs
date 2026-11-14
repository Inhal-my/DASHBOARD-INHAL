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
const ACTIVITY_KIND_LABELS = {
    ACC: 'ACC', Tolak: 'Ditolak', Batal: 'Dibatalkan', Menunggu: 'Kembali Menunggu',
    UploadMahasiswa: 'Unggah (Mahasiswa)', UploadAdmin: 'Unggah (Admin)',
    VerifyBayar: 'Verifikasi Bayar', CorrectBayar: 'Koreksi Bayar', ResetUpload: 'Reset Unggahan',
    UpdatePengajuan: 'Ubah Pengajuan', DeletePengajuan: 'Hapus Pengajuan',
    BaCreate: 'Buat BA', BaUpdate: 'Ubah BA', BaDelete: 'Hapus BA',
    RenameMaster: 'Ganti Nama Master', FileAccess: 'Akses Berkas', Deny: 'Akses Ditolak', Lainnya: 'Lainnya'
};
const ACTIVITY_KRITIS = ['Deny', 'DeletePengajuan', 'BaDelete', 'CorrectBayar', 'ResetUpload'];
const ACTIVITY_GROUP_OF = {
    ACC: ['keputusan'], Tolak: ['keputusan'], Batal: ['keputusan'], Menunggu: ['keputusan'],
    UploadMahasiswa: ['unggahan'], UploadAdmin: ['unggahan'], ResetUpload: ['unggahan'],
    VerifyBayar: ['bayar'], CorrectBayar: ['bayar'],
    BaCreate: ['ba'], BaUpdate: ['ba'], BaDelete: ['ba'],
    Deny: ['deny'], DeletePengajuan: ['kritis'], RenameMaster: ['master'],
    FileAccess: ['berkas'], UpdatePengajuan: ['data']
};
const ACTIVITY_GROUPS = [
    { key: '', label: 'Semua' },
    { key: 'keputusan', label: 'Keputusan' },
    { key: 'unggahan', label: 'Unggahan' },
    { key: 'bayar', label: 'Verifikasi Bayar' },
    { key: 'ba', label: 'Berita Acara' },
    { key: 'kritis', label: 'Kritis' },
    { key: 'deny', label: 'Akses Ditolak' }
];
const ACTIVITY_STATUS_JENIS = { ACC: 'ACC', Ditolak: 'Tolak', Dibatalkan: 'Batal', Menunggu: 'Menunggu' };
const ACTIVITY_STATUS_RINGKAS = {
    ACC: 'ACC pengajuan', Ditolak: 'Menolak pengajuan',
    Dibatalkan: 'Membatalkan pengajuan', Menunggu: 'Mengembalikan ke Menunggu'
};

function _actPad(n) {
    return (n < 10 ? '0' : '') + n;
}

// Timestamp audit tersimpan sebagai Date (UTC) atau teks ISO. Hasil selalu ISO
// UTC tanpa sufiks zona, agar UI dapat menambahkan offset WIB sendiri.
function _actIsoUtc(v) {
    if (v instanceof Date && !isNaN(v.getTime())) {
        return v.toISOString().slice(0, 19);
    }
    const s = String(v || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + (m[6] || '00');
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 19);
    return s.replace(' ', 'T');
}

function _actWibDay(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return String(iso || '').slice(0, 10);
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) + 7 * 3600000);
    return d.getUTCFullYear() + '-' + _actPad(d.getUTCMonth() + 1) + '-' + _actPad(d.getUTCDate());
}

function _actWibToday() {
    const d = new Date(Date.now() + 7 * 3600000);
    return d.getUTCFullYear() + '-' + _actPad(d.getUTCMonth() + 1) + '-' + _actPad(d.getUTCDate());
}

function _actShiftDay(day, days) {
    const m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + (Number(days) || 0) * 86400000);
    return d.getUTCFullYear() + '-' + _actPad(d.getUTCMonth() + 1) + '-' + _actPad(d.getUTCDate());
}

function _actParseJson(raw) {
    const s = String(raw === undefined || raw === null ? '' : raw);
    if (!s) return { value: null, json: false, text: '' };
    try {
        return { value: JSON.parse(s), json: true, text: s };
    } catch (e) {
        return { value: null, json: false, text: s };
    }
}

function _actInitials(name) {
    const cleaned = String(name || '').replace(/[,;]/g, ' ');
    const words = cleaned.split(/\s+/).filter(function(w) {
        const bare = w.replace(/\./g, '');
        if (!bare) return false;
        if (w.endsWith('.')) return false;
        if (/^(dr|drs|prof|hj|h)$/i.test(bare)) return false;
        return /[A-Za-z]/.test(bare);
    });
    const sig = words.length ? words : cleaned.split(/\s+/).filter(Boolean);
    if (!sig.length) return '?';
    if (sig.length === 1) return (sig[0].replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?').toUpperCase();
    return (sig[0][0] + sig[1][0]).toUpperCase();
}

function _actFileLabel(url) {
    const s = String(url || '');
    if (!s) return '';
    const drive = s.match(/\/file\/d\/([^/?#]+)/);
    if (drive) return drive[1];
    const parts = s.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    try { return decodeURIComponent(last); } catch (e) { return last; }
}

function _actDetailId(detail) {
    if (!detail || typeof detail !== 'object') return '';
    return String(detail.idPengajuan || detail['ID Pengajuan'] || '').trim();
}

function _activityKind(aksi, target) {
    const a = String(aksi || '').toUpperCase();
    const t = String(target || '').toLowerCase();
    if (t === 'checkdata') return 'UpdatePengajuan';
    if (a === 'BA_CREATE') return 'BaCreate';
    if (a === 'BA_UPDATE') return 'BaUpdate';
    if (a === 'BA_DELETE') return 'BaDelete';
    if (a === 'RENAME_MASTER') return 'RenameMaster';
    if (a === 'VERIFY') return 'VerifyBayar';
    if (a === 'CORRECT') return 'CorrectBayar';
    if (a === 'RESET_UPLOAD') return 'ResetUpload';
    if (a === 'UPLOAD_BUKTI_ADMIN' || a === 'UPLOAD_SURAT') return 'UploadAdmin';
    if (a === 'DENY') return 'Deny';
    if (a === 'FILE_ACCESS') return 'FileAccess';
    if (a === 'DELETE' && (t === 'pengajuan' || t === 'detailkegiatan')) return 'DeletePengajuan';
    if (a === 'UPDATE' && (t === 'pengajuan' || t === 'detailkegiatan')) return 'UpdatePengajuan';
    if (a.indexOf('JADWAL') !== -1) return 'BaUpdate';
    return 'Lainnya';
}

function _activityKindLabel(jenis) {
    return ACTIVITY_KIND_LABELS[jenis] || String(jenis || '') || 'Lainnya';
}

function _activityGroup(jenis) {
    return ACTIVITY_GROUP_OF[jenis] || [];
}

function _actEvent(source, ts, jenis, targetJenis, targetId, ringkasan, extra, idx) {
    const waktu = _actIsoUtc(ts);
    const e = {
        id: source + ':' + waktu + ':' + String(jenis) + ':' + String(targetId || '') + ':' + (idx || 0),
        waktu: waktu,
        aktor: String((extra && extra.aktor) || '').trim() || 'Sistem',
        aktorRole: String((extra && extra.aktorRole) || 'Admin'),
        inisial: _actInitials((extra && extra.aktor) || 'Sistem'),
        jenis: jenis,
        label: _activityKindLabel(jenis),
        grup: _activityGroup(jenis),
        sumber: source,
        targetJenis: targetJenis,
        targetId: String(targetId || ''),
        ringkasan: ringkasan,
        meta: (extra && extra.meta) || {},
        alasan: String((extra && extra.alasan) || ''),
        raw: String((extra && extra.raw) || '')
    };
    if (extra && extra.sebelum) e.sebelum = extra.sebelum;
    if (extra && extra.sesudah) e.sesudah = extra.sesudah;
    return e;
}

function _actFields(detail, skip) {
    const out = {};
    Object.keys(detail || {}).forEach(function(k) {
        if (skip && skip.indexOf(k) !== -1) return;
        out[k] = detail[k];
    });
    return out;
}

function _actNormalizeAudit(row, idx) {
    const action = String(row.Aksi || '').trim().toUpperCase();
    const target = String(row.Target || '').trim();
    const targetLow = target.toLowerCase();
    const parsed = _actParseJson(row.Detail);
    const detail = parsed.value && typeof parsed.value === 'object' ? parsed.value : null;
    const idPengajuan = _actDetailId(detail);
    const aktor = String(row['Actor Email'] || '').trim() || 'Sistem';
    const extra = { aktor: aktor, aktorRole: 'Admin', alasan: String(row.Alasan || '').trim(), raw: String(row.Detail || '') };

    if (targetLow === 'checkdata') {
        const cleared = !!(detail && detail.cleared);
        extra.meta = detail ? { biaya: detail.biaya, cleared: cleared } : {};
        return _actEvent('audit_log', row.Timestamp, 'UpdatePengajuan', 'CheckData', idPengajuan,
            cleared ? 'Mengembalikan biaya pengajuan ke MasterBiaya' : 'Mengoreksi biaya pengajuan', extra, idx);
    }

    if (action === 'UPDATE' && targetLow === 'pengajuan') {
        const keys = detail ? Object.keys(detail).filter(function(k) { return k !== 'idPengajuan' && k !== 'ID Pengajuan'; }) : [];
        extra.meta = { perubahan: keys.join(', ') };
        extra.sesudah = detail ? _actFields(detail, ['idPengajuan', 'ID Pengajuan']) : undefined;
        return _actEvent('audit_log', row.Timestamp, 'UpdatePengajuan', 'Pengajuan', idPengajuan,
            keys.length ? 'Memperbarui data pengajuan (' + keys.join(', ') + ')' : 'Memperbarui data pengajuan', extra, idx);
    }

    if (action === 'UPDATE' && targetLow === 'detailkegiatan') {
        const keys = detail ? Object.keys(detail).filter(function(k) { return k !== 'idPengajuan' && k !== 'ID Pengajuan' && k !== 'index'; }) : [];
        extra.meta = detail ? { perubahan: keys.join(', '), index: detail.index } : {};
        return _actEvent('audit_log', row.Timestamp, 'UpdatePengajuan', 'DetailKegiatan', idPengajuan,
            'Mengubah detail kegiatan', extra, idx);
    }

    if (action === 'DELETE' && targetLow === 'pengajuan') {
        extra.meta = detail ? { deleted: 1 } : {};
        return _actEvent('audit_log', row.Timestamp, 'DeletePengajuan', 'Pengajuan', idPengajuan,
            'Menghapus pengajuan', extra, idx);
    }

    if (action === 'DELETE' && targetLow === 'detailkegiatan') {
        extra.meta = detail ? _actFields(detail, ['idPengajuan', 'ID Pengajuan']) : {};
        extra.sebelum = detail ? _actFields(detail, ['idPengajuan', 'ID Pengajuan', 'index']) : undefined;
        return _actEvent('audit_log', row.Timestamp, 'DeletePengajuan', 'DetailKegiatan', idPengajuan,
            'Menghapus detail kegiatan', extra, idx);
    }

    if (action === 'UPLOAD_BUKTI_ADMIN') {
        extra.meta = detail ? { sumber: detail.sumber, berkas: _actFileLabel(detail.linkBukti) } : {};
        return _actEvent('audit_log', row.Timestamp, 'UploadAdmin', 'Pengajuan', idPengajuan,
            'Admin mengunggah bukti bayar', extra, idx);
    }

    if (action === 'UPLOAD_SURAT') {
        extra.meta = detail ? { berkas: _actFileLabel(detail.linkSurat) } : {};
        return _actEvent('audit_log', row.Timestamp, 'UploadAdmin', 'Pengajuan', idPengajuan,
            'Admin mengunggah surat keterangan', extra, idx);
    }

    if (action === 'RESET_UPLOAD') {
        extra.meta = detail ? { berkas: _actFileLabel(detail.linkBukti) } : {};
        extra.sebelum = detail ? { linkBukti: String(detail.linkBukti || '') } : undefined;
        extra.sesudah = { linkBukti: '' };
        return _actEvent('audit_log', row.Timestamp, 'ResetUpload', 'Pengajuan', idPengajuan,
            'Mereset unggahan mahasiswa', extra, idx);
    }

    if (action === 'VERIFY') {
        const nominal = detail ? Number(detail.nominal) || 0 : 0;
        const kesesuaian = detail ? String(detail.kesesuaian || '') : '';
        extra.meta = detail ? { nominal: nominal, kesesuaian: kesesuaian, tanggalBayar: detail.tanggal } : {};
        extra.sebelum = { status: 'menunggu' };
        extra.sesudah = { status: 'valid', nominal: nominal };
        return _actEvent('audit_log', row.Timestamp, 'VerifyBayar', 'Pembayaran', idPengajuan,
            'Memvalidasi pembayaran' + (nominal ? ' Rp' + Number(nominal).toLocaleString('id-ID') : '') +
            (kesesuaian ? ' (' + kesesuaian + ')' : ''), extra, idx);
    }

    if (action === 'CORRECT') {
        const mode = detail ? String(detail.mode || '') : '';
        const statusBaru = detail ? String(detail.statusBaru || '') : '';
        extra.meta = { mode: mode, statusBaru: statusBaru };
        extra.sebelum = { status: 'valid' };
        extra.sesudah = { status: statusBaru };
        return _actEvent('audit_log', row.Timestamp, 'CorrectBayar', 'Pembayaran', idPengajuan,
            mode === 'buka_kembali' ? 'Membuka kembali pembayaran ke antrean' : 'Koreksi administratif pembayaran', extra, idx);
    }

    if (action === 'BA_CREATE' || action === 'BA_UPDATE' || action === 'BA_DELETE') {
        const jenisBa = detail ? String(detail.jenis || '') : '';
        const map = { BA_CREATE: 'BaCreate', BA_UPDATE: 'BaUpdate', BA_DELETE: 'BaDelete' };
        const verb = { BA_CREATE: 'Membuat', BA_UPDATE: 'Memperbarui', BA_DELETE: 'Menghapus' };
        extra.meta = detail ? _actFields(detail, []) : {};
        return _actEvent('audit_log', row.Timestamp, map[action], 'Berita Acara', target,
            verb[action] + ' ' + (jenisBa ? 'BA ' + jenisBa : 'BA'), extra, idx);
    }

    if (action === 'RENAME_MASTER') {
        const parts = target.split('->');
        const dari = parts.length > 1 ? parts[0].replace(/^Blok:\s*/i, '').trim() : target;
        const ke = parts.length > 1 ? parts[1].trim() : '';
        extra.meta = detail ? _actFields(detail, []) : {};
        extra.sebelum = { nilai: dari };
        extra.sesudah = ke ? { nilai: ke } : undefined;
        return _actEvent('audit_log', row.Timestamp, 'RenameMaster', 'Master Data', target,
            'Mengganti nama master: ' + dari + (ke ? ' -> ' + ke : ''), extra, idx);
    }

    if (action === 'CREATE_JADWAL' || action === 'UPDATE_JADWAL' || action === 'CANCEL_JADWAL') {
        const jid = detail ? String(detail.jadwalId || '') : '';
        const ring = action === 'CREATE_JADWAL' ? 'Membuat jadwal pelaksanaan'
            : (action === 'CANCEL_JADWAL' ? 'Membatalkan jadwal pelaksanaan' : 'Memperbarui jadwal pelaksanaan');
        extra.meta = detail ? _actFields(detail, []) : {};
        return _actEvent('audit_log', row.Timestamp, _activityKind(action, target), 'Jadwal', jid || target, ring, extra, idx);
    }

    const fallbackText = parsed.json ? parsed.text : String(row.Detail || '');
    extra.meta = fallbackText ? { detail: fallbackText } : {};
    return _actEvent('audit_log', row.Timestamp, 'Lainnya', target || 'Lainnya', '',
        (action || 'AKSI') + (fallbackText ? ': ' + fallbackText.slice(0, 120) : ''), extra, idx);
}

function _actNormalizeStatus(row, prevStatus, idx) {
    const status = String(row.Status || '').trim();
    const idPengajuan = String(row['ID Pengajuan'] || '').trim();
    const aktor = String(row['Actor Email'] || '').trim() || 'Admin';
    const jenis = ACTIVITY_STATUS_JENIS[status] || 'Lainnya';
    const extra = {
        aktor: aktor,
        aktorRole: 'Admin',
        alasan: String(row.Catatan || ''),
        meta: { statusLama: String(prevStatus || ''), statusBaru: status },
        raw: String(row.Catatan || '')
    };
    if (prevStatus) extra.sebelum = { status: String(prevStatus) };
    extra.sesudah = { status: status };
    const ring = (ACTIVITY_STATUS_RINGKAS[status] || ('Status menjadi ' + status)) + (idPengajuan ? ' ' + idPengajuan : '');
    return _actEvent('status_history', row.Timestamp, jenis, 'Pengajuan', idPengajuan, ring, extra, idx);
}

function _actNormalizeUpload(row, adminAudit, idx) {
    const detail = String(row.Detail || '');
    const isAdmin = /unggah bukti bayar oleh admin/i.test(detail) || !!adminAudit;
    const aktor = isAdmin
        ? (adminAudit ? String(adminAudit['Actor Email'] || '').trim() || 'Admin' : 'Admin')
        : (String(row['Nama Lengkap'] || '').trim() || 'Mahasiswa');
    const jenis = isAdmin ? 'UploadAdmin' : 'UploadMahasiswa';
    const nama = String(row['Nama Lengkap'] || '').trim();
    const jenisKegiatan = String(row['Jenis Kegiatan'] || '').trim();
    const extra = {
        aktor: aktor,
        aktorRole: isAdmin ? 'Admin' : 'Mahasiswa',
        meta: {
            namaMahasiswa: nama,
            npm: String(row.NPM || '').trim(),
            blok: String(row.Blok || '').trim(),
            jenisKegiatan: jenisKegiatan,
            berkas: _actFileLabel(row['Link Bukti Bayar']),
            tanggal: String(row.Tanggal || '').trim()
        },
        raw: detail
    };
    const ring = isAdmin
        ? 'Admin mengunggah bukti bayar atas nama ' + (nama || String(row.NPM || '').trim() || '-')
        : 'Mahasiswa mengunggah bukti bayar' + (jenisKegiatan ? ' (' + jenisKegiatan + ')' : '');
    return _actEvent('log_upload', row.Timestamp, jenis, 'Pengajuan', String(row['ID Pengajuan'] || '').trim(), ring, extra, idx);
}

function _actTimeMs(v) {
    if (v instanceof Date) return v.getTime();
    const s = String(v || '').trim();
    if (!s) return NaN;
    return new Date(s).getTime();
}

function _actDedupeUploads(uploadRows, auditRows) {
    const watches = [];
    (auditRows || []).forEach(function(r) {
        const a = String(r.Aksi || '').trim().toUpperCase();
        if (a !== 'UPLOAD_BUKTI_ADMIN' && a !== 'RESET_UPLOAD') return;
        const parsed = _actParseJson(r.Detail);
        const d = parsed.value && typeof parsed.value === 'object' ? parsed.value : null;
        const id = _actDetailId(d);
        const ts = _actTimeMs(r.Timestamp);
        if (id && !isNaN(ts)) watches.push({ id: id, ts: ts });
    });
    return (uploadRows || []).filter(function(u) {
        if (!watches.length) return true;
        const id = String(u['ID Pengajuan'] || '').trim();
        if (!id) return true;
        const ts = _actTimeMs(u.Timestamp);
        if (isNaN(ts)) return true;
        return !watches.some(function(w) { return w.id === id && Math.abs(w.ts - ts) <= 10000; });
    });
}

function _actFilter(events, f) {
    const jenis = String(f.jenis || '').trim();
    const grup = String(f.grup || '').trim();
    const aktor = String(f.aktor || '').trim();
    const target = String(f.target || '').trim();
    const q = String(f.q || '').trim().toLowerCase();
    const dari = String(f.dari || '').trim();
    const sampai = String(f.sampai || '').trim();
    return (events || []).filter(function(e) {
        if (jenis && e.jenis !== jenis) return false;
        if (grup && _activityGroup(e.jenis).indexOf(grup) === -1) return false;
        if (aktor && e.aktor !== aktor) return false;
        if (target && e.targetJenis !== target) return false;
        const day = _actWibDay(e.waktu);
        if (dari && day < dari) return false;
        if (sampai && day > sampai) return false;
        if (q) {
            const hay = [e.aktor, e.aktorRole, e.targetId, e.targetJenis, e.ringkasan, e.alasan, _activityKindLabel(e.jenis)].join(' ').toLowerCase();
            if (hay.indexOf(q) === -1) return false;
        }
        return true;
    });
}

function _actActorSummary(events) {
    const map = {};
    (events || []).forEach(function(e) {
        const key = e.aktor + '|' + e.aktorRole;
        if (!map[key]) map[key] = { nama: e.aktor, role: e.aktorRole, jumlah: 0 };
        map[key].jumlah += 1;
    });
    return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) {
        return b.jumlah - a.jumlah || String(a.nama).localeCompare(String(b.nama));
    });
}

function _actKindSummary(events) {
    const map = {};
    (events || []).forEach(function(e) {
        if (!map[e.jenis]) map[e.jenis] = { jenis: e.jenis, label: _activityKindLabel(e.jenis), jumlah: 0 };
        map[e.jenis].jumlah += 1;
    });
    return Object.keys(map).map(function(k) { return map[k]; }).sort(function(a, b) { return b.jumlah - a.jumlah; });
}

function _actGroupSummaries(events) {
    return ACTIVITY_GROUPS.map(function(g) {
        return {
            key: g.key,
            label: g.label,
            jumlah: (events || []).filter(function(e) {
                return !g.key || _activityGroup(e.jenis).indexOf(g.key) !== -1;
            }).length
        };
    });
}

function _actSummary(events) {
    const list = events || [];
    const today = _actWibToday();
    const out = { hariIni: 0, keputusan: 0, unggahan: 0, kritis: 0, total: list.length };
    list.forEach(function(e) {
        if (_actWibDay(e.waktu) === today) out.hariIni += 1;
        if (['ACC', 'Tolak', 'Batal', 'Menunggu'].indexOf(e.jenis) !== -1) out.keputusan += 1;
        if (e.jenis === 'UploadMahasiswa' || e.jenis === 'UploadAdmin') out.unggahan += 1;
        if (ACTIVITY_KRITIS.indexOf(e.jenis) !== -1) out.kritis += 1;
    });
    return out;
}

function getActivityLog(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const p = payload || {};
    const today = _actWibToday();
    const dari = String(p.dari || '').trim() || _actShiftDay(today, -6);
    const sampai = String(p.sampai || '').trim() || today;
    const events = [];

    const auditRows = getAllRows('AuditLog');
    auditRows.forEach(function(r, i) { events.push(_actNormalizeAudit(r, i)); });

    // Status history diurutkan naik agar status sebelumnya per pengajuan akurat;
    // perhitungan ini memakai seluruh riwayat, bukan hanya rentang filter.
    const statusRows = getAllRows('StatusHistory').slice().sort(function(a, b) {
        return String(_actIsoUtc(a.Timestamp)).localeCompare(String(_actIsoUtc(b.Timestamp)));
    });
    const prev = {};
    statusRows.forEach(function(r, i) {
        const id = String(r['ID Pengajuan'] || '').trim();
        events.push(_actNormalizeStatus(r, prev[id], i));
        if (String(r.Status || '').trim()) prev[id] = String(r.Status || '').trim();
    });

    const adminUpload = {};
    auditRows.forEach(function(r) {
        if (String(r.Aksi || '').trim().toUpperCase() !== 'UPLOAD_BUKTI_ADMIN') return;
        const parsed = _actParseJson(r.Detail);
        const d = parsed.value && typeof parsed.value === 'object' ? parsed.value : null;
        const id = _actDetailId(d);
        if (id && !adminUpload[id]) adminUpload[id] = r;
    });
    const uploadRows = _actDedupeUploads(getAllRows('LogUpload'), auditRows);
    uploadRows.forEach(function(r, i) {
        events.push(_actNormalizeUpload(r, adminUpload[String(r['ID Pengajuan'] || '').trim()], i));
    });

    events.sort(function(a, b) {
        const wa = String(a.waktu || '');
        const wb = String(b.waktu || '');
        if (wa !== wb) return wb < wa ? -1 : 1;
        return String(b.id) < String(a.id) ? -1 : 1;
    });

    const HARD_CAP = 5000;
    const ranged = _actFilter(events, { dari: dari, sampai: sampai });
    const truncated = ranged.length > HARD_CAP;
    const capped = truncated ? ranged.slice(0, HARD_CAP) : ranged;
    const filtered = _actFilter(capped, {
        jenis: p.jenis, grup: p.grup, aktor: p.aktor, target: p.target, q: p.q,
        dari: dari, sampai: sampai
    });

    const perPageRaw = parseInt(p.perPage, 10);
    const perPage = !perPageRaw || perPageRaw < 1 ? 25 : Math.min(perPageRaw, HARD_CAP);
    const pages = Math.max(1, Math.ceil(filtered.length / perPage));
    let page = parseInt(p.page, 10) || 1;
    if (page < 1) page = 1;
    if (page > pages) page = pages;
    const start = (page - 1) * perPage;

    return {
        rows: filtered.slice(start, start + perPage),
        total: filtered.length,
        page: page,
        perPage: perPage,
        pages: pages,
        truncated: truncated,
        range: { dari: dari, sampai: sampai },
        actors: _actActorSummary(ranged),
        kinds: _actKindSummary(ranged),
        groups: _actGroupSummaries(ranged),
        summary: _actSummary(ranged),
        ok: true
    };
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
