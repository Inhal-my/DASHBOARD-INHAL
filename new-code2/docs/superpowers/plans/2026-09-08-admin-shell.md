# Admin Shell (AdminLTE-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `/dashboard`, `/laporan`, `/pengaturan` under one server-rendered AdminLTE-style shell (sidebar + topbar, off-canvas on mobile), move the 12 Pengaturan tabs into the sidebar as grouped submenu, make content full-width/fluid, and stop collecting/displaying `Matakuliah` in the registration UI.

**Architecture:** A manual CI4 4.4 layout (`app/Views/layouts/admin.php`) renders a shared document `<head>` (fonts, icons, csrf meta, `admin.css`) plus topbar/sidebar and injects each page's inner fragment as `$content`. `PageController` guards the three admin routes to `isAdmin()` (else redirect `/login`) and renders fragments into the layout. Page-level component CSS stays inline inside each fragment (`<style>` at top of content). Only shell CSS (layout/sidebar/topbar/off-canvas/submenu) lives in `public/assets/css/admin.css`. Matakuliah removal is UI-only (form + displays); DB/API/dup-check unchanged.

**Tech Stack:** PHP 7.4+/8.0, CodeIgniter 4.4.7, Vue 3 (CDN), Bootstrap Icons, Google Fonts (Plus Jakarta Sans), custom CSS. PHPUnit 9 for API regression.

## Global Constraints

- Stay on CI4 **4.4.7** — do NOT upgrade (no `extend`/`section`).
- Shell CSS goes in `public/assets/css/admin.css`; page component CSS stays inline per fragment. Do not introduce AdminLTE/Bootstrap assets.
- API endpoints, routes, filters, and DB schema must not change.
- All three admin fragments must keep their existing inline CSS and Vue app behaviour; only the outer shell (head/topbar/login-card) is removed. Do not rewrite page logic.
- `/`, `/portal`, `/bagian` remain standalone — never wrapped in the layout.
- Shell is admin-only; `/bagian` sessions keep redirecting to `/bagian`.
- Auth redirect flow for `/login` GET must keep working: admin → `/dashboard`; bagian → `/bagian`.
- CSRF meta tag must remain present in every rendered document (`meta[name="csrf"]`), because every page's Vue reads it.
- `csrf_hash()` usage stays in layout head; fragments must NOT duplicate the meta.
- Language of UI copy: Indonesian.
- Keep DBs at seed counts after smoke tests.

---

### Task 1: Add shell CSS (admin.css)

**Files:**
- Create: `public/assets/css/admin.css`
- Consumes: nothing yet (no layout links it until Task 2)
- Produces: class names consumed by `layouts/admin.php` (Task 2): `.shell`, `.shell-sidebar`, `.shell-sidebar.open`, `.shell-overlay`, `.shell-main`, `.shell-topbar`, `.shell-hamburger`, `.sidebar-brand`, `.sidebar-brand-badge`, `.menu-label`, `.side-link`, `.side-link.is-active`, `.side-submenu`, `.side-sub-link`, `.side-sub-link.is-active`, `.shell-topbar-user`, `.shell-topbar-nav`, plus layout geometry, full-width content override, and mobile off-canvas rules.

- [ ] **Step 1: Create the stylesheet**

`public/assets/css/admin.css`:

```css
/* Admin shell (AdminLTE-like) — layout, sidebar, topbar, responsive. */
*,*::before,*::after{box-sizing:border-box}
[v-cloak]{display:none}
body{margin:0;background:#f5f6fa;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}

.shell{display:flex;min-height:100vh;align-items:stretch}

/* ---- Sidebar ---- */
.shell-sidebar{position:fixed;top:0;left:0;bottom:0;width:264px;z-index:150;display:flex;flex-direction:column;
  background:linear-gradient(180deg,#111827,#1e1b4b);color:#cbd5e1;transition:transform .22s ease}
.shell-sidebar .sidebar-brand{display:flex;align-items:center;gap:.7rem;padding:1rem 1.1rem;text-decoration:none;color:#fff;border-bottom:1px solid rgba(255,255,255,.08);flex:none}
.shell-sidebar .sidebar-brand-badge{display:inline-flex;align-items:center;justify-content:center;width:2.35rem;height:2.35rem;border-radius:.8rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:1.05rem;box-shadow:0 8px 20px rgba(99,102,241,.35)}
.shell-sidebar .sidebar-brand-name{font-size:.92rem;font-weight:800;letter-spacing:-.01em;line-height:1.2}
.shell-sidebar .sidebar-brand-sub{font-size:.66rem;color:#94a3b8;line-height:1.2}
.shell-nav{flex:1;overflow-y:auto;padding:.7rem .65rem 1.5rem;display:flex;flex-direction:column;gap:.15rem}
.shell-nav::-webkit-scrollbar{width:6px}
.shell-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:6px}
.menu-label{font-size:.64rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:.85rem .55rem .25rem}
.side-link{display:flex;align-items:center;gap:.6rem;padding:.6rem .7rem;border-radius:.7rem;font-size:.84rem;font-weight:700;color:#cbd5e1;text-decoration:none;transition:background .15s ease,color .15s ease}
.side-link i{font-size:1rem;width:1.15rem;text-align:center}
.side-link:hover{background:rgba(255,255,255,.06);color:#fff}
.side-link.is-active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 6px 16px rgba(79,70,229,.35)}
.side-submenu{margin:.15rem 0 .15rem .55rem;padding-left:.5rem;border-left:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:.1rem}
.side-sub-link{display:flex;align-items:center;gap:.55rem;padding:.45rem .6rem;border-radius:.6rem;font-size:.8rem;font-weight:600;color:#94a3b8;text-decoration:none;background:transparent;border:0;cursor:pointer;text-align:left;transition:background .15s ease,color .15s ease}
.side-sub-link i{font-size:.85rem;width:1rem;text-align:center;opacity:.85}
.side-sub-link:hover{background:rgba(255,255,255,.06);color:#e2e8f0}
.side-sub-link.is-active{background:rgba(99,102,241,.25);color:#c7d2fe}
.sidebar-foot{padding:.9rem 1.1rem;border-top:1px solid rgba(255,255,255,.08);font-size:.72rem;color:#64748b;flex:none}
.shell-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);z-index:140;opacity:0;pointer-events:none;transition:opacity .2s ease}

/* ---- Main column ---- */
.shell-main{flex:1;min-width:0;display:flex;flex-direction:column;margin-left:264px}
.shell-topbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:1rem;height:4rem;padding:0 1.4rem;
  background:rgba(255,255,255,.88);backdrop-filter:blur(8px);border-bottom:1px solid #eef1f6}
.shell-hamburger{display:none;border:0;background:#f1f5f9;color:#334155;width:2.35rem;height:2.35rem;border-radius:.7rem;font-size:1.05rem;cursor:pointer;align-items:center;justify-content:center}
.shell-hamburger:hover{background:#e2e8f0}
.shell-topbar-title{display:flex;flex-direction:column;min-width:0}
.shell-topbar-title b{font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#0f172a;line-height:1.2}
.shell-topbar-title span{font-size:.68rem;color:#94a3b8;line-height:1.2}
.shell-topbar-nav{margin-left:auto;display:flex;align-items:center;gap:.55rem}
.shell-topbar-user{display:inline-flex;align-items:center;gap:.45rem;font-size:.78rem;font-weight:600;color:#334155;background:#fff;border:1px solid #e2e8f0;padding:.4rem .8rem;border-radius:999px}
.shell-topbar-user i{color:#6366f1}
.shell-topbar-nav a.btn{text-decoration:none}

/* ---- Fluid content area: neutralise old fixed-width wrappers ---- */
.shell-content{padding:1.4rem 1.4rem 4rem;min-width:0}
.shell-content .wrap,
.shell-content .container{max-width:none;margin:0 auto;padding:0}

/* ---- Buttons reused by shell ---- */
.shell .btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:0;border-radius:.8rem;font-size:.84rem;font-weight:700;padding:.55rem .95rem;cursor:pointer;text-decoration:none;transition:.15s ease}
.shell .btn:disabled{opacity:.6;cursor:not-allowed}
.shell .btn-soft{background:#fff;color:#475569;border:1px solid #e2e8f0}
.shell .btn-soft:hover{background:#f8fafc;color:#0f172a}
.shell .btn-sm{padding:.42rem .75rem;font-size:.78rem;border-radius:.65rem}
.shell .btn-danger-soft{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}

/* ---- Responsive ---- */
@media (max-width:991px){
  .shell-sidebar{transform:translateX(-100%);box-shadow:none}
  .shell-sidebar.open{transform:translateX(0);box-shadow:0 0 60px rgba(15,23,42,.35)}
  .shell-overlay.show{opacity:1;pointer-events:auto}
  .shell-main{margin-left:0}
  .shell-hamburger{display:inline-flex}
}
```

- [ ] **Step 2: Sanity check**

Run: `php -l public/assets/css/admin.css` won't work (not PHP). Instead verify the file exists and is non-empty:

```bash
wc -l public/assets/css/admin.css
```

Expected: ≥ 120 lines.

- [ ] **Step 3: Commit**

```bash
git add public/assets/css/admin.css
git commit -m "feat(new-code2): add shared admin shell stylesheet"
```

---

### Task 2: Build the shared layout view (layouts/admin.php)

**Files:**
- Create: `app/Views/layouts/admin.php`
- Consumes: `admin.css` (Task 1); session auth data; `$content`, `$page`, `$title`, `$userEmail`, `$activeMenu`, `$activeSubMenu` variables (produced by PageController in Task 3)
- Produces: `layouts/admin` view; relies on inner admin fragments (Tasks 4–6) to render into `$content`

**Interfaces:**
- PageController passes: `$content` (raw HTML fragment string), `$page` (`dashboard|laporan|pengaturan`), `$title`, `$activeMenu`, `$activeSubMenu` (pengaturan tab), `$userEmail`.
- The pengaturan fragment dispatches/expects a custom DOM event: layout submenu clicks fire `window.dispatchEvent(new CustomEvent('inhal-tab', { detail: tabKey }))`. Task 6's pengaturan fragment listens on `window` for `inhal-tab` and calls its existing `setTab(tabKey)`.

- [ ] **Step 1: Write the layout**

`app/Views/layouts/admin.php`:

```php
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
```

- [ ] **Step 2: Lint**

Run: `php -l app/Views/layouts/admin.php` — expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add app/Views/layouts/admin.php
git commit -m "feat(new-code2): add shared admin layout shell"
```

---

### Task 3: Update PageController — admin guard + opt-in fragment wrapping

**Files:**
- Modify: `app/Controllers/PageController.php`
- Consumes: `layouts/admin` (Task 2)
- Produces: layout-aware `show()` that routes a growing set of keys (`$shellKeys`) through the layout while the not-yet-converted pages keep rendering standalone. Every intermediate commit stays runnable.

**Wiring rule (critical):** A page file may be converted into a fragment (its `<head>`/csrf meta removed) **only in the same commit** that adds its key to `$shellKeys` — otherwise it renders with no head/meta and its Vue CSRF breaks. Therefore Task 3 adds the guard but leaves `$shellKeys = []`; Tasks 4, 5, and 6 each append exactly one key while converting the matching view file.

**Interfaces:**
- `$shellKeys`: array of page keys that go through the layout. Grows: Task 4 → `['dashboard']`, Task 5 → `['dashboard','laporan']`, Task 6 → `['dashboard','laporan','pengaturan']`.
- Method `show(string $page)` keeps signature & route map.

- [ ] **Step 1: Replace controller with guarded, layout-aware version**

`app/Controllers/PageController.php` full replacement:

```php
<?php

namespace App\Controllers;

class PageController extends BaseController
{
    private array $pages = [
        'index'    => 'pages/index',
        'portal'   => 'pages/portal',
        'bagian'   => 'pages/bagian',
        'dashboard'=> 'pages/dashboard',
        'laporan'  => 'pages/detail-laporan',
        'pengaturan'=> 'pages/pengaturan',
    ];

    /** Keys that render through layouts/admin. Grows per conversion task. */
    private array $shellKeys = [];

    private array $titles = [
        'dashboard'  => 'Dashboard',
        'laporan'    => 'Laporan',
        'pengaturan' => 'Pengaturan',
    ];

    public function show(string $page = 'index')
    {
        $key = array_key_exists($page, $this->pages) ? $page : 'index';

        if (!in_array($key, ['dashboard', 'laporan', 'pengaturan'], true)) {
            $data = [
                'page'   => $key,
                'title'  => ucfirst($key),
                'userEmail' => session()->get('auth.nama') ?? '',
            ];
            return view($this->pages[$key], $data);
        }

        // Admin shell pages: admin-only guard.
        $svc = new \App\Libraries\AuthService();
        if (!$svc->isAdmin()) {
            return redirect()->to('/login');
        }

        $title = $this->titles[$key] ?? ucfirst($key);
        $userEmail = session()->get('auth.nama') ?? '';

        // Not yet converted: keep standalone full-document rendering.
        if (!in_array($key, $this->shellKeys, true)) {
            return view($this->pages[$key], [
                'page'   => $key,
                'title'  => $title,
                'userEmail' => $userEmail,
            ]);
        }

        $sub = $key === 'pengaturan'
            ? $this->normalizeSubMenu((string) $this->request->getGet('tab', 'umum'))
            : '';

        $fragment = view($this->pages[$key], [
            'page'       => $key,
            'title'      => $title,
            'userEmail'  => $userEmail,
        ]);

        return view('layouts/admin', [
            'page'          => $key,
            'title'         => $title,
            'userEmail'     => $userEmail,
            'activeMenu'    => $key,
            'activeSubMenu' => $sub,
            'content'       => $fragment,
        ]);
    }

    private function normalizeSubMenu(string $tab): string
    {
        $allowed = ['umum','matakuliah','kegiatan','bagian','biaya','mahasiswa','pengguna','email','nomor','upload','status','audit'];
        return in_array($tab, $allowed, true) ? $tab : 'umum';
    }
}
```

- [ ] **Step 2: Lint**

Run: `php -l app/Controllers/PageController.php` — expected: `No syntax errors detected`.

- [ ] **Step 3: Route smoke (expect redirect to /login when unauth)**

Start dev server (background) then:

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/dashboard
```

Expected: `302` (redirect to /login). Same for `/laporan` and `/pengaturan`.

- [ ] **Step 4: Commit the guard only**

```bash
git add app/Controllers/PageController.php
git commit -m "feat(new-code2): guard admin pages and add opt-in shell routing"
```

---

### Task 4: Convert `/dashboard` into a shell fragment

**Files:**
- Modify: `app/Views/pages/dashboard.php`
- Consumes: layout (Task 2), PageController (Task 3)
- Produces: dashboard inner fragment usable as `$content`.

**Interfaces:**
- The fragment begins with a `<style>` block (the page's existing component CSS, unchanged), then `<div id="app" v-cloak>…` containing ONLY: boot-loading placeholder, logged-in content sections, modals, and toast — NO topbar, NO `!loggedIn` login card.
- Vue data `loggedIn`/`sessionNama`/`boot()` logic stays as-is (guard guarantees the user is authenticated; `boot()` re-verifies via `/api/dashboard/bootstrap`).

- [ ] **Step 1: Inspect current head/topbar boundaries**

Open the file and confirm the ranges (current line numbers at commit `851a61c`):
- PHP prologue + `<!DOCTYPE html>` … `</head>` : lines 1–146
- `<body>` : 147
- `<div id="app" v-cloak>` : 148
- Inline sticky topbar `<div style="position:sticky;top:0…">…</div>` : 149–165 (through the topbar-actions/user-chip/links)
- `<div class="wrap">` : 197
- `bootLoading` template : 167–169 (inside `.wrap`)
- `!loggedIn` login-card `<template v-else-if="!loggedIn">…</template>` : 171–196
- `<template v-else>` (content) : 198
- `</div>` closing `.wrap` : 493
- Modals/toast + `</div>` closing `#app` : 494–765
- `<script src="vue">`, inline script, `</body></html>` : 767–1504

- [ ] **Step 2: Rewrite file head → fragment head**

Replace everything from line 1 through line 147 (`</head>` + `<body>`) with a fragment opener that keeps only the component CSS. New top of file (verbatim):

```php
<?php
$pageKey = $page ?? 'dashboard';
$pageTitle = $title ?? 'Dashboard';
$userEmail = $userEmail ?? '';
?>
<style>
        *,*::before,*::after{box-sizing:border-box}
        [v-cloak]{display:none}
        body{margin:0;background:#f5f6fa;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}
        .wrap{padding:0;margin:0}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem;flex-wrap:wrap}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:1rem;background:#eef2ff;color:#4f46e5;font-size:1.3rem}
        .page-head h1{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#64748b}
        .page-head-actions{margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap}
        .tabs{display:flex;gap:.35rem;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:.35rem;margin-bottom:1.25rem;width:max-content;max-width:100%;overflow-x:auto}
        .tab{border:0;background:transparent;display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;font-weight:700;color:#64748b;padding:.55rem 1rem;border-radius:.7rem;cursor:pointer;white-space:nowrap;transition:.15s ease}
        .tab:hover{background:#f1f5f9;color:#334155}
        .tab.is-active{background:#eef2ff;color:#4f46e5}
        .tab .dot{display:inline-flex;align-items:center;justify-content:center;min-width:1.15rem;height:1.15rem;padding:0 .3rem;border-radius:999px;background:#fde68a;color:#92400e;font-size:.66rem;font-weight:800}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.8rem;margin-bottom:1.25rem}
        .stat{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.25rem}
        .stat-label{font-size:.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:.35rem}
        .stat-value{font-size:1.4rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .stat-sub{font-size:.72rem;color:#94a3b8}
        .card{background:#fff;border-radius:1.15rem;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:1.25rem;overflow:hidden}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.05rem 1.25rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .card-title{display:flex;align-items:center;gap:.6rem;font-size:.98rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .card-title i{color:#6366f1}
        .card-body{padding:1.25rem}
        .empty{text-align:center;padding:2.5rem 1rem;color:#94a3b8}
        .empty i{font-size:2.2rem;display:block;margin-bottom:.6rem;opacity:.6}
        .empty p{margin:0;font-size:.88rem;font-weight:600}
        .chips{display:flex;flex-wrap:wrap;gap:.45rem}
        .chip{border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:.78rem;font-weight:700;padding:.4rem .85rem;border-radius:999px;cursor:pointer;transition:.15s ease;display:inline-flex;align-items:center;gap:.35rem}
        .chip:hover{border-color:#cbd5e1}
        .chip.is-active{background:#0f172a;border-color:#0f172a;color:#fff}
        .chip .cnt{opacity:.65;font-weight:700}
        .filterbar{display:grid;gap:.75rem;margin-bottom:1rem}
        @media(min-width:768px){.filterbar{grid-template-columns:2fr 1fr 1fr auto}}
        .input{width:100%;border:1px solid #e2e8f0;border-radius:.8rem;padding:.62rem .9rem;font-size:.88rem;color:#0f172a;background:#fff;transition:.15s ease}
        .input:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:0;border-radius:.8rem;font-size:.84rem;font-weight:700;padding:.6rem 1rem;cursor:pointer;transition:.15s ease}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.28)}
        .btn-primary:hover{filter:brightness(1.05)}
        .btn-soft{background:#fff;color:#475569;border:1px solid #e2e8f0}
        .btn-soft:hover{background:#f8fafc;color:#0f172a}
        .btn-danger-soft{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
        .btn-danger-soft:hover{background:#fee2e2}
        .btn-success{background:#059669;color:#fff}
        .btn-success:hover{filter:brightness(1.05)}
        .btn-sm{padding:.42rem .75rem;font-size:.78rem;border-radius:.65rem}
        table.list{width:100%;border-collapse:collapse;font-size:.84rem}
        table.list th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;padding:.65rem 1rem;border-bottom:1px solid #f1f5f9;background:#fafbfc;font-weight:800;white-space:nowrap}
        table.list td{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
        table.list tbody tr{cursor:pointer;transition:.12s ease}
        table.list tbody tr:hover{background:#f8fafc}
        .table-scroll{overflow-x:auto}
        .badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:800;padding:.26rem .6rem;border-radius:999px;white-space:nowrap}
        .st-menunggu{background:#fffbeb;color:#b45309}
        .st-diterima{background:#ecfdf5;color:#047857}
        .st-acc{background:#eef2ff;color:#4f46e5}
        .st-ditolak{background:#fef2f2;color:#b91c1c}
        .st-dibatalkan{background:#f1f5f9;color:#475569}
        .flag-on{display:inline-flex;align-items:center;gap:.25rem;background:#ecfdf5;color:#047857;font-size:.7rem;font-weight:800;padding:.2rem .55rem;border-radius:999px}
        .flag-off{color:#cbd5e1;font-size:.8rem}
        .check-item{display:flex;align-items:center;gap:.6rem;padding:.55rem .1rem;font-size:.84rem}
        .check-name{font-weight:700;color:#0f172a;flex:1;min-width:0}
        .check-npm{font-size:.7rem;color:#94a3b8;margin-left:.35rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
        .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem}
        .sec-title{display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:.95rem;margin:1.3rem 0 .9rem;color:#0f172a}
        .sec-title i{color:#6366f1}
        .grid-info{display:grid;gap:.7rem 1.2rem;grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))}
        .label{display:block;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-bottom:.3rem}
        .value{font-size:.9rem;color:#334155;word-break:break-word}
        .panel{background:#f8fafc;border-radius:1rem;padding:1rem 1.1rem;margin-bottom:1rem}
        .panel-white{background:#fff;border:1px solid #f1f5f9;border-radius:1rem;padding:1rem 1.1rem;margin-bottom:1rem}
        .grid-form{display:grid;gap:.8rem;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))}
        .detail-item{background:#fff;border:1px solid #f1f5f9;border-radius:.9rem;padding:.85rem 1rem;margin-bottom:.6rem}
        .detail-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
        .detail-actions{display:flex;gap:.25rem;flex:none}
        .icon-btn{border:0;background:transparent;color:#94a3b8;width:1.9rem;height:1.9rem;border-radius:.55rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
        .icon-btn:hover{background:#f1f5f9;color:#4f46e5}
        .icon-btn.danger:hover{background:#fef2f2;color:#e11d48}
        .modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto}
        .modal{background:#fff;border-radius:1.25rem;width:100%;max-width:52rem;box-shadow:0 30px 80px rgba(15,23,42,.25);overflow:hidden;margin:auto}
        .modal-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1.15rem 1.35rem;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
        .modal-title{font-weight:800;font-size:1rem;display:flex;align-items:center;gap:.55rem}
        .modal-title i{color:#6366f1}
        .modal-sub{font-family:ui-monospace,monospace;font-size:.72rem;color:#94a3b8}
        .modal-close{border:0;background:#f1f5f9;color:#64748b;width:2rem;height:2rem;border-radius:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .modal-close:hover{background:#e2e8f0;color:#0f172a}
        .modal-body{padding:1.35rem}
        .modal-foot{padding:1rem 1.35rem;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap}
        .loading-pane{display:flex;flex-direction:column;align-items:center;gap:.6rem;padding:3.5rem 1rem;color:#64748b}
        .spinner{width:1.4rem;height:1.4rem;border:3px solid #e0e7ff;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        .spinner-sm{width:1rem;height:1rem;border-width:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .toast{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:.6rem;max-width:92vw;color:#fff;font-size:.85rem;font-weight:600;padding:.8rem 1.15rem;border-radius:.9rem;box-shadow:0 14px 40px rgba(15,23,42,.35);animation:rise .25s ease}
        .toast-success{background:#065f46}
        .toast-error{background:#991b1b}
        .toast-info{background:#0f172a}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .fade-enter-active,.fade-leave-active{transition:opacity .18s ease}
        .fade-enter-from,.fade-leave-to{opacity:0}
        .pop-enter-active,.pop-leave-active{transition:transform .2s ease,opacity .2s ease}
        .pop-enter-from,.pop-leave-to{transform:scale(.96);opacity:0}
        .bar-track{height:.55rem;background:#f1f5f9;border-radius:999px;overflow:hidden;flex:1}
        .bar-fill{height:100%;border-radius:999px;transition:width .4s ease}
        .chart-row{display:flex;align-items:center;gap:.7rem;margin-bottom:.6rem}
        .chart-label{width:7.5rem;flex:none;text-align:right;font-size:.78rem;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chart-val{width:2.2rem;flex:none;text-align:right;font-size:.78rem;font-weight:800;color:#0f172a}
        .link{font-weight:600;color:#4f46e5;text-decoration:none;word-break:break-all}
        .link:hover{text-decoration:underline}
        .divider{border:0;border-top:1px solid #f1f5f9;margin:1rem 0}
        .btn-block{width:100%}
        .hint{font-size:.74rem;color:#94a3b8;font-weight:500}
        .req{color:#e11d48}
    </style>
```

- [ ] **Step 3: Delete topbar + login card markup**

Inside `<div id="app" v-cloak>`:
1. Delete the sticky topbar `<div style="position:sticky;top:0;z-index:40;…">…</div>` (ends before `<div class="wrap">`). The layout's topbar replaces it (user name & logout are server-rendered).
2. Delete the `<div class="wrap">` opener line AND its closing `</div>` (currently ~line 493) so fragment children become direct. Alternatively keep `.wrap` but its `max-width` override already set to `0`/none in Step 2 — **simpler:** drop the `<div class="wrap">` open tag and matching close, leaving bootLoading + content templates directly inside `#app`.
3. Delete the whole `<template v-else-if="!loggedIn">…</template>` login-card block (role tabs + form). Since the controller now guards admin-only, this branch is unreachable and must be removed so no login UI duplicates the shell.
4. Change `<template v-else>` (content) to `<template v-else-if="loggedIn">` so that if a session is dropped mid-page the boot spinner is replaced by nothing (`boot()`'s existing catch already handles a failed re-verify by leaving `loggedIn=false`; the server guard on the next navigation returns the user to `/login`).

Resulting `#app` inner structure (verbatim ordering):

```html
<div id="app" v-cloak>
    <template v-if="bootLoading">
        <div class="card"><div class="loading-pane"><div class="spinner"></div><span>Memeriksa sesi admin…</span></div></div>
    </template>

    <template v-else-if="loggedIn">
        ...existing content sections, modals, toast unchanged...
    </template>
</div>
```

- [ ] **Step 4: Remove Matakuliah display in detail modal**

Find the block:

```html
<div v-if="detail.p.matakuliah"><span class="label">Matakuliah</span><span class="value">{{ detail.p.matakuliah }}</span></div>
```

Delete that one line from the Data Mahasiswa panel (inside `#app`, the read-only grid-info section near the original line ~530).

- [ ] **Step 5: Verify document structure**

The file must no longer contain `<!DOCTYPE`, `<head>`, `</head>`, `<body>`, `</body>`, or `</html>`. It must start with `<?php … ?>` then `<style>` and later contain `<div id="app" v-cloak>`, the Vue CDN script, and `.mount('#app');`.

Run:
```bash
grep -nE '<!DOCTYPE|<head>|</head>|<body>|</body>|</html>' app/Views/pages/dashboard.php; echo "exit=$?"
```
Expected: no matches (grep exit 1).

- [ ] **Step 6: Lint & auth smoke**

```bash
php -l app/Views/pages/dashboard.php
```
Expected: `No syntax errors detected`.

With the dev server running and no session cookie, `/dashboard` returns 302 to `/login` (guard). With an admin session (see smoke cookie procedure used previously), `/dashboard` returns 200 containing `class="shell"` and `<div id="app" v-cloak>` exactly once, and no `Masuk` login-card text.

- [ ] **Step 7: Wire dashboard into shell + commit**

Add `'dashboard'` to `$shellKeys` in `PageController.php` (currently `private array $shellKeys = [];` → `private array $shellKeys = ['dashboard'];`), then:

```bash
php -l app/Controllers/PageController.php
git add app/Views/pages/dashboard.php app/Controllers/PageController.php
git commit -m "refactor(new-code2): convert dashboard into admin shell fragment"
```

---

### Task 5: Convert `/laporan` into a shell fragment

**Files:**
- Modify: `app/Views/pages/detail-laporan.php`
- Consumes: layout (Task 2), PageController (Task 3)
- Produces: laporan inner fragment.

**Same mechanics as Task 4** — head/topbar/login-card removed, content kept. Unique anchors for THIS file:
- Component `<style>` block: lines 17–116 (`</style>` at 116), head ends 117, `<body>` 118, `<div id="app" v-cloak>` 119.
- Topnav: `<nav class="topnav">` line ~122 … `</nav>` line ~131.
- `.container` opener line ~134; its closing `</div>` line ~472.
- `bootLoading` template 135–137; `!loggedIn` login-card `<template v-else-if="!loggedIn">` 139–156; `<template v-else>` 158.
- Toast + `#app` close before Vue script at line 481.

- [ ] **Step 1: Rewrite file head → fragment opener**

Replace lines 1 through `<body>` (line 118) with the same PHP prologue + `<style>` block pattern as Task 4 Step 2, but using the ORIGINAL laporan component CSS (currently lines 19–116) verbatim, with two edits inside it:
1. Replace the `.topnav`/`.topnav-inner`/`.container` width rules with a fluid `.container{padding:0;margin:0}`.
2. Keep every other component rule identical.

Verbatim fragment opener (replacing the `.topnav*` and `.container` rules):

```css
        .container{padding:0;margin:0}
```

(Delete `.topnav`, `.topnav-inner`, `.topnav-brand*`, `.topnav-links`, `.topnav-link*` rules since the topnav markup is removed; keep `.container` content rules that the page needs — adjust only the width/padding as above.)

- [ ] **Step 2: Delete topnav + login card + unwrap container**

1. Remove the `<nav class="topnav">…</nav>` block (lines ~122–131).
2. Remove `<div class="container">` opener (~134) and its matching closing `</div>` (~472).
3. Remove `<template v-else-if="!loggedIn">…</template>` login card (139–156).
4. Change `<template v-else>` → `<template v-else-if="loggedIn">`.

- [ ] **Step 3: Remove Matakuliah from any export/label rendering**

Search the file for `Matakuliah` / `matakuliah`. None exist in the view today (backend `LaporanApi` still returns it; the view doesn't render it) — if grep shows nothing, skip. Verify:
```bash
grep -niE 'matakuliah' app/Views/pages/detail-laporan.php; echo "exit=$?"
```

- [ ] **Step 4: Verify document structure**

```bash
grep -nE '<!DOCTYPE|<head>|</head>|<body>|</body>|</html>' app/Views/pages/detail-laporan.php; echo "exit=$?"
```
Expected: no matches.

- [ ] **Step 5: Lint & smoke**

```bash
php -l app/Views/pages/detail-laporan.php
```
Unauth `/laporan` → 302; admin session → 200 containing `class="shell"` and no `Masuk` card.

- [ ] **Step 6: Wire laporan into shell + commit**

Add `'laporan'` to `$shellKeys` in `PageController.php` (→ `['dashboard','laporan']`), then:

```bash
php -l app/Controllers/PageController.php
git add app/Views/pages/detail-laporan.php app/Controllers/PageController.php
git commit -m "refactor(new-code2): convert laporan page into admin shell fragment"
```

---

### Task 6: Convert `/pengaturan` into a shell fragment with sidebar submenu

**Files:**
- Modify: `app/Views/pages/pengaturan.php`
- Consumes: layout (Task 2), PageController (Task 3)
- Produces: pengaturan fragment; listens for `inhal-tab` window event.

**Behaviour change:** The horizontal 12-tab bar is removed from content; the sidebar submenu (Task 2) drives tabs. The Vue app keeps `tab`, `setTab()`, `loadTab()`, `sectionFor()`, `labelFor()`.

- [ ] **Step 1: Rewrite head → fragment opener**

Same pattern as Tasks 4–5. Component CSS currently spans lines 17–92. Replace `.wrap{max-width:76rem;…}` with `.wrap{padding:0;margin:0}`. Keep the rest verbatim. Remove `.topbar-actions`/`.user-chip` (no topbar now) and `.auth-*`, `.role-*`, `.field`, `.btn-block` rules (login card removed) — optional but keep if referenced elsewhere; audit with grep after deletion.

- [ ] **Step 2: Delete topbar + login card + horizontal tabs**

1. Remove sticky topbar `<div style="position:sticky;…">…</div>` (page topbar block lines ~96–111).
2. Remove `<div class="wrap">` opener (~112) and its closing `</div>` (~556).
3. Remove `<template v-if="!loggedIn">…</template>` login card (114–131).
4. Change `<template v-else>` (133) → `<template v-else-if="loggedIn">`.
5. **Remove the horizontal tab bar**: delete the `.tabs` block inside the logged-in area (the 12 `<button class="tab">` items between page-head and `<template v-if="loading">`), lines ~147–160. The page-head remains (title + Simpan). The content `<section v-if="tab===…">` blocks stay untouched and are shown based on `tab` set via sidebar events.
6. Update the page-head subtitle to reflect the active tab? Not required; topbar title already shows active submenu (from `$activeSubMenu`/`$subTitles` in layout). Keep page-head as "Pengaturan".

- [ ] **Step 3: Sync Vue `tab` with sidebar events & boot default**

1. Change data default: `tab: 'matakuliah'` → `tab: 'umum'` (so the first boot matches the layout's default active submenu `umum`).
2. Add a method to receive sidebar clicks and subscribe in `mounted()`:

```js
            applyTabFromEvent(name) {
                const allowed = ['umum','matakuliah','kegiatan','bagian','biaya','mahasiswa','pengguna','email','nomor','upload','status','audit'];
                if (allowed.indexOf(name) === -1) return;
                this.setTab(name);
                try { history.replaceState(null, '', '/pengaturan?tab=' + name); } catch (e) { /* noop */ }
            },
```

In `mounted()` (currently `this.boot();`):

```js
        mounted() {
            window.addEventListener('inhal-tab', (ev) => {
                if (ev && ev.detail) this.applyTabFromEvent(ev.detail);
            });
            this.boot();
        }
```

- [ ] **Step 4: Read initial submenu from URL on boot**

The layout highlights `$activeSubMenu` from `?tab=`. Make the Vue boot honour it so a reload keeps the correct tab. Current boot method:

```js
            async boot() {
                this.loading = true;
                try {
                    const res = await apiFetch('GET', 'pengaturan/umum');
                    this.loggedIn = true;
                    this.loaded.umum = true;
                    this.c.umum = Object.assign(this.c.umum, res.data);
                    await this.loadTab('matakuliah');
                } catch (e) {
                    this.loggedIn = false;
                } finally {
                    this.loading = false;
                }
            },
```

Replace it with this version (parses `?tab=`, primes `this.tab`, then loads the effective tab; the `umum` fetch stays as the session probe and data source):

```js
            async boot() {
                this.loading = true;
                const qtab = new URLSearchParams(window.location.search).get('tab');
                const allowed = ['umum','matakuliah','kegiatan','bagian','biaya','mahasiswa','pengguna','email','nomor','upload','status','audit'];
                if (qtab && allowed.indexOf(qtab) !== -1) this.tab = qtab;
                try {
                    const res = await apiFetch('GET', 'pengaturan/umum');
                    this.loggedIn = true;
                    this.loaded.umum = true;
                    this.c.umum = Object.assign(this.c.umum, res.data);
                    await this.loadTab(this.tab);
                } catch (e) {
                    this.loggedIn = false;
                } finally {
                    this.loading = false;
                }
            },
```

- [ ] **Step 5: Verify document structure & leftover refs**

```bash
grep -nE '<!DOCTYPE|<head>|</head>|<body>|</body>|</html>' app/Views/pages/pengaturan.php; echo "exit=$?"
grep -nE 'class="tabs"|role-tab|auth-card' app/Views/pages/pengaturan.php; echo "exit=$?"
```
Expected: first grep no matches; second grep should return nothing for the removed login/tab markup (if matches remain, delete the leftover login/tab markup only, keeping any legitimate component usage).

- [ ] **Step 6: Lint & smoke**

```bash
php -l app/Views/pages/pengaturan.php
```
Unauth `/pengaturan` → 302; with admin session `/pengaturan` → 200 with `class="shell"`, sidebar submenu `<button … data-tab="biaya">`, and exactly one `#app`.

- [ ] **Step 7: Wire pengaturan into shell + commit**

Add `'pengaturan'` to `$shellKeys` in `PageController.php` (→ `['dashboard','laporan','pengaturan']`), then:

```bash
php -l app/Controllers/PageController.php
git add app/Views/pages/pengaturan.php app/Controllers/PageController.php
git commit -m "refactor(new-code2): route pengaturan through shell with sidebar submenu"
```

---

### Task 7: Remove Matakuliah from registration form (index.php)

**Files:**
- Modify: `app/Views/pages/index.php`

**Backend unchanged:** `PengajuanApi::register` keeps `matakuliah` column handling (sends `''`), duplicate-check, options endpoint, master table — all intact. UI-only removal.

- [ ] **Step 1: Remove the field block**

Delete the Matakuliah `<select>` block. Current anchors (lines ~163–167):

```html
                    <div v-if="form.jenisKegiatan && form.jenisKegiatan !== 'Praktikum'" class="mt-4 grid gap-4 sm:grid-cols-2">
```

Within that wrapper the first grid cell is Matakuliah:

```html
                                <div>
                                    <label class="label">Matakuliah <span class="text-rose-500">*</span></label>
                                    <select v-model="form.matakuliah" class="input">
                                        <option value="">-- Pilih Matakuliah --</option>
                                        <option v-for="o in options.matakuliah" :value="o">{{ o }}</option>
                                    </select>
                                </div>
```

Delete that cell (keep the wrapper's other cell(s) such as Tanggal Pelaksanaan, and keep the `v-if` wrapper). If Matakuliah is the only first cell, remove the cell only — do not delete the wrapper or the second field.

- [ ] **Step 2: Neutralise validation & payload references**

1. In `validate()` (~386): delete the branch
```js
if (jenis !== 'Praktikum' && !this.form.matakuliah) { ... }
```
(keep every other rule).
2. In the submit payload (~399): keep `matakuliah` value but set it always `''`:
```js
matakuliah: '',
```
3. Reset form objects (~299 and ~433): remove `matakuliah: ''` keys.
4. Optionally leave `options.matakuliah` untouched (harmless) — do NOT remove from `registration-options` mapping.

- [ ] **Step 3: Verify**

```bash
grep -nE 'matakuliah|Matakuliah' app/Views/pages/index.php; echo "exit=$?"
```
Expected: remaining matches only in JS payload (`matakuliah: ''`) — no `<select>`, no `options.matakuliah`, no validation text. Portal also checked in Task 8.

- [ ] **Step 4: Commit**

```bash
git add app/Views/pages/index.php
git commit -m "feat(new-code2): remove Matakuliah field from registration UI"
```

---

### Task 8: Hide Matakuliah from Portal display

**Files:**
- Modify: `app/Views/pages/portal.php`

- [ ] **Step 1: Search & remove any Matakuliah label/value in portal**

```bash
grep -niE 'matakuliah' app/Views/pages/portal.php; echo "exit=$?"
```
Expected today: no matches (backend `PortalApi` still returns it but the view does not render it). If grep shows a label/value row, delete that row only. Do not modify `PortalApi`.

- [ ] **Step 2: Commit**

```bash
git add app/Views/pages/portal.php
git commit -m "feat(new-code2): hide Matakuliah from portal view"
```

---

### Task 9: Regression & final verification

**Files:** none (verification only)

- [ ] **Step 1: PHP lint all changed PHP views**

```bash
for f in app/Views/layouts/admin.php app/Views/pages/dashboard.php app/Views/pages/detail-laporan.php app/Views/pages/pengaturan.php app/Views/pages/index.php app/Views/pages/portal.php app/Controllers/PageController.php; do php -l "$f" || echo "LINT FAIL: $f"; done
```
Expected: all `No syntax errors detected`.

- [ ] **Step 2: Full PHPUnit suite**

```bash
composer test
```
Expected: 24 tests / 80 assertions, all green (endpoints unchanged).

- [ ] **Step 3: Admin route smoke (with session)**

Start `php -S 127.0.0.1:8080 -t public` in a background terminal, obtain an admin session cookie + CSRF token (same procedure used previously: POST `/login` role=admin then read `ci_session`), then assert on each of `/dashboard`, `/laporan`, `/pengaturan`:
- HTTP 200.
- body contains `class="shell"` and one `<div id="app" v-cloak>`.
- body does NOT contain `Masuk Dashboard`, `Masuk Laporan`, or `Masuk Admin` login card copy.
- `/pengaturan?tab=biaya` shows `data-tab="biaya"` marked `is-active`.
- `/`, `/portal`, `/bagian` still 200 with their own full documents (grep `<!DOCTYPE` present).

- [ ] **Step 4: Matakuliah regression**

- `/` (registration) HTML no longer contains a `Matakuliah` label.
- Registration POST still succeeds (server accepts empty `matakuliah`) and duplicate logic still functions.

- [ ] **Step 5: Responsive/full-width check (manual)**

Via the public preview domain: on a wide window content reaches the edge (no fixed 72/76/80rem gutters inside the admin pages); below 992px the sidebar hides and the hamburger opens it as an off-canvas drawer with overlay; closing works. Pengaturan submenu clicks switch tabs without full reload and update the URL to `?tab=…`.

- [ ] **Step 6: Clean up DBs to seed counts & commit nothing else**

After smoke, restore `inhal` and `inhal_test` to seed state (as done previously). Confirm `git status --short` shows only the intended commits from tasks above.

---

## Self-review notes

- **Spec coverage:** A → Tasks 1–6; B → Task 1 CSS (fluid + off-canvas) + Task 4/5/6 fragment `.wrap/.container` zero-width + layout `.shell-content`; C → Task 6 + Task 2 submenu; D → Tasks 4 (dashboard modal), 7 (index), 8 (portal). Guard/unified login → Task 3. Shell admin-only → Task 3.
- **Type consistency:** The `inhal-tab` event payload is a string tab key consumed by `applyTabFromEvent`; the layout fires it from `data-tab` attributes whose values match `pengaturan` tab keys and `normalizeSubMenu` allow-list.
- **Placeholder scan:** All edits reference existing line ranges/anchors captured from the codebase at commit `851a61c`; conversion tasks tell the implementer to preserve verbatim the original component CSS and page logic.
