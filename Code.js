const SHEET_ID = '1mygekRYIbgthLINwBgEC3mdGyJMQ4GW4vMvv9YlD_fw';
const LOG_SHEET_NAME = 'LogData';
const TEMPLATE_DITERIMA_ID = 'template-acc-diterima-ditolak.html';
const TEMPLATE_DITOLAK_ID = 'template-acc-diterima-ditolak.html';
const TEMPLATE_ACC_ID = 'template-acc-final.html';
const FOLDER_ID = '1gFdANGMwa80gMpUNg1La91KOHAuMTt7P';
const UPLOAD_LOG_SHEET_NAME = 'LogUpload';
const CHECK_SHEET_NAME = 'CheckData';
const NAMA_SHEET_MHS = 'MHS';
const MASTER_BIAYA_SHEET_NAME = 'MasterBiaya';
const CORE_ADMIN_EMAILS = [
    'yudhasudira@umsu.ac.id',
    'devisyafriani@umsu.ac.id',
    'desiisnayanti@umsu.ac.id'
].map(function(email) { return email.toLowerCase(); });
// Global norm function for string normalization
function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}


// Caching
const CACHE_EXPIRATION = 300; // 5 menit
// Batas aman CacheService adalah 100 KB per entri; gunakan 90 KB per chunk
const CHUNK_SIZE = 90 * 1024;

// Fallback CSS untuk halaman check (digunakan bila <style> tidak ditemukan di check.html)
const THEME_CSS = 'body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f1f5f9;color:#0f172a}.container{max-width:1200px;margin:auto}table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #e2e8f0}th{background:#f8fafc}.badge{padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}.badge-pending{background:#fef3c7;color:#92400e}.badge-approved{background:#d1fae5;color:#065f46}.badge-rejected{background:#fee2e2;color:#991b1b}.btn{border:none;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer}.btn-primary{background:#0f766e;color:#fff}.btn-success{background:#10b981;color:#fff}.btn-danger{background:#ef4444;color:#fff}.text-muted{color:#64748b}.small{font-size:12px}';

// =================================================================
// =================== AUTHORIZATION & UTILITIES ===================
// =================================================================

let authorizedUsers = null;

// Mengambil spreadsheet global
function getGlobalSpreadsheet() {
    try {
        return SpreadsheetApp.openById(SHEET_ID);
    } catch (e) {
        console.error("Gagal membuka Spreadsheet. Periksa SHEET_ID. Error: " + e.message);
        throw new Error("Gagal mengakses spreadsheet utama.");
    }
}

// Cek apakah user diizinkan mengakses fitur admin
function isAuthorized(email) {
    if (authorizedUsers === null) {
        try {
            const sheet = getGlobalSpreadsheet().getSheetByName('Admin');
            if (sheet) {
                const sheetAdmins = sheet.getRange("A2:A").getValues().flat().filter(String).map(e => e.toLowerCase());
                authorizedUsers = [...new Set([...CORE_ADMIN_EMAILS, ...sheetAdmins])];
            } else {
                authorizedUsers = CORE_ADMIN_EMAILS.slice();
            }
        } catch (e) {
            console.error("Gagal membaca sheet 'Admin'. Menggunakan daftar admin bawaan. Error: " + e.message);
            authorizedUsers = CORE_ADMIN_EMAILS.slice();
        }
    }
    return email && authorizedUsers.includes(email.toLowerCase());
}

function isCoreAdminAuthorized(email) {
    return !!(email && CORE_ADMIN_EMAILS.includes(String(email).toLowerCase()));
}

function requireCoreAdminAuthorized() {
    var email = getCurrentUserEmail();
    if (!isCoreAdminAuthorized(email)) {
        throw new Error("Akses ditolak. Halaman ini hanya dapat diakses oleh 3 admin utama yang terdaftar di Code.gs.");
    }
}

function requireAuthorized() {
    const email = Session.getActiveUser().getEmail();
    if (!isAuthorized(email)) {
        throw new Error("Akses ditolak. Anda tidak memiliki izin untuk melakukan tindakan ini.");
    }
}

function getCurrentUserEmail() {
    try {
        return Session.getActiveUser().getEmail();
    } catch (e) {
        return '';
    }
}
function renderUnauthorizedPage() {
    return HtmlService.createHtmlOutput('<h1>Akses Ditolak</h1><p>Anda tidak terdaftar sebagai admin.</p>');
}

// =================================================================
// ================== BAGIAN STAFF AUTHORIZATION ====================
// =================================================================

// Panel Bagian memerlukan otorisasi khusus: email staf bagian harus
// didaftarkan pada sheet 'BagianStaff' dengan kolom:
//   A = Email, B = Kategori (SGD/KKD/Ujian/Praktikum, atau kosong/* untuk semua), C = Nama
// Enforce dilakukan di sisi server (tidak bisa dilewati dari client).
const BAGIAN_STAFF_SHEET_NAME = 'BagianStaff';

function _findBaginaStaffSheet(ss) {
    const candidates = [
        BAGIAN_STAFF_SHEET_NAME,
        'BaginaStaff',
        'Bagian Staff',
        'Staff Bagian',
        'Bagian',
        'Staff'
    ];
    const norm = function(name) {
        return String(name || '').toLowerCase().replace(/\s+/g, '');
    };
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
        const n = norm(sheets[i].getName());
        for (let j = 0; j < candidates.length; j++) {
            if (n === norm(candidates[j])) return sheets[i];
        }
        if (n.indexOf('bagian') !== -1 && n.indexOf('staff') !== -1) return sheets[i];
    }
    return ss.getSheetByName(BAGIAN_STAFF_SHEET_NAME);
}

function _getBaginaStaffMap() {
    const cacheKey = 'bagianStaffMap:v2';
    try {
        const cached = CacheService.getScriptCache().get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) { }
    let map = {};
    try {
        const sheet = _findBaginaStaffSheet(getGlobalSpreadsheet());
        if (sheet && sheet.getLastRow() > 0) {
            const data = sheet.getDataRange().getValues();
            let start = 0;
            if (data.length > 0 && String(data[0][0] || '').trim().toLowerCase().indexOf('@') === -1) {
                start = 1;
            }
            for (let i = start; i < data.length; i++) {
                const email = String(data[i][0] || '').trim().toLowerCase();
                if (!email) continue;
                const kategori = String(data[i][1] || '').trim();
                const nama = String(data[i][2] || '').trim();
                if (!map[email]) map[email] = { kategoris: [], nama: nama };
                if (kategori) map[email].kategoris.push(kategori.toLowerCase());
            }
        }
    } catch (e) {
        console.error('Gagal membaca sheet BagianStaff: ' + e.message);
    }
    try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(map), 300); } catch (e) { }
    return map;
}

function _normBaginaKey(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function _isWildcardBaginaKategori(k) {
    const v = _normBaginaKey(k);
    return v === '' || v === '*' || v === 'semua' || v === 'all';
}

function _baginaStaffEntry(email) {
    if (!email) return null;
    const map = _getBaginaStaffMap();
    return map[String(email).toLowerCase()] || null;
}

function _baginaHasAccess(entry, kategori, subBagian) {
    if (!entry || !entry.kategoris || entry.kategoris.length === 0) return true;
    const kat = _normBaginaKey(kategori);
    const sub = _normBaginaKey(subBagian);
    const isPraktikum = kat === 'praktikum';
    for (let i = 0; i < entry.kategoris.length; i++) {
        const raw = entry.kategoris[i];
        const nk = _normBaginaKey(raw);
        if (_isWildcardBaginaKategori(raw)) return true;
        if (nk === kat) return true;
        if (isPraktikum && nk.indexOf('lab') !== -1 && (!sub || nk.indexOf(sub) !== -1)) return true;
        if (sub && nk === sub) return true;
    }
    return false;
}

function verifyBaginaAccess(kategori, subBagian) {
    const email = getCurrentUserEmail();
    if (!email) {
        return { ok: false, message: 'Anda harus login dengan akun Google terlebih dahulu untuk mengakses Panel Bagian.' };
    }
    const entry = _baginaStaffEntry(email);
    if (!entry) {
        return { ok: false, message: "Email Anda belum terdaftar untuk Panel Bagian. Pastikan email Anda ('" + email + "') sudah ada di tab 'BagianStaff' pada spreadsheet INHAL (kolom A = Email, B = Kategori, C = Nama). Silakan hubungi Admin Prodi bila perlu didaftarkan." };
    }
    const kat = String(kategori || '').trim();
    if (kat && !_baginaHasAccess(entry, kat, subBagian)) {
        return { ok: false, message: 'Email Anda terdaftar untuk kategori: ' + (entry.kategoris.join(', ') || '(semua)') + '. Bukan ' + kat + '.' };
    }
    return { ok: true, kategori: kat, nama: entry.nama || '' };
}

function requireBaginaSession(kategori, subBagian) {
    const email = getCurrentUserEmail();
    if (!email) throw new Error('Akses ditolak. Silakan login dengan akun Google terlebih dahulu.');
    const entry = _baginaStaffEntry(email);
    if (!entry) throw new Error('Akses ditolak. Email Anda belum terdaftar untuk Panel Bagian.');
    const kat = String(kategori || '').trim();
    if (kat && !_baginaHasAccess(entry, kat, subBagian)) {
        throw new Error('Akses ditolak. Anda terdaftar untuk kategori: ' + (entry.kategoris.join(', ') || '(semua)') + '.');
    }
}

function requireAuthorizedOrBagina() {
    const email = getCurrentUserEmail();
    if (isAuthorized(email)) return;
    requireBaginaSession('');
}

// =================================================================
// ======================= DROPDOWN OPTIONS ========================
// =================================================================

function getDropdownOptions(columnLetter) {
    try {
        const sheet = getGlobalSpreadsheet().getSheetByName(NAMA_SHEET_MHS);
        if (!sheet || sheet.getLastRow() < 2) return [];

        const range = sheet.getRange(`${columnLetter}2:${columnLetter}${sheet.getLastRow()}`);
        const values = range.getValues().flat().filter(String);
        return [...new Set(values)];
    } catch (e) {
        console.error(`Error getting dropdown options for column ${columnLetter}:`, e.message);
        return [];
    }
}

function getBlokOptions() { return _getBlokOptions(); }
function getUjianOptions() { return getDropdownOptions('H'); }
function getSgdOptions() { return getDropdownOptions('I'); }
function getKkdOptions() { return getDropdownOptions('J'); }
function getDetailSgdOptions() { return getDropdownOptions('K'); }
function getDetailKkdOptions() { return getDropdownOptions('L'); }
function getLabOptions() { return getDropdownOptions('M'); }
function getKegiatanLabOptions() { return getDropdownOptions('N'); }
function getDosenOptions() { return getDropdownOptions('O'); }

function getStudentData() {
    // Rate limit publik: maksimal 120 panggilan per jendela 60 detik.
    if (!_rateLimitAllowed('getStudentData', 120, 60)) {
        return { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.' };
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = 'mhsStudentData:v1';
    try {
        var cached = _getCacheChunked(cache, cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && !parsed.error) return parsed;
            _removeCacheChunked(cache, cacheKey);
        }
    } catch (e) { }

    try {
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(NAMA_SHEET_MHS);
        if (!sheet) {
            console.error('Sheet MHS not found');
            return { error: 'Sheet MHS tidak ditemukan' };
        }

        const data = sheet.getDataRange().getValues();
        const studentData = {};

        // Skip header row (index 0), start from row 1
        for (let i = 1; i < data.length; i++) {
            const npm = data[i][0] ? data[i][0].toString().trim() : '';
            const namaLengkap = data[i][1] ? data[i][1].toString().trim() : '';

            if (npm && namaLengkap) {
                studentData[npm] = {
                    namaLengkap: namaLengkap,
                    // Add other fields if needed from the MHS sheet
                };
            }
        }

        console.log("Loaded student data for", Object.keys(studentData).length, "students");
        try {
            _setCacheChunked(cache, cacheKey, JSON.stringify(studentData), CACHE_EXPIRATION);
        } catch (e) { }
        return studentData;

    } catch (e) {
        console.error("Error loading student data:", e);
        return { error: 'Gagal memuat data mahasiswa: ' + e.message };
    }
}


// =================================================================
// ======================= FORM PROCESSING =========================
// =================================================================

function processRegistration(formData) {
    try {
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);

        // Cegah duplikat di sisi server (bypass dari cek client)
        const dupCheck = checkExactDuplicate(formData);
        if (dupCheck && dupCheck.isDuplicate) {
            return { success: false, message: dupCheck.message || 'Data identik sudah pernah diajukan.' };
        }

        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (sheet.getLastRow() === 0) {
            const headers = [
                'Timestamp', 'ID Pengajuan', 'Nama Lengkap', 'NPM', 'Email Address', 'No. HP/WA', 'Blok',
                'Jenis Kegiatan', 'Pilihan Ujian', 'Tanggal Ujian',
                'Pilihan SGD', 'Detail SGD', 'Tanggal SGD',
                'Pilihan KKD', 'Detail KKD', 'Tanggal KKD',
                'Pilihan LAB 1', 'Kegiatan LAB 1', 'Tanggal Praktikum 1',
                'Pilihan LAB 2', 'Kegiatan LAB 2', 'Tanggal Praktikum 2',
                'Pilihan LAB 3', 'Kegiatan LAB 3', 'Tanggal Praktikum 3',
                'Pilihan LAB 4', 'Kegiatan LAB 4', 'Tanggal Praktikum 4',
                'Pilihan LAB 5', 'Kegiatan LAB 5', 'Tanggal Praktikum 5',
                'Pilihan LAB 6', 'Kegiatan LAB 6', 'Tanggal Praktikum 6',
                'Pilihan LAB 7', 'Kegiatan LAB 7', 'Tanggal Praktikum 7',
                'Pilihan LAB 8', 'Kegiatan LAB 8', 'Tanggal Praktikum 8',
                'Pilihan LAB 9', 'Kegiatan LAB 9', 'Tanggal Praktikum 9',
                'Keterangan', 'Link Surat Keterangan', 'Status', 'Catatan Admin',
                'Notifikasi Terkirim Pada', 'Nomor Surat', 'Lampiran Email'
            ];
            sheet.appendRow(headers);
        }

        const idPengajuan = Utilities.getUuid();

        let fileUrl = '';
        if (formData.fileSurat) {
            const folder = DriveApp.getFolderById(FOLDER_ID);
            const blob = Utilities.newBlob(Utilities.base64Decode(formData.fileSurat.base64), formData.fileSurat.type, formData.fileSurat.name);
            const file = folder.createFile(blob);
            var shareResultSurat = trySetDriveFileSharing(file);
            fileUrl = file.getUrl();
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const newRow = new Array(headers.length).fill('');
        const headerMap = {};
        headers.forEach((h, i) => headerMap[h] = i);
        
        const setVal = (header, value) => {
            if (headerMap[header] !== undefined) {
                newRow[headerMap[header]] = value || '';
            }
        };

        setVal('Timestamp', new Date());
        setVal('ID Pengajuan', idPengajuan);
        setVal('Nama Lengkap', formData.namaLengkap);
        setVal('NPM', formData.npm);
        setVal('Email', formData.email);
        setVal('Email Address', formData.email);
        setVal('No. HP/WA', formData.noHp);
        setVal('Blok', formData.blok);
        setVal('Jenis Kegiatan', formData.jenisKegiatan);
        setVal('Keterangan', formData.keterangan);
        setVal('Link Surat Keterangan', fileUrl);
        setVal('Status', 'Menunggu');
        
        if (formData.jenisKegiatan === 'Ujian') {
            setVal('Pilihan Ujian', formData.detailKegiatan);
            setVal('Tanggal Ujian', formData.tanggalKegiatan);
        } else if (formData.jenisKegiatan === 'SGD') {
            setVal('Pilihan SGD', formData.pilihanSgd);
            setVal('Detail SGD', formData.detailSgd);
            setVal('Tanggal SGD', formData.tanggalKegiatan);
        } else if (formData.jenisKegiatan === 'KKD') {
            setVal('Pilihan KKD', formData.pilihanKkd);
            setVal('Detail KKD', formData.detailKkd);
            setVal('Tanggal KKD', formData.tanggalKegiatan);
        } else if (formData.jenisKegiatan === 'Praktikum' && formData.praktikum) {
            formData.praktikum.forEach((p, i) => {
                if (i < 9) {
                    setVal(`Pilihan LAB ${i + 1}`, p.lab);
                    setVal(`Kegiatan LAB ${i + 1}`, p.kegiatanLab);
                    setVal(`Tanggal Praktikum ${i + 1}`, p.tanggal);
                }
            });
        }
        
        sheet.appendRow(newRow);
        _clearStudentPortalCache(formData.npm);
        _clearCheckPageCache();
        
        var portalDetail = '';
        var portalTanggalKegiatan = '';
        if (formData.jenisKegiatan === 'Ujian') {
            portalDetail = formData.detailKegiatan || '';
            portalTanggalKegiatan = formData.tanggalKegiatan || '';
        } else if (formData.jenisKegiatan === 'SGD') {
            portalDetail = [formData.pilihanSgd || '', formData.detailSgd || ''].filter(Boolean).join(' - ');
            portalTanggalKegiatan = formData.tanggalKegiatan || '';
        } else if (formData.jenisKegiatan === 'KKD') {
            portalDetail = [formData.pilihanKkd || '', formData.detailKkd || ''].filter(Boolean).join(' - ');
            portalTanggalKegiatan = formData.tanggalKegiatan || '';
        } else if (formData.jenisKegiatan === 'Praktikum' && formData.praktikum && formData.praktikum.length) {
            portalDetail = formData.praktikum.map(function(p) {
                return [p.lab || '', p.kegiatanLab || ''].filter(Boolean).join(' - ');
            }).filter(Boolean).join('; ');
            portalTanggalKegiatan = formData.praktikum[0].tanggal || '';
        }

        return {
            success: true,
            portalItem: {
                id: idPengajuan,
                idPengajuan: idPengajuan,
                tanggalAjuan: formatIndonesianDate(new Date(), false),
                blok: formData.blok || '',
                jenis: formData.jenisKegiatan || '',
                detail: portalDetail,
                tanggalKegiatan: portalTanggalKegiatan ? formatIndonesianDate(portalTanggalKegiatan, false) : '',
                status: 'Menunggu',
                reason: '',
                hasUpload: false,
                linkFinal: '',
                uploadTimestamp: ''
            }
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============== UPLOAD HELPER BARU ================

/**
 * Mengambil satu baris data lengkap dari LogData berdasarkan ID Pengajuan.
 * @param {string} idPengajuan - ID unik pengajuan.
 * @returns {Object|null} Objek yang merepresentasikan baris data atau null jika tidak ditemukan.
 */
function _getFullDataById(idPengajuan) {
    if (!idPengajuan) return null;
    const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idCol = headers.indexOf('ID Pengajuan');
    if (idCol === -1) return null;

    const rowData = data.find(row => (row[idCol] || '').toString().trim() === idPengajuan);
    if (!rowData) return null;

    const result = {};
    headers.forEach((header, i) => {
        result[header] = rowData[i];
    });
    return result;
}

function buildRowObjectFromHeaders(headers, rowData) {
    var result = {};
    for (var i = 0; i < headers.length; i++) {
        result[headers[i]] = rowData[i];
    }
    return result;
}

function _getFullDataForUpload(uploadData) {
    try {
        if (!uploadData) {
            return { data: null, reason: 'Data upload tidak tersedia.', matchedBy: '' };
        }

        var idPengajuan = uploadData.idPengajuan || uploadData.IdPengajuan || '';
        if (idPengajuan) {
            var byId = _getFullDataById(idPengajuan);
            if (byId) {
                return { data: byId, reason: '', matchedBy: 'id' };
            }
        }

        var sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) {
            return { data: null, reason: 'Sheet LogData tidak tersedia.', matchedBy: '' };
        }

        var data = sheet.getDataRange().getValues();
        var headers = data.shift();
        var targetKey = _activityKey(
            uploadData.npm || uploadData.NPM || '',
            uploadData.jenisKegiatan || uploadData.JenisKegiatan || '',
            uploadData.detail || uploadData.Detail || '',
            uploadData.tanggal || uploadData.Tanggal || ''
        );

        if (!targetKey) {
            return { data: null, reason: 'Kunci pencarian data upload tidak lengkap.', matchedBy: '' };
        }

        for (var i = data.length - 1; i >= 0; i--) {
            var rowObj = buildRowObjectFromHeaders(headers, data[i]);
            var activity = extractCheckActivityFromRowData(rowObj);
            var rowKey = _activityKey(
                rowObj.NPM || '',
                rowObj['Jenis Kegiatan'] || '',
                activity.detail || '',
                activity.tanggal || ''
            );
            if (rowKey === targetKey) {
                return { data: rowObj, reason: '', matchedBy: 'activity' };
            }
        }

        return { data: null, reason: 'Data LogData untuk upload ini tidak ditemukan.', matchedBy: '' };
    } catch (e) {
        return { data: null, reason: e && e.message ? e.message : String(e), matchedBy: '' };
    }
}

/**
 * Membuat PDF ACC final, mengirimkannya ke Bagian, dan mengembalikan URL PDF.
 * @param {Object} studentData - Objek data mahasiswa dari LogData.
 * @returns {Object} Hasil proses PDF final dan email ke Bagian.
 */
function _sendAccNotificationAndGetUrl(studentData) {
    try {
        if (!studentData || !studentData.NPM) {
            return {
                success: false,
                pdfUrl: '',
                emailSent: false,
                bagianEmail: '',
                bagianName: '',
                message: 'Data mahasiswa untuk PDF final tidak tersedia.'
            };
        }

        const enhancedData = enhanceDataForTemplate(studentData);
        const pdfBlob = _createPdfFromTemplate(TEMPLATE_ACC_ID, enhancedData, 'Final');

        // Simpan PDF ke Drive
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const savedFile = folder.createFile(pdfBlob).setName(pdfBlob.getName());
        trySetDriveFileSharing(savedFile);
        const attachmentUrl = savedFile.getUrl();

        const studentName = studentData['Nama Lengkap'];

        // Email untuk Bagian
        const bagianMap = getBagianEmailMap();
        const bagianCandidates = getBagianLookupCandidates(studentData);
        const bagianMatch = resolveBagianEmailFromCandidates(bagianCandidates, bagianMap);
        const bagianName = bagianMatch.name || (bagianCandidates.length ? bagianCandidates[0] : '');
        const bagianEmail = bagianMatch.email || '';

        if (bagianEmail) {
            const bagianSubject = `Pemberitahuan ACC Final INHAL Mahasiswa - ${studentName}`;
            const bagianBody = `Assalamu'alaikum Admin Bagian ${bagianName}.

Terlampir adalah bukti ACC final pendaftaran INHAL.
Mohon segera ditindak lanjuti.

Data Mahasiswa:
Nama: ${studentName}
NPM: ${studentData.NPM}

Terimakasih,

Wassalamu'alaikum
Admin Prodi`;
            MailApp.sendEmail({ to: bagianEmail, subject: bagianSubject, body: bagianBody, attachments: [pdfBlob] });
            console.log('✅ Final ACC email sent to Bagian:', bagianEmail);
            return {
                success: true,
                pdfUrl: attachmentUrl,
                emailSent: true,
                bagianEmail: bagianEmail,
                bagianName: bagianName,
                message: ''
            };
        } else {
            console.warn(`Email untuk Bagian '${bagianName}' tidak ditemukan.`);
            return {
                success: false,
                pdfUrl: attachmentUrl,
                emailSent: false,
                bagianEmail: '',
                bagianName: bagianName,
                message: "Email untuk Bagian '" + (bagianName || '-') + "' tidak ditemukan."
            };
        }
    } catch (e) {
        console.error('❌ Error in _sendAccNotificationAndGetUrl:', e.stack);
        return {
            success: false,
            pdfUrl: '',
            emailSent: false,
            bagianEmail: '',
            bagianName: '',
            message: e && e.message ? e.message : String(e)
        };
    }
}

/**
 * Menyimpan hasil pengiriman email ACC final secara terpisah dari URL PDF.
 * URL PDF menyatakan berkas tersedia; kolom ini menyatakan email benar-benar terkirim.
 */
function _updateBagianNotificationStatus(idPengajuan, status, email, message) {
    try {
        if (!idPengajuan) return;
        const sheet = getGlobalSpreadsheet().getSheetByName(CHECK_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 1) return;

        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const find = (name) => headers.indexOf(name);
        let statusCol = find('Status Info Bagian');
        if (statusCol === -1) {
            statusCol = headers.length;
            sheet.getRange(1, statusCol + 1).setValue('Status Info Bagian');
            headers.push('Status Info Bagian');
        }
        let timeCol = find('Waktu Info Bagian');
        if (timeCol === -1) {
            timeCol = headers.length;
            sheet.getRange(1, timeCol + 1).setValue('Waktu Info Bagian');
            headers.push('Waktu Info Bagian');
        }
        let emailCol = find('Email Bagian');
        if (emailCol === -1) {
            emailCol = headers.length;
            sheet.getRange(1, emailCol + 1).setValue('Email Bagian');
            headers.push('Email Bagian');
        }
        let noteCol = find('Catatan Info Bagian');
        if (noteCol === -1) {
            noteCol = headers.length;
            sheet.getRange(1, noteCol + 1).setValue('Catatan Info Bagian');
        }

        const idCol = find('ID Pengajuan');
        if (idCol === -1) return;
        const values = sheet.getRange(2, idCol + 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
        for (let i = 0; i < values.length; i++) {
            if (String(values[i][0] || '').trim() === String(idPengajuan).trim()) {
                const row = i + 2;
                sheet.getRange(row, statusCol + 1).setValue(status || 'Belum dikirim');
                sheet.getRange(row, timeCol + 1).setValue(new Date());
                sheet.getRange(row, emailCol + 1).setValue(email || '');
                sheet.getRange(row, noteCol + 1).setValue(message || '');
                return;
            }
        }
    } catch (e) {
        console.error('Error _updateBagianNotificationStatus: ' + e.message);
    }
}

/**
 * Menyimpan URL PDF final ke sheet CheckData di kolom 'Link Final' (Kolom O).
 * @param {string} idPengajuan - ID unik untuk menemukan baris yang benar.
 * @param {string} url - URL PDF yang akan disimpan.
 */
function _updateFinalLinkInCheckData(idPengajuan, url) {
    try {
        if (!idPengajuan || !url) return;

        const sheet = getGlobalSpreadsheet().getSheetByName(CHECK_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) return;
        
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const idCol = headers.indexOf('ID Pengajuan');
        const linkCol = headers.indexOf('Link Final');

        if (idCol === -1 || linkCol === -1) {
            console.error("'ID Pengajuan' or 'Link Final' column not found in CheckData.");
            return;
        }

        const data = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < data.length; i++) {
            if ((data[i][0] || '').toString().trim() === idPengajuan) {
                const rowIndex = i + 2;
                sheet.getRange(rowIndex, linkCol + 1).setValue(url);
                console.log(`✅ Final PDF link saved to CheckData row ${rowIndex} for ID ${idPengajuan}`);
                return;
            }
        }
        console.warn(`ID Pengajuan ${idPengajuan} not found in CheckData to save final link.`);
    } catch(e) {
        console.error('❌ Error in _updateFinalLinkInCheckData:', e.stack);
    }
}

function collectPraktikumEntries(getValue) {
    var entries = [];
    for (var i = 1; i <= 9; i++) {
        var lab = getValue('Pilihan LAB ' + i) || '';
        var keg = getValue('Kegiatan LAB ' + i) || '';
        var tgl = getValue('Tanggal Praktikum ' + i) || getValue('Tanggal Praktkum ' + i) || '';
        if (lab || keg) {
            entries.push({
                desc: lab && keg ? lab + ' - ' + keg : (lab || keg),
                tgl: tgl
            });
        }
    }
    return entries;
}

function getFirstPraktikumTanggal(entries) {
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].tgl) return entries[i].tgl;
    }
    return '';
}

function extractCheckActivityFromRowData(rowData) {
    var jenis = String(rowData['Jenis Kegiatan'] || '').trim();
    var detail = '';
    var tanggal = '';

    if (jenis === 'Ujian') {
        detail = rowData['Pilihan Ujian'] || '';
        tanggal = rowData['Tanggal Ujian'] || '';
    } else if (jenis === 'SGD') {
        var sgdParts = [];
        if (rowData['Pilihan SGD']) sgdParts.push(rowData['Pilihan SGD']);
        if (rowData['Detail SGD']) sgdParts.push(rowData['Detail SGD']);
        detail = sgdParts.join(' - ');
        tanggal = rowData['Tanggal SGD'] || '';
    } else if (jenis === 'KKD') {
        var kkdParts = [];
        if (rowData['Pilihan KKD']) kkdParts.push(rowData['Pilihan KKD']);
        if (rowData['Detail KKD']) kkdParts.push(rowData['Detail KKD']);
        detail = kkdParts.join(' - ');
        tanggal = rowData['Tanggal KKD'] || '';
    } else if (jenis === 'Praktikum') {
        var praktikumEntries = collectPraktikumEntries(function(headerName) {
            return rowData[headerName] || '';
        });
        detail = praktikumEntries.map(function(entry) { return entry.desc; }).join('; ');
        tanggal = getFirstPraktikumTanggal(praktikumEntries);
    }

    return {
        jenis: jenis,
        detail: detail || '',
        tanggal: tanggal || ''
    };
}

function _upsertCheckDataFromLogRow(rowData, overrides) {
    try {
        if (!rowData) {
            return { success: false, message: 'Data LogData tidak tersedia.' };
        }

        var sheet = getGlobalSpreadsheet().getSheetByName(CHECK_SHEET_NAME);
        if (!sheet) {
            return { success: false, message: 'Sheet CheckData tidak ditemukan.' };
        }
        if (sheet.getLastRow() < 1) {
            return { success: false, message: 'Header CheckData belum tersedia.' };
        }

        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var idxId = headers.indexOf('ID Pengajuan');
        var idxNpm = headers.indexOf('NPM');
        var idxNama = headers.indexOf('Nama Lengkap');
        var idxJenis = headers.indexOf('Jenis Kegiatan');
        var idxDetail = headers.indexOf('Detail Kegiatan');
        var idxTanggal = headers.indexOf('Tanggal');
        var idxStatusFinal = headers.indexOf('Status Final');
        var idxStatus = idxStatusFinal === -1 ? headers.indexOf('Status') : -1;
        var idxCatatan = headers.indexOf('Catatan Admin');
        var idxKet = headers.indexOf('Keterangan');
        var idxLinkSurat = headers.indexOf('Link Surat');
        var idxLinkFinal = headers.indexOf('Link Final');
        var idxTs = headers.indexOf('Timestamp');

        if (idxNpm === -1) {
            return { success: false, message: 'Kolom NPM tidak ditemukan di CheckData.' };
        }

        var activity = extractCheckActivityFromRowData(rowData);
        var idPengajuan = String((overrides && overrides.idPengajuan) || rowData['ID Pengajuan'] || '').trim();
        var npm = String(rowData['NPM'] || '').trim();
        var nama = rowData['Nama Lengkap'] || '';
        var jenis = (overrides && overrides.jenis !== undefined) ? overrides.jenis : activity.jenis;
        var detail = (overrides && overrides.detail !== undefined) ? overrides.detail : activity.detail;
        var tanggal = (overrides && overrides.tanggal !== undefined) ? overrides.tanggal : activity.tanggal;
        var statusFinal = (overrides && overrides.statusFinal !== undefined) ? overrides.statusFinal : (rowData['Status'] || 'Menunggu');
        var catatanAdmin = (overrides && overrides.catatanAdmin !== undefined) ? overrides.catatanAdmin : (rowData['Catatan Admin'] || rowData['Catatan'] || rowData['Keterangan'] || '');
        var keterangan = (overrides && overrides.keterangan !== undefined) ? overrides.keterangan : (rowData['Keterangan'] || '');
        var linkSurat = (overrides && overrides.linkSurat !== undefined) ? overrides.linkSurat : (rowData['Link Surat Keterangan'] || rowData['Link Surat'] || '');
        var linkFinal = (overrides && overrides.linkFinal !== undefined) ? overrides.linkFinal : '';

        var foundRow = -1;
        if (sheet.getLastRow() > 1) {
            var lastRow = sheet.getLastRow();
            if (idxId !== -1 && idPengajuan) {
                var idValues = sheet.getRange(2, idxId + 1, lastRow - 1, 1).getDisplayValues();
                for (var i = 0; i < idValues.length; i++) {
                    if (String(idValues[i][0] || '').trim() === idPengajuan) {
                        foundRow = i + 2;
                        break;
                    }
                }
            }

            if (foundRow === -1) {
                var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
                for (var r = data.length - 1; r >= 0; r--) {
                    var row = data[r];
                    var rowNpm = String(row[idxNpm] || '').trim();
                    var rowJenis = idxJenis !== -1 ? String(row[idxJenis] || '').trim() : '';
                    var rowDetail = idxDetail !== -1 ? String(row[idxDetail] || '').trim() : '';
                    var rowTanggal = idxTanggal !== -1 ? row[idxTanggal] || '' : '';
                    if (rowNpm === npm &&
                        String(rowJenis || '').trim() === String(jenis || '').trim() &&
                        String(rowDetail || '').trim() === String(detail || '').trim() &&
                        String(rowTanggal || '').trim() === String(tanggal || '').trim()) {
                        foundRow = r + 2;
                        break;
                    }
                }
            }
        }

        var targetRow;
        if (foundRow > 0) {
            targetRow = sheet.getRange(foundRow, 1, 1, sheet.getLastColumn()).getValues()[0];
        } else {
            targetRow = [];
            for (var c = 0; c < headers.length; c++) {
                targetRow[c] = '';
            }
        }

        if (idxId !== -1) targetRow[idxId] = idPengajuan;
        if (idxNpm !== -1) targetRow[idxNpm] = npm;
        if (idxNama !== -1) targetRow[idxNama] = nama;
        if (idxJenis !== -1) targetRow[idxJenis] = jenis;
        if (idxDetail !== -1) targetRow[idxDetail] = detail;
        if (idxTanggal !== -1) targetRow[idxTanggal] = tanggal;
        if (idxStatusFinal !== -1) targetRow[idxStatusFinal] = statusFinal;
        if (idxStatus !== -1) targetRow[idxStatus] = statusFinal;
        if (idxCatatan !== -1) targetRow[idxCatatan] = catatanAdmin || '';
        if (idxKet !== -1 && keterangan !== undefined && keterangan !== null && String(keterangan).trim() !== '') targetRow[idxKet] = keterangan;
        if (idxLinkSurat !== -1 && linkSurat) targetRow[idxLinkSurat] = linkSurat;
        if (idxLinkFinal !== -1 && linkFinal) targetRow[idxLinkFinal] = linkFinal;
        if (idxTs !== -1) targetRow[idxTs] = new Date();

        if (foundRow > 0) {
            sheet.getRange(foundRow, 1, 1, sheet.getLastColumn()).setValues([targetRow]);
            return { success: true, rowIndex: foundRow, created: false };
        }

        sheet.appendRow(targetRow);
        return { success: true, rowIndex: sheet.getLastRow(), created: true };
    } catch (e) {
        console.error('❌ Error in _upsertCheckDataFromLogRow:', e && e.stack ? e.stack : e);
        return { success: false, message: e && e.message ? e.message : String(e) };
    }
}


// ============== FUNGSI UPLOAD ================
function trySetDriveFileSharing(file) {
    try {
        if (file && file.setSharing) {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
        return { success: true, message: '' };
    } catch (e) {
        console.warn('Gagal mengubah sharing file Drive:', e.message);
        return { success: false, message: e.message || 'Gagal mengubah akses file' };
    }
}

function uploadSuratKeterangan(fileData, rowId) {
  try {
    requireAuthorized();

    if (!fileData || !fileData.base64) {
      throw new Error("Data file tidak valid.");
    }
    if (!rowId) {
      throw new Error("ID baris tidak ditemukan.");
    }

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.type, fileData.name);
    const file = folder.createFile(blob);
    trySetDriveFileSharing(file);
    const fileUrl = file.getUrl();

    const ss = getGlobalSpreadsheet();
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const logHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
    
    // --- Pencarian header yang lebih tangguh untuk LogData ---
    let linkSuratCol = -1;
    const targetHeader = "link surat keterangan";
    for (let i = 0; i < logHeaders.length; i++) {
        if (String(logHeaders[i]).toLowerCase().trim() === targetHeader) {
            linkSuratCol = i;
            break;
        }
    }

    if (linkSuratCol === -1) {
      throw new Error("Kolom 'Link Surat Keterangan' tidak ditemukan di LogData.");
    }

    // 1. Perbarui sheet LogData
    logSheet.getRange(rowId, linkSuratCol + 1).setValue(fileUrl);

    // 2. Perbarui juga sheet CheckData agar dashboard sinkron
    try {
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);
        if (checkSheet && checkSheet.getLastRow() > 1) {
            const idPengajuanColIdx = logHeaders.indexOf('ID Pengajuan');
            if (idPengajuanColIdx !== -1) {
                const idPengajuan = logSheet.getRange(rowId, idPengajuanColIdx + 1).getValue();
                if (idPengajuan) {
                    const checkHeaders = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn()).getValues()[0];
                    const checkIdCol = checkHeaders.indexOf('ID Pengajuan');
                    const checkLinkSuratCol = checkHeaders.indexOf('Link Surat');
                    if (checkIdCol !== -1 && checkLinkSuratCol !== -1) {
                        const checkIdValues = checkSheet.getRange(2, checkIdCol + 1, checkSheet.getLastRow() - 1, 1).getValues();
                        for (let i = 0; i < checkIdValues.length; i++) {
                            if (String(checkIdValues[i][0]).trim() === String(idPengajuan).trim()) {
                                checkSheet.getRange(i + 2, checkLinkSuratCol + 1).setValue(fileUrl);
                                break;
                            }
                        }
                    }
                }
            }
        }
    } catch(e) {
        console.warn("Gagal memperbarui Link Surat di CheckData: " + e.message);
    }

    _clearCheckPageCache();
    const npmCol = logHeaders.indexOf('NPM');
    if (npmCol !== -1) {
        const npm = logSheet.getRange(rowId, npmCol + 1).getValue();
        if (npm) _clearStudentPortalCache(npm);
    }

    return { ok: true, url: fileUrl };
  } catch (e) {
    console.error('Error in uploadSuratKeterangan:', e);
    return { ok: false, error: e.message };
  }
}

function processUpload(uploadData) {
    try {
        console.log("Mencoba mengakses folder ID: " + FOLDER_ID);
        const folder = DriveApp.getFolderById(FOLDER_ID);
        console.log("Folder ditemukan: " + folder.getName());

        if (!uploadData || !uploadData.npm) {
            return { success: false, message: 'Data NPM tidak ditemukan' };
        }

        let accUrl = '', buktiUrl = '';
        const uploadWarnings = [];

        // ACC
        if (uploadData.fileAcc && uploadData.fileAcc.base64) {
            const blob = Utilities.newBlob(
                Utilities.base64Decode(uploadData.fileAcc.base64),
                uploadData.fileAcc.type,
                uploadData.fileAcc.name
            );
            const file = folder.createFile(blob);
            file.setName(uploadData.npm + '_ACC_' + Date.now());
            const shareResultAcc = trySetDriveFileSharing(file);
            if (!shareResultAcc.success) {
                uploadWarnings.push('Akses publik file ACC tidak dapat diatur otomatis');
            }
            accUrl = file.getUrl();
        }

        // Bukti Bayar
        if (uploadData.fileBukti && uploadData.fileBukti.base64) {
            const blob = Utilities.newBlob(
                Utilities.base64Decode(uploadData.fileBukti.base64),
                uploadData.fileBukti.type,
                uploadData.fileBukti.name
            );
            const file = folder.createFile(blob);
            file.setName(uploadData.npm + '_BUKTI_' + Date.now());
            const shareResultBukti = trySetDriveFileSharing(file);
            if (!shareResultBukti.success) {
                uploadWarnings.push('Akses publik file bukti bayar tidak dapat diatur otomatis');
            }
            buktiUrl = file.getUrl();
        }

        const saveResult = _saveToLogUpload(uploadData, accUrl, buktiUrl);
        if (!saveResult || !saveResult.success) {
            return {
                success: false,
                message: 'File berhasil diupload ke Drive, tetapi pencatatan ke sheet gagal. ' + ((saveResult && saveResult.message) ? saveResult.message : '')
            };
        }

        var finalUrl = '';
        var finalMessage = '';
        var finalData = _getFullDataForUpload(uploadData);
        var finalIdPengajuan = '';

        if (!finalData || !finalData.data) {
            _clearStudentPortalCache(uploadData.npm);
            _clearCheckPageCache();
            return {
                success: false,
                message: 'File berhasil diupload, tetapi data pengajuan untuk membuat ACC final tidak ditemukan. ' + (finalData && finalData.reason ? finalData.reason : '')
            };
        }

        finalIdPengajuan = finalData.data['ID Pengajuan'] || uploadData.idPengajuan || uploadData.IdPengajuan || '';
        if (!finalIdPengajuan) {
            _clearStudentPortalCache(uploadData.npm);
            _clearCheckPageCache();
            return {
                success: false,
                message: 'File berhasil diupload, tetapi ID Pengajuan untuk ACC final tidak ditemukan.'
            };
        }

        var finalResult = _sendAccNotificationAndGetUrl(finalData.data);
        _updateBagianNotificationStatus(
            finalIdPengajuan,
            finalResult && finalResult.emailSent ? 'Terkirim' : 'Gagal',
            finalResult && finalResult.bagianEmail,
            finalResult && finalResult.message
        );
        if (finalResult && finalResult.pdfUrl) {
            finalUrl = finalResult.pdfUrl;
            _updateFinalLinkInCheckData(finalIdPengajuan, finalUrl);
        }

        if (!finalResult || !finalResult.success) {
            finalMessage = finalResult && finalResult.message ? finalResult.message : 'PDF final atau email ke Bagian gagal diproses.';
            _clearStudentPortalCache(uploadData.npm);
            _clearCheckPageCache();
            return {
                success: false,
                message: 'File berhasil diupload, tetapi ACC final belum selesai diproses. ' + finalMessage,
                linkFinal: finalUrl || ''
            };
        }

        _clearStudentPortalCache(uploadData.npm);
        _clearCheckPageCache();

        return {
            success: true,
            message: uploadWarnings.length ? ('Upload berhasil. ' + uploadWarnings.join('. ')) : 'Upload berhasil',
            linkFinal: finalUrl || ''
        };

    } catch (e) {
        console.error("DEBUG ERROR: " + e.message);
        return { success: false, message: 'Gagal: ' + e.message };
    }
}

function _activityKey(npm, jenis, detail, tanggal) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normDate = (v) => {
        try {
            if (!v) return '';
            if (v && Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
                const y = v.getFullYear();
                const m = String(v.getMonth() + 1).padStart(2, '0');
                const day = String(v.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
            const s = String(v).trim();
            let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (m) return s;
            m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (m) {
                let d = m[1], mo = m[2], y = m[3];
                if (y.length < 4) y = '20' + y;
                return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        } catch (e) { }
        return norm(v);
    };
    return `${norm(npm)}|${norm(jenis)}|${norm(detail)}|${normDate(tanggal)}`;
}

// =================================================================
// ============== API UNTUK PORTAL MAHASISWA (info.html) ===========
// =================================================================
function getStudentPortalData(npm, options) {
    try {
        if (!npm) return { error: "NPM tidak boleh kosong" };
        var npmVal = String(npm).trim();
        var cacheKey = _getStudentPortalCacheKey(npmVal);
        var forceFresh = !!(options && options.fresh);
        if (!forceFresh) {
            try {
                var cache = CacheService.getScriptCache();
                var cached = cache.get(cacheKey);
                if (cached) {
                    var parsed = JSON.parse(cached);
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.history)) return parsed;
                }
            } catch (e) { }
        } else {
            try {
                CacheService.getScriptCache().remove(cacheKey);
            } catch (e) { }
        }
        var dashboardPayload = _getCheckPageData({ skipCache: forceFresh });
        if (!dashboardPayload || dashboardPayload.error) {
            return { error: "Terjadi kesalahan saat mengambil data portal: " + ((dashboardPayload && dashboardPayload.error) || 'Payload dashboard tidak tersedia') };
        }

        var rows = Array.isArray(dashboardPayload.rows) ? dashboardPayload.rows : [];
        var namaLengkap = '';
        var history = [];

        function inferJenisDanDetail(row) {
            var jenis = String((row && (row.JenisDasar || row.jenis || '')) || '').trim();
            var detail = String((row && (row.DetailKegiatanPortal || row.detail || '')) || '').trim();
            if (jenis) return { jenis: jenis, detail: detail };

            var combined = String((row && (row['Jenis Kegiatan'] || row.JenisKegiatan || '')) || '').trim();
            var knownJenis = ['Praktikum', 'SGD', 'KKD', 'Ujian'];
            for (var i = 0; i < knownJenis.length; i++) {
                var prefix = knownJenis[i] + ' - ';
                if (combined.indexOf(prefix) === 0) {
                    return {
                        jenis: knownJenis[i],
                        detail: combined.substring(prefix.length).trim()
                    };
                }
            }
            return { jenis: combined, detail: detail };
        }

        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var rowNpm = String((row && row.NPM) || '').trim();
            if (rowNpm !== npmVal) continue;

            if (!namaLengkap && row['Nama Lengkap']) {
                namaLengkap = String(row['Nama Lengkap']).trim();
            }

            var parsed = inferJenisDanDetail(row);
            var hasUpload = !!(row.accInhal || row.buktiBayar || row.LinkACC || row.LinkFinal || row.uploadTimestamp);
            history.push({
                id: row.idPengajuan || ('row:' + (row.originalRowIndex || (r + 2))),
                rowIndex: row.originalRowIndex || (r + 2),
                idPengajuan: row.idPengajuan || '',
                tanggalAjuan: row.Timestamp || '',
                blok: row.Blok || '',
                jenis: parsed.jenis || '',
                detail: parsed.detail || '',
                tanggalKegiatan: row.TanggalKegiatan || '',
                status: row.Status || 'Menunggu',
                reason: row['Catatan Admin'] || '',
                hasUpload: hasUpload,
                linkFinal: row.LinkFinal || '',
                uploadTimestamp: row.uploadTimestamp || (hasUpload ? 'Uploaded' : '')
            });
        }

        if (!namaLengkap) {
            namaLengkap = _lookupStudentNameByNpm(npmVal);
        }

        if (!namaLengkap && history.length === 0) {
            return { error: "Data pengajuan tidak ditemukan untuk NPM " + npmVal };
        }

        var payload = {
            nama: namaLengkap || 'Mahasiswa',
            npm: npmVal,
            history: history.sort(function(a, b) { return (b.rowIndex || 0) - (a.rowIndex || 0); })
        };
        if (!forceFresh) {
            try {
                _setCacheChunked(CacheService.getScriptCache(), cacheKey, JSON.stringify(payload), CACHE_EXPIRATION);
            } catch (e) { }
        }
        return payload;
    } catch (e) {
        console.error("Error getStudentPortalData:", e.stack);
        return { error: "Terjadi kesalahan saat mengambil data portal: " + e.message };
    }
}

function _saveUploadToCheckData(uploadData, accUrl, buktiUrl) {
    try {
        const ss = getGlobalSpreadsheet();
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);
        if (!checkSheet) throw new Error(`Sheet "${CHECK_SHEET_NAME}" tidak ditemukan.`);

        const headers = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn()).getValues()[0];
        const getIdx = (name) => headers.indexOf(name);
        
        const idxId = getIdx('ID Pengajuan');
        const idxNpm = getIdx('NPM');
        const idxAcc = getIdx('ACC INHAL');
        const idxBukti = getIdx('Bukti Bayar');

        if (idxId === -1 || idxNpm === -1) {
            throw new Error("Kolom 'ID Pengajuan' atau 'NPM' tidak ditemukan di CheckData.");
        }

        const idPengajuan = uploadData.idPengajuan || uploadData.IdPengajuan || '';
        
        // Find existing row by ID Pengajuan
        let foundRow = -1;
        if (checkSheet.getLastRow() > 1) {
            const idColumn = checkSheet.getRange(2, idxId + 1, checkSheet.getLastRow() - 1, 1).getValues();
            for (let i = 0; i < idColumn.length; i++) {
                if ((idColumn[i][0] || '').toString().trim() === idPengajuan) {
                    foundRow = i + 2;
                    break;
                }
            }
        }
        
        if (foundRow !== -1) {
            // Update existing row
            if (idxAcc > -1) checkSheet.getRange(foundRow, idxAcc + 1).setValue(accUrl);
            if (idxBukti > -1) checkSheet.getRange(foundRow, idxBukti + 1).setValue(buktiUrl);
        } else {
            // Append new row if not found
            const newRow = new Array(headers.length).fill('');
            newRow[idxId] = idPengajuan;
            newRow[idxNpm] = uploadData.npm || uploadData.NPM;
            
            const idxNama = getIdx('Nama Lengkap');
            const idxBlok = getIdx('Blok');
            const idxJenis = getIdx('Jenis Kegiatan');
            const idxDetail = getIdx('Detail Kegiatan');
            const idxTanggal = getIdx('Tanggal');
            const idxStatus = getIdx('Status Final');

            if (idxNama > -1) newRow[idxNama] = uploadData.namaLengkap || uploadData.NamaLengkap || '';
            if (idxBlok > -1) newRow[idxBlok] = uploadData.blok || uploadData.Blok || '';
            if (idxJenis > -1) newRow[idxJenis] = uploadData.jenisKegiatan || uploadData.JenisKegiatan || '';
            if (idxDetail > -1) newRow[idxDetail] = uploadData.detail || uploadData.Detail || '';
            if (idxTanggal > -1) newRow[idxTanggal] = uploadData.tanggal || uploadData.Tanggal || '';
            if (idxStatus > -1) newRow[idxStatus] = 'ACC'; // Set default status for new entries from upload
            
            if (idxAcc > -1) newRow[idxAcc] = accUrl;
            if (idxBukti > -1) newRow[idxBukti] = buktiUrl;
            
            checkSheet.appendRow(newRow);
        }
        return { success: true, message: 'Data upload berhasil disimpan ke CheckData.' };

    } catch (e) {
        console.error("Error _saveUploadToCheckData:", e.stack);
        return { success: false, message: e.message };
    }
}


function checkExactDuplicate(formData) {
    try {
        const normalize = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
        
        const buildKey = (fd) => {
             const npm = String(fd.npm || '').trim();
             const jenis = normalize(fd.jenisKegiatan);
             let detail = '';
             let tanggal = '';
             if (jenis === 'ujian') {
                 detail = normalize(fd.detailKegiatan);
                 tanggal = normalize(fd.tanggalKegiatan);
             } else if (jenis === 'sgd') {
                 detail = [normalize(fd.pilihanSgd), normalize(fd.detailSgd)].filter(Boolean).join(' | ');
                 tanggal = normalize(fd.tanggalKegiatan);
             } else if (jenis === 'kkd') {
                 detail = [normalize(fd.pilihanKkd), normalize(fd.detailKkd)].filter(Boolean).join(' | ');
                 tanggal = normalize(fd.tanggalKegiatan);
             } else if (jenis === 'praktikum' && fd.praktikum && fd.praktikum.length > 0) {
                 // Gabungkan SEMUA entri praktikum agar duplikat multi-lab terdeteksi
                 const parts = fd.praktikum.map(p => {
                     return [normalize(p.lab), normalize(p.kegiatanLab), normalize(p.tanggal)].filter(Boolean).join(' | ');
                 }).filter(Boolean).sort();
                 detail = parts.join(' && ');
                 tanggal = normalize(fd.praktikum[0].tanggal);
             }
             return [npm, jenis, detail, tanggal].join('||');
        };

        const searchKey = buildKey(formData);

        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (sheet.getLastRow() < 2) return { isDuplicate: false };

        const data = sheet.getDataRange().getValues();
        const headers = data.shift();

        for (const row of data) {
            const rowData = {};
            headers.forEach((h, i) => rowData[h] = row[i]);
            
            const rowKey = buildKey({
                npm: rowData['NPM'],
                jenisKegiatan: rowData['Jenis Kegiatan'],
                detailKegiatan: rowData['Pilihan Ujian'],
                tanggalKegiatan: rowData['Tanggal Ujian'] || rowData['Tanggal SGD'] || rowData['Tanggal KKD'],
                pilihanSgd: rowData['Pilihan SGD'],
                detailSgd: rowData['Detail SGD'],
                pilihanKkd: rowData['Pilihan KKD'],
                detailKkd: rowData['Detail KKD'],
                praktikum: (function() {
                    const entries = [];
                    for (let li = 1; li <= 9; li++) {
                        const lab = rowData['Pilihan LAB ' + li];
                        const keg = rowData['Kegiatan LAB ' + li];
                        const tgl = rowData['Tanggal Praktikum ' + li];
                        if (lab || keg || tgl) {
                            entries.push({ lab: lab, kegiatanLab: keg, tanggal: tgl });
                        }
                    }
                    return entries;
                })()
            });
            if (rowKey === searchKey) {
                return { isDuplicate: true, message: 'Data identik sudah pernah diajukan.' };
            }
        }

        return { isDuplicate: false };
    } catch(e) {
        console.error('Error in checkExactDuplicate:', e.message);
        return { isDuplicate: false, error: e.message }; // Fail open
    }
}
// ============== SCRIPT PROPERTIES & CACHING ==============

function _setCacheChunked(cache, key, value, expirationInSeconds) {
    const chunks = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.substring(i, i + CHUNK_SIZE));
    }
    const chunkKeys = chunks.map((_, i) => `${key}_${i}`);
    const cacheData = {};
    chunks.forEach((chunk, i) => {
        cacheData[chunkKeys[i]] = chunk;
    });
    cacheData[key] = JSON.stringify(chunkKeys); // Store manifest
    cache.putAll(cacheData, expirationInSeconds);
}

function _getCacheChunked(cache, key) {
    const manifestJson = cache.get(key);
    if (!manifestJson) return null;
    try {
        const chunkKeys = JSON.parse(manifestJson);
        const chunks = cache.getAll(chunkKeys);
        let value = '';
        for (const k of chunkKeys) {
            if (!chunks[k]) return null; // Abort if a chunk is missing
            value += chunks[k];
        }
        return value;
    } catch (e) {
        return null;
    }
}

function _removeCacheChunked(cache, key) {
    var keysToRemove = [key];
    try {
        var manifestJson = cache.get(key);
        if (manifestJson) {
            var chunkKeys = JSON.parse(manifestJson);
            if (chunkKeys && chunkKeys.length) {
                keysToRemove = keysToRemove.concat(chunkKeys);
            }
        }
    } catch (e) { }

    try {
        cache.removeAll(keysToRemove);
    } catch (e) {
        for (var i = 0; i < keysToRemove.length; i++) {
            try { cache.remove(keysToRemove[i]); } catch (err) { }
        }
    }
}

function _getStudentPortalCacheKey(npm) {
    return 'studentPortalData:v1:' + String(npm || '').replace(/[^0-9A-Za-z_-]/g, '');
}

// ============== RATE LIMITING RINGAN ==============
// Dipakai untuk endpoint publik yang boros (mis. getStudentData / getStudentNameByNpm)
// agar tidak mudah disalahgunakan menghabiskan kuota Apps Script.
// Fail-open: jika CacheService bermasalah, request tetap dilanjutkan.
function _rateLimitAllowed(token, maxCalls, windowSec) {
    try {
        var cache = CacheService.getScriptCache();
        var key = 'rl:' + String(token || 'anon').replace(/[^0-9A-Za-z_-]/g, '');
        var current = parseInt(cache.get(key) || '0', 10);
        if (current >= maxCalls) return false;
        cache.put(key, String(current + 1), windowSec || 60);
        return true;
    } catch (e) {
        return true;
    }
}

function _clearStudentPortalCache(npm) {
    if (!npm) return;
    try {
        CacheService.getScriptCache().remove(_getStudentPortalCacheKey(npm));
    } catch (e) { }
}


function processCheck(finalData) {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);
        if (!checkSheet) {
            throw new Error(`Sheet "${CHECK_SHEET_NAME}" tidak ditemukan.`);
        }

        const headers = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn()).getValues()[0];
        const idx = (name) => headers.indexOf(name);

        const idxNpm = idx('NPM');
        const idxNama = idx('Nama Lengkap');
        const idxJenis = idx('Jenis Kegiatan');
        const idxDetail = idx('Detail Kegiatan');
        const idxTanggal = idx('Tanggal');
        const idxDosen = idx('Dosen');
        const idxTPel = idx('Tanggal Pelaksanaan');
        const idxBiaya = idx('Biaya');
        const idxKet = idx('Keterangan');
        const idxCatatan = idx('Catatan Admin');
        const idxAcc = idx('ACC INHAL');
        const idxBukti = idx('Bukti Bayar');
        const idxStatus = idx('Status Final');
        const idxTs = idx('Timestamp');
        const idxLinkSurat = idx('Link Surat');
        const idxLinkFinal = idx('Link Final');

        if (idxNpm === -1) {
            throw new Error("Kolom 'NPM' tidak ditemukan di CheckData. Proses tidak dapat dilanjutkan.");
        }

        const npm = finalData.NPM;
        const nama = finalData['Nama Lengkap'];
        let jenis = finalData['Jenis Kegiatan'];
        let detailKegiatan = finalData['Detail Kegiatan'];
        let tanggalKegiatan = finalData['Tanggal'];
        let linkSurat = finalData['Link Surat Keterangan'];
        let linkFinalVal = finalData['Link Final'];

        // Ambil data dari LogData untuk memperkaya/memastikan data kanonik
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (logSheet && logSheet.getLastRow() > 1) {
            const data = logSheet.getDataRange().getValues();
            const logHeaders = data.shift();
            const logIdx = (name) => logHeaders.indexOf(name);
            const lNpm = logIdx('NPM');
            let logRow = null;
            for (let i = data.length - 1; i >= 0; i--) {
                if ((data[i][lNpm] || '') == npm) {
                    logRow = data[i];
                    break;
                }
            }

            if (logRow) {
                const getByHeader = (h) => logRow[logHeaders.indexOf(h)] || '';
                jenis = getByHeader('Jenis Kegiatan') || jenis;
                if (jenis === 'SGD') {
                    const p = getByHeader('Pilihan SGD');
                    const d = getByHeader('Detail SGD');
                    detailKegiatan = (p && d ? `${p} - ${d}` : (p || d)) || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal SGD') || tanggalKegiatan;
                } else if (jenis === 'KKD') {
                    const p = getByHeader('Pilihan KKD');
                    const d = getByHeader('Detail KKD');
                    detailKegiatan = (p && d ? `${p} - ${d}` : (p || d)) || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal KKD') || tanggalKegiatan;
                } else if (jenis === 'Ujian') {
                    detailKegiatan = getByHeader('Pilihan Ujian') || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal Ujian') || tanggalKegiatan;
                } else if (jenis === 'Praktikum') {
                    const praktikumEntries = collectPraktikumEntries(getByHeader);
                    if (praktikumEntries.length > 0) {
                        detailKegiatan = praktikumEntries.map(l => l.desc).join('; ');
                        tanggalKegiatan = getFirstPraktikumTanggal(praktikumEntries);
                    }
                }
            }
        }

        let foundRow = -1;
        const last = checkSheet.getLastRow();

        const normalizeText = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
        const cleanDashboardVal = (s) => {
            const n = normalizeText(s);
            return n === '-' ? '' : n;
        };

        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthNamesLower = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
        const normalizeTanggal = (v) => {
            if (!v || v === '-') return '';
            if (v instanceof Date) {
                const d = v.getDate().toString().padStart(2, '0');
                const m = monthNames[v.getMonth()];
                const y = v.getFullYear();
                return `${d}/${m}/${y}`;
            }
            const s = String(v).trim();
            if (s === '-' || s === '') return '';

            let m;
            m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
                const y = parseInt(m[1], 10);
                const mi = parseInt(m[2], 10) - 1;
                const d = m[3].padStart(2, '0');
                return `${d}/${monthNames[mi]}/${y}`;
            }
            m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const mi = parseInt(m[2], 10) - 1;
                const y = m[3];
                if (mi >= 0 && mi < 12) return `${d}/${monthNames[mi]}/${y}`;
            }
            m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const idx = monthNamesLower.indexOf(m[2].toLowerCase());
                if (idx !== -1) return `${d}/${monthNames[idx]}/${m[3]}`;
            }
            m = s.match(/^(\d{1,2})[\/\-]\s*([A-Za-z]+)[\/\-]\s*(\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const idx = monthNamesLower.indexOf(m[2].toLowerCase());
                if (idx !== -1) return `${d}/${monthNames[idx]}/${m[3]}`;
            }
            return s;
        };

        const searchNpm = String(npm).trim();
        const searchJenis = cleanDashboardVal(jenis); 
        const searchDetail = cleanDashboardVal(detailKegiatan);
        const searchTanggal = normalizeTanggal(tanggalKegiatan);

        if (last > 1) {
            const range = checkSheet.getRange(2, 1, last - 1, checkSheet.getLastColumn()).getValues();

            for (let r = 0; r < range.length; r++) {
                const row = range[r];
                const rowNpm = String(row[idxNpm] || '').trim();
                const rowJenis = cleanDashboardVal(row[idxJenis] || '');
                const rowDetail = cleanDashboardVal(row[idxDetail] || '');
                const rowTanggal = normalizeTanggal(row[idxTanggal]);

                if (rowNpm === searchNpm && rowJenis === searchJenis && rowDetail === searchDetail && rowTanggal === searchTanggal) {
                    foundRow = r + 2;
                    break;
                }
            }
            if (foundRow === -1) {
                for (let r = 0; r < range.length; r++) {
                    const row = range[r];
                    const rowNpm = String(row[idxNpm] || '').trim();
                    const rowJenis = cleanDashboardVal(row[idxJenis] || '');
                    const rowDetail = cleanDashboardVal(row[idxDetail] || '');

                    if (rowNpm === searchNpm && rowJenis === searchJenis && rowDetail === searchDetail) {
                        foundRow = r + 2;
                        break;
                    }
                }
            }
        }

        const accVal = finalData.accInhal || finalData['Link ACC INHAL'] || finalData['Link ACC'] || finalData['ACC INHAL'] || '';
        const buktiVal = finalData.buktiBayar || finalData['Link Bukti Bayar'] || finalData['Bukti Bayar'] || '';
        const dosen = finalData.Dosen;
        const tPel = finalData.TanggalPelaksanaan || finalData['Tanggal Pelaksanaan'];
        const biaya = (finalData.BiayaKegiatan != null ? finalData.BiayaKegiatan : (finalData.Biaya != null ? finalData.Biaya : undefined));
        const ket = finalData.Keterangan;
        const catatanAdmin = finalData['Catatan Admin'];
        const detail = detailKegiatan || finalData['Detail Kegiatan'] || '';
        const tglAsli = tanggalKegiatan || finalData['Tanggal'] || '';
        const linkSuratVal = linkSurat || finalData['Link Surat'] || '';
        const statusFinal = finalData['Status Final'] || 'Belum ACC';

        if (foundRow > 0) {
            const existing = checkSheet.getRange(foundRow, 1, 1, checkSheet.getLastColumn()).getValues()[0];
            if (dosen !== undefined) existing[idxDosen] = dosen;
            if (tPel !== undefined) existing[idxTPel] = tPel;
            if (biaya !== undefined) existing[idxBiaya] = biaya;
            if (idxKet !== -1 && ket !== undefined && catatanAdmin === undefined) existing[idxKet] = ket;
            if (idxCatatan !== -1 && catatanAdmin !== undefined) existing[idxCatatan] = catatanAdmin;
            if (idxDetail !== -1 && detail) existing[idxDetail] = detail;
            if (idxTanggal !== -1 && tglAsli) existing[idxTanggal] = tglAsli;
            if (idxLinkSurat !== -1 && linkSuratVal) existing[idxLinkSurat] = linkSuratVal;
            if (idxAcc !== -1 && accVal) existing[idxAcc] = accVal;
            if (idxBukti !== -1 && buktiVal) existing[idxBukti] = buktiVal;
            if (idxStatus !== -1) existing[idxStatus] = statusFinal;
            if (idxLinkFinal !== -1 && linkFinalVal) existing[idxLinkFinal] = linkFinalVal;
            if (idxTs !== -1) existing[idxTs] = new Date();
            checkSheet.getRange(foundRow, 1, 1, checkSheet.getLastColumn()).setValues([existing]);
        } else {
            const values = [];
            values[idxNpm] = npm;
            values[idxNama] = nama;
            values[idxJenis] = jenis;
            values[idxDetail] = detail;
            values[idxTanggal] = tglAsli;
            if (idxCatatan !== -1) values[idxCatatan] = catatanAdmin || '';
            if (idxKet !== -1 && catatanAdmin === undefined) values[idxKet] = ket || '';
            values[idxLinkSurat] = linkSuratVal;
            values[idxAcc] = accVal;
            values[idxBukti] = buktiVal;
            values[idxDosen] = dosen || '';
            values[idxTPel] = tPel || '';
            values[idxBiaya] = biaya || '';
            if (idxStatus !== -1) values[idxStatus] = statusFinal;
            if (idxLinkFinal !== -1) values[idxLinkFinal] = linkFinalVal;
            if (idxTs !== -1) values[idxTs] = new Date();
            checkSheet.appendRow(values);
        }

        _clearCheckPageCache();
        return { success: true, message: 'Data ACC final berhasil disimpan.' };
    } catch (e) {
        console.error('Error in processCheck:', e);
        return { success: false, message: 'Gagal memproses ACC Final: ' + e.message };
    }
}

function updateCheckDataPartial(payload) {
    try {
        requireAuthorized();
        const npm = payload.NPM || payload.npm;
        if (!npm) {
            throw new Error('NPM tidak tersedia pada payload.');
        }

        const ss = getGlobalSpreadsheet();
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);
        if (!checkSheet || checkSheet.getLastRow() < 2) {
            return { success: false, message: 'CheckData tidak tersedia.' };
        }

        const headers = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn()).getValues()[0];
        const idxNpm = headers.indexOf('NPM');
        const idxJenis = headers.indexOf('Jenis Kegiatan');
        const idxDetail = headers.indexOf('Detail Kegiatan');
        const idxTanggal = headers.indexOf('Tanggal');
        const idxDosen = headers.indexOf('Dosen');
        const idxTPel = headers.indexOf('Tanggal Pelaksanaan');
        const idxBiaya = headers.indexOf('Biaya');

        if (idxNpm === -1) {
            return { success: false, message: 'Kolom NPM tidak ditemukan di CheckData.' };
        }

        let jenis = payload['Jenis Kegiatan'] || payload.jenisKegiatan || '';
        let detailKegiatan = payload.Detail || payload.DetailKegiatan || payload['Detail Kegiatan'] || '';
        let tanggalKegiatan = payload.TanggalKegiatan || payload['Tanggal Kegiatan'] || payload['Tanggal'] || '';

        if (logSheet && logSheet.getLastRow() > 1) {
            const data = logSheet.getDataRange().getValues();
            const logHeaders = data.shift();
            const idxN = logHeaders.indexOf('NPM');
            let logRow = null;
            for (let i = data.length - 1; i >= 0; i--) {
                if ((data[i][idxN] || '') == npm) {
                    logRow = data[i];
                    break;
                }
            }
            if (logRow) {
                const getByHeader = (h) => logRow[logHeaders.indexOf(h)] || '';
                jenis = getByHeader('Jenis Kegiatan') || jenis;
                if (jenis === 'SGD') {
                    const p = getByHeader('Pilihan SGD');
                    const d = getByHeader('Detail SGD');
                    detailKegiatan = (p && d ? `${p} - ${d}` : (p || d)) || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal SGD') || tanggalKegiatan;
                } else if (jenis === 'KKD') {
                    const p = getByHeader('Pilihan KKD');
                    const d = getByHeader('Detail KKD');
                    detailKegiatan = (p && d ? `${p} - ${d}` : (p || d)) || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal KKD') || tanggalKegiatan;
                } else if (jenis === 'Ujian') {
                    detailKegiatan = getByHeader('Pilihan Ujian') || detailKegiatan;
                    tanggalKegiatan = getByHeader('Tanggal Ujian') || tanggalKegiatan;
                } else if (jenis === 'Praktikum') {
                    const praktikumEntries = collectPraktikumEntries(getByHeader);
                    if (praktikumEntries.length > 0) {
                        detailKegiatan = praktikumEntries.map(l => l.desc).join('; ');
                        tanggalKegiatan = getFirstPraktikumTanggal(praktikumEntries);
                    }
                }
            }
        }

        const normalizeText = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
        const cleanDashboardVal = (s) => {
            const n = normalizeText(s);
            return n === '-' ? '' : n;
        };
        const normalizeLoose = (v) => String(v || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]/g, '');
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthNamesLower = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
        const normalizeTanggal = (v) => {
            if (!v || v === '-') return '';
            if (v instanceof Date) {
                const d = v.getDate().toString().padStart(2, '0');
                const m = monthNames[v.getMonth()];
                const y = v.getFullYear();
                return `${d}/${m}/${y}`;
            }
            const s = String(v).trim();
            if (s === '-' || s === '') return '';
            let m;
            m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
                const y = parseInt(m[1], 10);
                const mi = parseInt(m[2], 10) - 1;
                const d = m[3].padStart(2, '0');
                return `${d}/${monthNames[mi]}/${y}`;
            }
            m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const mi = parseInt(m[2], 10) - 1;
                const y = m[3];
                if (mi >= 0 && mi < 12) return `${d}/${monthNames[mi]}/${y}`;
            }
            m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const idx = monthNamesLower.indexOf(m[2].toLowerCase());
                if (idx !== -1) return `${d}/${monthNames[idx]}/${m[3]}`;
            }
            m = s.match(/^(\d{1,2})[\/\-]\s*([A-Za-z]+)[\/\-]\s*(\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const idx = monthNamesLower.indexOf(m[2].toLowerCase());
                if (idx !== -1) return `${d}/${monthNames[idx]}/${m[3]}`;
            }
            return s;
        };

        const searchNpm = String(npm).trim();
        const searchJenis = cleanDashboardVal(jenis);
        const searchDetail = cleanDashboardVal(detailKegiatan);
        const searchDetailLoose = normalizeLoose(detailKegiatan);
        const searchTanggal = normalizeTanggal(tanggalKegiatan);

        let foundRow = -1;
        const candidates = [];
        const last = checkSheet.getLastRow();
        if (last > 1 && idxNpm !== -1 && idxJenis !== -1 && idxDetail !== -1 && idxTanggal !== -1) {
            const range = checkSheet.getRange(2, 1, last - 1, checkSheet.getLastColumn()).getValues();
            for (let r = 0; r < range.length; r++) {
                const row = range[r];
                const rowNpm = String(row[idxNpm] || '').trim();
                const rowJenis = cleanDashboardVal(row[idxJenis] || '');
                const rowDetail = cleanDashboardVal(row[idxDetail] || '');
                const rowDetailLoose = normalizeLoose(row[idxDetail] || '');
                const rowTanggal = normalizeTanggal(row[idxTanggal]);
                if (rowNpm === searchNpm) {
                    candidates.push({ rowIndex: r + 2, rowJenis, rowDetail, rowDetailLoose, rowTanggal });
                }
                const detailMatch = !searchDetail ? true : (rowDetail === searchDetail || rowDetailLoose === searchDetailLoose || rowDetailLoose.includes(searchDetailLoose) || searchDetailLoose.includes(rowDetailLoose));
                const tanggalMatch = !searchTanggal ? true : rowTanggal === searchTanggal;
                if (rowNpm === searchNpm && rowJenis === searchJenis && detailMatch && tanggalMatch) {
                    foundRow = r + 2;
                    break;
                }
            }
            if (foundRow === -1) {
                for (let r = 0; r < range.length; r++) {
                    const row = range[r];
                    const rowNpm = String(row[idxNpm] || '').trim();
                    const rowJenis = cleanDashboardVal(row[idxJenis] || '');
                    const rowDetail = cleanDashboardVal(row[idxDetail] || '');
                    const rowDetailLoose = normalizeLoose(row[idxDetail] || '');
                    const detailMatch = !searchDetail ? true : (rowDetail === searchDetail || rowDetailLoose === searchDetailLoose || rowDetailLoose.includes(searchDetailLoose) || searchDetailLoose.includes(rowDetailLoose));
                    if (rowNpm === searchNpm && rowJenis === searchJenis && detailMatch) {
                        foundRow = r + 2;
                        break;
                    }
                }
            }
            if (foundRow === -1 && candidates.length > 0) {
                let filtered = candidates;
                if (searchJenis) {
                    filtered = filtered.filter(c => c.rowJenis === searchJenis);
                }
                if (filtered.length === 0) filtered = candidates;
                if (searchDetailLoose) {
                    const byDetail = filtered.filter(c => c.rowDetailLoose && (c.rowDetailLoose === searchDetailLoose || c.rowDetailLoose.includes(searchDetailLoose) || searchDetailLoose.includes(c.rowDetailLoose)));
                    if (byDetail.length > 0) filtered = byDetail;
                }
                if (searchTanggal) {
                    const byTanggal = filtered.filter(c => c.rowTanggal === searchTanggal);
                    if (byTanggal.length > 0) filtered = byTanggal;
                }
                foundRow = filtered[filtered.length - 1].rowIndex;
            }
        } else if (last > 1 && idxNpm !== -1) {
            const range = checkSheet.getRange(2, 1, last - 1, checkSheet.getLastColumn()).getValues();
            for (let r = 0; r < range.length; r++) {
                if (String(range[r][idxNpm] || '').trim() === searchNpm) {
                    foundRow = r + 2;
                    break;
                }
            }
        }

        if (foundRow === -1) {
            return { success: false, message: 'Baris CheckData tidak ditemukan.' };
        }

        const dosen = payload.Dosen;
        const tPel = payload.TanggalPelaksanaan || payload['Tanggal Pelaksanaan'];
        const biayaRaw = (payload.BiayaKegiatan != null ? payload.BiayaKegiatan : (payload.Biaya != null ? payload.Biaya : undefined));
        const biaya = biayaRaw === undefined
            ? undefined
            : (String(biayaRaw).trim() === '' ? '' : parseCurrency(biayaRaw));

        const existing = checkSheet.getRange(foundRow, 1, 1, checkSheet.getLastColumn()).getValues()[0];
        if (idxDosen !== -1 && dosen !== undefined) existing[idxDosen] = dosen;
        if (idxTPel !== -1 && tPel !== undefined) existing[idxTPel] = tPel;
        if (idxBiaya !== -1 && biaya !== undefined) existing[idxBiaya] = biaya;
        checkSheet.getRange(foundRow, 1, 1, checkSheet.getLastColumn()).setValues([existing]);

        _clearCheckPageCache();
        return { success: true };
    } catch (e) {
        console.error('updateCheckDataPartial error:', e);
        return { success: false, message: e.message };
    }
}

// ============== FUNGSI UTAMA (ROUTING) ================
function doGet(e) {
    const page = e && e.parameter && e.parameter.page ? String(e.parameter.page).trim() : '';

    if (page === 'theme.css') {
        try {
            const html = HtmlService.createHtmlOutputFromFile('check').getContent();
            const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            const css = (m && m[1]) ? m[1] : THEME_CSS;
            return ContentService.createTextOutput(css).setMimeType(ContentService.MimeType.CSS);
        } catch (err) {
            return ContentService.createTextOutput(THEME_CSS).setMimeType(ContentService.MimeType.CSS);
        }
    }

    if (page === 'check') {
        const email = getCurrentUserEmail();
        if (!isAuthorized(email)) return renderUnauthorizedPage();
        return HtmlService.createHtmlOutputFromFile('check').setTitle("Check & Report Dashboard");
    }

    if (page === 'admin') {
        const email = getCurrentUserEmail();
        if (!isAuthorized(email)) return renderUnauthorizedPage();
        return HtmlService.createHtmlOutputFromFile('admin').setTitle("Admin Dashboard");
    }

    if (page === 'dashboard') {
        const email = getCurrentUserEmail();
        if (!isCoreAdminAuthorized(email)) return renderUnauthorizedPage();
        return HtmlService.createTemplateFromFile('dashboard').evaluate()
            .setTitle("Inhal Online Dashboard")
            .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    if (page === 'index') {
        return HtmlService.createTemplateFromFile('index').evaluate()
            .setTitle("Form Pendaftaran Inhal")
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (page === 'info') {
        return HtmlService.createTemplateFromFile('info').evaluate()
            .setTitle("Portal Mahasiswa - INHAL FKIK UMSU")
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (page === 'detail-laporan') {
        const email = getCurrentUserEmail();
        if (!isAuthorized(email)) return renderUnauthorizedPage();
        return HtmlService.createTemplateFromFile('detail-laporan').evaluate()
            .setTitle("Detail Laporan - INHAL FKIK UMSU")
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (page === 'bagian') {
        return HtmlService.createTemplateFromFile('bagian').evaluate()
            .setTitle("Admin Bagian - INHAL FKIK UMSU")
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    return HtmlService.createTemplateFromFile('info').evaluate()
        .setTitle("Portal Mahasiswa - INHAL FKIK UMSU")
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getThemeCss() {
    try {
        const html = HtmlService.createHtmlOutputFromFile('check').getContent();
        const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        const css = (m && m[1]) ? m[1] : THEME_CSS;
        return css;
    } catch (err) {
        return THEME_CSS;
    }
}

function getMonitorSectionDefinitions_() {
    return [
        { key: 'blok', label: 'Blok', column: 7, description: 'Daftar blok pembelajaran.' },
        { key: 'ujian', label: 'Ujian', column: 8, description: 'Pilihan ujian yang tersedia.' },
        { key: 'sgd', label: 'SGD', column: 9, description: 'Pilihan SGD yang tersedia.' },
        { key: 'detailSgd', label: 'Detail SGD', column: 10, description: 'Detail kegiatan untuk SGD.' },
        { key: 'kkd', label: 'KKD', column: 11, description: 'Pilihan KKD yang tersedia.' },
        { key: 'detailKkd', label: 'Detail KKD', column: 12, description: 'Detail kegiatan untuk KKD.' },
        { key: 'dosen', label: 'Dosen', column: 15, description: 'Daftar dosen penguji atau pembimbing.' }
    ];
}

function monitorNormalizeList_(values) {
    var seen = {};
    var list = [];
    if (!Array.isArray(values)) return list;
    for (var i = 0; i < values.length; i++) {
        var value = String(values[i] || '').trim();
        if (!value) continue;
        var key = value.toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        list.push(value);
    }
    return list;
}

function monitorNormalizeRowValue_(value) {
    return String(value == null ? '' : value).trim();
}

function monitorEnsureRowCapacity_(sheet, requiredLastRow) {
    if (!sheet) return;
    var currentMaxRows = sheet.getMaxRows();
    if (requiredLastRow > currentMaxRows) {
        sheet.insertRowsAfter(currentMaxRows, requiredLastRow - currentMaxRows);
    }
}

function monitorReadListColumn_(sheet, columnNumber) {
    if (!sheet || sheet.getLastRow() < 2) return [];
    var values = sheet.getRange(2, columnNumber, sheet.getLastRow() - 1, 1).getDisplayValues();
    return monitorNormalizeList_(values.map(function(row) { return row[0]; }));
}

function monitorWriteListColumn_(sheet, columnNumber, values) {
    var sanitized = monitorNormalizeList_(values);
    var clearCount = Math.max(sheet.getLastRow() - 1, sanitized.length, 1);
    monitorEnsureRowCapacity_(sheet, sanitized.length + 1);
    sheet.getRange(2, columnNumber, clearCount, 1).clearContent();
    if (sanitized.length > 0) {
        sheet.getRange(2, columnNumber, sanitized.length, 1).setValues(
            sanitized.map(function(value) { return [value]; })
        );
    }
}

function monitorReadBagianMappings_(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return [];
    var rowCount = sheet.getLastRow() - 1;
    var data = sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).getDisplayValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var item = {
            lab: monitorNormalizeRowValue_(row[12]),
            kegiatanLab: monitorNormalizeRowValue_(row[13]),
            bagian: monitorNormalizeRowValue_(row[18]),
            email: monitorNormalizeRowValue_(row[19])
        };
        if (item.lab || item.kegiatanLab || item.bagian || item.email) {
            rows.push(item);
        }
    }
    return rows;
}

function monitorWriteBagianMappings_(sheet, rows) {
    var sanitized = [];
    if (Array.isArray(rows)) {
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            var item = {
                lab: monitorNormalizeRowValue_(row.lab),
                kegiatanLab: monitorNormalizeRowValue_(row.kegiatanLab),
                bagian: monitorNormalizeRowValue_(row.bagian),
                email: monitorNormalizeRowValue_(row.email)
            };
            if (item.lab || item.kegiatanLab || item.bagian || item.email) {
                sanitized.push(item);
            }
        }
    }

    var clearCount = Math.max(sheet.getLastRow() - 1, sanitized.length, 1);
    monitorEnsureRowCapacity_(sheet, sanitized.length + 1);
    sheet.getRange(2, 13, clearCount, 1).clearContent();
    sheet.getRange(2, 14, clearCount, 1).clearContent();
    sheet.getRange(2, 19, clearCount, 1).clearContent();
    sheet.getRange(2, 20, clearCount, 1).clearContent();

    if (sanitized.length > 0) {
        sheet.getRange(2, 13, sanitized.length, 1).setValues(sanitized.map(function(row) { return [row.lab]; }));
        sheet.getRange(2, 14, sanitized.length, 1).setValues(sanitized.map(function(row) { return [row.kegiatanLab]; }));
        sheet.getRange(2, 19, sanitized.length, 1).setValues(sanitized.map(function(row) { return [row.bagian]; }));
        sheet.getRange(2, 20, sanitized.length, 1).setValues(sanitized.map(function(row) { return [row.email]; }));
    }
}

function monitorGetSheetInfo_(sheet) {
    if (!sheet) {
        return { exists: false, rows: 0, columns: 0, headers: [] };
    }
    return {
        exists: true,
        rows: sheet.getLastRow(),
        columns: sheet.getLastColumn(),
        headers: sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] : []
    };
}

function getMonitorPageData() {
    requireCoreAdminAuthorized();

    var ss = getGlobalSpreadsheet();
    var mhsSheet = ss.getSheetByName(NAMA_SHEET_MHS);
    var biayaSheet = ss.getSheetByName(MASTER_BIAYA_SHEET_NAME);
    var sectionDefs = getMonitorSectionDefinitions_();
    var sectionMap = {};
    for (var i = 0; i < sectionDefs.length; i++) {
        sectionMap[sectionDefs[i].key] = {
            key: sectionDefs[i].key,
            label: sectionDefs[i].label,
            description: sectionDefs[i].description,
            values: monitorReadListColumn_(mhsSheet, sectionDefs[i].column)
        };
    }

    var biayaRows = [];
    if (biayaSheet && biayaSheet.getLastRow() > 1) {
        var biayaData = biayaSheet.getDataRange().getDisplayValues();
        var biayaHeaders = biayaData.shift();
        var idxKegiatan = biayaHeaders.indexOf('Kegiatan');
        var idxBiaya = biayaHeaders.indexOf('Biaya');
        if (idxKegiatan !== -1 && idxBiaya !== -1) {
            for (var b = 0; b < biayaData.length; b++) {
                var kegiatan = monitorNormalizeRowValue_(biayaData[b][idxKegiatan]);
                var biaya = monitorNormalizeRowValue_(biayaData[b][idxBiaya]);
                if (kegiatan || biaya) {
                    biayaRows.push({ kegiatan: kegiatan, biaya: biaya });
                }
            }
        }
    }

    var bagianMappings = monitorReadBagianMappings_(mhsSheet);
    var systemConfig = {
        sheetId: SHEET_ID,
        logSheetName: LOG_SHEET_NAME,
        uploadLogSheetName: UPLOAD_LOG_SHEET_NAME,
        checkSheetName: CHECK_SHEET_NAME,
        mhsSheetName: NAMA_SHEET_MHS,
        masterBiayaSheetName: MASTER_BIAYA_SHEET_NAME,
        folderId: FOLDER_ID,
        templateDiterimaId: TEMPLATE_DITERIMA_ID,
        templateDitolakId: TEMPLATE_DITOLAK_ID,
        templateAccId: TEMPLATE_ACC_ID
    };

    return {
        userEmail: getCurrentUserEmail(),
        generatedAt: new Date().toISOString(),
        overview: {
            masterCounts: {
                blok: sectionMap.blok.values.length,
                ujian: sectionMap.ujian.values.length,
                sgd: sectionMap.sgd.values.length,
                detailSgd: sectionMap.detailSgd.values.length,
                kkd: sectionMap.kkd.values.length,
                detailKkd: sectionMap.detailKkd.values.length,
                dosen: sectionMap.dosen.values.length,
                labMappings: bagianMappings.length,
                biaya: biayaRows.length
            }
        },
        systemConfig: systemConfig,
        masterSections: sectionMap,
        bagianMappings: bagianMappings,
        biayaRows: biayaRows,
        diagnostics: {
            mhs: monitorGetSheetInfo_(mhsSheet),
            biaya: monitorGetSheetInfo_(biayaSheet),
            labManagedInBagianTab: true
        }
    };
}

function saveMonitorMasterData(payload) {
    requireCoreAdminAuthorized();

    var sections = payload && payload.sections ? payload.sections : {};
    var ss = getGlobalSpreadsheet();
    var mhsSheet = ss.getSheetByName(NAMA_SHEET_MHS);
    if (!mhsSheet) {
        throw new Error('Sheet MHS tidak ditemukan.');
    }

    var defs = getMonitorSectionDefinitions_();
    for (var i = 0; i < defs.length; i++) {
        var values = sections[defs[i].key] || [];
        monitorWriteListColumn_(mhsSheet, defs[i].column, values);
    }

    return {
        success: true,
        message: 'Master kegiatan berhasil diperbarui.',
        data: getMonitorPageData()
    };
}

function saveMonitorBiayaData(payload) {
    requireCoreAdminAuthorized();

    var rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
    var ss = getGlobalSpreadsheet();
    var biayaSheet = ss.getSheetByName(MASTER_BIAYA_SHEET_NAME);
    if (!biayaSheet) {
        biayaSheet = ss.insertSheet(MASTER_BIAYA_SHEET_NAME);
    }

    if (biayaSheet.getLastRow() === 0) {
        biayaSheet.getRange(1, 1, 1, 2).setValues([['Kegiatan', 'Biaya']]);
    } else {
        var existingHeaders = biayaSheet.getRange(1, 1, 1, Math.max(2, biayaSheet.getLastColumn())).getDisplayValues()[0];
        if (existingHeaders[0] !== 'Kegiatan' || existingHeaders[1] !== 'Biaya') {
            biayaSheet.getRange(1, 1, 1, 2).setValues([['Kegiatan', 'Biaya']]);
        }
    }

        var sanitized = [];
    for (var i = 0; i < rows.length; i++) {
        var kegiatan = monitorNormalizeRowValue_(rows[i] && rows[i].kegiatan);
            var biayaRaw = monitorNormalizeRowValue_(rows[i] && rows[i].biaya);
            var biaya = biayaRaw === '' ? '' : parseCurrency(biayaRaw);
        if (kegiatan || biaya) {
            sanitized.push([kegiatan, biaya]);
        }
    }

    var clearCount = Math.max(biayaSheet.getLastRow() - 1, sanitized.length, 1);
    monitorEnsureRowCapacity_(biayaSheet, sanitized.length + 1);
    biayaSheet.getRange(2, 1, clearCount, 2).clearContent();
    if (sanitized.length > 0) {
        biayaSheet.getRange(2, 1, sanitized.length, 2).setValues(sanitized);
    }

    return {
        success: true,
        message: 'Master biaya berhasil diperbarui.',
        data: getMonitorPageData()
    };
}

function _getBlokOptions() {
    try {
        const sheet = getGlobalSpreadsheet().getSheetByName(NAMA_SHEET_MHS);
        if (!sheet || sheet.getLastRow() < 2) {
            return [];
        }

        const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const headers = headerRow.map(h => (h || '').toString().toLowerCase());

        const getIdx = (names) => {
            for (const name of names) {
                const idx = headers.indexOf(name.toLowerCase());
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const blokColIdx = getIdx(['Blok', 'Block']);

        let values = [];
        if (blokColIdx !== -1) {
            const colLetter = String.fromCharCode('A'.charCodeAt(0) + blokColIdx);
            const range = sheet.getRange(`${colLetter}2:${colLetter}${sheet.getLastRow()}`);
            values = range.getValues().flat().filter(v => v && v.toString().trim() !== '');
        } else {
            try {
                const range = sheet.getRange(`G2:G${sheet.getLastRow()}`);
                values = range.getValues().flat().filter(v => v && v.toString().trim() !== '');
            } catch (fallbackError) {
                return [];
            }
        }

        return [...new Set(values)];
    } catch (e) {
        console.error('Error in _getBlokOptions:', e.message);
        return [];
    }
}

function getUniqueBloks(kategori) {
    requireAuthorizedOrBagina();
    return _getBlokOptions();
}

function getUniqueJenisKegiatan() {
    try {
        requireAuthorized();
        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) return [];

        // Cari kolom berdasarkan nama header 'Jenis Kegiatan' agar tidak hardcode
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const normalized = headers.map(h => String(h || '').toLowerCase().trim());
        let colIdx = normalized.indexOf('jenis kegiatan');
        if (colIdx === -1) colIdx = normalized.findIndex(h => h.indexOf('jenis') !== -1);
        if (colIdx === -1) return [];
        const colLetter = String.fromCharCode('A'.charCodeAt(0) + colIdx);
        const range = sheet.getRange(colLetter + '2:' + colLetter + sheet.getLastRow());
        const values = range.getValues().flat().filter(String);
        return [...new Set(values)];
    } catch (e) {
        console.error('Error getting unique Jenis Kegiatan:', e.message);
        return [];
    }
}


function getStudentNameByNpm(npm, kategori) {
    requireBaginaSession(kategori);
    if (!_rateLimitAllowed('npmlookup:' + String(npm || ''), 60, 60)) {
        return '';
    }
    return _lookupStudentNameByNpm(npm);
}

// Membaca peta NPM -> Nama dari sheet MHS, di-cache 5 menit.
// Menghindari pemindaian seluruh sheet per NPM.
function _getMhsNameMap() {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'mhsNameMap:v1';
    try {
        var cached = _getCacheChunked(cache, cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') return parsed;
            _removeCacheChunked(cache, cacheKey);
        }
    } catch (e) { }

    var map = {};
    try {
        var ss = getGlobalSpreadsheet();
        var sheet = ss.getSheetByName('MHS');
        if (sheet && sheet.getLastRow() > 1) {
            var data = sheet.getDataRange().getValues();
            for (var i = 1; i < data.length; i++) {
                var npm = data[i][0] ? String(data[i][0]).trim() : '';
                if (npm && map[npm] === undefined) {
                    map[npm] = String(data[i][1] || '');
                }
            }
        }
        try {
            _setCacheChunked(cache, cacheKey, JSON.stringify(map), CACHE_EXPIRATION);
        } catch (e) { }
    } catch (e) {
        console.error('Error in _getMhsNameMap: ' + e);
    }
    return map;
}

function _lookupStudentNameByNpm(npm) {
    try {
        const inputNpm = npm ? String(npm).trim() : '';
        if (!inputNpm) return '';
        const map = _getMhsNameMap();
        return map[inputNpm] || '';
    } catch (e) {
        console.error('Error in _lookupStudentNameByNpm: ' + e);
        return '';
    }
}


function clearCheckPageCache() {
    requireAuthorized();
    return _clearCheckPageCache();
}

function _clearCheckPageCache() {
    // Bersihkan semua cache data baca (dipanggil setiap kali terjadi operasi tulis).
    var dataCacheKeys = [
        'checkPageData:v1',
        'logDataForAdmin:v1',
        'detailLaporanData:v1',
        'mhsNameMap:v1',
        'mhsStudentData:v1'
    ];
    try {
        var cache = CacheService.getScriptCache();
        for (var i = 0; i < dataCacheKeys.length; i++) {
            try { _removeCacheChunked(cache, dataCacheKeys[i]); } catch (e) { }
        }
    } catch (e) { }
}

function getCheckPageDataNoAuth() {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        const uploadSheet = ss.getSheetByName(UPLOAD_LOG_SHEET_NAME);
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME) || ss.getSheetByName('Check');

        const logRowCount = logSheet ? Math.max(0, logSheet.getLastRow() - 1) : 0;
        const uploadRowCount = uploadSheet ? Math.max(0, uploadSheet.getLastRow() - 1) : 0;
        const checkRowCount = checkSheet ? Math.max(0, checkSheet.getLastRow() - 1) : 0;

        let logHeaders = [];
        let firstLogRow = [];
        if (logSheet && logSheet.getLastRow() > 0) {
            const data = logSheet.getDataRange().getDisplayValues();
            logHeaders = data[0] || [];
            firstLogRow = data.length > 1 ? data[1] : [];
        }

        return {
            success: true,
            logRowCount: logRowCount,
            uploadRowCount: uploadRowCount,
            checkRowCount: checkRowCount,
            logHeaders: logHeaders,
            firstLogRow: firstLogRow
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function getCheckPageData(options) {
    requireAuthorized();
    return _getCheckPageData(options);
}

function _getCheckPageData(options) {
    var cacheKey = 'checkPageData:v1';
    var useCache = !(options && options.skipCache);
    if (useCache) {
        try {
            var cache = CacheService.getScriptCache();
            var cached = _getCacheChunked(cache, cacheKey);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) return parsed;
                _removeCacheChunked(cache, cacheKey);
            }
        } catch (e) { }
    }

    try {
        var ss = getGlobalSpreadsheet();
        var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        var uploadSheet = ss.getSheetByName(UPLOAD_LOG_SHEET_NAME);
        var checkSheet = ss.getSheetByName(CHECK_SHEET_NAME) || ss.getSheetByName('Check');

        var logData = logSheet && logSheet.getLastRow() > 1 ? logSheet.getDataRange().getValues() : [];
        var uploadData = uploadSheet && uploadSheet.getLastRow() > 1 ? uploadSheet.getDataRange().getValues() : [];
        var checkData = checkSheet && checkSheet.getLastRow() > 1 ? checkSheet.getDataRange().getValues() : [];
        var logHeaders = logData.length > 0 ? logData.shift() : [];

        var monthNames = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
        function normalizeHeaderName(value) {
            return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        }
        function buildHeaderIndex(headers) {
            var map = {};
            for (var i = 0; i < headers.length; i++) {
                map[normalizeHeaderName(headers[i])] = i;
            }
            return map;
        }
        function findHeaderIndex(headerMap, names) {
            for (var i = 0; i < names.length; i++) {
                var normalized = normalizeHeaderName(names[i]);
                if (headerMap.hasOwnProperty(normalized)) return headerMap[normalized];
            }
            return -1;
        }
        function stringifyCell(value) {
            if (value === null || value === undefined) return '';
            return String(value).trim();
        }
        function normalizeDateKey(value) {
            if (!value) return '';
            if (value instanceof Date) {
                return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
            }
            var text = String(value).trim();
            if (!text) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
            var match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (match) return match[3] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[1]).padStart(2, '0');
            match = text.match(/^(\d{1,2})[\s\/-]+([A-Za-z]+)[\s\/-]+(\d{4})$/);
            if (match) {
                var monthIndex = monthNames.indexOf(String(match[2]).toLowerCase());
                if (monthIndex !== -1) return match[3] + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(match[1]).padStart(2, '0');
            }
            return text.toLowerCase();
        }
        function formatDateIndo(rawDate, includeTime) {
            if (!rawDate) return '';
            var date = rawDate instanceof Date ? rawDate : new Date(rawDate);
            if (isNaN(date.getTime())) return rawDate;
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            var day = String(date.getDate()).padStart(2, '0');
            var month = months[date.getMonth()];
            var year = date.getFullYear();
            if (includeTime === false) {
                return day + '/' + month + '/' + year;
            }
            var hour = String(date.getHours()).padStart(2, '0');
            var minute = String(date.getMinutes()).padStart(2, '0');
            var second = String(date.getSeconds()).padStart(2, '0');
            return day + '/' + month + '/' + year + ' ' + hour + ':' + minute + ':' + second;
        }
        function normalizeHp(value) {
            var hp = stringifyCell(value);
            if (hp && hp.charAt(0) === '8') return '0' + hp;
            return hp;
        }
        function pushLabValue(labsArray, row, idxPil, idxKeg, idxTgl) {
            if (idxPil < 0 && idxKeg < 0) return;
            var pil = idxPil >= 0 ? stringifyCell(row[idxPil]) : '';
            var keg = idxKeg >= 0 ? stringifyCell(row[idxKeg]) : '';
            var tgl = idxTgl >= 0 ? stringifyCell(row[idxTgl]) : '';
            if (pil || keg) {
                labsArray.push({
                    desc: pil && keg ? pil + ' - ' + keg : (pil || keg),
                    tgl: tgl
                });
            }
        }
        function summarizeLogActivity(row, indexes) {
            var jenis = indexes.iJenis >= 0 ? stringifyCell(row[indexes.iJenis]) : '';
            var jenisLower = jenis.toLowerCase();
            var detail = 'N/A';
            var tanggalKegiatan = '';
            var tglRawForKey = '';
            if (jenisLower === 'praktikum') {
                var labs = [];
                pushLabValue(labs, row, indexes.iPilLab1, indexes.iKegLab1, indexes.iTglLab1);
                pushLabValue(labs, row, indexes.iPilLab2, indexes.iKegLab2, indexes.iTglLab2);
                pushLabValue(labs, row, indexes.iPilLab3, indexes.iKegLab3, indexes.iTglLab3);
                pushLabValue(labs, row, indexes.iPilLab4, indexes.iKegLab4, indexes.iTglLab4);
                pushLabValue(labs, row, indexes.iPilLab5, indexes.iKegLab5, indexes.iTglLab5);
                pushLabValue(labs, row, indexes.iPilLab6, indexes.iKegLab6, indexes.iTglLab6);
                pushLabValue(labs, row, indexes.iPilLab7, indexes.iKegLab7, indexes.iTglLab7);
                pushLabValue(labs, row, indexes.iPilLab8, indexes.iKegLab8, indexes.iTglLab8);
                pushLabValue(labs, row, indexes.iPilLab9, indexes.iKegLab9, indexes.iTglLab9);
                if (labs.length > 0) {
                    var detailParts = [];
                    for (var li = 0; li < labs.length; li++) {
                        detailParts.push(labs[li].desc);
                    }
                    detail = detailParts.join('; ');
                    tanggalKegiatan = getFirstPraktikumTanggal(labs);
                }
                tglRawForKey = (indexes.iTglLab1 >= 0 && row[indexes.iTglLab1]) ? row[indexes.iTglLab1]
                    : (indexes.iTglLab2 >= 0 && row[indexes.iTglLab2]) ? row[indexes.iTglLab2]
                        : '';
            } else if (jenisLower === 'sgd') {
                var pilSgd = indexes.iPilSgd >= 0 ? stringifyCell(row[indexes.iPilSgd]) : '';
                var detSgd = indexes.iDetSgd >= 0 ? stringifyCell(row[indexes.iDetSgd]) : '';
                detail = pilSgd && detSgd ? pilSgd + ' - ' + detSgd : (pilSgd || detSgd || 'N/A');
                tanggalKegiatan = indexes.iTglSgd >= 0 ? stringifyCell(row[indexes.iTglSgd]) : '';
                tglRawForKey = indexes.iTglSgd >= 0 ? row[indexes.iTglSgd] : '';
            } else if (jenisLower === 'kkd') {
                var pilKkd = indexes.iPilKkd >= 0 ? stringifyCell(row[indexes.iPilKkd]) : '';
                var detKkd = indexes.iDetKkd >= 0 ? stringifyCell(row[indexes.iDetKkd]) : '';
                detail = pilKkd && detKkd ? pilKkd + ' - ' + detKkd : (pilKkd || detKkd || 'N/A');
                tanggalKegiatan = indexes.iTglKkd >= 0 ? stringifyCell(row[indexes.iTglKkd]) : '';
                tglRawForKey = indexes.iTglKkd >= 0 ? row[indexes.iTglKkd] : '';
            } else if (jenisLower === 'ujian') {
                detail = indexes.iPilUjian >= 0 ? (stringifyCell(row[indexes.iPilUjian]) || 'N/A') : 'N/A';
                tanggalKegiatan = indexes.iTglUjian >= 0 ? stringifyCell(row[indexes.iTglUjian]) : '';
                tglRawForKey = indexes.iTglUjian >= 0 ? row[indexes.iTglUjian] : '';
            }
            return {
                jenis: jenis,
                jenisLower: jenisLower,
                detail: detail,
                tanggalKegiatan: tanggalKegiatan,
                tanggalNorm: normalizeDateKey(tglRawForKey)
            };
        }

        var debug = {
            step: 'init',
            logRowsTotal: logData.length,
            iNpm: -1,
            processing: [],
            uploadMapSize: 0,
            checkMapSize: 0
        };

        var uploadById = {};
        var uploadByActivity = {};
        if (uploadData.length > 0) {
            var uploadHeaders = uploadData.shift();
            var uploadHeaderMap = buildHeaderIndex(uploadHeaders);
            var uploadIdxId = findHeaderIndex(uploadHeaderMap, ['ID Pengajuan', 'IdPengajuan']);
            var uploadIdxNpm = findHeaderIndex(uploadHeaderMap, ['NPM', 'NIM', 'Nomor Induk Mahasiswa']);
            var uploadIdxJenis = findHeaderIndex(uploadHeaderMap, ['Jenis Kegiatan', 'JenisKegiatan']);
            var uploadIdxDetail = findHeaderIndex(uploadHeaderMap, ['Detail', 'Detail Kegiatan']);
            var uploadIdxTanggal = findHeaderIndex(uploadHeaderMap, ['Tanggal', 'Tanggal Kegiatan']);
            var uploadIdxAcc = findHeaderIndex(uploadHeaderMap, ['Link ACC INHAL', 'Link ACC', 'ACC INHAL']);
            var uploadIdxBukti = findHeaderIndex(uploadHeaderMap, ['Link Bukti Bayar', 'Bukti Bayar']);
                var uploadIdxTimestamp = findHeaderIndex(uploadHeaderMap, ['Timestamp', 'Waktu', 'Time']);
            for (var u = 0; u < uploadData.length; u++) {
                var uploadRow = uploadData[u];
                var uploadEntry = {
                    accInhal: uploadIdxAcc >= 0 ? stringifyCell(uploadRow[uploadIdxAcc]) : '',
                        buktiBayar: uploadIdxBukti >= 0 ? stringifyCell(uploadRow[uploadIdxBukti]) : '',
                        timestamp: uploadIdxTimestamp >= 0 ? uploadRow[uploadIdxTimestamp] : ''
                };
                var uploadId = uploadIdxId >= 0 ? stringifyCell(uploadRow[uploadIdxId]) : '';
                var uploadNpm = uploadIdxNpm >= 0 ? stringifyCell(uploadRow[uploadIdxNpm]) : '';
                var uploadJenis = uploadIdxJenis >= 0 ? stringifyCell(uploadRow[uploadIdxJenis]) : '';
                var uploadDetail = uploadIdxDetail >= 0 ? stringifyCell(uploadRow[uploadIdxDetail]) : '';
                var uploadTanggal = uploadIdxTanggal >= 0 ? uploadRow[uploadIdxTanggal] : '';
                var uploadKey = _activityKey(uploadNpm, uploadJenis, uploadDetail, uploadTanggal);
                if (uploadId) uploadById['id:' + uploadId] = uploadEntry;
                if (uploadNpm && (uploadJenis || uploadDetail || uploadTanggal)) {
                    uploadByActivity['activity:' + uploadKey] = uploadEntry;
                }
            }
        }

        var checkById = {};
        var checkByActivity = {};
        if (checkData.length > 0) {
            var checkHeaders = checkData.shift();
            var checkHeaderMap = buildHeaderIndex(checkHeaders);
            var checkIdxId = findHeaderIndex(checkHeaderMap, ['ID Pengajuan', 'IdPengajuan']);
            var checkIdxNpm = findHeaderIndex(checkHeaderMap, ['NPM', 'NIM', 'Nomor Induk Mahasiswa']);
            var checkIdxStatus = findHeaderIndex(checkHeaderMap, ['Status Final', 'Final Status', 'Status']);
            var checkIdxAcc = findHeaderIndex(checkHeaderMap, ['ACC INHAL', 'Link ACC INHAL', 'Link ACC']);
            var checkIdxBukti = findHeaderIndex(checkHeaderMap, ['Bukti Bayar', 'Link Bukti Bayar']);
            var checkIdxDosen = findHeaderIndex(checkHeaderMap, ['Dosen', 'Dosen Penguji', 'Dosen Pembimbing']);
            var checkIdxTPel = findHeaderIndex(checkHeaderMap, ['Tanggal Pelaksanaan', 'Pelaksanaan', 'Tanggal Kegiatan', 'Tanggal Pelaksa Biaya']);
            var checkIdxBiaya = findHeaderIndex(checkHeaderMap, ['Biaya', 'Biaya Kegiatan']);
            var checkIdxKet = findHeaderIndex(checkHeaderMap, ['Keterangan', 'Catatan']);
            var checkIdxCatatanAdmin = findHeaderIndex(checkHeaderMap, ['Catatan Admin', 'CatatanAdmin']);
            var checkIdxJenis = findHeaderIndex(checkHeaderMap, ['Jenis Kegiatan', 'JenisKegiatan']);
            var checkIdxNama = findHeaderIndex(checkHeaderMap, ['Nama Lengkap', 'Nama']);
            var checkIdxTanggal = findHeaderIndex(checkHeaderMap, ['Tanggal', 'Tanggal Kegiatan', 'Tanggal Pelaksanaan']);
            var checkIdxDetail = findHeaderIndex(checkHeaderMap, ['Detail Kegiatan', 'Detail']);
            var checkIdxLinkSurat = findHeaderIndex(checkHeaderMap, ['Link Surat', 'Link Surat Keterangan']);
            var checkIdxLinkFinal = findHeaderIndex(checkHeaderMap, ['Link Final', 'Link Final PDF', 'Final PDF Link']);
            for (var c = 0; c < checkData.length; c++) {
                var checkRow = checkData[c];
                var checkNpm = checkIdxNpm >= 0 ? stringifyCell(checkRow[checkIdxNpm]) : '';
                var checkId = checkIdxId >= 0 ? stringifyCell(checkRow[checkIdxId]) : '';
                var checkJenis = checkIdxJenis >= 0 ? stringifyCell(checkRow[checkIdxJenis]) : '';
                var checkDetail = checkIdxDetail >= 0 ? stringifyCell(checkRow[checkIdxDetail]) : '';
                var checkTanggalRaw = checkIdxTanggal >= 0 ? checkRow[checkIdxTanggal] : (checkIdxTPel >= 0 ? checkRow[checkIdxTPel] : '');
                var checkEntry = {
                    statusFinal: checkIdxStatus >= 0 ? (stringifyCell(checkRow[checkIdxStatus]) || 'Belum Diproses') : 'Belum Diproses',
                    accInhal: checkIdxAcc >= 0 ? stringifyCell(checkRow[checkIdxAcc]) : '',
                    buktiBayar: checkIdxBukti >= 0 ? stringifyCell(checkRow[checkIdxBukti]) : '',
                    Dosen: checkIdxDosen >= 0 ? (checkRow[checkIdxDosen] || '') : '',
                    TanggalPelaksanaan: checkIdxTPel >= 0 ? (checkRow[checkIdxTPel] || '') : '',
                    BiayaKegiatan: checkIdxBiaya >= 0 ? (checkRow[checkIdxBiaya] || '') : '',
                    JenisKegiatan: checkIdxJenis >= 0 ? (checkRow[checkIdxJenis] || '') : '',
                    NamaLengkap: checkIdxNama >= 0 ? (checkRow[checkIdxNama] || '') : '',
                    Tanggal: checkIdxTanggal >= 0 ? (checkRow[checkIdxTanggal] || '') : '',
                    DetailKegiatan: checkIdxDetail >= 0 ? (checkRow[checkIdxDetail] || '') : '',
                    LinkSurat: checkIdxLinkSurat >= 0 ? (checkRow[checkIdxLinkSurat] || '') : '',
                    LinkFinal: checkIdxLinkFinal >= 0 ? (checkRow[checkIdxLinkFinal] || '') : ''
                };
                if (checkIdxKet >= 0 && stringifyCell(checkRow[checkIdxKet]) !== '') checkEntry.Keterangan = checkRow[checkIdxKet];
                if (checkIdxCatatanAdmin >= 0 && stringifyCell(checkRow[checkIdxCatatanAdmin]) !== '') checkEntry['Catatan Admin'] = checkRow[checkIdxCatatanAdmin];
                if (checkId) {
                    checkById['id:' + checkId] = checkEntry;
                } else if (checkNpm && (checkJenis || checkDetail || checkTanggalRaw)) {
                    checkByActivity['activity:' + _activityKey(checkNpm, checkJenis, checkDetail, checkTanggalRaw)] = checkEntry;
                }
            }
        }

        debug.uploadMapSize = Object.keys(uploadById).length + Object.keys(uploadByActivity).length;
        debug.checkMapSize = Object.keys(checkById).length + Object.keys(checkByActivity).length;
        debug.logHeadersLength = logHeaders.length;
        debug.logDataLength = logData.length;
        debug.logHeadersFirst = logHeaders.length ? logHeaders[0] : '';
        debug.logDataFirst = logData.length > 0 ? logData[0][0] : 'Empty';

        var logHeaderMap = buildHeaderIndex(logHeaders);
        var indexes = {
            iTimestamp: findHeaderIndex(logHeaderMap, ['Timestamp', 'Waktu', 'Time']),
            iNpm: findHeaderIndex(logHeaderMap, ['NPM', 'nim', 'Nomor Induk Mahasiswa']),
            iNama: findHeaderIndex(logHeaderMap, ['Nama Lengkap', 'nama', 'Nama Mahasiswa']),
            iBlok: findHeaderIndex(logHeaderMap, ['Blok']),
            iJenis: findHeaderIndex(logHeaderMap, ['Jenis Kegiatan', 'JenisKegiatan']),
            iKet: findHeaderIndex(logHeaderMap, ['Keterangan']),
            iCatatanAdmin: findHeaderIndex(logHeaderMap, ['Catatan Admin', 'CatatanAdmin']),
            iLinkSurat: findHeaderIndex(logHeaderMap, ['Link Surat Keterangan', 'Link Surat']),
            iStatus: findHeaderIndex(logHeaderMap, ['Status']),
            iEmail: findHeaderIndex(logHeaderMap, ['Email Address', 'Email']),
            iHp: findHeaderIndex(logHeaderMap, ['Nomor HP', 'No HP', 'HP', 'Whatsapp', 'No. HP/WA']),
            iTglUjian: findHeaderIndex(logHeaderMap, ['Tanggal Ujian']),
            iPilUjian: findHeaderIndex(logHeaderMap, ['Pilihan Ujian', 'Detail Ujian']),
            iPilSgd: findHeaderIndex(logHeaderMap, ['Pilihan SGD']),
            iDetSgd: findHeaderIndex(logHeaderMap, ['Detail SGD']),
            iTglSgd: findHeaderIndex(logHeaderMap, ['Tanggal SGD']),
            iPilKkd: findHeaderIndex(logHeaderMap, ['Pilihan KKD']),
            iDetKkd: findHeaderIndex(logHeaderMap, ['Detail KKD']),
            iTglKkd: findHeaderIndex(logHeaderMap, ['Tanggal KKD']),
            iPilLab1: findHeaderIndex(logHeaderMap, ['Pilihan LAB 1', 'Pilihan LAB']),
            iKegLab1: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 1', 'Detail LAB']),
            iTglLab1: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 1', 'Tanggal Praktkum 1', 'Tanggal Praktkum']),
            iTglLab2: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 2', 'Tanggal Praktkum 2']),
            iTglLab3: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 3', 'Tanggal Praktkum 3']),
            iTglLab4: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 4', 'Tanggal Praktkum 4']),
            iTglLab5: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 5', 'Tanggal Praktkum 5']),
            iTglLab6: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 6', 'Tanggal Praktkum 6']),
            iTglLab7: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 7', 'Tanggal Praktkum 7']),
            iTglLab8: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 8', 'Tanggal Praktkum 8']),
            iTglLab9: findHeaderIndex(logHeaderMap, ['Tanggal Praktikum 9', 'Tanggal Praktkum 9']),
            iPilLab2: findHeaderIndex(logHeaderMap, ['Pilihan LAB 2']),
            iKegLab2: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 2']),
            iPilLab3: findHeaderIndex(logHeaderMap, ['Pilihan LAB 3']),
            iKegLab3: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 3']),
            iPilLab4: findHeaderIndex(logHeaderMap, ['Pilihan LAB 4']),
            iKegLab4: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 4']),
            iPilLab5: findHeaderIndex(logHeaderMap, ['Pilihan LAB 5']),
            iKegLab5: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 5']),
            iPilLab6: findHeaderIndex(logHeaderMap, ['Pilihan LAB 6']),
            iKegLab6: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 6']),
            iPilLab7: findHeaderIndex(logHeaderMap, ['Pilihan LAB 7']),
            iKegLab7: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 7']),
            iPilLab8: findHeaderIndex(logHeaderMap, ['Pilihan LAB 8']),
            iKegLab8: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 8']),
            iPilLab9: findHeaderIndex(logHeaderMap, ['Pilihan LAB 9']),
            iKegLab9: findHeaderIndex(logHeaderMap, ['Kegiatan LAB 9']),
            iIdPengajuanLog: findHeaderIndex(logHeaderMap, ['ID Pengajuan', 'IdPengajuan'])
        };
        debug.iNpm = indexes.iNpm;

        var result = [];
        var blokSeen = {};
        var jenisSeen = {};
        for (var r = 0; r < logData.length; r++) {
            var logRow = logData[r];
            var npm = indexes.iNpm >= 0 ? stringifyCell(logRow[indexes.iNpm]) : '';
            if (!npm) continue;

            var blok = indexes.iBlok >= 0 ? stringifyCell(logRow[indexes.iBlok]) : '';
            var jenisInfo = summarizeLogActivity(logRow, indexes);
            var jenis = jenisInfo.jenis;
            if (blok) blokSeen[blok] = true;
            if (jenis) jenisSeen[jenis] = true;

            var idPengajuan = indexes.iIdPengajuanLog >= 0 ? stringifyCell(logRow[indexes.iIdPengajuanLog]) : '';
            var activityKey = 'activity:' + _activityKey(npm, jenis, jenisInfo.detail, jenisInfo.tanggalKegiatan);
            var checks = (idPengajuan && checkById['id:' + idPengajuan]) || checkByActivity[activityKey] || {};
            var uploads = (idPengajuan && uploadById['id:' + idPengajuan]) || uploadByActivity[activityKey] || {};
            var accInhalVal = checks.accInhal || uploads.accInhal || '';
            var buktiBayarVal = checks.buktiBayar || uploads.buktiBayar || '';
            var statusFinal = checks.statusFinal || '';
            var keteranganVal = (checks.Keterangan !== null && checks.Keterangan !== undefined && stringifyCell(checks.Keterangan) !== '')
                ? checks.Keterangan
                : (indexes.iKet >= 0 ? (logRow[indexes.iKet] || '') : '');
            var catatanAdminVal = (checks['Catatan Admin'] !== null && checks['Catatan Admin'] !== undefined && stringifyCell(checks['Catatan Admin']) !== '')
                ? checks['Catatan Admin']
                : (indexes.iCatatanAdmin >= 0 ? (logRow[indexes.iCatatanAdmin] || '') : '');
            var linkSuratVal = checks.LinkSurat || (indexes.iLinkSurat >= 0 ? (logRow[indexes.iLinkSurat] || '') : '');
            var combinedJenis = (jenisInfo.detail && jenisInfo.detail !== 'N/A') ? jenis + ' - ' + jenisInfo.detail : jenis;
            var emailVal = indexes.iEmail >= 0 ? stringifyCell(logRow[indexes.iEmail]) : '';
            var hpValRaw = indexes.iHp >= 0 ? stringifyCell(logRow[indexes.iHp]) : '';
            var statusVal = 'Menunggu';
            if (indexes.iStatus >= 0 && stringifyCell(logRow[indexes.iStatus]) !== '') {
                statusVal = stringifyCell(logRow[indexes.iStatus]);
            }

            result.push({
                NPM: npm,
                idPengajuan: idPengajuan,
                Timestamp: indexes.iTimestamp >= 0 ? formatDateIndo(logRow[indexes.iTimestamp], true) : '',
                'Nama Lengkap': indexes.iNama >= 0 ? (logRow[indexes.iNama] || '') : '',
                Blok: blok,
                JenisDasar: jenis,
                DetailKegiatanPortal: jenisInfo.detail,
                'Jenis Kegiatan': combinedJenis,
                'Keterangan': keteranganVal,
                'Catatan Admin': catatanAdminVal,
                'Link Surat Keterangan': linkSuratVal,
                Status: statusVal,
                statusFinal: statusFinal,
                Detail: jenisInfo.detail !== 'N/A' ? jenisInfo.detail : (indexes.iKet >= 0 ? (logRow[indexes.iKet] || '') : ''),
                TanggalKegiatan: formatDateIndo(jenisInfo.tanggalKegiatan, false),
                Email: emailVal,
                NoHP: normalizeHp(hpValRaw),
                originalRowIndex: r + 2,
                accInhal: accInhalVal,
                buktiBayar: buktiBayarVal,
                Dosen: checks.Dosen || '',
                TanggalPelaksanaan: checks.TanggalPelaksanaan || '',
                BiayaKegiatan: checks.BiayaKegiatan !== null && checks.BiayaKegiatan !== undefined ? checks.BiayaKegiatan : '',
                LinkACC: accInhalVal,
                LinkFinal: checks.LinkFinal || '',
                uploadTimestamp: uploads.timestamp || ''
            });
        }

        if (result.length === 0) {
            return JSON.parse(JSON.stringify({
                rows: [],
                debug: debug
            }));
        }

        var blokList = Object.keys(blokSeen).sort();
        var jenisList = Object.keys(jenisSeen).sort();
        var payload = {
            rows: result,
            blokList: blokList,
            jenisList: jenisList,
            dosenList: getDosenOptions(),
            biayaMap: _getBiayaMap(),
            bagianEmailMap: getBagianEmailMap()
        };
        if (options && options.includeDebug) payload.debug = debug;
        if (useCache && payload.rows && payload.rows.length) {
            _setCacheChunked(CacheService.getScriptCache(), cacheKey, JSON.stringify(payload), 300);
        }
        return JSON.parse(JSON.stringify(payload));
    } catch (e) {
        return {
            rows: [],
            error: e.message || e.toString(),
            stack: e.stack
        };
    }
}

function getCheckMatchedData() {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME) || ss.getSheetByName('Check');
        if (!logSheet || !checkSheet) return [];

        const logRows = _getLogDataForAdminData(); 
        if (!logRows || logRows.length === 0) return [];

        const cData = checkSheet.getDataRange().getDisplayValues();
        if (!cData || cData.length < 2) return [];
        const cHeaders = cData[0] || [];
        const cRows = cData.slice(1);

        const findIdx = (names) => {
            for (let n of names) {
                const i = cHeaders.indexOf(n);
                if (i !== -1) return i;
            }
            return -1;
        };
        const ciNpm = findIdx(['NPM', 'NIM']);
        const ciNama = findIdx(['Nama Lengkap', 'Nama']);
        const ciJenis = findIdx(['Jenis Kegiatan', 'JenisKegiatan']);
        const ciDetail = findIdx(['Detail Kegiatan', 'Detail', 'DetailKegiatan']);
        const ciTanggal = findIdx(['Tanggal', 'Tanggal Kegiatan', 'Tanggal Pelaksanaan']);
        const ciAcc = findIdx(['ACC INHAL', 'Link ACC INHAL', 'Link ACC', 'ACC']);
        const ciBukti = findIdx(['Bukti Bayar', 'Link Bukti Bayar', 'Bukti']);
        const ciDosen = findIdx(['Dosen', 'Dosen Penguji', 'Dosen Pembimbing']);
        const ciTPel = findIdx(['Tanggal Pelaksanaan', 'TanggalPelaksanaan']);
        const ciBiaya = findIdx(['Biaya', 'Biaya Kegiatan', 'BiayaKegiatan']);
        const ciKet = findIdx(['Keterangan', 'Catatan']);
        const ciLinkFinal = findIdx(['Link Final', 'Lampiran Email', 'Link Lampiran Email']);

        const norm = (s) => String(s || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        const monthNamesLower = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
        const normDate = (s) => {
            const v = String(s || '').trim();
            if (!v) return '';
            if (s instanceof Date) {
                const y = s.getFullYear();
                const m = String(s.getMonth() + 1).padStart(2, '0');
                const d = String(s.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
            let m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const mo = m[2].padStart(2, '0');
                const y = m[3];
                return `${y}-${mo}-${d}`;
            }
            m = v.match(/^(\d{1,2})[\/\-\s]+([A-Za-z]+)[\/\-\s]+(\d{4})$/);
            if (m) {
                const d = m[1].padStart(2, '0');
                const monthName = m[2].toLowerCase();
                const y = m[3];
                const idx = monthNamesLower.indexOf(monthName);
                if (idx !== -1) {
                    const mo = String(idx + 1).padStart(2, '0');
                    return `${y}-${mo}-${d}`;
                }
            }
            return v.toLowerCase();
        };

        const checkMap = new Map();
        cRows.forEach(row => {
            const npm = ciNpm !== -1 ? row[ciNpm] : '';
            const nama = ciNama !== -1 ? row[ciNama] : '';
            const jenis = ciJenis !== -1 ? row[ciJenis] : '';
            const detail = ciDetail !== -1 ? row[ciDetail] : '';
            const tanggal = ciTanggal !== -1 ? row[ciTanggal] : '';
            const key = `${norm(npm)}|${norm(nama)}|${norm(jenis)}|${norm(detail)}|${normDate(tanggal)}`;
            checkMap.set(key, {
                NPM: npm || '',
                NamaLengkap: nama || '',
                JenisKegiatan: jenis || '',
                DetailKegiatan: detail || '',
                Tanggal: tanggal || '',
                ACC: ciAcc !== -1 ? (row[ciAcc] || '') : '',
                Bukti: ciBukti !== -1 ? (row[ciBukti] || '') : '',
                Dosen: ciDosen !== -1 ? (row[ciDosen] || '') : '',
                TanggalPelaksanaan: ciTPel !== -1 ? (row[ciTPel] || '') : '',
                Biaya: ciBiaya !== -1 ? (row[ciBiaya] || '') : '',
                Keterangan: ciKet !== -1 ? (row[ciKet] || '') : '',
                LinkFinal: ciLinkFinal !== -1 ? (row[ciLinkFinal] || '') : ''
            });
        });

        const out = [];
        const added = new Set();
        logRows.forEach(r => {
            const key = `${norm(r.NPM)}|${norm(r.NamaLengkap)}|${norm(r.JenisKegiatan)}|${norm(r.DetailKegiatan)}|${normDate(r.TanggalKegiatan)}`;
            const m = checkMap.get(key);
            if (!m) return; 
            const matched = {
                NPM: r.NPM || '',
                'Nama Lengkap': r.NamaLengkap || '',
                Blok: r.Blok || '',
                'Jenis Kegiatan': r.JenisKegiatan || '',
                'Detail Kegiatan': r.DetailKegiatan || '',
                Tanggal: m.Tanggal || r.TanggalKegiatan || '',
                Email: r.Email || '',
                'ACC INHAL': m.ACC || '',
                'Bukti Bayar': m.Bukti || '',
                Status: (r.Status || '').toString()
            };
            matched.Dosen = m.Dosen || '';
            matched['Tanggal Pelaksanaan'] = m.TanggalPelaksanaan || '';
            matched.Biaya = m.Biaya != null ? m.Biaya : '';
            matched.Keterangan = m.Keterangan || r.Keterangan || '';
            matched.Catatan = (r.CatatanAdmin || r.Catatan || '');
            matched['Link Final'] = m.LinkFinal || '';
            out.push(matched);
            added.add(key);
        });

        const logByNpm = new Map(logRows.map(l => [norm(l.NPM), l]));
        checkMap.forEach((m, key) => {
            if (added.has(key)) return; 
            const logRow = logByNpm.get(norm(m.NPM));
            const matched = {
                NPM: m.NPM || (logRow ? logRow.NPM : ''),
                'Nama Lengkap': m.NamaLengkap || (logRow ? logRow.NamaLengkap : ''),
                Blok: logRow ? (logRow.Blok || '') : '',
                'Jenis Kegiatan': m.JenisKegiatan || (logRow ? (logRow.JenisKegiatan || '') : ''),
                'Detail Kegiatan': m.DetailKegiatan || (logRow ? (logRow.DetailKegiatan || '') : ''),
                Tanggal: m.Tanggal || (logRow ? (logRow.TanggalKegiatan || '') : ''),
                Email: logRow ? (logRow.Email || '') : '',
                'ACC INHAL': m.ACC || '',
                'Bukti Bayar': m.Bukti || '',
                Status: (logRow && logRow.Status) ? logRow.Status : '',
                Dosen: m.Dosen || '',
                'Tanggal Pelaksanaan': m.TanggalPelaksanaan || '',
                Biaya: m.Biaya != null ? m.Biaya : '',
                Keterangan: m.Keterangan || (logRow ? (logRow.Keterangan || '') : ''),
                Catatan: (logRow ? ((logRow.CatatanAdmin || logRow.Catatan || '')) : ''),
                'Link Final': m.LinkFinal || ''
            };
            out.push(matched);
        });

        return out;
    } catch (e) {
        console.error('getCheckMatchedData error:', e.message);
        return [];
    }
}

function getDetailLaporanData() {
    var cacheKey = 'detailLaporanData:v1';
    var cache = CacheService.getScriptCache();
    try {
        var cached = _getCacheChunked(cache, cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && parsed.summary) return parsed;
            _removeCacheChunked(cache, cacheKey);
        }
    } catch (e) { }

    try {
        requireAuthorized();

        const ss = getGlobalSpreadsheet();
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);

        const baReportSheet = ss.getSheetByName(BA_SHEET_NAME);
        const hasLog = logSheet && logSheet.getLastRow() > 1;
        const hasBa = baReportSheet && baReportSheet.getLastRow() > 1;
        if (!hasLog && !hasBa) return { error: "Data kosong" };

        const logData = hasLog ? logSheet.getDataRange().getDisplayValues() : [];
        const logHeaders = logData.length > 0 ? logData.shift() : [];

        const getIdx = (headers, names) => {
            const namesLower = names.map(n => n.toLowerCase());
            for (let i = 0; i < headers.length; i++) {
                if (namesLower.includes(headers[i].toLowerCase().trim())) return i;
            }
            return -1;
        };

        const iTimestamp = getIdx(logHeaders, ['Timestamp', 'Waktu']);
        const iStatus = getIdx(logHeaders, ['Status', 'Status Final']);
        const iJenis = getIdx(logHeaders, ['Jenis Kegiatan', 'Jenis']);
        const iDetail = getIdx(logHeaders, ['Detail Kegiatan', 'Detail', 'Keterangan']);
        const iBlok = getIdx(logHeaders, ['Blok']);
        const iTglKegiatan = getIdx(logHeaders, ['Tanggal Pelaksanaan', 'Tanggal Kegiatan', 'Tanggal']);
        let iDosen = getIdx(logHeaders, ['Dosen', 'Dosen Penguji', 'Dosen Pembimbing']);
        const iPilUjian = getIdx(logHeaders, ['Pilihan Ujian', 'Detail Ujian']);
        const iTglUjian = getIdx(logHeaders, ['Tanggal Ujian']);
        const iPilSgd = getIdx(logHeaders, ['Pilihan SGD']);
        const iDetSgd = getIdx(logHeaders, ['Detail SGD']);
        const iTglSgd = getIdx(logHeaders, ['Tanggal SGD']);
        const iPilKkd = getIdx(logHeaders, ['Pilihan KKD']);
        const iDetKkd = getIdx(logHeaders, ['Detail KKD']);
        const iTglKkd = getIdx(logHeaders, ['Tanggal KKD']);
        const iPilLab = getIdx(logHeaders, ['Pilihan LAB 1', 'Pilihan LAB']);
        const iKegLab = getIdx(logHeaders, ['Kegiatan LAB 1', 'Detail LAB']);
        const iTglLab = getIdx(logHeaders, ['Tanggal Praktikum 1', 'Tanggal Praktkum 1', 'Tanggal Praktkum']);
        const iIdPengajuan = getIdx(logHeaders, ['ID Pengajuan', 'IdPengajuan']);

        let checkMap = {}; // Key by "npm|idPengajuan" or just npm if no id
        if (checkSheet && checkSheet.getLastRow() > 1) {
            const checkData = checkSheet.getDataRange().getDisplayValues();
            const checkHeaders = checkData.shift();
            const ciNpm = getIdx(checkHeaders, ['NPM', 'NIM']);
            const ciBiaya = getIdx(checkHeaders, ['Biaya', 'Biaya Kegiatan']);
            const ciDosen = getIdx(checkHeaders, ['Dosen', 'Dosen Penguji']);
            const ciAcc = getIdx(checkHeaders, ['ACC INHAL', 'Link ACC INHAL', 'Link ACC']);
            const ciStatusFinal = getIdx(checkHeaders, ['Status Final', 'Status']);
            const ciTPel = getIdx(checkHeaders, ['Tanggal Pelaksanaan']);
            const ciJenis = getIdx(checkHeaders, ['Jenis Kegiatan', 'Jenis']);
            const ciDetail = getIdx(checkHeaders, ['Detail Kegiatan', 'Detail']);
            const ciIdPengajuan = getIdx(checkHeaders, ['ID Pengajuan', 'IdPengajuan']);

            checkData.forEach(row => {
                const npm = ciNpm >= 0 ? String(row[ciNpm]).trim() : '';
                const idPengajuan = ciIdPengajuan >=0 ? String(row[ciIdPengajuan]).trim() : '';
                if (npm) {
                    const key = idPengajuan ? `${npm}|${idPengajuan}` : npm;
                    checkMap[key] = {
                        biaya: ciBiaya >= 0 ? parseCurrency(row[ciBiaya]) : 0,
                        dosen: ciDosen >= 0 ? row[ciDosen] : '',
                        acc: ciAcc >= 0 ? row[ciAcc] : '',
                        statusFinal: ciStatusFinal >= 0 ? row[ciStatusFinal] : '',
                        tanggalPelaksanaan: ciTPel >= 0 ? row[ciTPel] : '',
                        jenis: ciJenis >= 0 ? row[ciJenis] : '',
                        detail: ciDetail >= 0 ? row[ciDetail] : ''
                    };
                }
            });
        }

        let totalPendaftar = 0;
        let totalDiterima = 0;
        let totalDitolak = 0;
        let totalBiaya = 0;

        const trendMap = {}; 
        const jenisMap = {}; 
        const dosenMap = {}; 
        const blokMap = {};  
        const bagianRows = [];
        const bagianIndex = {};
        const bagianFilters = { bagian: ['SGD', 'KKD', 'Ujian', 'Praktikum'], pilihan: [], detail: [], blok: [], sumber: ['LogData', 'Berita Acara'] };

        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        const normalizeSpace = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const splitMulti = (raw) => {
            const cleaned = normalizeSpace(raw);
            if (!cleaned) return [];
            return cleaned.split(/[,;/|]+|\s+dan\s+/i).map(s => normalizeSpace(s)).filter(Boolean);
        };
        const pushUnique = (list, value) => {
            const v = normalizeSpace(value);
            if (!v) return;
            if (list.indexOf(v) === -1) list.push(v);
        };
        const addBagianRow = (bagian, pilihan, detail, tanggal, blok, sumber) => {
            const pilihanText = normalizeSpace(pilihan);
            if (!pilihanText) return;
            const detailText = normalizeSpace(detail);
            const jenisKegiatan = detailText ? `${pilihanText} - ${detailText}` : pilihanText;
            const tglText = normalizeSpace(tanggal) || '-';
            const blokText = normalizeSpace(blok) || '-';
            const sumberText = normalizeSpace(sumber) || 'LogData';
            const key = [sumberText, bagian, blokText, jenisKegiatan, tglText].join('|');
            if (bagianIndex[key] !== undefined) {
                bagianRows[bagianIndex[key]].total += 1;
            } else {
                bagianIndex[key] = bagianRows.length;
                bagianRows.push({
                    bagian,
                    blok: blokText,
                    total: 1,
                    jenisKegiatan,
                    tanggalPelaksanaan: tglText,
                    pilihan: pilihanText,
                    detail: detailText,
                    sumber: sumberText
                });
            }
            pushUnique(bagianFilters.blok, blokText);
            pushUnique(bagianFilters.pilihan, pilihanText);
            if (detailText) pushUnique(bagianFilters.detail, detailText);
        };

        const baKategori = (bagian) => {
            const b = normalizeSpace(bagian).toLowerCase();
            if (b.indexOf('praktikum') !== -1) return 'Praktikum';
            if (b.indexOf('sgd') !== -1) return 'SGD';
            if (b.indexOf('kkd') !== -1) return 'KKD';
            if (b.indexOf('ujian') !== -1) return 'Ujian';
            return normalizeSpace(bagian) || 'Lainnya';
        };
        const addBaBagianRow = (baRow) => {
            const kategori = baKategori(baRow['Bagian']);
            const pilihanText = kategori === 'Praktikum'
                ? normalizeSpace(String(baRow['Bagian']).replace(/^Praktikum\s*/i, ''))
                : '';
            const detailText = normalizeSpace(baRow['Nama Kegiatan']);
            const jenisKegiatan = detailText || 'Berita Acara';
            const tglText = normalizeSpace(baRow['Tanggal Pelaksanaan']) || '-';
            const blokText = normalizeSpace(baRow['Blok']) || '-';
            const baIdText = normalizeSpace(baRow['BA ID']) || 'BA';
            const sumberText = 'Berita Acara';
            const key = [sumberText, baIdText, kategori, blokText, jenisKegiatan, tglText].join('|');
            if (bagianIndex[key] !== undefined) {
                bagianRows[bagianIndex[key]].total += Number(baRow['Jumlah Peserta']) || 0;
            } else {
                bagianIndex[key] = bagianRows.length;
                bagianRows.push({
                    bagian: kategori,
                    blok: blokText,
                    total: Number(baRow['Jumlah Peserta']) || 0,
                    jenisKegiatan,
                    tanggalPelaksanaan: tglText,
                    pilihan: pilihanText,
                    detail: detailText,
                    sumber: sumberText,
                    fileUrl: normalizeSpace(baRow['File URL'])
                });
            }
            pushUnique(bagianFilters.blok, blokText);
            if (pilihanText) pushUnique(bagianFilters.pilihan, pilihanText);
            if (detailText) pushUnique(bagianFilters.detail, detailText);
        };

        const iNpmLog = getIdx(logHeaders, ['NPM', 'NIM']);
        const iNamaLog = getIdx(logHeaders, ['Nama Lengkap', 'Nama', 'Nama Mahasiswa']);
        logData.forEach(row => {
            totalPendaftar++;

            const statusRaw = iStatus >= 0 ? row[iStatus] : '';
            const status = statusRaw.toLowerCase();
            const isAccepted = status.includes('diterima') || status.includes('acc') || status.includes('setuju');
            const isRejected = status.includes('ditolak');
            const isPending = status.includes('menunggu');
            if (isAccepted) totalDiterima++;
            if (isRejected) totalDitolak++;

            const npm = iNpmLog >= 0 ? String(row[iNpmLog]).trim() : '';
            const idPengajuan = iIdPengajuan >= 0 ? String(row[iIdPengajuan]).trim() : '';
            
            // Find check entry: try npm|idPengajuan first, then npm
            let checkKey = null;
            let check = null;
            if (npm) {
                if (idPengajuan) checkKey = `${npm}|${idPengajuan}`;
                if (!checkKey || !checkMap[checkKey]) checkKey = npm;
                if (checkMap[checkKey]) check = checkMap[checkKey];
            }

            if (check) {
                totalBiaya += check.biaya || 0;
            }

            if (iTimestamp >= 0 && row[iTimestamp]) {
                try {
                    const d = new Date(row[iTimestamp]);
                    if (!isNaN(d.getTime())) {
                        const year = d.getFullYear().toString().slice(-2);
                        const mStr = months[d.getMonth()] + " '" + year;
                        trendMap[mStr] = (trendMap[mStr] || 0) + 1;
                    }
                } catch (e) { }
            }

            const jenis = iJenis >= 0 ? (row[iJenis] || 'Lainnya').trim() : 'Lainnya';
            if (jenis) {
                jenisMap[jenis] = (jenisMap[jenis] || 0) + 1;
            }

            let dosenName = '';
            if (check && check.dosen) {
                dosenName = check.dosen;
            } else if (iDosen >= 0) {
                dosenName = row[iDosen];
            }
            // If still no dosenName, use "Belum Ditentukan"
            if (!dosenName) dosenName = 'Belum Ditentukan';

            // MODIFIED: Only process if status is Accepted or ACC
            if (isAccepted) {
                dosenName = dosenName.trim();
                if (!dosenMap[dosenName]) {
                    dosenMap[dosenName] = {
                        total: 0,
                        beban: {},
                        statusLengkap: true,
                        totalBiaya: 0,
                        blokSet: {},
                        blokList: [],
                        tanggalList: [],
                        accList: [],
                        detailList: [],
                        studentSet: {},
                        students: []
                    };
                }
                dosenMap[dosenName].total++;
                const jenisCheck = check && check.jenis ? String(check.jenis).trim() : '';
                const jenisFinal = jenisCheck || jenis;
                dosenMap[dosenName].beban[jenisFinal] = (dosenMap[dosenName].beban[jenisFinal] || 0) + 1;
                if (check) {
                    dosenMap[dosenName].totalBiaya += check.biaya || 0;
                }
                const statusText = (check && check.statusFinal ? check.statusFinal : statusRaw) || '';
                const accOk = (check && check.acc) || String(statusText).toLowerCase().includes('acc') || String(statusText).toLowerCase().includes('diterima') || String(statusText).toLowerCase().includes('setuju');
                if (!accOk) dosenMap[dosenName].statusLengkap = false;
                const blokVal = iBlok >= 0 ? (row[iBlok] || '').trim() : '';
                if (blokVal) {
                    const blokKey = blokVal.toLowerCase();
                    if (!dosenMap[dosenName].blokSet[blokKey]) {
                        dosenMap[dosenName].blokSet[blokKey] = true;
                        dosenMap[dosenName].blokList.push(blokVal);
                    }
                }
                const tPel = (check && check.tanggalPelaksanaan ? check.tanggalPelaksanaan : '') || (iTglKegiatan >= 0 ? row[iTglKegiatan] : '');
                if (tPel) dosenMap[dosenName].tanggalList.push(tPel);
                const detailRaw = (check && check.detail ? check.detail : '') || (iDetail >= 0 ? (row[iDetail] || '') : '');
                const detailText = [jenisFinal, detailRaw].map(v => String(v || '').trim()).filter(Boolean).join(' - ');
                if (detailText) dosenMap[dosenName].detailList.push(detailText);
                if (accOk) {
                    const accItem = check && check.acc ? check.acc : 'ok';
                    dosenMap[dosenName].accList.push(accItem);
                }
                const npmText = npm;
                const namaText = iNamaLog >= 0 ? String(row[iNamaLog] || '').trim() : '';
                const studentKey = npmText || namaText;
                if (studentKey && !dosenMap[dosenName].studentSet[studentKey]) {
                    dosenMap[dosenName].studentSet[studentKey] = true;
                    dosenMap[dosenName].students.push({ npm: npmText, nama: namaText });
                }
            }

            // MODIFIED: Only process if status is Accepted or ACC
            if (isAccepted) {
                const blok = iBlok >= 0 ? (row[iBlok] || 'Uncategorized').trim() : 'Uncategorized';
                if (blok) {
                    if (!blokMap[blok]) blokMap[blok] = { total: 0, types: {} };
                    blokMap[blok].total++;
                    blokMap[blok].types[jenis] = (blokMap[blok].types[jenis] || 0) + 1;
                }

                const jenisKey = String(jenis || '').toLowerCase().trim();
                const blokVal = iBlok >= 0 ? row[iBlok] : '';
                if (jenisKey === 'sgd') {
                    const pilihanList = splitMulti(iPilSgd >= 0 ? row[iPilSgd] : '');
                    const detailList = splitMulti(iDetSgd >= 0 ? row[iDetSgd] : '');
                    const tanggalVal = iTglSgd >= 0 ? row[iTglSgd] : '';
                    const detailFinal = detailList.length ? detailList : [''];
                    pilihanList.forEach(p => {
                        detailFinal.forEach(d => addBagianRow('SGD', p, d, tanggalVal, blokVal));
                    });
                } else if (jenisKey === 'kkd') {
                    const pilihanList = splitMulti(iPilKkd >= 0 ? row[iPilKkd] : '');
                    const detailList = splitMulti(iDetKkd >= 0 ? row[iDetKkd] : '');
                    const tanggalVal = iTglKkd >= 0 ? row[iTglKkd] : '';
                    const detailFinal = detailList.length ? detailList : [''];
                    pilihanList.forEach(p => {
                        detailFinal.forEach(d => addBagianRow('KKD', p, d, tanggalVal, blokVal));
                    });
                } else if (jenisKey === 'ujian') {
                    const pilihanList = splitMulti(iPilUjian >= 0 ? row[iPilUjian] : '');
                    const tanggalVal = iTglUjian >= 0 ? row[iTglUjian] : '';
                    pilihanList.forEach(p => addBagianRow('Ujian', p, '', tanggalVal, blokVal));
                } else if (jenisKey === 'praktikum') {
                    const pilihanList = splitMulti(iPilLab >= 0 ? row[iPilLab] : '');
                    const detailList = splitMulti(iKegLab >= 0 ? row[iKegLab] : '');
                    const tanggalVal = iTglLab >= 0 ? row[iTglLab] : '';
                    const detailFinal = detailList.length ? detailList : [''];
                    pilihanList.forEach(p => {
                        detailFinal.forEach(d => addBagianRow('Praktikum', p, d, tanggalVal, blokVal));
                    });
                }
            }
        });

        // Gabungkan Berita Acara (hasil upload bagian.html) ke Laporan Bagian
        if (hasBa) {
            const baData = baReportSheet.getDataRange().getDisplayValues();
            const baHeaders = baData.shift() || [];
            const baHeaderIdx = {};
            baHeaders.forEach(function (h, i) { baHeaderIdx[String(h).trim()] = i; });
            const bGet = function (row, name) { return baHeaderIdx[name] !== undefined ? row[baHeaderIdx[name]] : ''; };
            baData.forEach(function (brow) {
                if (String(bGet(brow, 'BA ID') || '').trim() === '' && String(bGet(brow, 'Nama Kegiatan') || '').trim() === '') return;
                addBaBagianRow({
                    'Bagian': bGet(brow, 'Bagian'),
                    'Blok': bGet(brow, 'Blok'),
                    'Nama Kegiatan': bGet(brow, 'Nama Kegiatan'),
                    'Tanggal Pelaksanaan': bGet(brow, 'Tanggal Pelaksanaan'),
                    'Jumlah Peserta': bGet(brow, 'Jumlah Peserta'),
                    'File URL': bGet(brow, 'File URL'),
                    'BA ID': bGet(brow, 'BA ID')
                });
            });
        }

        const mhsSheet = ss.getSheetByName(NAMA_SHEET_MHS);
        if (mhsSheet && mhsSheet.getLastRow() > 1) {
            const lastRow = mhsSheet.getLastRow();
            const readCol = (col) => mhsSheet.getRange(2, col, lastRow - 1, 1).getDisplayValues().map(r => normalizeSpace(r[0])).filter(Boolean);
            const ujianOpts = readCol(8);
            const sgdOpts = readCol(9);
            const kkdOpts = readCol(10);
            const labOpts = readCol(13);
            ujianOpts.forEach(v => pushUnique(bagianFilters.pilihan, v));
            sgdOpts.forEach(v => pushUnique(bagianFilters.pilihan, v));
            kkdOpts.forEach(v => pushUnique(bagianFilters.pilihan, v));
            labOpts.forEach(v => pushUnique(bagianFilters.pilihan, v));
        }
        ['Remediasi', 'Inhal', 'Praktikum', 'Posttest'].forEach(v => pushUnique(bagianFilters.detail, v));
        const dosenList = Object.keys(dosenMap).map(name => {
            const d = dosenMap[name];
            const bebanStr = Object.entries(d.beban).map(([k, v]) => `${v} ${k}`).join(', ');
            return {
                nama: name,
                total: d.total,
                beban: bebanStr,
                buktiAcc: d.statusLengkap ? 'Lengkap' : 'Belum',
                totalBiaya: d.totalBiaya || 0,
                blokList: d.blokList || [],
                tanggalList: d.tanggalList || [],
                detailList: d.detailList || [],
                accItems: d.accList || [],
                students: d.students || []
            };
        }).sort((a, b) => b.total - a.total);
        const blokList = Object.keys(blokMap).map(name => {
            const b = blokMap[name];
            return {
                nama: name,
                total: b.total,
                types: b.types
            };
        }).sort((a, b) => b.total - a.total);

        const result = {
            summary: {
                total: totalPendaftar,
                accepted: totalDiterima,
                rejected: totalDitolak,
                revenue: totalBiaya
            },
            trend: trendMap,
            jenis: jenisMap,
            dosen: dosenList,
            blok: blokList,
            bagian: bagianRows,
            bagianFilters
        };
        try {
            _setCacheChunked(cache, cacheKey, JSON.stringify(result), CACHE_EXPIRATION);
        } catch (e) { }
        return result;

    } catch (e) {
        console.error("Error getDetailLaporanData: " + e.message);
        return { error: e.message };
    }
}

function parseCurrency(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const clean = str.toString().replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
}

function updateStatusAndSendEmail(rowIndex, newStatus, rejectionReason) {
    try {
        requireAuthorized();
        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) {
            return { success: false, message: 'Sheet LogData tidak tersedia.' };
        }
        if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
            return { success: false, message: 'Baris data tidak valid.' };
        }

        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        let colCatatanIdx = headers.indexOf('Catatan Admin') + 1;
        if (colCatatanIdx <= 0) {
            colCatatanIdx = headers.indexOf('Catatan') + 1;
        }
        if (colCatatanIdx <= 0) {
            colCatatanIdx = headers.length + 1;
            headers.push('Catatan Admin');
        }

        if (sheet.getMaxColumns() < colCatatanIdx) {
            sheet.insertColumnsAfter(sheet.getMaxColumns(), colCatatanIdx - sheet.getMaxColumns());
            headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        }

        sheet.getRange(1, colCatatanIdx).setValue('Catatan Admin');

        const adminNote = rejectionReason || '-';
        sheet.getRange(rowIndex, colCatatanIdx).setValue(adminNote);

        let statusColIndex = headers.indexOf("Status") + 1;
        if (statusColIndex <= 0) {
            statusColIndex = headers.length + 1;
            sheet.getRange(1, statusColIndex).setValue('Status');
            headers.push('Status');
        }

        let notifColIndex = headers.indexOf("Notifikasi Terkirim Pada") + 1;
        if (notifColIndex <= 0) {
            notifColIndex = headers.length + 1;
            sheet.getRange(1, notifColIndex).setValue('Notifikasi Terkirim Pada');
            headers.push('Notifikasi Terkirim Pada');
        }

        let emailStatusColIndex = headers.indexOf('Status Notifikasi Email') + 1;
        if (emailStatusColIndex <= 0) {
            emailStatusColIndex = headers.length + 1;
            sheet.getRange(1, emailStatusColIndex).setValue('Status Notifikasi Email');
            headers.push('Status Notifikasi Email');
        }

        let emailErrorColIndex = headers.indexOf('Error Notifikasi Email') + 1;
        if (emailErrorColIndex <= 0) {
            emailErrorColIndex = headers.length + 1;
            sheet.getRange(1, emailErrorColIndex).setValue('Error Notifikasi Email');
            headers.push('Error Notifikasi Email');
        }

        sheet.getRange(rowIndex, statusColIndex).setValue(newStatus);
        sheet.getRange(rowIndex, notifColIndex).setValue('');
        sheet.getRange(rowIndex, emailStatusColIndex).setValue('Menunggu');
        sheet.getRange(rowIndex, emailErrorColIndex).setValue('');

        let nsColIndex = headers.indexOf('Nomor Surat') + 1;
        let nomorSurat = '';
        if (newStatus === 'Diterima') {
            nomorSurat = getNextSuratNumberYearly('INHAL');
            if (nsColIndex <= 0) {
                nsColIndex = headers.length + 1;
                sheet.getRange(1, nsColIndex).setValue('Nomor Surat');
                headers.push('Nomor Surat');
            }
            sheet.getRange(rowIndex, nsColIndex).setValue(nomorSurat);
        }

        let dataRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
        let rowData = {};
        headers.forEach((header, i) => { rowData[header] = dataRow[i]; });
        rowData['Status'] = newStatus;
        rowData['Catatan Admin'] = adminNote;
        rowData['Catatan'] = adminNote;
        if (nomorSurat) rowData['Nomor Surat'] = nomorSurat;

        const checkSync = _upsertCheckDataFromLogRow(rowData, {
            idPengajuan: rowData['ID Pengajuan'],
            statusFinal: newStatus,
            catatanAdmin: adminNote,
            linkSurat: rowData['Link Surat Keterangan'] || rowData['Link Surat'] || ''
        });

        const enhancedData = enhanceDataForTemplate(rowData);
        enhancedData.Status = newStatus;
        enhancedData.TanggalPengajuan = formatIndonesianDate(rowData.Timestamp || rowData['Tanggal Pengajuan'] || new Date());
        enhancedData['Catatan Admin'] = adminNote;
        enhancedData['Catatan'] = adminNote;
        if (nomorSurat) enhancedData.NomorSurat = nomorSurat;

        if (newStatus === 'Ditolak') {
            enhancedData.AlasanPenolakan = adminNote;
        }

        const templateId = newStatus === 'Diterima' ? TEMPLATE_DITERIMA_ID : TEMPLATE_DITOLAK_ID;
        const warnings = [];
        let pdfBlob = null;
        try {
            pdfBlob = _createPdfFromTemplate(templateId, enhancedData, newStatus);
        } catch (ePdf) {
            warnings.push('PDF notifikasi gagal dibuat: ' + (ePdf && ePdf.message ? ePdf.message : ePdf));
        }

        if (pdfBlob) {
            try {
                let attachmentUrl = '';
                const folder = DriveApp.getFolderById(FOLDER_ID);
                const savedFile = folder.createFile(pdfBlob).setName(pdfBlob.getName());
                attachmentUrl = savedFile.getUrl();
                // Resolve kolom 'Lampiran Email' berdasarkan header, bukan hardcode kolom 49
                headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                let lampiranCol = headers.indexOf('Lampiran Email') + 1;
                if (lampiranCol <= 0) {
                    lampiranCol = headers.length + 1;
                    sheet.getRange(1, lampiranCol).setValue('Lampiran Email');
                }
                sheet.getRange(rowIndex, lampiranCol).setValue(attachmentUrl);
            } catch (eAttach) {
                warnings.push('Lampiran PDF gagal disimpan ke Drive: ' + (eAttach && eAttach.message ? eAttach.message : eAttach));
                console.error('Gagal menyimpan lampiran status ke Drive/LogData:', eAttach && eAttach.message ? eAttach.message : eAttach);
            }
        }

        const recipientEmail = String(rowData.Email || rowData['Email Address'] || '').trim();
        if (!recipientEmail) {
            warnings.push('Email mahasiswa tidak ditemukan.');
        } else if (pdfBlob) {
            try {
                _sendNotificationEmail(recipientEmail, newStatus, pdfBlob, rowData);
                sheet.getRange(rowIndex, notifColIndex).setValue(new Date().toLocaleString());
                sheet.getRange(rowIndex, emailStatusColIndex).setValue('Berhasil');
                sheet.getRange(rowIndex, emailErrorColIndex).setValue('');
            } catch (eMail) {
                var emailError = eMail && eMail.message ? eMail.message : String(eMail);
                warnings.push(emailError);
                sheet.getRange(rowIndex, emailStatusColIndex).setValue('Gagal');
                sheet.getRange(rowIndex, emailErrorColIndex).setValue(emailError);
            }
        } else {
            warnings.push('Email notifikasi tidak dikirim karena PDF belum tersedia.');
        }

        if (!recipientEmail) {
            sheet.getRange(rowIndex, emailStatusColIndex).setValue('Gagal');
            sheet.getRange(rowIndex, emailErrorColIndex).setValue('Email mahasiswa tidak ditemukan.');
        } else if (!pdfBlob) {
            sheet.getRange(rowIndex, emailStatusColIndex).setValue('Gagal');
            sheet.getRange(rowIndex, emailErrorColIndex).setValue('PDF notifikasi belum tersedia.');
        }

        if (!checkSync || !checkSync.success) {
            warnings.push('Sinkronisasi CheckData gagal: ' + ((checkSync && checkSync.message) ? checkSync.message : 'unknown error'));
        }

        _clearCheckPageCache();
        _clearStudentPortalCache(rowData['NPM']);

        var message = "Status '" + newStatus + "' berhasil disimpan untuk " + (rowData['Nama Lengkap'] || 'mahasiswa');
        if (recipientEmail && pdfBlob && warnings.length === 0) {
            message = "Notifikasi '" + newStatus + "' berhasil dikirim ke " + (rowData['Nama Lengkap'] || 'mahasiswa');
        } else if (warnings.length > 0) {
            message += '. ' + warnings.join('. ');
        }
        return { success: true, message: message, warnings: warnings };
    } catch (e) {
        console.error('❌ Error in updateStatusAndSendEmail:', e.message);
        return { success: false, message: 'Gagal mengupdate status: ' + e.message };
    }
}

function updateCatatanAdmin(rowIndex, newCatatan) {
    try {
        requireAuthorized();
        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const prefer = ['Catatan Admin', 'Catatan', 'Keterangan'];
        let colIdx = -1;
        for (let i = 0; i < prefer.length; i++) {
            const idx = headers.indexOf(prefer[i]);
            if (idx !== -1) { colIdx = idx + 1; break; }
        }
        if (colIdx === -1) {
            colIdx = headers.length + 1;
            sheet.getRange(1, colIdx).setValue('Catatan Admin');
        }
        sheet.getRange(rowIndex, colIdx).setValue(newCatatan || '');
        _clearCheckPageCache();
        return { success: true };
    } catch (e) {
        console.error('❌ Error in updateCatatanAdmin:', e.message);
        return { success: false, message: 'Gagal mengupdate catatan: ' + e.message };
    }
}

function updateSubmissionEmail(rowIndex, newEmail) {
    try {
        requireAuthorized();
        var email = String(newEmail || '').trim();
        if (!email) {
            return { success: false, message: 'Email tidak boleh kosong.' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { success: false, message: 'Format email tidak valid.' };
        }

        var sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) {
            return { success: false, message: 'Data LogData tidak tersedia.' };
        }
        if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
            return { success: false, message: 'Baris data tidak valid.' };
        }

        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var idxEmail = headers.indexOf('Email');
        var idxEmailAddress = headers.indexOf('Email Address');
        var lastCol = sheet.getLastColumn();

        if (idxEmail === -1 && idxEmailAddress === -1) {
            idxEmailAddress = lastCol;
            sheet.getRange(1, lastCol + 1).setValue('Email Address');
            headers.push('Email Address');
        }

        if (idxEmail !== -1) {
            sheet.getRange(rowIndex, idxEmail + 1).setValue(email);
        }
        if (idxEmailAddress !== -1) {
            sheet.getRange(rowIndex, idxEmailAddress + 1).setValue(email);
        }

        _clearCheckPageCache();
        return { success: true, message: 'Email mahasiswa berhasil diperbarui.', email: email };
    } catch (e) {
        console.error('updateSubmissionEmail error:', e);
        return { success: false, message: e && e.message ? e.message : 'Unknown error' };
    }
}

function _deleteRelatedRowsFromSheet(sheet, ref) {
    if (!sheet || sheet.getLastRow() < 2 || !ref) return 0;

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var idxId = headers.indexOf('ID Pengajuan');
    var idxNpm = headers.indexOf('NPM');
    if (idxNpm === -1) idxNpm = headers.indexOf('NIM');
    var idxJenis = headers.indexOf('Jenis Kegiatan');
    if (idxJenis === -1) idxJenis = headers.indexOf('Jenis');
    var idxDetail = headers.indexOf('Detail Kegiatan');
    if (idxDetail === -1) idxDetail = headers.indexOf('Detail');
    var idxTanggal = headers.indexOf('Tanggal');
    if (idxTanggal === -1) idxTanggal = headers.indexOf('Tanggal Kegiatan');
    if (idxTanggal === -1) idxTanggal = headers.indexOf('Tanggal Pelaksanaan');

    var normalizeLoose = function (v) {
        return String(v || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]/g, '');
    };

    var matched = [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rowId = idxId !== -1 ? String(row[idxId] || '').trim() : '';
        if (ref.idPengajuan && rowId && rowId === ref.idPengajuan) {
            matched.push(i + 2);
            continue;
        }

        var rowNpm = idxNpm !== -1 ? String(row[idxNpm] || '').trim() : '';
        if (!ref.npm || !rowNpm || rowNpm !== ref.npm) continue;

        var jenisOk = true;
        var detailOk = true;
        var tanggalOk = true;

        if (idxJenis !== -1 && ref.jenis) {
            var rowJenis = normalizeLoose(row[idxJenis]);
            var refJenis = normalizeLoose(ref.jenis);
            jenisOk = !refJenis || rowJenis === refJenis;
        }
        if (idxDetail !== -1 && ref.detail) {
            var rowDetail = normalizeLoose(row[idxDetail]);
            var refDetail = normalizeLoose(ref.detail);
            detailOk = !refDetail || rowDetail === refDetail || rowDetail.indexOf(refDetail) !== -1 || refDetail.indexOf(rowDetail) !== -1;
        }
        if (idxTanggal !== -1 && ref.tanggal) {
            var rowTanggal = normalizeLoose(row[idxTanggal]);
            var refTanggal = normalizeLoose(ref.tanggal);
            tanggalOk = !refTanggal || rowTanggal === refTanggal || rowTanggal.indexOf(refTanggal) !== -1 || refTanggal.indexOf(rowTanggal) !== -1;
        }

        if (jenisOk && detailOk && tanggalOk) {
            matched.push(i + 2);
        }
    }

    for (var j = matched.length - 1; j >= 0; j--) {
        sheet.deleteRow(matched[j]);
    }
    return matched.length;
}

function deleteLogRow(rowIndex, audit) {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) return { success: false, message: 'Tidak ada data' };

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const dataRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
        const rowObj = {};
        headers.forEach((h, i) => { rowObj[h] = dataRow[i]; });

        const auditSheet = ss.getSheetByName('AuditLog') || ss.insertSheet('AuditLog');
        if (auditSheet.getLastRow() === 0) {
            auditSheet.appendRow(['Timestamp', 'ActorEmail', 'Action', 'RowIndex', 'NPM', 'Nama Lengkap', 'Jenis Kegiatan', 'Detail Kegiatan', 'Tanggal', 'Reason']);
        }
        const actorEmail = (Session && Session.getActiveUser && Session.getActiveUser().getEmail) ? Session.getActiveUser().getEmail() : '';
        const detailKegiatan = rowObj['Detail Kegiatan'] || rowObj.DetailKegiatan || rowObj.Detail || '';
        const tanggal = rowObj['Tanggal'] || rowObj['Tanggal Kegiatan'] || rowObj.TanggalKegiatan || '';
        const npm = rowObj['NPM'] || rowObj.NPM || '';
        const nama = rowObj['Nama Lengkap'] || rowObj.NamaLengkap || '';
        const jenis = rowObj['Jenis Kegiatan'] || rowObj.JenisKegiatan || '';
        const reason = audit && audit.reason ? String(audit.reason) : '';
        const idPengajuan = (rowObj['ID Pengajuan'] || rowObj.IdPengajuan || '').toString().trim();
        const enhanced = enhanceDataForTemplate(rowObj);
        const ref = {
            idPengajuan: idPengajuan,
            npm: (npm || '').toString().trim(),
            jenis: jenis || '',
            detail: enhanced.DetailKegiatan || detailKegiatan || '',
            tanggal: enhanced.TanggalKegiatan || tanggal || ''
        };

        auditSheet.appendRow([new Date(), actorEmail, 'DELETE_LOGDATA', rowIndex, npm, nama, jenis, detailKegiatan, tanggal, reason]);

        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME) || ss.getSheetByName('Check');
        const uploadSheet = ss.getSheetByName(UPLOAD_LOG_SHEET_NAME);
        const deletedCheckRows = _deleteRelatedRowsFromSheet(checkSheet, ref);
        const deletedUploadRows = _deleteRelatedRowsFromSheet(uploadSheet, ref);

        sheet.deleteRow(rowIndex);
        _clearCheckPageCache();
        return {
            success: true,
            message: 'Data pengajuan berhasil dihapus.',
            deletedCheckRows: deletedCheckRows,
            deletedUploadRows: deletedUploadRows
        };
    } catch (e) {
        console.error('deleteLogRow error:', e);
        return { success: false, message: e && e.message ? e.message : 'Unknown error' };
    }
}

function enhanceDataForTemplate(data) {
    const currentDate = new Date();
    const enhanced = { ...data };

    enhanced.NomorSurat = data['Nomor Surat'] || '';
    enhanced.Bulan = getRomanMonth(currentDate.getMonth() + 1);
    enhanced.Tahun = currentDate.getFullYear().toString();
    enhanced.TanggalSurat = formatIndonesianDate(currentDate);

    const jenisKegiatan = data['Jenis Kegiatan'] || '';
    if (jenisKegiatan === 'Ujian') {
        enhanced.DetailKegiatan = data['Pilihan Ujian'] || '';
        const rawTanggal = data['Tanggal Ujian'] || '';
        enhanced.TanggalKegiatan = rawTanggal ? formatIndonesianDate(rawTanggal) : '';
    } else if (jenisKegiatan === 'SGD') {
        enhanced.DetailKegiatan = `${data['Pilihan SGD'] || ''} - ${data['Detail SGD'] || ''}`;
        const rawTanggal = data['Tanggal SGD'] || '';
        enhanced.TanggalKegiatan = rawTanggal ? formatIndonesianDate(rawTanggal) : '';
    } else if (jenisKegiatan === 'KKD') {
        enhanced.DetailKegiatan = `${data['Pilihan KKD'] || ''} - ${data['Detail KKD'] || ''}`;
        const rawTanggal = data['Tanggal KKD'] || '';
        enhanced.TanggalKegiatan = rawTanggal ? formatIndonesianDate(rawTanggal) : '';
    } else if (jenisKegiatan === 'Praktikum') {
        const labs = [];
        for (let i = 1; i <= 9; i++) {
            const lab = data[`Pilihan LAB ${i}`];
            if (lab) labs.push(lab);
        }
        enhanced.DetailKegiatan = labs.join(', ') || '';
        const rawTanggal = getFirstPraktikumTanggal(collectPraktikumEntries(function(headerName) {
            return data[headerName] || '';
        }));
        enhanced.TanggalKegiatan = rawTanggal ? formatIndonesianDate(rawTanggal) : '';
    }

    enhanced.Catatan = (data['Catatan Admin'] || data['Catatan'] || data['Keterangan'] || '');
    enhanced['Catatan Admin'] = data['Catatan Admin'] || data.CatatanAdmin || enhanced.Catatan || '';
    enhanced.Keterangan = data['Keterangan'] || data.Keterangan || data['Detail Kegiatan'] || data.DetailKegiatan || data.Detail || '';
    enhanced['No. HP/WA'] = data['No. HP/WA'] || data.NoHPWA || data.NoHP || data['NoHP'] || '';

    try {
        const ts = data.Timestamp || data['Tanggal Pengajuan'];
        if (ts) {
            enhanced.TanggalPengajuan = formatIndonesianDate(ts);
        }
    } catch (e) {
        enhanced.TanggalPengajuan = '';
    }
    return enhanced;
}

function _sendNotificationEmail(recipient, status, attachment, data) {
    try {
        recipient = String(recipient || '').trim();
        if (!recipient) {
            throw new Error('Email penerima kosong.');
        }
        if (!attachment) {
            throw new Error('Lampiran PDF belum tersedia.');
        }
        const subject = `Pemberitahuan Status Pendaftaran INHAL`;
        const catatan = (data['Catatan Admin'] || data['Catatan'] || data['Keterangan'] || '').toString().trim();
        const noteLine = catatan ? `

Catatan Admin: ${catatan}` : '';
        const body = `Assalamu'alaikum ${data['Nama Lengkap']}, ${data.NPM}.

Terlampir adalah surat pemberitahuan status pendaftaran INHAL Anda.${noteLine}

Wassalamu'alaikum
Admin Prodi`;
        MailApp.sendEmail({
            to: recipient,
            subject: subject,
            body: body,
            attachments: [attachment]
        });
        console.log('✅ Notification email sent to:', recipient);
    } catch (e) {
        console.error('❌ Error sending notification email:', e.message);
        throw new Error('Gagal mengirim email notifikasi: ' + e.message);
    }
}

function normalizeTemplateFileName(templateRef) {
    return String(templateRef || '').trim().replace(/\.html$/i, '');
}

function escapeHtmlForTemplate(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\r\n|\r|\n/g, '<br />');
}

function stripPdfPreviewArtifacts(html) {
    return String(html || '')
        .replace(/<div class="preview-bar no-print">[\s\S]*?<\/div>/gi, '')
        .replace(/<p class="hint no-print">[\s\S]*?<\/p>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '');
}

function _renderPdfTemplateHtml(templateRef, data, status) {
    const fileName = normalizeTemplateFileName(templateRef);
    let html = HtmlService.createHtmlOutputFromFile(fileName).getContent();

    Object.keys(data || {}).forEach(function(key) {
        const token = `{{${key}}}`;
        html = html.split(token).join(escapeHtmlForTemplate(data[key]));
    });

    if (fileName === 'template-acc-diterima-ditolak') {
        const bodyClass = status === 'Ditolak' ? 'show-ditolak' : 'show-diterima';
        html = html.replace(/<body\b[^>]*>/i, `<body class="${bodyClass}">`);
    }

    return stripPdfPreviewArtifacts(html);
}

function _createPdfFromTemplate(templateId, data, status) {
    try {
        const renderedHtml = _renderPdfTemplateHtml(templateId, data, status);
        const pdfBlob = HtmlService.createHtmlOutput(renderedHtml)
            .getBlob()
            .getAs(MimeType.PDF);
        pdfBlob.setName(`${status}_INHAL_${data.NPM}_${data['Nama Lengkap']}.pdf`);
        return pdfBlob;
    } catch (e) {
        console.error("❌ Error creating PDF:", e.message);
        throw new Error("Gagal membuat PDF: " + e.message);
    }
}

function getRomanMonth(month) {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romans[month - 1] || 'I';
}

function formatIndonesianDate(date) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function ensureNomorSuratSheet() {
    const ss = getGlobalSpreadsheet();
    let sheet = ss.getSheetByName('NomorSurat');
    if (!sheet) {
        sheet = ss.insertSheet('NomorSurat');
    }
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Type', 'Tahun', 'LastNumber', 'UpdatedAt']);
    }
    return sheet;
}

function getNextSuratNumberYearly(type) {
    type = type || 'INHAL';
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const now = new Date();
        const year = now.getFullYear();
        const romanMonth = getRomanMonth(now.getMonth() + 1);

        const sheet = ensureNomorSuratSheet();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const iType = headers.indexOf('Type');
        const iTahun = headers.indexOf('Tahun');
        const iLast = headers.indexOf('LastNumber');
        const iUpdated = headers.indexOf('UpdatedAt');

        const lastRow = sheet.getLastRow();
        let rowIndex = -1;
        if (lastRow > 1) {
            const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
            for (let r = 0; r < data.length; r++) {
                const row = data[r];
                if ((row[iType] || '') === type && Number(row[iTahun]) === year) {
                    rowIndex = r + 2;
                    break;
                }
            }
        }

        let nextNum = 1;
        if (rowIndex > 0) {
            const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
            const current = parseInt(row[iLast], 10) || 0;
            nextNum = current + 1;
            sheet.getRange(rowIndex, iLast + 1).setValue(nextNum);
            sheet.getRange(rowIndex, iUpdated + 1).setValue(new Date());
        } else {
            const values = new Array(headers.length).fill('');
            values[iType] = type;
            values[iTahun] = year;
            values[iLast] = nextNum; 
            values[iUpdated] = new Date();
            sheet.appendRow(values);
        }

        const seq = String(nextNum).padStart(3, '0');
        return `${seq}/${type}/FKIK-UMSU/${romanMonth}/${year}`;
    } finally {
        lock.releaseLock();
    }
}


function getAcceptedStudentData() {
    const all = _getAcceptedStudentData();
    if (!Array.isArray(all)) return all;
    return all.map(function(s) {
        const copy = Object.assign({}, s);
        delete copy.email;
        return copy;
    });
}

function _getAcceptedStudentData() {
    try {
        const ss = getGlobalSpreadsheet();
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME) || ss.getSheetByName('Check');
        const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
        
        if (!checkSheet || checkSheet.getLastRow() < 2) {
            return [];
        }

        // Buat map email dari LogData berdasarkan NPM dan ID Pengajuan
        const emailMap = {};
        if (logSheet && logSheet.getLastRow() > 1) {
            const logData = logSheet.getDataRange().getValues();
            const logHeaders = logData.shift();
            const idxLogNpm = logHeaders.indexOf('NPM');
            const idxLogEmail = (logHeaders.indexOf('Email') >= 0) ? logHeaders.indexOf('Email') : logHeaders.indexOf('Email Address');
            const idxLogIdPengajuan = logHeaders.indexOf('ID Pengajuan');
            if (idxLogNpm !== -1 && idxLogEmail !== -1) {
                logData.forEach(row => {
                    const npm = String(row[idxLogNpm] || '').trim();
                    const email = String(row[idxLogEmail] || '').trim();
                    const idPengajuan = idxLogIdPengajuan !== -1 ? String(row[idxLogIdPengajuan] || '').trim() : '';
                    if (npm) {
                        emailMap[npm] = email;
                    }
                    if (idPengajuan) {
                        emailMap['id:' + idPengajuan] = email;
                    }
                });
            }
        }

        const data = checkSheet.getDataRange().getValues();
        const headers = data.shift();

        const getIdx = (names) => {
            for (let i = 0; i < names.length; i++) {
                const name = names[i];
                const idx = headers.indexOf(name);
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const idxNpm = getIdx(['NPM', 'NIM']);
        const idxNama = getIdx(['Nama Lengkap', 'Nama']);
        const idxBlok = getIdx(['Blok']);
        const idxJenis = getIdx(['Jenis Kegiatan']);
        const idxDetail = getIdx(['Detail Kegiatan']);
        const idxTanggal = getIdx(['Tanggal', 'Tanggal Kegiatan']);
        const idxIdPengajuan = getIdx(['ID Pengajuan', 'IdPengajuan']);
        const idxStatus = getIdx(['Status Final', 'Status']);
        const idxEmail = getIdx(['Email', 'Email Address']);

        if (idxNpm === -1 || idxStatus === -1) {
            console.error("Kolom 'NPM' atau 'Status Final' tidak ditemukan di sheet CheckData.");
            return { error: "Kolom 'NPM' atau 'Status Final' tidak ditemukan." };
        }

        const acceptedStudents = [];
        data.forEach(row => {
            const status = (row[idxStatus] || '').toString().trim().toLowerCase();
            if (status === 'acc' || status === 'diterima') {
                const npm = (row[idxNpm] || '').toString().trim();
                if (npm) {
                    // Dapatkan email: dari CheckData dulu, jika tidak ada dari LogData
                    let email = (idxEmail !== -1 ? row[idxEmail] : '') || '';
                    if (!email) {
                        email = emailMap[npm] || '';
                        const idPengajuan = idxIdPengajuan !== -1 ? String(row[idxIdPengajuan] || '').trim() : '';
                        if (!email && idPengajuan) {
                            email = emailMap['id:' + idPengajuan] || '';
                        }
                    }

                    acceptedStudents.push({
                        npm: npm,
                        nama: (idxNama !== -1 ? row[idxNama] : '') || '',
                        blok: (idxBlok !== -1 ? row[idxBlok] : '') || '',
                        jenisKegiatan: (idxJenis !== -1 ? row[idxJenis] : '') || '',
                        detailKegiatan: (idxDetail !== -1 ? row[idxDetail] : '') || '',
                        tanggal: (idxTanggal !== -1 ? row[idxTanggal] : '') || '',
                        idPengajuan: (idxIdPengajuan !== -1 ? row[idxIdPengajuan] : '') || '',
                        email: email
                    });
                }
            }
        });

        console.log(`[getAcceptedStudentData] Found ${acceptedStudents.length} accepted students.`);
        return acceptedStudents;

    } catch (e) {
        console.error('Error in getAcceptedStudentData:', e);
        return { error: 'Gagal mengambil data mahasiswa yang disetujui: ' + e.message };
    }
}

function _getAcceptedStudentByNpm(npm) {
    const all = _getAcceptedStudentData();
    if (Array.isArray(all)) {
        return all.find(student => student.npm === npm) || null;
    }
    if (typeof all === 'object' && all !== null && !all.error) {
        const studentArray = Object.values(all);
        return studentArray.find(student => student.npm === npm) || null;
    }
    return null;
}

function _saveToLogUpload(uploadData, accUrl, buktiUrl) {
    try {
        if (!uploadData) {
            console.warn('_saveToLogUpload: legacy call tanpa uploadData, diabaikan.');
            return { success: true, message: 'Legacy _saveToLogUpload call ignored' };
        }

        if (typeof uploadData !== 'object') {
            uploadData = { npm: String(uploadData) };
        }

        const normalized = {
            npm: uploadData.npm || uploadData.NPM || '',
            namaLengkap: uploadData.namaLengkap || uploadData.NamaLengkap || '',
            blok: uploadData.blok || uploadData.Blok || '',
            jenisKegiatan: uploadData.jenisKegiatan || uploadData.JenisKegiatan || '',
            detail: uploadData.detail || uploadData.Detail || '',
            tanggal: uploadData.tanggal || uploadData.Tanggal || '',
            idPengajuan: uploadData.idPengajuan || uploadData.IdPengajuan || ''
        };

        const ss = getGlobalSpreadsheet();
        let sh = ss.getSheetByName(UPLOAD_LOG_SHEET_NAME);
        if (!sh) {
            sh = ss.insertSheet(UPLOAD_LOG_SHEET_NAME);
        }
        var canonicalHeaders = [
            'Timestamp',
            'ID Pengajuan',
            'NPM',
            'Nama Lengkap',
            'Blok',
            'Jenis Kegiatan',
            'Detail',
            'Tanggal',
            'Link ACC INHAL',
            'Link Bukti Bayar'
        ];
        if (sh.getLastRow() === 0) {
            sh.appendRow(canonicalHeaders);
        } else {
            var existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
            var missingHeaders = [];
            for (var h = 0; h < canonicalHeaders.length; h++) {
                if (existingHeaders.indexOf(canonicalHeaders[h]) === -1) {
                    missingHeaders.push(canonicalHeaders[h]);
                }
            }
            if (missingHeaders.length > 0) {
                sh.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
            }
        }

        const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
        const row = new Array(headers.length).fill('');
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            if (h === 'Timestamp' || h === 'Waktu') row[i] = new Date();
            else if (h === 'ID Pengajuan' || h === 'IdPengajuan') row[i] = normalized.idPengajuan;
            else if (h === 'NPM') row[i] = normalized.npm;
            else if (h === 'Nama Lengkap') row[i] = normalized.namaLengkap;
            else if (h === 'Blok') row[i] = normalized.blok;
            else if (h === 'Jenis Kegiatan') row[i] = normalized.jenisKegiatan;
            else if (h === 'Detail' || h === 'Detail Kegiatan') row[i] = normalized.detail;
            else if (h === 'Tanggal' || h === 'Tanggal Kegiatan') row[i] = normalized.tanggal;
            else if (h === 'Link ACC INHAL' || h === 'ACC INHAL' || h === 'Link ACC' || h === 'ACC') row[i] = accUrl || '';
            else if (h === 'Link Bukti Bayar' || h === 'Bukti Bayar' || h === 'Bukti') row[i] = buktiUrl || '';
        }
        sh.appendRow(row);

        const upsertResult = _saveUploadToCheckData(normalized, accUrl, buktiUrl);
        return upsertResult;
    } catch (e) {
        console.error('_saveToLogUpload shim error:', e.message);
        return { success: false, message: e.message };
    }
}

function _sendUploadReceiptEmail(uploadData, accUrl, buktiUrl) {
    try {
        const npm = uploadData.npm || uploadData.NPM || '';
        const student = npm ? _getAcceptedStudentByNpm(npm) : null;
        const recipient = student && student.email ? student.email : '';
        const nama = uploadData.namaLengkap || uploadData.NamaLengkap || (student && (student.namaLengkap || student.nama)) || '';
        const blok = uploadData.blok || uploadData.Blok || (student && student.blok) || '';
        const jenisKegiatan = uploadData.jenisKegiatan || uploadData.JenisKegiatan || (student && student.jenisKegiatan) || '';
        const detail = uploadData.detail || uploadData.Detail || (student && (student.detailKegiatan || student.detail)) || '';
        const tanggal = uploadData.tanggal || uploadData.Tanggal || (student && student.tanggal) || '';

        if (!recipient) {
            console.warn('_sendUploadReceiptEmail: email mahasiswa tidak ditemukan untuk NPM:', npm);
            return;
        }

        const subject = "Konfirmasi pengisian form Upload Bukti Pembayaran INHAL";

        const htmlBody = [
            `Assalamu'alaikum ${nama} ,`,
            `Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:`,
            `NPM: ${npm}`,
            `Nama Lengkap: ${nama}`,
            `Blok: ${blok}`,
            `Jenis Kegiatan: ${jenisKegiatan}`,
            `Detail Kegiatan: ${detail}`,
            `Tanggal: ${tanggal}`,
            `Link ACC INHAL: <a href="${accUrl}" target="_blank">${accUrl}</a>`,
            `Link Bukti Bayar: <a href="${buktiUrl}" target="_blank">${buktiUrl}</a>`,
            ``,
            `Catatan:`,
            `- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.`,
            `- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.`,
            `Jika ada pertanyaan, silakan hubungi admin Prodi.`,
            `Terima kasih.`,
            `Wassalamu'alaikum.`
        ].map(line => `<p>${line}</p>`).join('');

        const plainBody = [
            `Assalamu'alaikum ${nama} ,`,
            `Kami telah menerima upload bukti pembayaran INHAL Anda. Berikut ringkasan data yang tercatat:`,
            `NPM: ${npm}`,
            `Nama Lengkap: ${nama}`,
            `Blok: ${blok}`,
            `Jenis Kegiatan: ${jenisKegiatan}`,
            `Detail Kegiatan: ${detail}`,
            `Tanggal: ${tanggal}`,
            `Link ACC INHAL: ${accUrl}`,
            `Link Bukti Bayar: ${buktiUrl}`,
            ``,
            `Catatan:`,
            `- Prodi akan memverifikasi dokumen dan Anda akan menerima email pemberitahuan selanjutnya.`,
            `- Silakan simpan email ini sebagai bukti bahwa pengisian form Anda sudah tercatat.`,
            `Jika ada pertanyaan, silakan hubungi admin Prodi.`,
            `Terima kasih.`,
            `Wassalamu'alaikum.`
        ].join('\n');

        MailApp.sendEmail(recipient, subject, plainBody, { htmlBody });
        console.log('✅ Upload receipt email sent to:', recipient);
    } catch (e) {
        console.error('❌ _sendUploadReceiptEmail error:', e.message);
    }
}

function _getBiayaMap() {
    try {
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(MASTER_BIAYA_SHEET_NAME);
        if (!sheet) return {};

        const data = sheet.getDataRange().getValues();
        if (data.length < 2) return {};

        const headers = data[0].map(h => h.toString().trim());
        const idxKegiatan = headers.indexOf('Kegiatan');
        const idxBiaya = headers.indexOf('Biaya');

        if (idxKegiatan === -1 || idxBiaya === -1) return {};

        const map = {};
        for (let i = 1; i < data.length; i++) {
            const kegiatan = data[i][idxKegiatan];
            const biaya = data[i][idxBiaya];
            if (kegiatan) {
                map[kegiatan.toString().trim()] = biaya === '' || biaya == null ? '' : parseCurrency(biaya);
            }
        }
        return map;
    } catch (e) {
        console.error('Error in _getBiayaMap:', e);
        return {};
    }
}

function getBagianEmailMap() {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const mhsMap = {};
        const adminMap = {};

        // 1. Baca data dasar dari sheet MHS (fallback)
        const mhsSheet = ss.getSheetByName(NAMA_SHEET_MHS);
        if (mhsSheet && mhsSheet.getLastRow() > 1) {
            const data = mhsSheet.getDataRange().getValues();
            if (data && data.length > 1) {
                for (let r = 1; r < data.length; r++) {
                    const row = data[r];
                    const emailMhs = (row[19] || '').toString().trim();
                    if (!emailMhs) continue;

                    // Menggunakan nama praktikum (kolom M) dan nama bagian (kolom S)
                    const praktikumName = (row[12] || '').toString().trim();
                    const bagian = (row[18] || '').toString().trim();

                    if (praktikumName) {
                        mhsMap[norm(praktikumName)] = emailMhs;
                    }
                    if (bagian) {
                        mhsMap[norm(bagian)] = emailMhs;
                    }
                }
            }
        }

        // 2. Baca dari sheet EmailBagian (prioritas utama / hasil simpan admin)
        const emailSheet = ss.getSheetByName('EmailBagian');
        if (emailSheet && emailSheet.getLastRow() > 1) {
            const emailData = emailSheet.getRange(2, 1, emailSheet.getLastRow() - 1, 2).getValues();
            for (let i = 0; i < emailData.length; i++) {
                const nama = (emailData[i][0] || '').toString().trim();
                const email = (emailData[i][1] || '').toString().trim();
                // Admin dapat dengan sengaja mengosongkan email, jadi kita tetap menyimpannya
                if (nama) {
                    adminMap[norm(nama)] = email;
                }
            }
        }

        // 3. Gabungkan keduanya, adminMap akan menimpa mhsMap jika ada kunci yang sama
        return { ...mhsMap, ...adminMap };

    } catch (e) {
        console.error('Error in getBagianEmailMap:', e);
        return {};
    }
}

/**
 * Simpan pemetaan email bagian ke sheet EmailBagian.
 * @param {Object} mapObj - { "NamaBagian": "email@domain.com", ... }
 */
function saveBagianEmailMap(mapObj) {
    try {
        requireAuthorized();
        const ss = getGlobalSpreadsheet();
        const SHEET_NAME = 'EmailBagian';
        let sheet = ss.getSheetByName(SHEET_NAME);

        // Buat sheet jika belum ada
        if (!sheet) {
            sheet = ss.insertSheet(SHEET_NAME);
            sheet.getRange(1, 1).setValue('Nama Bagian');
            sheet.getRange(1, 2).setValue('Email');
            sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
        }

        // Hapus data lama (baris 2 ke bawah)
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
        }

        // Tulis data baru
        const keys = Object.keys(mapObj || {});
        if (keys.length > 0) {
            const rows = keys.map(function(k) {
                return [k, mapObj[k] || ''];
            });
            sheet.getRange(2, 1, rows.length, 2).setValues(rows);
        }

        // Hapus cache agar data terbaru langsung tersedia
        try { _removeCacheChunked(CacheService.getScriptCache(), 'checkPageData:v1'); } catch(e) {}

        return { success: true };
    } catch (e) {
        console.error('Error in saveBagianEmailMap:', e);
        return { success: false, message: e.message };
    }
}

function normalizeBagianLookupKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getBagianLookupCandidates(studentData) {
    var candidates = [];
    var added = {};
    var pushCandidate = function(value) {
        var raw = String(value || '').trim();
        var key = norm(raw);
        if (!raw || !key || added[key]) return;
        added[key] = true;
        candidates.push(raw);
    };

    if (!studentData) return candidates;

    var jenis = String(studentData['Jenis Kegiatan'] || '').trim();
    if (jenis && norm(jenis) !== 'praktikum') {
        pushCandidate(jenis);
        pushCandidate(studentData.Blok || studentData.Bagian || '');
        return candidates;
    }

    pushCandidate(studentData.Blok || studentData.Bagian || '');
    var i;
    for (i = 1; i <= 9; i++) {
        pushCandidate(studentData['Pilihan LAB ' + i] || '');
        pushCandidate(studentData['Kegiatan LAB ' + i] || '');
    }
    pushCandidate(jenis);
    return candidates;
}

function resolveBagianEmail(bagianName, bagianMap) {
    try {
        if (!bagianName || !bagianMap) return { name: '', email: '' };

        var exactLegacy = bagianMap[norm(bagianName)];
        if (exactLegacy) {
            return {
                name: bagianName,
                email: exactLegacy
            };
        }

        var target = normalizeBagianLookupKey(bagianName);
        if (!target) return { name: '', email: '' };

        var keys = Object.keys(bagianMap);
        var i;

        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (normalizeBagianLookupKey(key) === target) {
                return {
                    name: key,
                    email: bagianMap[key] || ''
                };
            }
        }

        for (i = 0; i < keys.length; i++) {
            var normalizedKey = normalizeBagianLookupKey(keys[i]);
            if (!normalizedKey) continue;
            if (normalizedKey.indexOf(target) !== -1 || target.indexOf(normalizedKey) !== -1) {
                return {
                    name: keys[i],
                    email: bagianMap[keys[i]] || ''
                };
            }
        }

        return { name: '', email: '' };
    } catch (e) {
        return { name: '', email: '' };
    }
}

function resolveBagianEmailFromCandidates(candidates, bagianMap) {
    try {
        if (!candidates || !candidates.length) {
            return { name: '', email: '' };
        }
        var i;
        for (i = 0; i < candidates.length; i++) {
            var match = resolveBagianEmail(candidates[i], bagianMap);
            if (match && match.email) {
                return {
                    name: match.name || candidates[i],
                    email: match.email
                };
            }
        }
        return { name: '', email: '' };
    } catch (e) {
        return { name: '', email: '' };
    }
}

// =================================================================
// ==================== PANEL BAGIAN API HELPERS ===================
// =================================================================

function submitPendaftaranBagian(payload, kategori) {
    try {
        requireBaginaSession(kategori);
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (!sheet) {
            throw new Error('Sheet LogData tidak ditemukan.');
        }

        // Pastikan header sesuai struktur utama (sama dengan processRegistration)
        if (sheet.getLastRow() === 0) {
            const headers = [
                'Timestamp', 'ID Pengajuan', 'Nama Lengkap', 'NPM', 'Email Address', 'No. HP/WA', 'Blok',
                'Jenis Kegiatan', 'Pilihan Ujian', 'Tanggal Ujian',
                'Pilihan SGD', 'Detail SGD', 'Tanggal SGD',
                'Pilihan KKD', 'Detail KKD', 'Tanggal KKD',
                'Pilihan LAB 1', 'Kegiatan LAB 1', 'Tanggal Praktikum 1',
                'Pilihan LAB 2', 'Kegiatan LAB 2', 'Tanggal Praktikum 2',
                'Pilihan LAB 3', 'Kegiatan LAB 3', 'Tanggal Praktikum 3',
                'Pilihan LAB 4', 'Kegiatan LAB 4', 'Tanggal Praktikum 4',
                'Pilihan LAB 5', 'Kegiatan LAB 5', 'Tanggal Praktikum 5',
                'Pilihan LAB 6', 'Kegiatan LAB 6', 'Tanggal Praktikum 6',
                'Pilihan LAB 7', 'Kegiatan LAB 7', 'Tanggal Praktikum 7',
                'Pilihan LAB 8', 'Kegiatan LAB 8', 'Tanggal Praktikum 8',
                'Pilihan LAB 9', 'Kegiatan LAB 9', 'Tanggal Praktikum 9',
                'Keterangan', 'Link Surat Keterangan', 'Status', 'Catatan Admin',
                'Notifikasi Terkirim Pada', 'Nomor Surat', 'Lampiran Email'
            ];
            sheet.appendRow(headers);
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const newRow = new Array(headers.length).fill('');
        const headerMap = {};
        headers.forEach((h, i) => headerMap[h] = i);
        const setVal = (header, value) => {
            if (headerMap[header] !== undefined) newRow[headerMap[header]] = value || '';
        };

        const kategori = payload.kategori || '';
        const subBagian = payload.subBagian || '';
        const detailKegiatan = payload.detailKegiatan || '';

        setVal('Timestamp', new Date());
        setVal('ID Pengajuan', Utilities.getUuid());
        setVal('NPM', payload.npm || '');
        setVal('Nama Lengkap', payload.namaLengkap || '');
        setVal('Blok', payload.blok || '');
        setVal('Jenis Kegiatan', kategori);
        setVal('Status', 'Menunggu');
        setVal('Keterangan', payload.keterangan || 'Diinput oleh Admin Bagian');

        // Simpan detail ke kolom per-jenis (sama seperti processRegistration) agar
        // getCheckPageData / getLogDataForAdmin bisa me-resolve Detail Kegiatan.
        if (kategori === 'Ujian') {
            setVal('Pilihan Ujian', detailKegiatan);
            if (payload.tanggalKegiatan) setVal('Tanggal Ujian', payload.tanggalKegiatan);
        } else if (kategori === 'SGD') {
            setVal('Pilihan SGD', detailKegiatan);
            if (payload.tanggalKegiatan) setVal('Tanggal SGD', payload.tanggalKegiatan);
        } else if (kategori === 'KKD') {
            setVal('Pilihan KKD', detailKegiatan);
            if (payload.tanggalKegiatan) setVal('Tanggal KKD', payload.tanggalKegiatan);
        } else if (kategori === 'Praktikum') {
            setVal('Pilihan LAB 1', subBagian);
            setVal('Kegiatan LAB 1', detailKegiatan);
            if (payload.tanggalKegiatan) setVal('Tanggal Praktikum 1', payload.tanggalKegiatan);
        }

        sheet.appendRow(newRow);
        _clearStudentPortalCache(payload.npm || '');
        _clearCheckPageCache();

        return { success: true, message: 'Data peserta inhal berhasil ditambahkan.' };
    } catch (e) {
        console.error("Error submitPendaftaranBagian: " + e.message);
        throw new Error("Gagal menyimpan data ke Spreadsheet: " + e.message);
    }
}


function getLogDataForAdmin(kategori) {
    requireBaginaSession(kategori);
    return _getLogDataForAdminData();
}

function _getLogDataForAdminData() {
    var cacheKey = 'logDataForAdmin:v1';
    var cache = CacheService.getScriptCache();
    try {
        var cached = _getCacheChunked(cache, cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && parsed.rows) return parsed;
            _removeCacheChunked(cache, cacheKey);
        }
    } catch (e) { }

    try {
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) {
            return { rows: [] };
        }

        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const checkSheet = ss.getSheetByName(CHECK_SHEET_NAME);
        const checkRows = checkSheet && checkSheet.getLastRow() > 1 ? checkSheet.getDataRange().getValues() : [];
        const checkHeaders = checkRows.length ? checkRows[0] : [];
        const checkIdCol = checkHeaders.indexOf('ID Pengajuan');
        const checkInfoCol = checkHeaders.indexOf('Status Info Bagian');
        const checkTimeCol = checkHeaders.indexOf('Waktu Info Bagian');
        const checkEmailCol = checkHeaders.indexOf('Email Bagian');
        const checkLinkFinalCol = checkHeaders.indexOf('Link Final');
        const checkInfoMap = {};
        for (let c = 1; c < checkRows.length && checkIdCol > -1; c++) {
            const key = String(checkRows[c][checkIdCol] || '').trim();
            if (key) checkInfoMap[key] = {
                status: checkInfoCol > -1 ? checkRows[c][checkInfoCol] : '',
                time: checkTimeCol > -1 ? checkRows[c][checkTimeCol] : '',
                email: checkEmailCol > -1 ? checkRows[c][checkEmailCol] : '',
                linkFinal: checkLinkFinalCol > -1 ? checkRows[c][checkLinkFinalCol] : ''
            };
        }
        const rows = [];

        for (let i = 1; i < data.length; i++) {
            const rowData = {};
            headers.forEach((header, colIndex) => {
                let cellValue = data[i][colIndex];
                // Handle Date object serialization issue for google.script.run
                if (cellValue instanceof Date) {
                    cellValue = cellValue.toISOString();
                }
                rowData[String(header).trim()] = cellValue;
            });
            rowData.originalRowIndex = i + 1;
            const info = checkInfoMap[String(rowData['ID Pengajuan'] || '').trim()];
            rowData['Status Info Bagian'] = info ? info.status : '';
            rowData['Waktu Info Bagian'] = info && info.time instanceof Date ? info.time.toISOString() : (info ? info.time : '');
            rowData['Email Bagian'] = info ? info.email : '';
            if (info && info.linkFinal) rowData['Link Final'] = info.linkFinal;

            // Resolve kolom "Detail Kegiatan" agar sinkron dengan dashboard.html
            // (LogData menyimpan detail di kolom per-jenis, bukan satu kolom "Detail Kegiatan")
            const activity = extractCheckActivityFromRowData(rowData);
            if (!rowData['Detail Kegiatan'] || String(rowData['Detail Kegiatan']).trim() === '') {
                rowData['Detail Kegiatan'] = activity.detail || '';
            }
            rows.push(rowData);
        }

        const result = { rows: rows };
        try {
            _setCacheChunked(cache, cacheKey, JSON.stringify(result), CACHE_EXPIRATION);
        } catch (e) { }
        return result;
    } catch (e) {
        console.error("Error getLogDataForAdmin: " + e.message);
        return { rows: [] };
    }
}

function updateStatusRowIndex(rowIndex, newStatus, kategori) {
    try {
        requireBaginaSession(kategori);
        const ss = getGlobalSpreadsheet();
        const sheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (!sheet || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
            throw new Error("Baris data tidak ditemukan.");
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        let statusCol = headers.indexOf("Status") + 1;
        if (statusCol <= 0) {
            statusCol = headers.length + 1;
            sheet.getRange(1, statusCol).setValue("Status");
        }

        sheet.getRange(rowIndex, statusCol).setValue(newStatus);
        return { success: true };
    } catch (e) {
        throw new Error("Gagal memperbarui status: " + e.message);
    }
}

const BA_SHEET_NAME = "BeritaAcara";
const BA_PESERTA_SHEET_NAME = "BeritaAcaraPeserta";
const BA_HEADERS = [
    'Timestamp', 'BA ID', 'Bagian', 'Blok', 'Nama Kegiatan',
    'Tanggal Pelaksanaan', 'Jumlah Peserta', 'File Name', 'File URL', 'Catatan'
];
const BA_PESERTA_HEADERS = [
    'Timestamp', 'BA ID', 'NPM', 'Nama Lengkap', 'Blok', 'Bagian', 'Status Pengajuan'
];

function ensureBaSheets(ss) {
    let baSheet = ss.getSheetByName(BA_SHEET_NAME);
    if (!baSheet) {
        baSheet = ss.insertSheet(BA_SHEET_NAME);
    }
    let pesertaSheet = ss.getSheetByName(BA_PESERTA_SHEET_NAME);
    if (!pesertaSheet) {
        pesertaSheet = ss.insertSheet(BA_PESERTA_SHEET_NAME);
    }
    return { baSheet: baSheet, pesertaSheet: pesertaSheet };
}

function appendMissingHeaders(sheet, expectedHeaders) {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
        // Sheet kosong tanpa header — tulis header penuh langsung
        sheet.appendRow(expectedHeaders);
        const map = {};
        expectedHeaders.forEach(function (h, i) { map[h] = i; });
        return map;
    }
    const lastCol = sheet.getLastColumn();
    if (lastCol <= 0) {
        sheet.appendRow(expectedHeaders);
        const map = {};
        expectedHeaders.forEach(function (h, i) { map[h] = i; });
        return map;
    }
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    const existing = {};
    headers.forEach(function (h, i) { existing[h] = i; });
    const missing = expectedHeaders.filter(function (h) { return existing[h] === undefined; });
    if (missing.length > 0) {
        const baseCols = sheet.getLastColumn();
        const targetCols = baseCols + missing.length;
        if (sheet.getMaxColumns() < targetCols) {
            sheet.insertColumnsAfter(sheet.getMaxColumns(), targetCols - sheet.getMaxColumns());
        }
        sheet.getRange(1, baseCols + 1, 1, missing.length).setValues([missing]);
        missing.forEach(function (h, idx) { existing[h] = baseCols + idx; });
    }
    return existing;
}

function generateBaId(baSheet) {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = 'BA-' + year + '-';
    let maxSeq = 0;
    const lastRow = baSheet.getLastRow();
    if (lastRow > 1) {
        const ids = baSheet.getRange(2, 2, lastRow - 1, 1).getValues();
        ids.forEach(function (row) {
            const id = String(row[0] || '').trim();
            if (id.indexOf(prefix) === 0) {
                const num = parseInt(id.substring(prefix.length), 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
        });
    }
    return prefix + String(maxSeq + 1).padStart(4, '0');
}

function normalizeBaPeserta(payload) {
    const peserta = [];
    const raw = payload.peserta || [];
    if (Array.isArray(raw)) {
        raw.forEach(function (p) {
            const npm = String((p && p.npm) || '').trim();
            const nama = String((p && p.namaLengkap) || (p && p.nama) || '').trim();
            if (npm || nama) {
                peserta.push({
                    npm: npm,
                    namaLengkap: nama,
                    blok: String((p && p.blok) || '').trim(),
                    statusPengajuan: String((p && p.statusPengajuan) || (p && p.status) || '').trim()
                });
            }
        });
    }
    return peserta;
}

function uploadBeritaAcaraBagian(payload, kategori) {
    let step = 'inisialisasi';
    try {
        requireBaginaSession(kategori);
        step = 'buka spreadsheet';
        const ss = getGlobalSpreadsheet();
        step = 'siapkan sheet';
        const sheets = ensureBaSheets(ss);
        const baSheet = sheets.baSheet;
        const pesertaSheet = sheets.pesertaSheet;

        step = 'pastikan header BA';
        appendMissingHeaders(baSheet, BA_HEADERS);
        step = 'pastikan header peserta';
        appendMissingHeaders(pesertaSheet, BA_PESERTA_HEADERS);

        const baHeaderMap = {};
        baSheet.getRange(1, 1, 1, baSheet.getLastColumn()).getValues()[0]
            .forEach(function (h, i) { baHeaderMap[String(h).trim()] = i; });
        const pesertaHeaderMap = {};
        pesertaSheet.getRange(1, 1, 1, pesertaSheet.getLastColumn()).getValues()[0]
            .forEach(function (h, i) { pesertaHeaderMap[String(h).trim()] = i; });

        let fileUrl = "";
        let fileName = "";
        let driveWarnings = [];

        if (payload.file && payload.file.data) {
            step = 'upload file ke Drive';
            try {
                let folder;
                try {
                    folder = DriveApp.getFolderById(FOLDER_ID);
                } catch (fe) {
                    folder = DriveApp.getRootFolder();
                }

                const blob = Utilities.newBlob(
                    Utilities.base64Decode(payload.file.data),
                    payload.file.mimeType || 'application/pdf',
                    payload.file.fileName || ('BeritaAcara_' + Date.now() + '.pdf')
                );
                const createdFile = folder.createFile(blob);
                fileUrl = createdFile.getUrl();
                fileName = createdFile.getName();
                try {
                    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                } catch (shareErr) {
                    driveWarnings.push('Akses publik file Drive tidak dapat diatur: ' + (shareErr && shareErr.message ? shareErr.message : shareErr));
                    console.warn('Gagal mengatur sharing file Drive BA: ' + (shareErr && shareErr.stack ? shareErr.stack : shareErr));
                }
            } catch (driveErr) {
                // Upload file gagal (mis. DriveApp tidak terotorisasi) —
                // Berita Acara tetap disimpan tanpa file, disertai peringatan.
                driveWarnings.push('File gagal diunggah ke Drive: ' + (driveErr && driveErr.message ? driveErr.message : driveErr));
                console.error('Drive upload BA gagal (record tetap disimpan): ' + (driveErr && driveErr.stack ? driveErr.stack : driveErr));
            }
        }

        step = 'siapkan data BA';
        const baId = generateBaId(baSheet);
        const peserta = normalizeBaPeserta(payload);
        const tanggalPelaksanaan = String(payload.tanggalPelaksanaan || '').trim();

        const baCols = Math.max(1, baSheet.getLastColumn());
        const baRow = new Array(baCols).fill('');
        const setBa = function (header, value) {
            if (baHeaderMap[header] !== undefined) baRow[baHeaderMap[header]] = value;
        };
        setBa('Timestamp', new Date());
        setBa('BA ID', baId);
        setBa('Bagian', payload.bagianDisplay || payload.bagian || '');
        setBa('Blok', payload.blok || '');
        setBa('Nama Kegiatan', payload.namaKegiatan || '');
        setBa('Tanggal Pelaksanaan', tanggalPelaksanaan);
        setBa('Jumlah Peserta', peserta.length || (payload.jumlahPeserta || 0));
        setBa('File Name', fileName);
        setBa('File URL', fileUrl);
        setBa('Catatan', payload.catatan || '');
        step = 'tulis baris BA';
        baSheet.appendRow(baRow);

        if (peserta.length > 0) {
            step = 'siapkan baris peserta';
            const pCols = Math.max(1, pesertaSheet.getLastColumn());
            const rows = peserta.map(function (p) {
                const row = new Array(pCols).fill('');
                const setP = function (header, value) {
                    if (pesertaHeaderMap[header] !== undefined) row[pesertaHeaderMap[header]] = value;
                };
                setP('Timestamp', new Date());
                setP('BA ID', baId);
                setP('NPM', p.npm);
                setP('Nama Lengkap', p.namaLengkap);
                setP('Blok', p.blok);
                setP('Bagian', payload.bagianDisplay || payload.bagian || '');
                setP('Status Pengajuan', p.statusPengajuan || '');
                return row;
            });
            step = 'tulis baris peserta';
            pesertaSheet.getRange(pesertaSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
                .setValues(rows);
        }

        return { success: true, baId: baId, fileUrl: fileUrl, jumlahPeserta: peserta.length, warnings: driveWarnings };
    } catch (e) {
        console.error("Error uploadBeritaAcaraBagian @ " + step + ": " + (e && e.stack ? e.stack : e));
        throw new Error("Gagal mengunggah Berita Acara (" + step + "): " + (e && e.message ? e.message : e));
    }
}
/**
 * Mengambil daftar berita acara yang diupload oleh admin
 */
function getBeritaAcaraAdminList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      console.error("getBeritaAcaraAdminList: Gagal mendapatkan spreadsheet aktif.");
      return [];
    }
    let sheet = ss.getSheetByName("BeritaAcaraAdmin");
    if (!sheet || sheet.getLastRow() <= 1) {
      console.log("getBeritaAcaraAdminList: Sheet 'BeritaAcaraAdmin' tidak ditemukan atau kosong.");
      return [];
    }

    // Ambil semua data kecuali header
    const dataValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const result = dataValues.map(row => {
      // Fungsi utilitas untuk mengubah nilai menjadi string yang aman
      const safeString = (val) => {
        if (val === null || val === undefined) {
          return '';
        }
        if (val instanceof Date) {
          // Coba format tanggal, jika gagal, kembalikan sebagai string
          try {
            return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          } catch (e) {
            return val.toString();
          }
        }
        return String(val);
      };

      return {
        id: safeString(row[0]),
        waktuUpload: safeString(row[1]),
        blok: safeString(row[2]),
        jenisKegiatan: safeString(row[3]),
        detailKegiatan: safeString(row[4]),
        judulBA: safeString(row[5]),
        tanggalKegiatan: safeString(row[6]),
        fileUrl: safeString(row[7])
      };
    });

    console.log("getBeritaAcaraAdminList: Sukses memproses dan akan mengirim " + result.length + " baris.");
    return result;

  } catch (err) {
    console.error("ERROR BESAR di getBeritaAcaraAdminList: " + err.message + " | Stack: " + err.stack);
    return []; // Jika ada error tak terduga, kembalikan array kosong.
  }
}

/**
 * Upload berita acara admin (simpan file ke Drive dan catat ke Spreadsheet)
 */
function uploadBeritaAcaraAdmin(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("BeritaAcaraAdmin");
    if (!sheet) {
      sheet = ss.insertSheet("BeritaAcaraAdmin");
      sheet.appendRow(["ID", "Waktu Upload", "Blok", "Jenis Kegiatan", "Detail Kegiatan", "Judul BA", "Tanggal Kegiatan", "File URL"]);
    }

    // Decode base64 file
    const fileData = payload.file;
    const split = fileData.data.split(',');
    const mimeType = fileData.mimeType || 'application/pdf';
    const decoded = Utilities.base64Decode(split[1]);
    const blob = Utilities.newBlob(decoded, mimeType, fileData.fileName);

    // Simpan ke Google Drive (sesuaikan ID folder jika perlu, atau simpan di root)
    // const folder = DriveApp.getFolderById("YOUR_FOLDER_ID");
    // const driveFile = folder.createFile(blob);
    const driveFile = DriveApp.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = driveFile.getUrl();

    const id = new Date().getTime();
    const waktuUpload = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      id,
      waktuUpload,
      payload.blok,
      payload.jenisKegiatan,
      payload.detailKegiatan,
      payload.judulBA,
      payload.tanggalKegiatan,
      fileUrl
    ]);

    return { success: true, id: id, fileUrl: fileUrl };
  } catch (err) {
    console.error("Error uploadBeritaAcaraAdmin: " + err.message);
    throw new Error(err.message);
  }
}

/**
 * Hapus berita acara admin berdasarkan ID
 */
function deleteBeritaAcaraAdmin(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("BeritaAcaraAdmin");
    if (!sheet) return { success: false, message: "Sheet not found" };

    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        const fileUrl = rows[i][7];
        // Hapus file dari Drive jika ada URL-nya
        try {
          if (fileUrl && fileUrl.includes("id=")) {
            const fileId = fileUrl.split("id=")[1].split("&")[0];
            DriveApp.getFileById(fileId).setTrashed(true);
          }
        } catch (e) {
          console.warn("Could not delete file from drive: " + e.message);
        }

        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: "ID not found" };
  } catch (err) {
    console.error("Error deleteBeritaAcaraAdmin: " + err.message);
    throw new Error(err.message);
  }
}

function getBeritaAcaraList(bagianFilter, kategori) {
    try {
        requireAuthorizedOrBagina();
        const ss = getGlobalSpreadsheet();
        const baSheet = ss.getSheetByName(BA_SHEET_NAME);
        if (!baSheet || baSheet.getLastRow() < 2) {
            return { rows: [] };
        }

        const data = baSheet.getDataRange().getValues();
        const headers = data[0];
        const rows = [];

        const pesertaSheet = ss.getSheetByName(BA_PESERTA_SHEET_NAME);
        const pesertaByBa = {};
        if (pesertaSheet && pesertaSheet.getLastRow() > 1) {
            const pData = pesertaSheet.getDataRange().getValues();
            const pHeaders = pData[0];
            for (let j = 1; j < pData.length; j++) {
                const pRow = {};
                pHeaders.forEach(function (header, colIndex) {
                    let cellValue = pData[j][colIndex];
                    if (cellValue instanceof Date) cellValue = cellValue.toISOString();
                    pRow[String(header).trim()] = cellValue;
                });
                const baId = String(pRow['BA ID'] || '').trim();
                if (baId) {
                    if (!pesertaByBa[baId]) pesertaByBa[baId] = [];
                    pesertaByBa[baId].push(pRow);
                }
            }
        }

        for (let i = 1; i < data.length; i++) {
            const rowData = {};
            headers.forEach(function (header, colIndex) {
                let cellValue = data[i][colIndex];
                if (cellValue instanceof Date) cellValue = cellValue.toISOString();
                rowData[String(header).trim()] = cellValue;
            });

            if (!bagianFilter || String(rowData.Bagian || '').toLowerCase().includes(bagianFilter.toLowerCase())) {
                rowData.peserta = pesertaByBa[String(rowData['BA ID'] || '').trim()] || [];
                rowData.jumlahPesertaList = rowData.peserta.length;
                rows.push(rowData);
            }
        }

        return { rows: rows };
    } catch (e) {
        console.error("Error getBeritaAcaraList: " + e.message);
        return { rows: [] };
    }
}

// =================================================================
// ========== ADMIN COMBINED PAGINATED DATA (admin.html) ===========
// =================================================================

/**
 * Endpoint paginated untuk halaman admin (admin.html).
 * Menggabungkan data LogData + CheckData + Upload, menerapkan filter,
 * menghitung statistik, lalu memotong per halaman.
 * @param {number} page - Halaman saat ini (1-based).
 * @param {number} pageSize - Jumlah baris per halaman.
 * @param {Object} filters - { search, status, blok, jenis }
 * @returns {Object} { data, total, totalPages, currentPage, stats }
 */
function getAdminCombinedPaged(page, pageSize, filters) {
    try {
        requireAuthorized();

        const p = Math.max(1, parseInt(page, 10) || 1);
        const size = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
        const f = filters || {};

        // Gunakan cache (5 menit). Tombol "Refresh" di admin.html mengirim fresh:true
        // agar tetap bisa membaca data terbaru saat diminta eksplisit.
        // Semua operasi tulis sudah memanggil _clearCheckPageCache() sehingga cache
        // otomatis tidak akan kedaluwarsa setelah admin mengubah data.
        if (f.fresh) _clearCheckPageCache();
        const payload = _getCheckPageData({ skipCache: !!f.fresh });
        const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];

        const term = String(f.search || '').toLowerCase().trim();
        const sStatus = String(f.status || '').toLowerCase().trim();
        const sBlok = String(f.blok || '').trim();
        const sJenis = String(f.jenis || '').trim();

        const matches = (r) => {
            if (sBlok && String(r.Blok || '').trim() !== sBlok) return false;
            if (sJenis) {
                const jenis = String(r.JenisDasar || r['Jenis Kegiatan'] || '').trim();
                if (jenis !== sJenis) return false;
            }
            if (sStatus) {
                const status = String(r.Status || '').trim();
                if (sStatus === 'pending') {
                    if (status && !/diterima|acc|ditolak|tidak acc/i.test(status)) return false;
                } else if (sStatus === 'approved') {
                    if (!/diterima|acc/i.test(status)) return false;
                } else if (sStatus === 'rejected') {
                    if (!/ditolak|tidak acc/i.test(status)) return false;
                } else if (status.toLowerCase() !== sStatus) {
                    return false;
                }
            }
            if (term) {
                const haystack = [
                    r.NPM, r['Nama Lengkap'], r.Email, r.Blok,
                    r.JenisDasar, r['Jenis Kegiatan'], r.DetailKegiatanPortal,
                    r['Catatan Admin'], r['Keterangan']
                ].map(v => String(v || '').toLowerCase()).join(' ');
                if (haystack.indexOf(term) === -1) return false;
            }
            return true;
        };

        const filtered = rows.filter(matches);

        const stats = {
            total: filtered.length,
            pending: filtered.filter(r => {
                const s = String(r.Status || '').trim();
                return !s || /menunggu/i.test(s);
            }).length,
            accepted: filtered.filter(r => /diterima|acc/i.test(String(r.Status || ''))).length,
            rejected: filtered.filter(r => /ditolak|tidak acc/i.test(String(r.Status || ''))).length
        };

        const totalPages = Math.max(1, Math.ceil(filtered.length / size));
        const currentPage = Math.min(p, totalPages);
        const start = (currentPage - 1) * size;
        const pageRows = filtered.slice(start, start + size).map(function(r) {
            return {
                rowIndex: r.originalRowIndex,
                NPM: r.NPM || '',
                NamaLengkap: r['Nama Lengkap'] || '',
                DetailKegiatan: r.DetailKegiatanPortal || r.Detail || '',
                TanggalKegiatan: r.TanggalKegiatan || '',
                Tanggal: r.TanggalKegiatan || '',
                JenisKegiatan: r.JenisDasar || r['Jenis Kegiatan'] || '',
                'Jenis Kegiatan': r['Jenis Kegiatan'] || '',
                Keterangan: r['Keterangan'] || '',
                LinkSuratKeterangan: r['Link Surat Keterangan'] || '',
                CatatanAdmin: r['Catatan Admin'] || '',
                Catatan: r['Catatan Admin'] || '',
                Status: r.Status || '',
                Blok: r.Blok || '',
                Email: r.Email || '',
                Timestamp: r.Timestamp || '',
                NoHP: r.NoHP || '',
                'No. HP/WA': r.NoHP || '',
                LampiranEmail: r.LampiranEmail || ''
            };
        });

        return {
            data: pageRows,
            total: filtered.length,
            totalPages: totalPages,
            currentPage: currentPage,
            stats: stats
        };
    } catch (e) {
        console.error('Error getAdminCombinedPaged:', e.message);
        return {
            data: [],
            total: 0,
            totalPages: 1,
            currentPage: 1,
            stats: { total: 0, pending: 0, accepted: 0, rejected: 0 },
            error: e.message
        };
    }
}

// =================================================================
// ==================== FINAL EMAIL (PDF ACC Final) ================
// =================================================================

/**
 * Helper: menyiapkan PDF ACC Final dan mengirim email ke mahasiswa.
 * Dipakai oleh sendFinalEmail / sendBulkFinalEmail / sendFinalEmailForCheck.
 * @param {Object} data - data baris (dari LogData / CheckData / payload frontend).
 * @returns {Object} { ok, error?, pdfUrl?, emailSent? }
 */
function _prepareAndSendFinalPdf(data) {
    if (!data) return { ok: false, error: 'Data tidak tersedia.' };

    const npm = data.NPM || data['NPM'] || '';
    const email = String(data.Email || data['Email'] || data['Email Address'] || '').trim();
    const namaLengkap = data['Nama Lengkap'] || data.NamaLengkap || data.nama || '';

    if (!email) {
        return { ok: false, error: 'Email mahasiswa tidak tersedia.' };
    }

    try {
        const enhanced = enhanceDataForTemplate(data);
        enhanced.Status = 'Final';
        enhanced['Catatan Admin'] = data['Catatan Admin'] || data.CatatanAdmin || '';
        enhanced['Catatan'] = enhanced['Catatan Admin'];
        enhanced.TanggalPengajuan = data.Timestamp || data['Tanggal Pengajuan']
            ? formatIndonesianDate(data.Timestamp || data['Tanggal Pengajuan'])
            : '';

        const pdfBlob = _createPdfFromTemplate(TEMPLATE_ACC_ID, enhanced, 'Final');
        const subject = `Surat Keterangan Final INHAL - ${namaLengkap || npm}`;
        const body = `Assalamu'alaikum ${namaLengkap || ''} (NPM: ${npm}).

Terlampir adalah surat keterangan final pendaftaran INHAL Anda.

Wassalamu'alaikum
Admin Prodi`;

        MailApp.sendEmail({
            to: email,
            subject: subject,
            body: body,
            attachments: [pdfBlob]
        });

        return { ok: true, pdfUrl: '', emailSent: true, email: email };
    } catch (e) {
        console.error('Error _prepareAndSendFinalPdf:', e.message);
        return { ok: false, error: e.message };
    }
}

/**
 * Kirim email PDF Final ke mahasiswa (dipanggil dashboard.html & admin.html).
 * @param {Object} payload - minimal berisi NPM/Email/'Nama Lengkap'/data kegiatan.
 * @returns {Object} { ok, error? }
 */
function sendFinalEmail(payload) {
    try {
        requireAuthorized();

        if (!payload) return { ok: false, error: 'Payload tidak tersedia.' };

        // Coba dapatkan data lengkap dari LogData berdasarkan ID Pengajuan / NPM
        let rowData = null;
        const idPengajuan = payload.idPengajuan || payload.IdPengajuan || payload['ID Pengajuan'] || '';
        if (idPengajuan) rowData = _getFullDataById(idPengajuan);

        if (!rowData && payload.NPM) {
            const npm = String(payload.NPM).trim();
            const dataByNpm = _getFullDataByNpmLatest(npm);
            if (dataByNpm) rowData = dataByNpm;
        }

        const merged = {};
        if (rowData) {
            Object.keys(rowData).forEach(function(k) { merged[k] = rowData[k]; });
        }
        // Timpa dengan payload frontend agar tetap konsisten
        Object.keys(payload || {}).forEach(function(k) { merged[k] = payload[k]; });
        if (!merged['Nama Lengkap']) merged['Nama Lengkap'] = merged.nama || '';
        if (!merged['Jenis Kegiatan']) merged['Jenis Kegiatan'] = merged.jenis || '';
        if (!merged['Detail Kegiatan']) merged['Detail Kegiatan'] = merged.detail || '';

        const result = _prepareAndSendFinalPdf(merged);
        return result.ok ? { ok: true, message: 'Email final terkirim.' } : { ok: false, error: result.error };
    } catch (e) {
        console.error('Error sendFinalEmail:', e.message);
        return { ok: false, error: e.message };
    }
}

/**
 * Kirim email PDF Final massal (dipanggil dashboard.html bagian tab Bagian).
 * @param {Array} payload - array dari objek baris.
 * @returns {Object} { ok, sent, failed, errors? }
 */
function sendBulkFinalEmail(payload) {
    try {
        requireAuthorized();

        if (!Array.isArray(payload) || payload.length === 0) {
            return { ok: false, sent: 0, failed: 0, error: 'Tidak ada data untuk dikirim.' };
        }

        let sent = 0;
        const errors = [];
        for (let i = 0; i < payload.length; i++) {
            const item = payload[i] || {};
            let rowData = null;
            const idPengajuan = item.idPengajuan || item.IdPengajuan || item['ID Pengajuan'] || '';
            if (idPengajuan) rowData = _getFullDataById(idPengajuan);
            if (!rowData && item.NPM) rowData = _getFullDataByNpmLatest(String(item.NPM).trim());

            const merged = {};
            if (rowData) Object.keys(rowData).forEach(function(k) { merged[k] = rowData[k]; });
            Object.keys(item || {}).forEach(function(k) { merged[k] = item[k]; });
            if (!merged['Nama Lengkap']) merged['Nama Lengkap'] = merged.nama || '';
            if (!merged['Jenis Kegiatan']) merged['Jenis Kegiatan'] = merged.jenis || '';
            if (!merged['Detail Kegiatan']) merged['Detail Kegiatan'] = merged.detail || '';

            const res = _prepareAndSendFinalPdf(merged);
            if (res.ok) {
                sent++;
            } else {
                errors.push((merged['Nama Lengkap'] || item.NPM || '?') + ': ' + res.error);
            }
        }

        return {
            ok: errors.length === 0,
            sent: sent,
            failed: errors.length,
            errors: errors
        };
    } catch (e) {
        console.error('Error sendBulkFinalEmail:', e.message);
        return { ok: false, sent: 0, failed: (payload && payload.length) || 0, error: e.message };
    }
}

/**
 * Kirim email PDF Final dari halaman check (check.html).
 * @param {Object} row - baris data dari CheckData.
 * @returns {Object} { ok, error? }
 */
function sendFinalEmailForCheck(row) {
    try {
        requireAuthorized();
        if (!row) return { ok: false, error: 'Data tidak tersedia.' };

        const rowData = {};
        Object.keys(row || {}).forEach(function(k) { rowData[k] = row[k]; });

        // Lengkapi dari LogData bila perlu
        const npm = rowData.NPM || rowData.npm || '';
        if (npm && !rowData['Nama Lengkap']) {
            const full = _getFullDataByNpmLatest(String(npm).trim());
            if (full) {
                Object.keys(full).forEach(function(k) {
                    if (!rowData[k] && !rowData[k.replace(/\s/g, '')]) rowData[k] = full[k];
                });
            }
        }

        const result = _prepareAndSendFinalPdf(rowData);
        return result.ok ? { ok: true, message: 'Email final terkirim.' } : { ok: false, error: result.error };
    } catch (e) {
        console.error('Error sendFinalEmailForCheck:', e.message);
        return { ok: false, error: e.message };
    }
}

/**
 * Mengambil baris LogData terbaru untuk NPM tertentu.
 * @param {string} npm - NPM mahasiswa.
 * @returns {Object|null} baris terbaru sebagai objek.
 */
function _getFullDataByNpmLatest(npm) {
    if (!npm) return null;
    try {
        const sheet = getGlobalSpreadsheet().getSheetByName(LOG_SHEET_NAME);
        if (!sheet || sheet.getLastRow() < 2) return null;

        const data = sheet.getDataRange().getValues();
        const headers = data.shift();
        const npmCol = headers.indexOf('NPM');
        if (npmCol === -1) return null;

        const npmVal = String(npm).trim();
        for (let i = data.length - 1; i >= 0; i--) {
            if (String(data[i][npmCol] || '').trim() === npmVal) {
                const result = {};
                headers.forEach(function(h, ci) { result[h] = data[i][ci]; });
                return result;
            }
        }
        return null;
    } catch (e) {
        console.error('Error _getFullDataByNpmLatest:', e.message);
        return null;
    }
}





