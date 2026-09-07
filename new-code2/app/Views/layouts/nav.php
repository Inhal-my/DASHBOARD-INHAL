<?php
$navPage = $page ?? '';
$navTitle = $title ?? '';
$navItems = [
    '/'          => ['label' => 'Pendaftaran', 'icon' => 'bi-clipboard2-check'],
    '/portal'    => ['label' => 'Portal', 'icon' => 'bi-search'],
    '/bagian'    => ['label' => 'Bagian', 'icon' => 'bi-people'],
    '/dashboard' => ['label' => 'Dashboard', 'icon' => 'bi-speedometer2'],
    '/laporan'   => ['label' => 'Laporan', 'icon' => 'bi-file-earmark-bar-graph'],
    '/pengaturan'=> ['label' => 'Pengaturan', 'icon' => 'bi-gear'],
];
?>
<nav class="topnav">
    <div class="topnav-inner">
        <a href="/" class="topnav-brand">
            <span class="topnav-badge"><i class="bi bi-clipboard2-check"></i></span>
            <span class="topnav-brand-text">
                <span class="topnav-name">Pendaftaran INHAL</span>
                <span class="topnav-sub">Formulir Pengajuan Kegiatan</span>
            </span>
        </a>
        <div class="topnav-links">
            <?php foreach ($navItems as $navHref => $navItem): ?>
                <?php $navActive = $navPage === ($navHref === '/' ? 'index' : ltrim($navHref, '/')); ?>
                <a href="<?= $navHref ?>" class="topnav-link<?= $navActive ? ' is-active' : '' ?>">
                    <i class="bi <?= $navItem['icon'] ?>"></i>
                    <span><?= $navItem['label'] ?></span>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
</nav>
