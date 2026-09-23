# Admin Shell (AdminLTE-style) — Design

Date: 2026-09-08
Status: Approved (design)
Scope: A (shared shell) + B (full-width/responsive) + C (Pengaturan submenu in sidebar) + D (remove Matakuliah from UI)

## Problem

1. Admin pages `/dashboard`, `/laporan`, `/pengaturan` are three standalone HTML files (1000–1500 lines each) that duplicate the same CSS conventions and each ship their own `<head>`, topbar, inline CSS, and a separate Vue 3 app. Navigation between them is inconsistent (`dashboard.php` has no links to `/laporan` or `/pengaturan`), making the admin area feel fragmented and confusing.
2. Content is capped at `max-width: 72/76/80rem`, leaving large empty gutters on laptop/wide screens; the layout is not truly responsive.
3. `/pengaturan` has 12 tabs crammed into one horizontal row.
4. The registration form still asks for `Matakuliah`, which is not used by the department (only `Blok` is used).

## Constraints

- CodeIgniter **4.4.7** installed. The native `$this->extend()/section()` view layout feature is only available in CI4 4.5+. We stay on 4.4.7 and implement a manual layout, without upgrading the framework.
- Stack stays as-is: Vue 3 via CDN, Bootstrap Icons, Google Fonts (Plus Jakarta Sans), custom CSS + Tailwind-style utility classes.
- No real AdminLTE / Bootstrap 5 assets are introduced; we only mimic the AdminLTE look (dark sidebar, icon+label menu, white topbar).
- Existing APIs and routes must not change; PHPUnit suite must stay green.
- The `/` (registration), `/portal`, and `/bagian` pages stay outside the shell and are not restyled.

## Decisions

- **Shell is admin-only.** A `bagian` session always redirects to `/bagian`, which lives outside the shell. Dashboard/Laporan/Pengaturan are pure admin areas. Menu for admin: Dashboard, Laporan, Pengaturan, plus Keluar (logout). Menu is not role-adaptive beyond this (admin-only scope).
- **Login is unified** through the existing `/login` route rendering a single "Masuk" view (role tabs Admin/Bagian + password). Unauth visits to `/dashboard`, `/laporan`, `/pengaturan` redirect to `/login`. The inline login cards currently embedded in dashboard/laporan/pengaturan are removed.
- **Manual layout**: one layout view receives `$content` (rendered inner view) plus `$page`/`$title`/`$activeMenu`, and emits the full HTML document (shared `<head>` + `admin.css` + topbar + sidebar + content region).
- **Fluid full-width** content for admin pages (drop the `max-width` wrappers). Fixed 260px sidebar on wide screens; off-canvas sidebar + hamburger below ~992px.
- **Pengaturan submenu lives in the sidebar** (grouped Master / Lainnya). Clicking a submenu sets the active `tab` inside the Pengaturan Vue app. The old horizontal 12-tab bar is removed from the content area.
- **Matakuliah removal is UI-only**: drop the field from the registration form and hide it from all displays (dashboard detail, laporan, portal). DB column, master_matakuliah, registration-options payload, and the backend duplicate-check are left untouched.

## Architecture

### New files

- `app/Views/layouts/admin.php` — manual layout for the three admin pages.
  - Renders full HTML document.
  - `$title` (used in `<title>` and page heading).
  - `$activeMenu` → decides which sidebar item is highlighted and whether the Pengaturan submenu group is expanded/visible.
  - `$content` → already-rendered inner page HTML (page-specific CSS + markup + Vue script).
  - Includes topbar: brand (Pendaftaran INHAL / badge), user chip (`$userEmail`), Keluar link.
  - Includes sidebar: Dashboard, Laporan, Pengaturan menu items; when `$activeMenu === 'pengaturan'`, renders grouped submenu (Master / Lainnya) whose items carry `data-tab` attributes the inner app reacts to.
- `public/assets/css/admin.css` — shared shell CSS extracted from the duplicated inline blocks of the three pages: variables, topbar, sidebar + off-canvas behaviour, `.card`, `.btn`, `.tabs` (kept for inner content needs if any), `.page-head`, badges/chips, table + `.table-scroll`, modal, toast, form controls (`.input`, `.field`, `.label`), responsive rules.

### Changed files

- `app/Controllers/PageController.php`
  - For keys `dashboard`, `laporan`, `pengaturan`: render inner view to a string, then render `layouts/admin` passing `$content`, `$page`, `$title`, `$activeMenu` (= page key), `$userEmail`.
  - For `index`, `portal`, `bagian`: unchanged standalone rendering.
  - Unauthenticated admin pages redirect to `/login` (pengaturan already does; dashboard & laporan get the same guard; see Auth section).
- `app/Views/pages/dashboard.php` — strip the outer `<head>`/topbar/login-card shell; keep inner content sections (Pengajuan / Statistik / BA / BA Bagian tabs), page-specific CSS and the Vue app. Remove Matakuliah display in detail modal.
- `app/Views/pages/detail-laporan.php` — same treatment; admin-only login card removed; remove Matakuliah column/display.
- `app/Views/pages/pengaturan.php` — same treatment; remove the horizontal 12-tab bar and page-level Save button duplication if it belongs in the topbar; expose a method (or existing `setTab`) that the sidebar submenu links can trigger; content header shows the active tab title.
- `app/Views/pages/index.php` — remove the Matakuliah `<select>` and label; keep `form.matakuliah` present as `''` in the payload; remove the "matakuliah wajib" validation branch.
- `app/Views/pages/portal.php` — hide Matakuliah row in the student status detail.
- `app/Controllers/Auth.php` — already renders a `pages/bagian`-based login view today; replace with a dedicated login view under the shell so pre-login pages show a uniform "Masuk" screen (role tabs Admin/Bagian). Guarding detail below.

### Auth & guards

- Keep `AuthService` untouched (role stored in `auth.role`; admin vs bagian redirect logic preserved).
- `PageController::show`: before rendering admin pages, if `!isAdmin()` redirect to `/login`. `/login` route renders the uniform login view (no sidebar required yet) instead of reusing `pages/bagian`.
- `detail-laporan.php` and `dashboard.php` currently embed their own login cards; these are removed since `/login` handles authentication. Their API filters (`admin`) are unchanged.

### Matakuliah hiding points (D)

- `app/Views/pages/index.php`: remove `<select>` (Matakuliah) + label + validation requiring it.
- `app/Views/pages/dashboard.php` ~line 530: drop the `detail.p.matakuliah` block.
- `app/Views/pages/detail-laporan.php`: remove Matakuliah from table/export labels where rendered.
- `app/Views/pages/portal.php`: remove Matakuliah row.
- Backend (`PengajuanApi`, `LaporanApi`, `PortalApi`, `MasterApi`), DB schema, `master_matakuliah`: unchanged.

## Data flow

1. Request `GET /pengaturan`.
2. `PageController::show('pengaturan')` → guard `isAdmin()` else redirect `/login`.
3. Inner view `pages/pengaturan` renders (CSS + tabs sections + Vue app) into `$content`.
4. `layouts/admin` renders the full document with shared CSS, topbar, sidebar (Pengaturan submenu active), then injects `$content`.
5. Clicking a sidebar submenu (e.g. "Master Biaya") dispatches a custom event or calls the exposed `setTab('biaya')` on the inner Vue app; content section swaps without a reload. Fallback: tiny inline script that finds the app method via `window`.

## Error handling

- No new server-side errors introduced. Auth redirects handle unauth access.
- If a submenu click cannot reach the Vue app (edge timing), the page falls back to a full reload with a `?tab=` query parameter that the page reads on boot. (Simple, avoids fragile coupling.)

## Testing

- PHPUnit (`composer test`) must remain green — endpoints unchanged.
- Manual (via preview URL after deploy):
  - Login as admin → shell appears; sidebar shows Dashboard / Laporan / Pengaturan.
  - Each menu item opens the right page with the correct active state.
  - On `/pengaturan`, clicking each grouped submenu switches the correct tab; page heading updates.
  - Resize to <992px → sidebar hides; hamburger opens off-canvas; backdrop closes.
  - Content stretches full width on a wide window (no side gutters).
  - Registration form no longer shows Matakuliah and still submits (dup-check still works).
  - Portal / laporan / dashboard detail no longer display Matakuliah.
  - Unauth `/dashboard`, `/laporan`, `/pengaturan` redirect to `/login`.

## Out of scope

- Upgrading CI4 (deferred unless later needed).
- Introducing real AdminLTE/Bootstrap assets.
- Restyling `/`, `/portal`, `/bagian`.
- Data/model changes for Matakuliah (kept for reversibility).
- Backend duplicate-check semantics changes.
