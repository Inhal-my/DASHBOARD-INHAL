<?php
$pageKey     = $page ?? 'dashboard';
$pageTitle   = $title ?? 'Dashboard';
$userEmail   = $userEmail ?? '';
$activeMenu  = $activeMenu ?? $pageKey;
$activeSub   = $activeSubMenu ?? 'umum';

$menu = [
    'dashboard'  => ['Dashboard', '/dashboard', 'bi-speedometer2'],
    'laporan'    => ['Laporan', '/laporan', 'bi-file-earmark-bar-graph'],
    'pengaturan' => ['Pengaturan', '/pengaturan', 'bi-sliders'],
];

$subMenus = [
    'master' => [
        'umum' => ['Umum', 'bi-gear'], 'matakuliah' => ['Matakuliah', 'bi-book'],
        'kegiatan' => ['Master Kegiatan', 'bi-diagram-3'], 'bagian' => ['Master Bagian', 'bi-people'],
        'biaya' => ['Master Biaya', 'bi-cash-coin'], 'mahasiswa' => ['Mahasiswa', 'bi-person-lines-fill'],
    ],
    'lainnya' => [
        'pengguna' => ['Pengguna', 'bi-person-badge'], 'email' => ['Email', 'bi-envelope'],
        'nomor' => ['Nomor Surat', 'bi-file-earmark-text'], 'upload' => ['Upload', 'bi-cloud-arrow-up'],
        'status' => ['Alur Status', 'bi-arrow-repeat'], 'audit' => ['Audit', 'bi-clock-history'],
    ],
];

$subTitles = [];
foreach ($subMenus as $group) { foreach ($group as $k => $v) { $subTitles[$k] = $v[0]; } }
$brandIcon = ['dashboard' => 'bi-speedometer2', 'laporan' => 'bi-file-earmark-bar-graph', 'pengaturan' => 'bi-sliders'][$pageKey];
$brandSub  = ['dashboard' => 'Admin operasional pengajuan', 'laporan' => 'Laporan & rekap biaya', 'pengaturan' => 'Konfigurasi master, pengguna, dan email'][$pageKey];
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf" content="<?= csrf_hash() ?>">
    <title><?= htmlspecialchars($pageTitle) ?> | Pendaftaran INHAL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/admin.css">
</head>
<body>
<div class="shell">
    <div class="shell-overlay" id="shellOverlay"></div>

    <aside class="shell-sidebar" id="shellSidebar">
        <a class="sidebar-brand" href="/dashboard">
            <span class="sidebar-brand-badge"><i class="bi <?= $brandIcon ?>"></i></span>
            <span>
                <span class="sidebar-brand-name">Pendaftaran INHAL</span><br>
                <span class="sidebar-brand-sub"><?= htmlspecialchars(ucfirst($brandSub)) ?></span>
            </span>
        </a>
        <nav class="shell-nav">
            <?php foreach ($menu as $key => $m): ?>
                <a class="side-link <?= $activeMenu === $key ? 'is-active' : '' ?>" href="<?= $m[1] ?>">
                    <i class="bi <?= $m[2] ?>"></i> <?= $m[0] ?>
                </a>
                <?php if ($key === 'pengaturan' && $activeMenu === 'pengaturan'): ?>
                    <?php foreach ($subMenus as $groupName => $group): ?>
                        <div class="menu-label"><?= $groupName === 'master' ? 'Master' : 'Lainnya' ?></div>
                        <div class="side-submenu">
                            <?php foreach ($group as $tabKey => $sm): ?>
                                <button type="button" class="side-sub-link <?= $activeSub === $tabKey ? 'is-active' : '' ?>" data-tab="<?= $tabKey ?>">
                                    <i class="bi <?= $sm[1] ?>"></i><?= $sm[0] ?>
                                </button>
                            <?php endforeach; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            <?php endforeach; ?>
        </nav>
        <div class="sidebar-foot"><i class="bi bi-shield-lock"></i> Area admin</div>
    </aside>

    <div class="shell-main">
        <header class="shell-topbar">
            <button class="shell-hamburger" id="shellHamburger" type="button" aria-label="Buka menu"><i class="bi bi-list"></i></button>
            <div class="shell-topbar-title">
                <b><?= htmlspecialchars($activeMenu === 'pengaturan' ? ($subTitles[$activeSub] ?? 'Pengaturan') : $menu[$activeMenu][0]) ?></b>
                <span><?= htmlspecialchars(ucfirst($brandSub)) ?></span>
            </div>
            <div class="shell-topbar-nav">
                <span class="shell-topbar-user"><i class="bi bi-person-circle"></i><?= htmlspecialchars($userEmail ?: 'Admin') ?></span>
                <a class="btn btn-soft btn-sm" href="/logout"><i class="bi bi-box-arrow-right"></i> Keluar</a>
            </div>
        </header>

        <main class="shell-content">
            <?= $content ?? '' ?>
        </main>
    </div>
</div>

<script>
    (function () {
        var sidebar = document.getElementById('shellSidebar');
        var overlay = document.getElementById('shellOverlay');
        var burger = document.getElementById('shellHamburger');
        function openMenu() { sidebar.classList.add('open'); overlay.classList.add('show'); }
        function closeMenu() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
        if (burger) burger.addEventListener('click', function () {
            sidebar.classList.contains('open') ? closeMenu() : openMenu();
        });
        if (overlay) overlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.side-sub-link[data-tab]').forEach(function (el) {
            el.addEventListener('click', function () {
                document.querySelectorAll('.side-sub-link[data-tab]').forEach(function (x) { x.classList.remove('is-active'); });
                el.classList.add('is-active');
                window.dispatchEvent(new CustomEvent('inhal-tab', { detail: el.getAttribute('data-tab') }));
                if (window.innerWidth <= 991) closeMenu();
            });
        });
    })();
</script>
</body>
</html>
