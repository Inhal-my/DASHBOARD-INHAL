<?php
$pageKey = $page ?? 'portal';
$pageTitle = $title ?? 'Portal';
$userEmail = $userEmail ?? '';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf" content="<?= csrf_hash() ?>">
    <title><?= htmlspecialchars($pageTitle) ?> | Portal Mahasiswa INHAL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
        *,*::before,*::after{box-sizing:border-box}
        [v-cloak]{display:none}
        body{margin:0;background:#eef0f6;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}
        .topnav{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.85);border-bottom:1px solid #eef1f6;backdrop-filter:blur(8px)}
        .topnav-inner{max-width:72rem;margin:0 auto;height:4rem;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
        .topnav-brand{display:flex;align-items:center;gap:.75rem;text-decoration:none;color:inherit}
        .topnav-badge{display:inline-flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:.75rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.35)}
        .topnav-brand-text{display:flex;flex-direction:column}
        .topnav-name{font-size:.95rem;font-weight:800;letter-spacing:-.01em;color:#0f172a;line-height:1.2}
        .topnav-sub{font-size:.68rem;color:#94a3b8;line-height:1.2}
        .topnav-links{display:flex;align-items:center;gap:.35rem;overflow-x:auto;scrollbar-width:none}
        .topnav-links::-webkit-scrollbar{display:none}
        .topnav-link{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;padding:.5rem .8rem;border-radius:.7rem;font-size:.8rem;font-weight:600;color:#64748b;text-decoration:none;transition:background .15s ease,color .15s ease}
        .topnav-link:hover{background:#f1f5f9;color:#334155}
        .topnav-link.is-active{background:#eef2ff;color:#4f46e5}
        .container{max-width:72rem;margin:0 auto;padding:1.5rem 1.25rem 3rem}
        .page-head{display:flex;align-items:center;gap:.9rem;margin-bottom:1.25rem}
        .page-head-icon{display:inline-flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:.9rem;background:#eef2ff;color:#4f46e5;font-size:1.25rem}
        .page-head h1{margin:0;font-size:1.35rem;font-weight:800;letter-spacing:-.01em;color:#0f172a}
        .page-head p{margin:.15rem 0 0;font-size:.8rem;color:#94a3b8}
        .card{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(15,23,42,.06);padding:1.5rem}
        .card-note{display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:#475569}
    </style>
    <style>
        [v-cloak] { display: none; }
        .safe-b { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem); }
        .safe-t { padding-top: env(safe-area-inset-top, 0px); }
        .input { width: 100%; border-radius: 1rem; border: 0; background: #f8fafc; padding: .8rem 1rem; font-size: .95rem; color: #0f172a; outline: none; box-shadow: inset 0 0 0 1.5px #e2e8f0; transition: box-shadow .15s ease, background .15s ease; }
        .input:focus { background: #fff; box-shadow: inset 0 0 0 2px #4f46e5; }
        .input::placeholder { color: #a3afbf; }
        .label { display: block; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; margin-bottom: .4rem; }
        .value { font-size: .92rem; color: #334155; }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 1rem; background: linear-gradient(135deg, #6366f1, #4f46e5); padding: .9rem 1.25rem; font-size: .95rem; font-weight: 700; color: #fff; transition: transform .12s ease, box-shadow .15s ease, opacity .15s ease; box-shadow: 0 6px 18px rgba(79,70,229,.35); }
        .btn-primary:active { transform: scale(.98); }
        .btn-primary:disabled { opacity: .55; box-shadow: none; }
        .btn-soft { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border-radius: 1rem; background: #fff; padding: .7rem 1rem; font-size: .875rem; font-weight: 600; color: #475569; box-shadow: inset 0 0 0 1.5px #e2e8f0; transition: all .15s ease; }
        .btn-soft:active { background: #f1f5f9; }
        .link { font-weight: 600; color: #4f46e5; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .section-title { display: flex; align-items: center; gap: .5rem; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #4f46e5; margin-bottom: .9rem; }
        .chip { display: inline-flex; align-items: center; gap: .3rem; border-radius: 999px; padding: .28rem .7rem; font-size: .72rem; font-weight: 700; letter-spacing: .02em; }
        .timeline { position: relative; padding-left: 26px; }
        .timeline::before { content: ""; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 2px; background: #e2e8f0; }
        .t-item { position: relative; padding-bottom: 22px; }
        .t-item:last-child { padding-bottom: 0; }
        .t-dot { position: absolute; left: -26px; top: 2px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.08); z-index: 1; }
        .fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
        .fade-enter-from, .fade-leave-to { opacity: 0; }
        .slide-enter-active, .slide-leave-active { transition: transform .25s ease, opacity .25s ease; }
        .slide-enter-from, .slide-leave-to { transform: translateY(100%); opacity: 0; }
        .blur-final { filter: blur(5px); user-select: none; }
    </style>
    <style>

*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }/*! tailwindcss v3.4.17 | MIT License | https://tailwindcss.com*/*,:after,:before{box-sizing:border-box;border:0 solid #e5e7eb}:after,:before{--tw-content:""}:host,html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4;font-family:Plus Jakarta Sans,system-ui,sans-serif;font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:#9ca3af}input::placeholder,textarea::placeholder{opacity:1;color:#9ca3af}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]:where(:not([hidden=until-found])){display:none}.pointer-events-none{pointer-events:none}.fixed{position:fixed}.absolute{position:absolute}.relative{position:relative}.sticky{position:sticky}.inset-0{inset:0}.inset-x-0{left:0;right:0}.inset-y-0{top:0;bottom:0}.-left-10{left:-2.5rem}.-right-16{right:-4rem}.-top-16{top:-4rem}.bottom-0{bottom:0}.bottom-6{bottom:1.5rem}.left-0{left:0}.left-3\.5{left:.875rem}.left-4{left:1rem}.right-6{right:1.5rem}.top-0{top:0}.top-1\/2{top:50%}.z-10{z-index:10}.z-30{z-index:30}.z-40{z-index:40}.z-50{z-index:50}.z-\[100\]{z-index:100}.z-\[110\]{z-index:110}.z-\[120\]{z-index:120}.col-span-2{grid-column:span 2/span 2}.mx-4{margin-left:1rem;margin-right:1rem}.mx-auto{margin-left:auto;margin-right:auto}.my-5{margin-top:1.25rem;margin-bottom:1.25rem}.\!mb-0{margin-bottom:0!important}.-mt-10{margin-top:-2.5rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}.mb-5{margin-bottom:1.25rem}.mb-6{margin-bottom:1.5rem}.ml-1{margin-left:.25rem}.ml-3{margin-left:.75rem}.ml-auto{margin-left:auto}.mr-1{margin-right:.25rem}.mr-1\.5{margin-right:.375rem}.mt-0\.5{margin-top:.125rem}.mt-1{margin-top:.25rem}.mt-1\.5{margin-top:.375rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-5{margin-top:1.25rem}.mt-6{margin-top:1.5rem}.mt-auto{margin-top:auto}.block{display:block}.inline-block{display:inline-block}.flex{display:flex}.inline-flex{display:inline-flex}.table{display:table}.grid{display:grid}.hidden{display:none}.h-10{height:2.5rem}.h-12{height:3rem}.h-14{height:3.5rem}.h-16{height:4rem}.h-2\.5{height:.625rem}.h-20{height:5rem}.h-4{height:1rem}.h-40{height:10rem}.h-5{height:1.25rem}.h-56{height:14rem}.h-6{height:1.5rem}.h-8{height:2rem}.h-9{height:2.25rem}.h-full{height:100%}.h-px{height:1px}.max-h-\[88vh\]{max-height:88vh}.max-h-\[92vh\]{max-height:92vh}.min-h-screen{min-height:100vh}.w-10{width:2.5rem}.w-12{width:3rem}.w-14{width:3.5rem}.w-16{width:4rem}.w-20{width:5rem}.w-24{width:6rem}.w-36{width:9rem}.w-4{width:1rem}.w-40{width:10rem}.w-5{width:1.25rem}.w-56{width:14rem}.w-6{width:1.5rem}.w-8{width:2rem}.w-9{width:2.25rem}.w-\[268px\]{width:268px}.w-full{width:100%}.min-w-0{min-width:0}.max-w-3xl{max-width:48rem}.max-w-4xl{max-width:56rem}.max-w-5xl{max-width:64rem}.max-w-7xl{max-width:80rem}.max-w-md{max-width:28rem}.max-w-sm{max-width:24rem}.max-w-xl{max-width:36rem}.flex-1{flex:1 1 0%}.shrink-0{flex-shrink:0}.-translate-x-full{--tw-translate-x:-100%}.-translate-x-full,.-translate-y-1\/2{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.-translate-y-1\/2{--tw-translate-y:-50%}.translate-x-0{--tw-translate-x:0px}.transform,.translate-x-0{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}@keyframes spin{to{transform:rotate(1turn)}}.animate-spin{animation:spin 1s linear infinite}.cursor-pointer{cursor:pointer}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-center{align-items:center}.justify-end{justify-content:flex-end}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.gap-1{gap:.25rem}.gap-1\.5{gap:.375rem}.gap-2{gap:.5rem}.gap-2\.5{gap:.625rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-x-3{-moz-column-gap:.75rem;column-gap:.75rem}.gap-x-4{-moz-column-gap:1rem;column-gap:1rem}.gap-x-6{-moz-column-gap:1.5rem;column-gap:1.5rem}.gap-y-1{row-gap:.25rem}.gap-y-3{row-gap:.75rem}.space-y-1>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.25rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.25rem*var(--tw-space-y-reverse))}.space-y-1\.5>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.375rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.375rem*var(--tw-space-y-reverse))}.space-y-2>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.5rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.5rem*var(--tw-space-y-reverse))}.space-y-3>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.75rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.75rem*var(--tw-space-y-reverse))}.space-y-4>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1rem*var(--tw-space-y-reverse))}.divide-y>:not([hidden])~:not([hidden]){--tw-divide-y-reverse:0;border-top-width:calc(1px*(1 - var(--tw-divide-y-reverse)));border-bottom-width:calc(1px*var(--tw-divide-y-reverse))}.divide-slate-50>:not([hidden])~:not([hidden]){--tw-divide-opacity:1;border-color:rgb(248 250 252/var(--tw-divide-opacity,1))}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}.truncate{overflow:hidden;text-overflow:ellipsis}.truncate,.whitespace-nowrap{white-space:nowrap}.whitespace-pre-wrap{white-space:pre-wrap}.rounded-2xl{border-radius:1rem}.rounded-3xl{border-radius:1.5rem}.rounded-full{border-radius:9999px}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-t-3xl{border-top-left-radius:1.5rem;border-top-right-radius:1.5rem}.border{border-width:1px}.border-2{border-width:2px}.border-b{border-bottom-width:1px}.border-t{border-top-width:1px}.border-dashed{border-style:dashed}.border-brand-300{--tw-border-opacity:1;border-color:rgb(165 180 252/var(--tw-border-opacity,1))}.border-slate-100{--tw-border-opacity:1;border-color:rgb(241 245 249/var(--tw-border-opacity,1))}.border-slate-200{--tw-border-opacity:1;border-color:rgb(226 232 240/var(--tw-border-opacity,1))}.border-slate-300{--tw-border-opacity:1;border-color:rgb(203 213 225/var(--tw-border-opacity,1))}.border-slate-50{--tw-border-opacity:1;border-color:rgb(248 250 252/var(--tw-border-opacity,1))}.border-white\/10{border-color:hsla(0,0%,100%,.1)}.bg-amber-400\/90{background-color:rgba(251,191,36,.9)}.bg-amber-50{--tw-bg-opacity:1;background-color:rgb(255 251 235/var(--tw-bg-opacity,1))}.bg-blue-500{--tw-bg-opacity:1;background-color:rgb(59 130 246/var(--tw-bg-opacity,1))}.bg-brand-400\/20{background-color:rgba(129,140,248,.2)}.bg-brand-50{--tw-bg-opacity:1;background-color:rgb(238 242 255/var(--tw-bg-opacity,1))}.bg-brand-500\/25{background-color:rgba(99,102,241,.25)}.bg-brand-600{--tw-bg-opacity:1;background-color:rgb(79 70 229/var(--tw-bg-opacity,1))}.bg-emerald-50{--tw-bg-opacity:1;background-color:rgb(236 253 245/var(--tw-bg-opacity,1))}.bg-emerald-500{--tw-bg-opacity:1;background-color:rgb(16 185 129/var(--tw-bg-opacity,1))}.bg-emerald-600{--tw-bg-opacity:1;background-color:rgb(5 150 105/var(--tw-bg-opacity,1))}.bg-indigo-50{--tw-bg-opacity:1;background-color:rgb(238 242 255/var(--tw-bg-opacity,1))}.bg-rose-50{--tw-bg-opacity:1;background-color:rgb(255 241 242/var(--tw-bg-opacity,1))}.bg-rose-600{--tw-bg-opacity:1;background-color:rgb(225 29 72/var(--tw-bg-opacity,1))}.bg-slate-100{--tw-bg-opacity:1;background-color:rgb(241 245 249/var(--tw-bg-opacity,1))}.bg-slate-300{--tw-bg-opacity:1;background-color:rgb(203 213 225/var(--tw-bg-opacity,1))}.bg-slate-50{--tw-bg-opacity:1;background-color:rgb(248 250 252/var(--tw-bg-opacity,1))}.bg-slate-50\/60{background-color:rgba(248,250,252,.6)}.bg-slate-50\/70{background-color:rgba(248,250,252,.7)}.bg-slate-50\/80{background-color:rgba(248,250,252,.8)}.bg-slate-800{--tw-bg-opacity:1;background-color:rgb(30 41 59/var(--tw-bg-opacity,1))}.bg-slate-900{--tw-bg-opacity:1;background-color:rgb(15 23 42/var(--tw-bg-opacity,1))}.bg-slate-900\/30{background-color:rgba(15,23,42,.3)}.bg-slate-900\/40{background-color:rgba(15,23,42,.4)}.bg-slate-900\/45{background-color:rgba(15,23,42,.45)}.bg-teal-50{--tw-bg-opacity:1;background-color:rgb(240 253 250/var(--tw-bg-opacity,1))}.bg-white{--tw-bg-opacity:1;background-color:rgb(255 255 255/var(--tw-bg-opacity,1))}.bg-white\/10{background-color:hsla(0,0%,100%,.1)}.bg-white\/15{background-color:hsla(0,0%,100%,.15)}.bg-white\/5{background-color:hsla(0,0%,100%,.05)}.bg-white\/70{background-color:hsla(0,0%,100%,.7)}.bg-white\/80{background-color:hsla(0,0%,100%,.8)}.bg-gradient-to-b{background-image:linear-gradient(to bottom,var(--tw-gradient-stops))}.bg-gradient-to-br{background-image:linear-gradient(to bottom right,var(--tw-gradient-stops))}.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-stops))}.from-brand-400{--tw-gradient-from:#818cf8 var(--tw-gradient-from-position);--tw-gradient-to:rgba(129,140,248,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-brand-50\/60{--tw-gradient-from:rgba(238,242,255,.6) var(--tw-gradient-from-position);--tw-gradient-to:rgba(238,242,255,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-brand-600{--tw-gradient-from:#4f46e5 var(--tw-gradient-from-position);--tw-gradient-to:rgba(79,70,229,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.from-brand-700{--tw-gradient-from:#4338ca var(--tw-gradient-from-position);--tw-gradient-to:rgba(67,56,202,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}.via-brand-800{--tw-gradient-to:rgba(55,48,163,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),#3730a3 var(--tw-gradient-via-position),var(--tw-gradient-to)}.to-brand-800{--tw-gradient-to:#3730a3 var(--tw-gradient-to-position)}.to-brand-900{--tw-gradient-to:#312e81 var(--tw-gradient-to-position)}.to-brand-950{--tw-gradient-to:#1e1b4b var(--tw-gradient-to-position)}.to-violet-500{--tw-gradient-to:#8b5cf6 var(--tw-gradient-to-position)}.to-white{--tw-gradient-to:#fff var(--tw-gradient-to-position)}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-8{padding:2rem}.\!px-3{padding-left:.75rem!important;padding-right:.75rem!important}.\!py-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.\!py-1\.5{padding-top:.375rem!important;padding-bottom:.375rem!important}.\!py-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.\!py-2\.5{padding-top:.625rem!important;padding-bottom:.625rem!important}.\!py-3{padding-top:.75rem!important;padding-bottom:.75rem!important}.\!py-3\.5{padding-top:.875rem!important;padding-bottom:.875rem!important}.px-1\.5{padding-left:.375rem;padding-right:.375rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-2\.5{padding-left:.625rem;padding-right:.625rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-3\.5{padding-left:.875rem;padding-right:.875rem}.px-4{padding-left:1rem;padding-right:1rem}.px-5{padding-left:1.25rem;padding-right:1.25rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}.py-0\.5{padding-top:.125rem;padding-bottom:.125rem}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\.5{padding-top:.375rem;padding-bottom:.375rem}.py-12{padding-top:3rem;padding-bottom:3rem}.py-14{padding-top:3.5rem;padding-bottom:3.5rem}.py-16{padding-top:4rem;padding-bottom:4rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-2\.5{padding-top:.625rem;padding-bottom:.625rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-3\.5{padding-top:.875rem;padding-bottom:.875rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-5{padding-top:1.25rem;padding-bottom:1.25rem}.py-6{padding-top:1.5rem;padding-bottom:1.5rem}.py-8{padding-top:2rem;padding-bottom:2rem}.\!pl-11{padding-left:2.75rem!important}.pb-2{padding-bottom:.5rem}.pb-20{padding-bottom:5rem}.pb-24{padding-bottom:6rem}.pb-8{padding-bottom:2rem}.pl-10{padding-left:2.5rem}.pt-14{padding-top:3.5rem}.pt-5{padding-top:1.25rem}.text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}.font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace}.font-sans{font-family:Plus Jakarta Sans,system-ui,sans-serif}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}.text-\[10px\]{font-size:10px}.text-\[11px\]{font-size:11px}.text-\[13px\]{font-size:13px}.text-\[15px\]{font-size:15px}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-xs{font-size:.75rem;line-height:1rem}.font-bold{font-weight:700}.font-extrabold{font-weight:800}.font-medium{font-weight:500}.font-semibold{font-weight:600}.uppercase{text-transform:uppercase}.leading-relaxed{line-height:1.625}.leading-snug{line-height:1.375}.leading-tight{line-height:1.25}.tracking-tight{letter-spacing:-.025em}.tracking-wide{letter-spacing:.025em}.tracking-wider{letter-spacing:.05em}.tracking-widest{letter-spacing:.1em}.text-amber-400{--tw-text-opacity:1;color:rgb(251 191 36/var(--tw-text-opacity,1))}.text-amber-500{--tw-text-opacity:1;color:rgb(245 158 11/var(--tw-text-opacity,1))}.text-amber-700{--tw-text-opacity:1;color:rgb(180 83 9/var(--tw-text-opacity,1))}.text-amber-950{--tw-text-opacity:1;color:rgb(69 26 3/var(--tw-text-opacity,1))}.text-brand-100{--tw-text-opacity:1;color:rgb(224 231 255/var(--tw-text-opacity,1))}.text-brand-200{--tw-text-opacity:1;color:rgb(199 210 254/var(--tw-text-opacity,1))}.text-brand-300{--tw-text-opacity:1;color:rgb(165 180 252/var(--tw-text-opacity,1))}.text-brand-400{--tw-text-opacity:1;color:rgb(129 140 248/var(--tw-text-opacity,1))}.text-brand-500{--tw-text-opacity:1;color:rgb(99 102 241/var(--tw-text-opacity,1))}.text-brand-600{--tw-text-opacity:1;color:rgb(79 70 229/var(--tw-text-opacity,1))}.text-brand-700{--tw-text-opacity:1;color:rgb(67 56 202/var(--tw-text-opacity,1))}.text-brand-800{--tw-text-opacity:1;color:rgb(55 48 163/var(--tw-text-opacity,1))}.text-emerald-400{--tw-text-opacity:1;color:rgb(52 211 153/var(--tw-text-opacity,1))}.text-emerald-500{--tw-text-opacity:1;color:rgb(16 185 129/var(--tw-text-opacity,1))}.text-emerald-600{--tw-text-opacity:1;color:rgb(5 150 105/var(--tw-text-opacity,1))}.text-emerald-700{--tw-text-opacity:1;color:rgb(4 120 87/var(--tw-text-opacity,1))}.text-emerald-800{--tw-text-opacity:1;color:rgb(6 95 70/var(--tw-text-opacity,1))}.text-ink{--tw-text-opacity:1;color:rgb(15 23 42/var(--tw-text-opacity,1))}.text-rose-400{--tw-text-opacity:1;color:rgb(251 113 133/var(--tw-text-opacity,1))}.text-rose-500{--tw-text-opacity:1;color:rgb(244 63 94/var(--tw-text-opacity,1))}.text-rose-600{--tw-text-opacity:1;color:rgb(225 29 72/var(--tw-text-opacity,1))}.text-rose-700{--tw-text-opacity:1;color:rgb(190 18 60/var(--tw-text-opacity,1))}.text-rose-800{--tw-text-opacity:1;color:rgb(159 18 57/var(--tw-text-opacity,1))}.text-slate-300{--tw-text-opacity:1;color:rgb(203 213 225/var(--tw-text-opacity,1))}.text-slate-400{--tw-text-opacity:1;color:rgb(148 163 184/var(--tw-text-opacity,1))}.text-slate-500{--tw-text-opacity:1;color:rgb(100 116 139/var(--tw-text-opacity,1))}.text-slate-600{--tw-text-opacity:1;color:rgb(71 85 105/var(--tw-text-opacity,1))}.text-slate-700{--tw-text-opacity:1;color:rgb(51 65 85/var(--tw-text-opacity,1))}.text-slate-800{--tw-text-opacity:1;color:rgb(30 41 59/var(--tw-text-opacity,1))}.text-slate-900{--tw-text-opacity:1;color:rgb(15 23 42/var(--tw-text-opacity,1))}.text-transparent{color:transparent}.text-white{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.underline{text-decoration-line:underline}.antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.accent-indigo-600{accent-color:#4f46e5}.opacity-25{opacity:.25}.opacity-75{opacity:.75}.shadow-2xl{--tw-shadow:0 25px 50px -12px rgba(0,0,0,.25);--tw-shadow-colored:0 25px 50px -12px var(--tw-shadow-color)}.shadow-2xl,.shadow-lg{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color),0 4px 6px -4px var(--tw-shadow-color)}.shadow-lift{--tw-shadow:0 4px 12px rgba(16,24,40,.08),0 18px 44px rgba(16,24,40,.1);--tw-shadow-colored:0 4px 12px var(--tw-shadow-color),0 18px 44px var(--tw-shadow-color)}.shadow-lift,.shadow-sm{box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-sm{--tw-shadow:0 1px 2px 0 rgba(0,0,0,.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color)}.shadow-soft{--tw-shadow:0 1px 2px rgba(16,24,40,.04),0 10px 28px rgba(16,24,40,.06);--tw-shadow-colored:0 1px 2px var(--tw-shadow-color),0 10px 28px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.shadow-indigo-200\/50{--tw-shadow-color:rgba(199,210,254,.5);--tw-shadow:var(--tw-shadow-colored)}.shadow-indigo-950\/50{--tw-shadow-color:rgba(30,27,75,.5);--tw-shadow:var(--tw-shadow-colored)}.outline{outline-style:solid}.ring-1{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)}.ring-inset{--tw-ring-inset:inset}.ring-amber-600\/20{--tw-ring-color:rgba(217,119,6,.2)}.ring-brand-100{--tw-ring-opacity:1;--tw-ring-color:rgb(224 231 255/var(--tw-ring-opacity,1))}.ring-brand-600\/20{--tw-ring-color:rgba(79,70,229,.2)}.ring-emerald-100{--tw-ring-opacity:1;--tw-ring-color:rgb(209 250 229/var(--tw-ring-opacity,1))}.ring-emerald-600\/20{--tw-ring-color:rgba(5,150,105,.2)}.ring-rose-100{--tw-ring-opacity:1;--tw-ring-color:rgb(255 228 230/var(--tw-ring-opacity,1))}.ring-rose-600\/20{--tw-ring-color:rgba(225,29,72,.2)}.ring-slate-100{--tw-ring-opacity:1;--tw-ring-color:rgb(241 245 249/var(--tw-ring-opacity,1))}.ring-slate-200{--tw-ring-opacity:1;--tw-ring-color:rgb(226 232 240/var(--tw-ring-opacity,1))}.ring-slate-500\/20{--tw-ring-color:rgba(100,116,139,.2)}.ring-slate-900{--tw-ring-opacity:1;--tw-ring-color:rgb(15 23 42/var(--tw-ring-opacity,1))}.ring-white\/20{--tw-ring-color:hsla(0,0%,100%,.2)}.blur{--tw-blur:blur(8px)}.blur,.blur-2xl{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.blur-2xl{--tw-blur:blur(40px)}.filter{filter:var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)}.backdrop-blur{--tw-backdrop-blur:blur(8px)}.backdrop-blur,.backdrop-blur-sm{-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}.backdrop-blur-sm{--tw-backdrop-blur:blur(4px)}.transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,-webkit-backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter,-webkit-backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-all{transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.transition-transform{transition-property:transform;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.duration-300{transition-duration:.3s}.duration-500{transition-duration:.5s}.hover\:border-slate-200:hover{--tw-border-opacity:1;border-color:rgb(226 232 240/var(--tw-border-opacity,1))}.hover\:bg-brand-50\/40:hover{background-color:rgba(238,242,255,.4)}.hover\:bg-brand-700:hover{--tw-bg-opacity:1;background-color:rgb(67 56 202/var(--tw-bg-opacity,1))}.hover\:bg-rose-50:hover{--tw-bg-opacity:1;background-color:rgb(255 241 242/var(--tw-bg-opacity,1))}.hover\:bg-slate-100:hover{--tw-bg-opacity:1;background-color:rgb(241 245 249/var(--tw-bg-opacity,1))}.hover\:bg-white\/10:hover{background-color:hsla(0,0%,100%,.1)}.hover\:bg-white\/20:hover{background-color:hsla(0,0%,100%,.2)}.hover\:bg-white\/5:hover{background-color:hsla(0,0%,100%,.05)}.hover\:text-rose-500:hover{--tw-text-opacity:1;color:rgb(244 63 94/var(--tw-text-opacity,1))}.hover\:text-slate-600:hover{--tw-text-opacity:1;color:rgb(71 85 105/var(--tw-text-opacity,1))}.hover\:text-white:hover{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.hover\:ring-slate-300:hover{--tw-ring-opacity:1;--tw-ring-color:rgb(203 213 225/var(--tw-ring-opacity,1))}.active\:scale-\[\.98\]:active{--tw-scale-x:.98;--tw-scale-y:.98}.active\:scale-\[\.98\]:active,.active\:scale-\[\.99\]:active{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.active\:scale-\[\.99\]:active{--tw-scale-x:.99;--tw-scale-y:.99}.group:hover .group-hover\:text-brand-500{--tw-text-opacity:1;color:rgb(99 102 241/var(--tw-text-opacity,1))}@media (min-width:640px){.sm\:col-span-1{grid-column:span 1/span 1}.sm\:col-span-2{grid-column:span 2/span 2}.sm\:col-span-3{grid-column:span 3/span 3}.sm\:col-span-4{grid-column:span 4/span 4}.sm\:my-0{margin-top:0;margin-bottom:0}.sm\:inline{display:inline}.sm\:grid-cols-12{grid-template-columns:repeat(12,minmax(0,1fr))}.sm\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.sm\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.sm\:items-end{align-items:flex-end}.sm\:px-6{padding-left:1.5rem;padding-right:1.5rem}}@media (min-width:768px){.md\:col-span-2{grid-column:span 2/span 2}.md\:col-span-3{grid-column:span 3/span 3}.md\:col-span-4{grid-column:span 4/span 4}.md\:inline{display:inline}.md\:flex{display:flex}.md\:grid-cols-12{grid-template-columns:repeat(12,minmax(0,1fr))}.md\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.md\:p-6{padding:1.5rem}.md\:px-8{padding-left:2rem;padding-right:2rem}}@media (min-width:1024px){.lg\:ml-\[268px\]{margin-left:268px}.lg\:hidden{display:none}.lg\:translate-x-0{--tw-translate-x:0px;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.lg\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.lg\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.lg\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.lg\:p-8{padding:2rem}}@media (min-width:1280px){.xl\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.xl\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}.xl\:grid-cols-7{grid-template-columns:repeat(7,minmax(0,1fr))}}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
        if (window.pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    </script>
</head>
<body>
<div id="app" v-cloak class="font-sans text-ink antialiased">
    <?= view('layouts/nav', ['page' => $pageKey, 'title' => $pageTitle]) ?>

    <main class="mx-auto max-w-md px-4 py-6 sm:px-6">
        <div class="mx-auto flex w-full max-w-md flex-col">
            <transition name="fade">
                <div v-if="loading" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
                    <div class="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-lift">
                        <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span class="text-sm font-semibold text-slate-700">Memuat data...</span>
                    </div>
                </div>
            </transition>

            <div v-if="view === 'login'" class="flex min-h-[70vh] flex-col">
                <div class="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-6 pt-9 text-center shadow-2xl ring-1 ring-white/10">
                    <div class="pointer-events-none absolute"></div>
                    <div class="relative">
                        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-white shadow-lg ring-1 ring-white/20 backdrop-blur">
                            <i class="bi bi-mortarboard-fill text-4xl"></i>
                        </div>
                        <h1 class="mt-5 text-2xl font-extrabold tracking-tight text-white">Portal Mahasiswa</h1>
                        <p class="mt-1 text-sm text-brand-200">INHAL FKIK UMSU</p>
                    </div>
                </div>

                <div class="flex-1 pt-5">
                    <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i class="bi bi-search-heart text-lg"></i></div>
                            <div>
                                <h2 class="text-base font-bold text-slate-900">Cek Status Pengajuan</h2>
                                <p class="text-xs text-slate-400">Masukkan NPM Anda untuk melihat status</p>
                            </div>
                        </div>
                        <form class="mt-5" @submit.prevent="doLogin">
                            <label class="label">NPM (Nomor Pokok Mahasiswa)</label>
                            <div class="relative">
                                <i class="bi bi-person-vcard pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input v-model="npmInput" type="tel" inputmode="numeric" maxlength="15"
                                    class="input !pl-11 !py-3.5 text-base tracking-wide"
                                    placeholder="Contoh: 2201010001" autocomplete="off">
                            </div>
                            <button type="submit" class="btn-primary mt-4 w-full !py-3.5" :disabled="loggingIn">
                                <svg v-if="loggingIn" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                                <i v-else class="bi bi-arrow-right-circle"></i>
                                {{ loggingIn ? 'Memeriksa...' : 'Periksa Pengajuan INHAL' }}
                            </button>
                        </form>
                    </div>
                    <p class="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
                        Pantau status pengajuan, unggah bukti bayar,<br>dan unduh ACC final di sini.
                    </p>
                </div>
            </div>

            <div v-else class="flex min-h-screen flex-col">
                <template v-if="view === 'dashboard'">
                    <div class="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-soft">
                        <div class="flex items-center gap-4 p-5">
                            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-extrabold ring-1 ring-white/20">
                                {{ initials }}
                            </div>
                            <div class="min-w-0">
                                <div class="truncate text-base font-bold">{{ user.nama || 'Mahasiswa' }}</div>
                                <div class="mt-0.5 font-mono text-xs tracking-wide text-brand-200">NPM {{ user.npm }}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between border-t border-white/10 bg-white/5 px-5 py-3">
                            <div class="text-xs text-brand-100">Total Pengajuan</div>
                            <div class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{{ user.history.length }}</div>
                        </div>
                    </div>

                    <h3 class="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-slate-700">
                        <i class="bi bi-clock-history text-slate-400"></i> Riwayat Pengajuan
                    </h3>

                    <div v-if="user.history.length" class="space-y-3">
                        <button v-for="item in user.history" :key="item.id"
                            class="group flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-slate-100 transition active:scale-[.99]"
                            @click="openDetail(item)">
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                :class="iconBoxClass(item.statusCode)">
                                <i :class="iconClass(item.statusCode)"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="truncate text-sm font-bold text-slate-900">{{ item.jenis || 'Pengajuan' }}</div>
                                    <span class="chip shrink-0" :class="chipClass(item.statusCode)">{{ item.status }}</span>
                                </div>
                                <div v-if="item.detail" class="mt-0.5 truncate text-xs text-slate-500">{{ item.detail }}</div>
                                <div class="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                                    <span class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(item.tanggal) }}</span>
                                    <span v-if="item.blok" class="flex items-center gap-1"><i class="bi bi-grid"></i>{{ item.blok }}</span>
                                </div>
                                <div v-if="item.hasUpload" class="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                    <i class="bi bi-check-circle-fill"></i> Bukti terunggah
                                </div>
                            </div>
                            <i class="bi bi-chevron-right mt-3 text-slate-300 transition group-hover:text-brand-500"></i>
                        </button>
                    </div>
                    <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <i class="bi bi-folder2-open mb-2 block text-4xl text-slate-300"></i>
                        <p class="text-sm text-slate-500">Belum ada riwayat pengajuan.</p>
                    </div>

                    <div class="mt-6 space-y-3">
                        <a href="/" class="btn-soft w-full !py-3 text-sm text-center" style="display:inline-flex">
                            <i class="bi bi-plus-circle"></i> Ajukan Inhal Baru
                        </a>
                        <button class="btn-soft w-full !py-3 text-sm" style="display:inline-flex" @click="logout">
                            <i class="bi bi-box-arrow-right"></i> Keluar
                        </button>
                    </div>
                </template>

                <template v-else-if="view === 'detail' && detailItem">
                    <div class="mb-4 flex items-center gap-2">
                        <button class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-100" @click="goBack">
                            <i class="bi bi-arrow-left text-lg"></i>
                        </button>
                        <div>
                            <div class="text-sm font-bold text-slate-800">Detail Pengajuan</div>
                            <div class="text-[11px] text-slate-400">{{ detailItem.idPengajuan }}</div>
                        </div>
                    </div>

                    <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white p-5">
                            <h2 class="text-base font-bold text-slate-900">{{ detailItem.jenis || 'Pengajuan' }}<span v-if="detailItem.detail"> - {{ detailItem.detail }}</span></h2>
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                <span class="chip" :class="chipClass(detailItem.statusCode)">{{ detailItem.status }}</span>
                            </div>
                        </div>

                        <div v-if="detailItem.statusCode === 'rejected' || detailItem.statusCode === 'cancelled'"
                            class="mx-4 mt-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
                            <i class="bi bi-exclamation-circle-fill mt-0.5 text-rose-500"></i>
                            <div class="text-sm">
                                <div class="font-bold text-rose-800">{{ detailItem.statusCode === 'cancelled' ? 'Pengajuan Dibatalkan' : 'Pengajuan Ditolak' }}</div>
                                <p class="mt-0.5 text-rose-600">{{ detailItem.catatan || 'Mohon maaf, pengajuan Anda tidak dapat diproses.' }}</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                            <div><div class="label">NPM</div><div class="value font-mono text-sm">{{ user.npm }}</div></div>
                            <div><div class="label">Nama</div><div class="value font-semibold">{{ user.nama || '-' }}</div></div>
                            <div><div class="label">Blok</div><div class="value">{{ detailItem.blok || '-' }}</div></div>
                            <div><div class="label">Tanggal Kegiatan</div><div class="value">{{ formatTanggal(detailItem.tanggal) }}</div></div>
                            <div class="col-span-2"><div class="label">Diajukan Pada</div><div class="value">{{ formatDateTime(detailItem.tanggalAjuan) }}</div></div>
                        </div>

                        <div class="border-t border-slate-100 p-5">
                            <div class="section-title"><i class="bi bi-signpost-split"></i> Progres Pengajuan</div>
                            <div class="timeline">
                                <div class="t-item">
                                    <div class="t-dot bg-emerald-500"></div>
                                    <div class="text-sm font-bold text-slate-900">Pengajuan dikonfirmasi</div>
                                    <p class="mt-0.5 text-xs text-slate-500">Data Anda sedang diproses admin.</p>
                                </div>
                                <div class="t-item">
                                    <div class="t-dot" :class="step2DotClass"></div>
                                    <div class="text-sm font-bold" :class="step2TitleClass">Instruksi Pembayaran & Berkas</div>
                                    <div v-if="detailItem.statusCode === 'approved' && !detailItem.hasUpload" class="mt-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
                                        <p class="text-xs text-brand-800">Silakan lakukan pembayaran sesuai tagihan, lalu unggah ACC INHAL dan bukti bayar.</p>
                                        <button class="btn-primary mt-3 w-full !py-2.5 text-sm" @click="openUpload">
                                            <i class="bi bi-cloud-arrow-up"></i> Upload Bukti
                                        </button>
                                    </div>
                                    <div v-else-if="detailItem.statusCode === 'approved' && detailItem.hasUpload" class="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                        <i class="bi bi-check-circle-fill mr-1"></i> Berkas berhasil diunggah. Menunggu verifikasi admin.
                                    </div>
                                    <p v-else class="mt-1 text-xs text-slate-400">{{ detailItem.statusCode === 'rejected' || detailItem.statusCode === 'cancelled' ? 'Proses dihentikan.' : 'Menunggu persetujuan admin.' }}</p>
                                </div>
                                <div class="t-item">
                                    <div class="t-dot" :class="step3DotClass"></div>
                                    <div class="text-sm font-bold" :class="step3TitleClass">Validasi Akhir</div>
                                    <div class="mt-1.5">
                                        <div v-if="detailItem.hasUpload" class="text-xs text-slate-500">Menunggu admin memverifikasi bukti unggahan Anda.</div>
                                        <p v-else class="text-xs text-slate-400">Menunggu admin memverifikasi bukti unggahan Anda.</p>
                                    </div>
                                    <a v-if="detailItem.linkFinal" :href="detailItem.linkFinal" target="_blank" rel="noopener"
                                        class="btn-primary mt-3 w-full !py-2.5 text-sm" style="display:inline-flex">
                                        <i class="bi bi-file-earmark-arrow-down"></i> Unduh ACC Final (PDF)
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <transition name="fade">
                <div v-if="upload.open" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" @click.self="closeUpload">
                    <transition name="slide">
                        <div class="safe-b max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
                            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                                <h3 class="text-base font-bold text-slate-900">Upload Bukti</h3>
                                <button class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500" @click="closeUpload">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div class="space-y-4 p-5">
                                <div class="rounded-xl bg-brand-50 p-3 text-xs text-brand-800 ring-1 ring-brand-100">
                                    Unggahan hanya bisa dilakukan satu kali. Pastikan file sudah benar sebelum mengirim.
                                </div>
                                <div class="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                                    <div><div class="text-[11px] text-slate-400">NPM</div><div class="font-mono font-semibold text-slate-800">{{ user.npm }}</div></div>
                                    <div><div class="text-[11px] text-slate-400">Blok</div><div class="font-semibold text-slate-800">{{ detailItem.blok || '-' }}</div></div>
                                    <div class="col-span-2"><div class="text-[11px] text-slate-400">Kegiatan</div><div class="font-semibold text-slate-800">{{ detailItem.jenis }}{{ detailItem.detail ? ' - ' + detailItem.detail : '' }}</div></div>
                                    <div><div class="text-[11px] text-slate-400">Tanggal</div><div class="font-semibold text-slate-800">{{ formatTanggal(detailItem.tanggal) }}</div></div>
                                    <div><div class="text-[11px] text-slate-400">Status</div><div class="font-semibold text-slate-800">{{ detailItem.status }}</div></div>
                                </div>
                                <div>
                                    <label class="label">Upload ACC INHAL (PDF / Gambar)</label>
                                    <div class="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-3">
                                        <i class="bi bi-file-earmark-pdf text-2xl text-rose-400"></i>
                                        <div class="min-w-0 flex-1 text-xs text-slate-500">
                                            <span v-if="upload.accName" class="font-semibold text-slate-700">{{ upload.accName }}</span>
                                            <span v-else>Pilih file ACC INHAL</span>
                                        </div>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="w-24 text-[11px] text-transparent" @change="onAccFile">
                                    </div>
                                </div>
                                <div>
                                    <label class="label">Upload Bukti Bayar</label>
                                    <div class="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-3">
                                        <i class="bi bi-receipt text-2xl text-brand-400"></i>
                                        <div class="min-w-0 flex-1 text-xs text-slate-500">
                                            <span v-if="upload.buktiName" class="font-semibold text-slate-700">{{ upload.buktiName }}</span>
                                            <span v-else>Pilih file bukti bayar</span>
                                        </div>
                                        <input type="file" :accept="upload.buktiMode === 'lenggang' ? '.pdf,.jpg,.jpeg,.png' : '.pdf,application/pdf'" class="w-24 text-[11px] text-transparent" @change="onBuktiFile">
                                    </div>
                                    <p v-if="upload.validMsg" class="mt-1.5 text-xs" :class="upload.validOk ? 'text-emerald-600' : 'text-rose-600'">
                                        <i :class="upload.validOk ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'"></i> {{ upload.validMsg }}
                                    </p>
                                </div>
                            </div>
                            <div class="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-5 py-4">
                                <button class="btn-soft flex-1" @click="closeUpload">Batal</button>
                                <button class="btn-primary flex-1" :disabled="upload.submitting" @click="submitUpload">
                                    <svg v-if="upload.submitting" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    {{ upload.submitting ? 'Mengunggah...' : 'Kirim' }}
                                </button>
                            </div>
                        </div>
                    </transition>
                </div>
            </transition>

            <transition name="fade">
                <div v-if="toast.show" class="fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
                    <div class="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lift"
                        :class="toast.type === 'error' ? 'bg-rose-600' : (toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800')">
                        <i :class="toast.type === 'error' ? 'bi-x-circle-fill' : (toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill')"></i>
                        {{ toast.message }}
                    </div>
                </div>
            </transition>
        </div>
    </main>
</div>
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
<script>
        const { createApp } = Vue;

        function csrfToken() {
            const el = document.querySelector('meta[name="csrf"]');
            return el ? el.getAttribute('content') : '';
        }

        async function apiJson(path, payload) {
            const isGet = payload === undefined;
            const headers = {};
            if (!isGet) headers['Content-Type'] = 'application/json';
            if (!isGet) headers['X-CSRF-TOKEN'] = csrfToken();
            let res;
            try {
                res = await fetch('/api/' + path, { method: isGet ? 'GET' : 'POST', headers, credentials: 'same-origin', body: isGet ? undefined : JSON.stringify(payload || {}) });
            } catch (e) {
                throw new Error('Tidak dapat terhubung ke server.');
            }
            let j;
            try {
                j = await res.json();
            } catch (e) {
                j = { ok: false, message: 'Respons tidak valid' };
            }
            if (!j.ok) {
                let msg = j.message || 'Terjadi kesalahan';
                if (j.errors) {
                    const errs = Object.values(j.errors).filter(Boolean);
                    if (errs.length) msg = errs.join(' ');
                }
                throw new Error(msg);
            }
            return j.data;
        }

        async function apiUpload(path, formData) {
            let res;
            try {
                res = await fetch('/api/' + path, { method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken() }, credentials: 'same-origin', body: formData });
            } catch (e) {
                throw new Error('Tidak dapat terhubung ke server.');
            }
            let j;
            try {
                j = await res.json();
            } catch (e) {
                j = { ok: false, message: 'Respons tidak valid' };
            }
            if (!j.ok) {
                throw new Error(j.message || 'Terjadi kesalahan');
            }
            return j.data;
        }

        createApp({
            data() {
                return {
                    loading: false,
                    loggingIn: false,
                    view: 'login',
                    npmInput: '',
                    user: { nama: '', npm: '', buktiMode: 'strict', history: [] },
                    detailItem: null,
                    upload: { open: false, accFile: null, accName: '', buktiFile: null, buktiName: '', buktiMode: 'strict', validOk: false, validMsg: '', submitting: false },
                    toast: { show: false, type: 'info', message: '' },
                    toastTimer: null
                };
            },
            computed: {
                initials() {
                    const n = (this.user.nama || 'M').trim().split(/\s+/);
                    return (n[0][0] + (n[1] ? n[1][0] : '')).toUpperCase();
                },
                step2DotClass() {
                    const s = this.detailItem.statusCode;
                    if (s === 'approved') return 'bg-blue-500';
                    return 'bg-slate-300';
                },
                step2TitleClass() {
                    return this.detailItem.statusCode === 'approved' ? 'text-slate-900' : 'text-slate-400';
                },
                step3DotClass() {
                    if (this.detailItem.hasUpload) return 'bg-blue-500';
                    return 'bg-slate-300';
                },
                step3TitleClass() {
                    return this.detailItem.hasUpload ? 'text-slate-700' : 'text-slate-400';
                }
            },
            methods: {
                showToast(message, type) {
                    this.toast = { show: true, type: type || 'info', message: message };
                    if (this.toastTimer) clearTimeout(this.toastTimer);
                    this.toastTimer = setTimeout(() => { this.toast.show = false; }, 3200);
                },
                mapStatusCode(status) {
                    const s = String(status || '').toLowerCase();
                    if (s.indexOf('diterima') !== -1 || s.indexOf('acc') !== -1 || s.indexOf('disetujui') !== -1) return 'approved';
                    if (s.indexOf('ditolak') !== -1) return 'rejected';
                    if (s.indexOf('dibatalkan') !== -1) return 'cancelled';
                    return 'pending';
                },
                normalizeItem(item) {
                    return Object.assign({}, item, { statusCode: this.mapStatusCode(item.status) });
                },
                chipClass(code) {
                    return {
                        approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
                        rejected: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
                        cancelled: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20',
                        pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                    }[code] || 'bg-slate-100 text-slate-500';
                },
                iconClass(code) {
                    return {
                        approved: 'bi bi-check-circle-fill text-emerald-500',
                        rejected: 'bi bi-x-circle-fill text-rose-500',
                        cancelled: 'bi bi-slash-circle text-slate-400',
                        pending: 'bi bi-hourglass-split text-amber-500'
                    }[code] || 'bi bi-hourglass-split text-slate-400';
                },
                iconBoxClass(code) {
                    return {
                        approved: 'bg-emerald-50',
                        rejected: 'bg-rose-50',
                        cancelled: 'bg-slate-100',
                        pending: 'bg-amber-50'
                    }[code] || 'bg-slate-100';
                },
                formatTanggal(v) {
                    if (!v) return '-';
                    const d = new Date(v);
                    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
                    const s = String(v);
                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
                    return s;
                },
                formatDateTime(v) {
                    if (!v) return '-';
                    const d = new Date(v);
                    if (isNaN(d.getTime())) return String(v);
                    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
                },
                async doLogin() {
                    const npm = this.npmInput.trim();
                    if (!npm) { this.showToast('Masukkan NPM terlebih dahulu.', 'error'); return; }
                    this.loggingIn = true;
                    try {
                        const resp = await apiJson('portal/' + encodeURIComponent(npm));
                        if (!resp) {
                            this.showToast('Data tidak ditemukan. Periksa kembali NPM Anda.', 'error');
                            return;
                        }
                        this.user = {
                            nama: resp.nama || 'Mahasiswa',
                            npm: resp.npm || npm,
                            buktiMode: resp.buktiMode || 'strict',
                            history: (resp.history || []).map(item => this.normalizeItem(item))
                        };
                        this.upload.buktiMode = this.user.buktiMode;
                        this.view = 'dashboard';
                        window.scrollTo(0, 0);
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loggingIn = false;
                    }
                },
                logout() {
                    this.view = 'login';
                    this.npmInput = '';
                    this.user = { nama: '', npm: '', buktiMode: 'strict', history: [] };
                    this.detailItem = null;
                    window.scrollTo(0, 0);
                },
                openDetail(item) {
                    this.detailItem = item;
                    this.view = 'detail';
                    window.scrollTo(0, 0);
                },
                goBack() {
                    this.view = 'dashboard';
                    this.detailItem = null;
                    window.scrollTo(0, 0);
                },
                openUpload() {
                    this.upload = { open: true, accFile: null, accName: '', buktiFile: null, buktiName: '', buktiMode: this.user.buktiMode, validOk: false, validMsg: '', submitting: false };
                },
                closeUpload() {
                    if (!this.upload.submitting) this.upload.open = false;
                },
                onAccFile(e) {
                    this.upload.accFile = e.target.files && e.target.files.length ? e.target.files[0] : null;
                    this.upload.accName = this.upload.accFile ? this.upload.accFile.name : '';
                },
                onBuktiFile(e) {
                    this.upload.buktiFile = e.target.files && e.target.files.length ? e.target.files[0] : null;
                    this.upload.buktiName = this.upload.buktiFile ? this.upload.buktiFile.name : '';
                    this.validateBukti();
                },
                readFileHeader(file, bytes) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const arr = new Uint8Array(reader.result);
                            let s = '';
                            for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
                            resolve(s);
                        };
                        reader.onerror = () => reject(new Error('Gagal membaca file'));
                        reader.readAsArrayBuffer(file.slice(0, bytes));
                    });
                },
                async validateBukti() {
                    const file = this.upload.buktiFile;
                    this.upload.validOk = false;
                    if (!file) { this.upload.validMsg = ''; return; }
                    if (this.upload.buktiMode === 'lenggang') {
                        this.upload.validOk = true;
                        this.upload.validMsg = 'cek berkas valid';
                        return;
                    }
                    const head = await this.readFileHeader(file, 5).catch(() => '');
                    if (head.indexOf('%PDF') !== 0) {
                        this.upload.validMsg = 'cek berkas gagal, gunakan file pdf dari portal mahasiswa';
                        return;
                    }
                    this.upload.validOk = true;
                    this.upload.validMsg = 'cek berkas valid';
                },
                async submitUpload() {
                    if (!this.upload.accFile || !this.upload.buktiFile) {
                        this.showToast('Unggah kedua file (ACC INHAL dan Bukti Bayar).', 'error');
                        return;
                    }
                    if (!this.upload.validOk) {
                        this.showToast(this.upload.validMsg || 'cek berkas gagal, gunakan file pdf dari portal mahasiswa', 'error');
                        return;
                    }
                    this.upload.submitting = true;
                    this.loading = true;
                    try {
                        const fd = new FormData();
                        fd.append('npm', this.user.npm || '');
                        fd.append('accFile', this.upload.accFile);
                        fd.append('buktiFile', this.upload.buktiFile);
                        const res = await apiUpload('portal/' + this.detailItem.idPengajuan + '/bukti', fd);
                        this.upload.open = false;
                        this.showToast((res && res.message) || 'Upload berhasil.', 'success');
                        await this.refreshData(this.detailItem.idPengajuan);
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.upload.submitting = false;
                        this.loading = false;
                    }
                },
                async refreshData(preserveId) {
                    try {
                        const resp = await apiJson('portal/' + encodeURIComponent(this.user.npm));
                        if (!resp) return;
                        this.user.nama = resp.nama || this.user.nama;
                        this.user.buktiMode = resp.buktiMode || this.user.buktiMode;
                        this.upload.buktiMode = this.user.buktiMode;
                        this.user.history = (resp.history || []).map(item => this.normalizeItem(item));
                        if (preserveId) {
                            const found = this.user.history.find(x => x.idPengajuan === preserveId);
                            if (found) this.detailItem = found;
                        }
                    } catch (e) { }
                }
            },
            mounted() {
                const params = new URLSearchParams(window.location.search);
                const npm = (params.get('npm') || '').trim();
                if (!npm) return;
                this.npmInput = npm;
                this.doLogin();
                window.history.replaceState(null, '', window.location.pathname);
            }
        }).mount('#app');
</script>
</body>
</html>
