/**
 * Drive Bridge — dipakai oleh Worker (new-code1-cf) untuk menyimpan berkas
 * Berita Acara ke Google Drive (folder DRIVE_FOLDER_ID di 0_code.gs).
 *
 * Cara pakai:
 *   1. Set Script Property DRIVE_BRIDGE_TOKEN (Project Settings > Script Properties).
 *   2. Deploy > Manage deployments > Edit (aktif) > Version: New version > Deploy.
 *   3. Web App sudah berformat "Execute as: Me" / "Access: Anyone" (lihat appsscript.json).
 */

function _driveBridgeToken() {
    return String(PropertiesService.getScriptProperties().getProperty('DRIVE_BRIDGE_TOKEN') || '').trim();
}

function _driveBridgeJson(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function _driveBridgeExtractId(url) {
    const m = String(url || '').match(/[=\/]([\w\-]{20,})/);
    return m ? m[1] : '';
}

function doPost(e) {
    try {
        const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
        const body = raw ? JSON.parse(raw) : {};
        const expected = _driveBridgeToken();
        if (!expected || String(body.token || '') !== expected) {
            return _driveBridgeJson({ success: false, message: 'Token tidak valid.' });
        }

        const action = String(body.action || '').trim();
        if (action === 'saveFile') {
            const data = String(body.base64 || '');
            if (!data) return _driveBridgeJson({ success: false, message: 'Berkas kosong.' });
            const url = _saveFileToDrive(data, body.mimeType, body.fileName, body.prefix);
            return _driveBridgeJson({
                success: true,
                url: url,
                fileId: _driveBridgeExtractId(url),
                name: String(body.fileName || '')
            });
        }

        if (action === 'trashFile') {
            const id = String(body.fileId || '').trim();
            if (!id) return _driveBridgeJson({ success: false, message: 'fileId wajib diisi.' });
            try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { }
            return _driveBridgeJson({ success: true });
        }

        return _driveBridgeJson({ success: false, message: 'Aksi tidak dikenal: ' + action });
    } catch (err) {
        return _driveBridgeJson({ success: false, message: (err && err.message) ? err.message : String(err) });
    }
}
