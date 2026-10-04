const PAGE_TITLES = {
    index: 'Pendaftaran INHAL',
    portal: 'Portal Mahasiswa INHAL',
    admin: 'Dashboard INHAL',
    bagian: 'Panel Bagian INHAL',
    dashboard: 'Dashboard INHAL',
    'detail-laporan': 'Detail Laporan INHAL'
};

const PAGE_IDS = ['index', 'portal', 'admin', 'bagian', 'dashboard', 'detail-laporan'];

function doGet(e) {
    const params = e && e.parameter ? e.parameter : {};
    let page = String(params.page || 'index').toLowerCase();
    if (PAGE_IDS.indexOf(page) === -1) {
        page = 'index';
    }
    if (page === 'admin') {
        page = 'dashboard';
    }
    return renderPage(page);
}

function renderPage(page) {
    let tpl = null;
    try {
        tpl = HtmlService.createTemplateFromFile('pages/' + page);
    } catch (e) {
        tpl = null;
    }
    if (!tpl) {
        tpl = HtmlService.createTemplateFromFile(page);
    }
    tpl.appUrl = ScriptApp.getService().getUrl();
    tpl.userEmail = getCurrentUserEmail();
    const html = tpl.evaluate()
        .setTitle(PAGE_TITLES[page] || 'INHAL')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return html;
}
