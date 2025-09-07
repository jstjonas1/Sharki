
let canvas;
let world;
let _origCanvasSize = null;
let _origBodyOverflow = null;
let _origBodyTouch = null;
let _origMobileState = null;

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // removed auto fullscreen on load to avoid non-user-gesture errors; fullscreen must be triggered by user (start button)

    // start screen wiring
    try {
        const startBtn = document.getElementById('startBtn');
        const startScreen = document.getElementById('startScreen');
        // create an explicit fullscreen button so users can trigger fullscreen if automatic request fails
        try {
            let fb = document.getElementById('fullscreenBtn');
            if (!fb && startScreen) {
                fb = document.createElement('button'); fb.id = 'fullscreenBtn'; fb.innerText = 'Vollbild';
                fb.style.marginLeft = '8px'; fb.style.padding = '6px 10px';
                startScreen.querySelector && startScreen.querySelector('div') && startScreen.querySelector('div').appendChild(fb);
                fb.addEventListener('click', () => { try { enterFullscreen(); } catch (e) {} });
            }
        } catch (e) {}

        startBtn && startBtn.addEventListener('click', () => {
            // compute mobile state once for this handler
            const MOBILE_THRESHOLD = 720;
            const isNarrow = (typeof window !== 'undefined') && (window.innerWidth && window.innerWidth < MOBILE_THRESHOLD);
            const isPortrait = (typeof window !== 'undefined') && (window.innerHeight > window.innerWidth);
            try {
                if (isNarrow && isPortrait) {
                    // ensure mobile helpers and rotate overlay exist
                    try { if (typeof setupMobileControls === 'function') setupMobileControls(); } catch (e) {}
                    // disable start button until landscape
                    try { startBtn.disabled = true; } catch (e) {}
                    const onReady = () => {
                        const nowPortrait = (window.innerHeight > window.innerWidth);
                        if (!nowPortrait) {
                            try { startBtn.disabled = false; } catch (e) {}
                            window.removeEventListener('orientationchange', onReady);
                            window.removeEventListener('resize', onReady);
                        }
                    };
                    window.addEventListener('orientationchange', onReady);
                    window.addEventListener('resize', onReady);
                    return; // do not start until user rotates to landscape
                }
            } catch (err) {}

            // determine selected mode
            const sel = document.querySelector('input[name="startMode"]:checked');
            const isDark = sel && sel.value === 'dark';
            // attempt to enter fullscreen on narrow devices (user gesture)
            try { if (isNarrow) enterFullscreen(); } catch (e) {}

            // preload critical assets (manifest + backgrounds) so pending loads are registered
            try { preloadCriticalAssets(); } catch (e) {}
            // create world but defer start until assets loaded
            world = new World(canvas, { autoStart: false });
            window.world = world;
            // show loading overlay (with progress)
            let loadOverlay = document.getElementById('loadOverlay');
            if (!loadOverlay) {
                loadOverlay = document.createElement('div');
                loadOverlay.id = 'loadOverlay';
                loadOverlay.style.position = 'fixed'; loadOverlay.style.left = '0'; loadOverlay.style.top = '0'; loadOverlay.style.width = '100%'; loadOverlay.style.height = '100%';
                loadOverlay.style.display = 'flex'; loadOverlay.style.alignItems = 'center'; loadOverlay.style.justifyContent = 'center';
                loadOverlay.style.background = 'rgba(0,0,0,0.7)'; loadOverlay.style.zIndex = '10000';
                loadOverlay.style.color = 'white';
                const inner = document.createElement('div'); inner.style.textAlign = 'center'; inner.style.color = 'white';
                const t = document.createElement('div'); t.id = 'loadOverlayText'; t.innerText = 'Lade Grafiken...'; t.style.marginBottom = '10px';
                const barWrap = document.createElement('div'); barWrap.style.width = '260px'; barWrap.style.height = '12px'; barWrap.style.background = 'rgba(255,255,255,0.12)'; barWrap.style.borderRadius = '6px';
                const bar = document.createElement('div'); bar.id = 'loadOverlayBar'; bar.style.width = '0%'; bar.style.height = '100%'; bar.style.background = 'linear-gradient(90deg,#3ab0ff,#00e0a8)'; bar.style.borderRadius = '6px'; barWrap.appendChild(bar);
                inner.appendChild(t); inner.appendChild(barWrap); loadOverlay.appendChild(inner);
                document.body.appendChild(loadOverlay);
            }
            // wait for all pending loads (with a 8s timeout fallback)
            try {
                const pending = (typeof window !== 'undefined' && Array.isArray(window._pendingLoads)) ? window._pendingLoads.slice() : [];
                const total = pending.length;
                let loaded = 0;
                const updateProgress = () => {
                    try {
                        const pct = total > 0 ? Math.round((loaded / total) * 100) : 100;
                        const text = document.getElementById('loadOverlayText'); const barEl = document.getElementById('loadOverlayBar');
                        if (text) text.innerText = 'Lade Grafiken... ' + pct + '%';
                        if (barEl) barEl.style.width = pct + '%';
                    } catch (e) {}
                };
                // attach handlers so we update progress for both resolve and reject
                try {
                    pending.forEach(p => {
                        if (!p || typeof p.then !== 'function') { loaded++; updateProgress(); return; }
                        p.then(() => { loaded++; updateProgress(); }, () => { loaded++; updateProgress(); });
                    });
                } catch (e) {}

                // wait for everything (settle) or timeout
                const waitAll = Promise.allSettled(pending);
                const timeout = new Promise((resolve) => setTimeout(resolve, 12000));
                Promise.race([waitAll.catch(() => {}), timeout]).then(() => {
                    try { if (loadOverlay && loadOverlay.parentNode) loadOverlay.parentNode.removeChild(loadOverlay); } catch (e) {}
                    try { if (window.world && typeof window.world.start === 'function') window.world.start(); } catch (e) {}
                    // start monitoring for game over so we can show options overlay on death
                    try { monitorGameOver(); } catch (e) {}
                });
            } catch (e) {
                try { if (loadOverlay && loadOverlay.parentNode) loadOverlay.parentNode.removeChild(loadOverlay); } catch (e) {}
                try { if (window.world && typeof window.world.start === 'function') window.world.start(); } catch (e) {}
            }
            // apply chosen mode
            try { if (typeof world.setDarkMode === 'function') world.setDarkMode(isDark); } catch (e) {}
            // sync checkbox and persist choice
            const darkToggle = document.getElementById('darkToggle');
            if (darkToggle) {
                darkToggle.checked = !!isDark;
                try { localStorage.setItem('sharkyDarkMode', isDark ? '1' : '0'); } catch (e) {}
            }
            // hide start screen
            if (startScreen) startScreen.style.display = 'none';
        });
    } catch (e) {}

    // wire dark mode toggle (if present) for runtime toggling
    try {
        const darkToggle = document.getElementById('darkToggle');
        if (darkToggle) {
            // restore saved preference if available (only sets checkbox until game started)
            try {
                const saved = localStorage.getItem('sharkyDarkMode');
                if (saved !== null) darkToggle.checked = (saved === '1');
            } catch (e) {}

            darkToggle.addEventListener('change', (ev) => {
                const isDark = !!ev.target.checked;
                if (window.world && typeof window.world.setDarkMode === 'function') window.world.setDarkMode(isDark);
                try { localStorage.setItem('sharkyDarkMode', isDark ? '1' : '0'); } catch (e) {}
            });
        }
    } catch (e) {}

    // mobile detection: call setup on narrow screens or touch-capable devices
    try {
        const MOBILE_THRESHOLD = 720;
        const isNarrow = (typeof window !== 'undefined') && (window.innerWidth && window.innerWidth < MOBILE_THRESHOLD);
        const isTouch = (typeof navigator !== 'undefined') && ((navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || ('ontouchstart' in window));
        if ((isNarrow || isTouch) && typeof setupMobileControls === 'function') setupMobileControls();
        // show rotate prompt when portrait on touch/narrow devices
        const checkRotate = () => {
            try {
                const nowPortrait = window.innerHeight > window.innerWidth;
                const nowNarrow = (window.innerWidth && window.innerWidth < MOBILE_THRESHOLD);
                if ((nowNarrow || isTouch) && nowPortrait) {
                    try { showRotatePrompt(); } catch (e) {}
                } else {
                    try { hideRotatePrompt(); } catch (e) {}
                }
                // also manage mobile controls lifecycle
                if ((nowNarrow || isTouch) && typeof setupMobileControls === 'function') setupMobileControls(); else if (typeof teardownMobileControls === 'function') teardownMobileControls();
            } catch (e) {}
        };
        window.addEventListener('resize', checkRotate);
        window.addEventListener('orientationchange', checkRotate);
        // initial invocation
        try { checkRotate(); } catch (e) {}
    } catch (e) {}
}

// request fullscreen helper (will only succeed on user gesture in many browsers)
function enterFullscreen() {
    try {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            try { const p = el.requestFullscreen(); if (p && typeof p.catch === 'function') p.catch(() => { try { enterPseudoFullscreen(); } catch (e) {} }); return p; } catch (e) { try { enterPseudoFullscreen(); } catch (e2) {} }
        }
        if (el.webkitRequestFullscreen) {
            try { const p = el.webkitRequestFullscreen(); if (p && typeof p.catch === 'function') p.catch(() => { try { enterPseudoFullscreen(); } catch (e) {} }); return p; } catch (e) { try { enterPseudoFullscreen(); } catch (e2) {} }
        }
        if (el.msRequestFullscreen) {
            try { const p = el.msRequestFullscreen(); if (p && typeof p.catch === 'function') p.catch(() => { try { enterPseudoFullscreen(); } catch (e) {} }); return p; } catch (e) { try { enterPseudoFullscreen(); } catch (e2) {} }
        }
        // if none available, fall through to pseudo-fullscreen below
    } catch (e) {}
    // Fallback for browsers (notably older Safari/iOS) where Fullscreen API isn't available or is restricted:
    try { enterPseudoFullscreen(); } catch (e) {}
}

// Pseudo fullscreen: emulate fullscreen on platforms where requestFullscreen isn't available (iOS Safari)
function enterPseudoFullscreen() {
    try {
        if (!canvas) canvas = document.getElementById('gameCanvas');
        // remember previous state
        if (!window._pseudoFsState) window._pseudoFsState = {};
        window._pseudoFsState.bodyOverflow = document.body.style.overflow || '';
        window._pseudoFsState.htmlOverflow = document.documentElement.style.overflow || '';
        window._pseudoFsState.canvasStyle = { position: canvas.style.position || '', left: canvas.style.left || '', top: canvas.style.top || '', width: canvas.style.width || '', height: canvas.style.height || '', zIndex: canvas.style.zIndex || '' };
    // hide non-canvas UI but keep the start screen visible so users can start from fullscreen
    try { document.querySelectorAll('#controls, header, nav, footer, #loadOverlay').forEach(el => { if (el) el.style.display = 'none'; }); } catch (e) {}
        // disable scroll and overscroll
        try { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; document.documentElement.style.overscrollBehavior = 'none'; document.body.style.overscrollBehavior = 'none'; document.documentElement.style.touchAction = 'none'; document.body.style.touchAction = 'none'; } catch (e) {}
        // style canvas to fill viewport and be on top
        try {
            canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.width = '100vw'; canvas.style.height = '100vh'; canvas.style.zIndex = '2147483645';
            // also set attributes so drawing uses correct size
            try { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } catch (e) {}
        } catch (e) {}
        // add an exit control
        let btn = document.getElementById('pseudoFsExitBtn');
        if (!btn) {
            btn = document.createElement('button'); btn.id = 'pseudoFsExitBtn'; btn.innerText = 'Beenden';
            btn.style.position = 'fixed'; btn.style.right = '12px'; btn.style.top = '12px'; btn.style.zIndex = '2147483646'; btn.style.padding = '8px 10px'; btn.style.borderRadius = '8px'; btn.style.background = 'rgba(0,0,0,0.5)'; btn.style.color = 'white'; btn.style.border = 'none';
            btn.addEventListener('click', exitPseudoFullscreen);
            document.body.appendChild(btn);
        }
        // also add a restart button in pseudo-fullscreen for convenience (top-right, left of exit)
        try {
            let rbtn = document.getElementById('pseudoFsRestartBtn');
            if (!rbtn) {
                rbtn = document.createElement('button'); rbtn.id = 'pseudoFsRestartBtn'; rbtn.innerText = 'Neustart';
                rbtn.style.position = 'fixed'; rbtn.style.right = '12px'; rbtn.style.top = '56px'; rbtn.style.zIndex = '2147483646'; rbtn.style.padding = '8px 10px'; rbtn.style.borderRadius = '8px'; rbtn.style.background = 'rgba(0,0,0,0.5)'; rbtn.style.color = 'white'; rbtn.style.border = 'none';
                rbtn.addEventListener('click', () => { try { triggerRestart(); } catch (e) {} });
                document.body.appendChild(rbtn);
            }
        } catch (e) {}
        // ensure start screen (if present) remains visible and interactive above the canvas so users can start the game while in fullscreen
        try {
            const ss = document.getElementById('startScreen');
            if (ss) {
                ss.style.display = ss.style.display === 'none' ? 'flex' : ss.style.display || 'flex';
                ss.style.zIndex = '2147483647';
                ss.style.pointerEvents = 'auto';
            }
        } catch (e) {}
        // let the rest of the app know
        window._inPseudoFullscreen = true;
        // update world references
        if (window.world) { try { window.world.canvas = canvas; window.world.ctx = canvas.getContext('2d'); } catch (e) {} }
    // enable mobile controls overlay on small screens
    try { const smallScreen = (window.innerWidth && window.innerHeight && window.innerWidth < 1000 && window.innerHeight < 1000); if (smallScreen && typeof enterMobileMode === 'function') enterMobileMode(); } catch (e) {}
    } catch (e) { console && console.warn && console.warn('pseudo-fullscreen failed', e); }
}

function exitPseudoFullscreen() {
    try {
        if (!canvas) canvas = document.getElementById('gameCanvas');
        // restore hidden UI
        try { document.querySelectorAll('#startScreen, #controls, header, nav, footer, #loadOverlay').forEach(el => { if (el) el.style.display = ''; }); } catch (e) {}
        // restore scroll
        try { document.documentElement.style.overflow = window._pseudoFsState && window._pseudoFsState.htmlOverflow || ''; document.body.style.overflow = window._pseudoFsState && window._pseudoFsState.bodyOverflow || ''; document.documentElement.style.overscrollBehavior = ''; document.body.style.overscrollBehavior = ''; document.documentElement.style.touchAction = ''; document.body.style.touchAction = ''; } catch (e) {}
        // restore canvas styles
        try {
            if (window._pseudoFsState && window._pseudoFsState.canvasStyle) {
                const s = window._pseudoFsState.canvasStyle;
                canvas.style.position = s.position || '';
                canvas.style.left = s.left || '';
                canvas.style.top = s.top || '';
                canvas.style.width = s.width || '';
                canvas.style.height = s.height || '';
                canvas.style.zIndex = s.zIndex || '';
            }
        } catch (e) {}
        // remove exit button
    try { const btn = document.getElementById('pseudoFsExitBtn'); if (btn && btn.parentNode) btn.parentNode.removeChild(btn); } catch (e) {}
    try { const rbtn = document.getElementById('pseudoFsRestartBtn'); if (rbtn && rbtn.parentNode) rbtn.parentNode.removeChild(rbtn); } catch (e) {}
        window._inPseudoFullscreen = false; window._pseudoFsState = null;
        // restore canvas drawing size fallback
        try { if (canvas) { canvas.width = canvas.clientWidth || 720; canvas.height = canvas.clientHeight || 480; } } catch (e) {}
        if (window.world) { try { window.world.canvas = canvas; window.world.ctx = canvas.getContext('2d'); } catch (e) {} }
    } catch (e) { console && console.warn && console.warn('exit pseudo-fullscreen failed', e); }
}

// ensure the canvas fills the entire screen when in fullscreen, and restore when leaving
function fitCanvasToScreen() {
    try {
        if (!canvas) canvas = document.getElementById('gameCanvas');
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        if (isFs) {
            // store original if not stored
            if (!_origCanvasSize && canvas) {
                _origCanvasSize = { w: canvas.width, h: canvas.height, styleW: canvas.style.width || '', styleH: canvas.style.height || '' };
            }
            // expand to viewport
            try { canvas.style.width = '100%'; canvas.style.height = '100%'; } catch (e) {}
            try { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } catch (e) {}
            // disable page scroll while in fullscreen and reduce iOS overscroll bounce
            try {
                if (_origBodyOverflow === null) {
                    _origBodyOverflow = { doc: document.documentElement.style.overflow || '', body: document.body.style.overflow || '' };
                }
                if (_origBodyTouch === null) {
                    _origBodyTouch = {
                        docTouch: document.documentElement.style.touchAction || '',
                        bodyTouch: document.body.style.touchAction || '',
                        docOverscroll: document.documentElement.style.overscrollBehavior || '',
                        bodyOverscroll: document.body.style.overscrollBehavior || '',
                        bodyWebkit: document.body.style.webkitOverflowScrolling || ''
                    };
                }
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                // prefer disabling overscroll behavior and touch action to avoid bounce on iOS
                try { document.documentElement.style.overscrollBehavior = 'none'; } catch (e) {}
                try { document.body.style.overscrollBehavior = 'none'; } catch (e) {}
                try { document.documentElement.style.touchAction = 'none'; } catch (e) {}
                try { document.body.style.touchAction = 'none'; } catch (e) {}
                try { document.body.style.setProperty('-webkit-overflow-scrolling', 'auto'); } catch (e) {}
            } catch (e) {}
            // ensure start screen (if present and not hidden) remains above the canvas and interactive in native fullscreen
            try {
                const ss = document.getElementById('startScreen');
                if (ss && ss.style.display !== 'none') {
                    ss.style.zIndex = '2147483647';
                    ss.style.pointerEvents = 'auto';
                }
            } catch (e) {}
        } else {
            // restore original canvas size
            if (_origCanvasSize && canvas) {
                try { canvas.width = _origCanvasSize.w; canvas.height = _origCanvasSize.h; } catch (e) {}
                try { canvas.style.width = _origCanvasSize.styleW; canvas.style.height = _origCanvasSize.styleH; } catch (e) {}
                _origCanvasSize = null;
            } else if (canvas) {
                // fallback to default
                try { canvas.width = 720; canvas.height = 480; canvas.style.width = ''; canvas.style.height = ''; } catch (e) {}
            }
            // restore body overflow and touch/overscroll settings when leaving fullscreen
            try {
                if (_origBodyOverflow !== null) {
                    document.documentElement.style.overflow = _origBodyOverflow.doc || '';
                    document.body.style.overflow = _origBodyOverflow.body || '';
                    _origBodyOverflow = null;
                }
                if (_origBodyTouch !== null) {
                    try { document.documentElement.style.touchAction = _origBodyTouch.docTouch || ''; } catch (e) {}
                    try { document.body.style.touchAction = _origBodyTouch.bodyTouch || ''; } catch (e) {}
                    try { document.documentElement.style.overscrollBehavior = _origBodyTouch.docOverscroll || ''; } catch (e) {}
                    try { document.body.style.overscrollBehavior = _origBodyTouch.bodyOverscroll || ''; } catch (e) {}
                    try { document.body.style.setProperty('-webkit-overflow-scrolling', _origBodyTouch.bodyWebkit || ''); } catch (e) {}
                    _origBodyTouch = null;
                }
            } catch (e) {}
                // restore start screen layering when leaving fullscreen
                try {
                    const ss = document.getElementById('startScreen');
                    if (ss) {
                        ss.style.zIndex = '';
                        ss.style.pointerEvents = '';
                    }
                } catch (e) {}
        }
        // If we're in fullscreen and the viewport is small, enable mobile controls overlay
        try {
            const smallScreen = (window.innerWidth && window.innerHeight && window.innerWidth < 1000 && window.innerHeight < 1000);
            if (isFs && smallScreen) {
                try { if (typeof enterMobileMode === 'function') enterMobileMode(); } catch (e) {}
            } else {
                try { if (typeof exitMobileMode === 'function') exitMobileMode(); } catch (e) {}
            }
        } catch (e) {}
        // ensure world references the updated canvas/context
        if (window.world) {
            try { window.world.canvas = canvas; window.world.ctx = canvas.getContext('2d'); } catch (e) {}
        }
        // fullscreen controls overlay: dark mode toggle + restart (semi-transparent)
        try {
            const isFsNow = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            let fsControls = document.getElementById('fsControls');
            if (isFsNow) {
                if (!fsControls) {
                    fsControls = document.createElement('div'); fsControls.id = 'fsControls';
                    fsControls.style.position = 'fixed'; fsControls.style.right = '12px'; fsControls.style.top = '12px';
                    fsControls.style.zIndex = '11000'; fsControls.style.opacity = '0.5'; fsControls.style.pointerEvents = 'auto';
                    fsControls.style.display = 'flex'; fsControls.style.alignItems = 'center'; fsControls.style.gap = '10px';
                    fsControls.style.padding = '6px 8px'; fsControls.style.background = 'rgba(0,0,0,0.35)'; fsControls.style.borderRadius = '8px';
                    fsControls.style.color = 'white';
                    // dark mode checkbox (sync with existing localStorage)
                    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = 'fsDarkToggle';
                    const lbl = document.createElement('label'); lbl.htmlFor = 'fsDarkToggle'; lbl.style.color = 'white'; lbl.style.userSelect = 'none'; lbl.style.fontSize = '14px'; lbl.style.marginLeft = '6px'; lbl.innerText = 'Dark';
                    // restart button
                    const rb = document.createElement('button'); rb.id = 'fsRestartBtn'; rb.innerText = 'Neustart'; rb.style.padding = '6px 10px'; rb.style.borderRadius = '6px'; rb.style.fontSize = '14px';
                    fsControls.appendChild(lbl); fsControls.appendChild(chk); fsControls.appendChild(rb);
                    document.body.appendChild(fsControls);

                    // wire events
                    chk.addEventListener('change', (ev) => {
                        const isDark = !!ev.target.checked;
                        try { if (window.world && typeof window.world.setDarkMode === 'function') window.world.setDarkMode(isDark); } catch (e) {}
                        try { localStorage.setItem('sharkyDarkMode', isDark ? '1' : '0'); } catch (e) {}
                        // also sync main toggle if present
                        try { const d = document.getElementById('darkToggle'); if (d) d.checked = isDark; } catch (e) {}
                    });
                    rb.addEventListener('click', () => { try { triggerRestart(); } catch (e) {} });
                }
                // sync state from stored preference
                try { const saved = localStorage.getItem('sharkyDarkMode'); if (saved !== null) { const c = document.getElementById('fsDarkToggle'); if (c) c.checked = (saved === '1'); } } catch (e) {}
                if (fsControls) fsControls.style.display = 'flex';
            } else {
                if (fsControls && fsControls.parentNode) fsControls.parentNode.removeChild(fsControls);
            }
        } catch (e) {}
    } catch (e) {}
}

// listen for fullscreen change and window resize to adapt canvas
try {
    document.addEventListener('fullscreenchange', fitCanvasToScreen);
    document.addEventListener('webkitfullscreenchange', fitCanvasToScreen);
    document.addEventListener('msfullscreenchange', fitCanvasToScreen);
    window.addEventListener('resize', () => { try { fitCanvasToScreen(); } catch (e) {} });
} catch (e) {}

// preload critical assets using frames manifest and known background paths
function preloadCriticalAssets() {
    try {
        const list = [];
        // frames manifest entries
        if (typeof window !== 'undefined' && window.FRAMES_MANIFEST) {
            for (const base in window.FRAMES_MANIFEST) {
                try {
                    const files = window.FRAMES_MANIFEST[base];
                    if (Array.isArray(files)) files.forEach(f => list.push(base + f));
                } catch (e) {}
            }
        }
        // small, explicit background list mirroring World.backgroundLightPaths
        const backgrounds = [
            './assets/img/sharki/3background/layers/5water/l.png',
            './assets/img/sharki/3background/layers/4fondo_2/l.png',
            './assets/img/sharki/3background/layers/3fondo_1/l.png',
            './assets/img/sharki/3background/layers/2floor/l.png',
            './assets/img/sharki/3background/layers/1light/completo.png'
        ];
        backgrounds.forEach(p => list.push(p));
        // dedupe
        const uniq = Array.from(new Set(list));
        window._pendingLoads = window._pendingLoads || [];
        // create image load promises and push to global pending list
        uniq.forEach(path => {
            try {
                const p = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        try { window._assetCache = window._assetCache || {}; window._assetCache[path] = img; } catch (e) {}
                        resolve(img);
                    };
                    img.onerror = () => { try { window._assetCache = window._assetCache || {}; window._assetCache[path] = null; } catch (e) {} resolve(null); };
                    img.src = path;
                });
                window._pendingLoads.push(p);
            } catch (e) {}
        });
        return uniq.length;
    } catch (e) { return 0; }
}

// Game-over / options overlay shown on mobile or when the player dies
function showGameOverOverlay() {
    let ov = document.getElementById('gameOverOverlay');
    if (!ov) {
        ov = document.createElement('div'); ov.id = 'gameOverOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.display = 'flex'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.85)'; ov.style.color = 'white'; ov.style.zIndex = '10001';
        ov.style.padding = '20px'; ov.style.boxSizing = 'border-box';
        const inner = document.createElement('div'); inner.style.background = '#0b2233'; inner.style.padding = '18px'; inner.style.borderRadius = '10px'; inner.style.width = '320px'; inner.style.textAlign = 'center';
        inner.innerHTML = `<h2 style="margin:0 0 8px">Spiel vorbei</h2>
            <div id="gameOverScore" style="font-size:18px; margin-bottom:12px">Punkte: 0</div>
            <div style="text-align:left; margin-bottom:12px">
              <label style="display:block; margin-bottom:6px"><input type="radio" name="overMode" value="light"> Lichtmodus</label>
              <label style="display:block"><input type="radio" name="overMode" value="dark"> Dunkelmodus</label>
            </div>
            <div style="display:flex; gap:10px; justify-content:center">
              <button id="overRestartBtn" style="padding:8px 12px; font-size:16px">Neustart</button>
              <button id="overContinueBtn" style="padding:8px 12px; font-size:16px">Zurück</button>
            </div>`;
        ov.appendChild(inner); document.body.appendChild(ov);

        // wire controls
        const r = inner.querySelector('#overRestartBtn');
        const c = inner.querySelector('#overContinueBtn');
        r && r.addEventListener('click', () => { try { triggerRestart(); hideGameOverOverlay(); } catch (e) {} });
        c && c.addEventListener('click', () => { try { hideGameOverOverlay(); } catch (e) {} });
        const radios = inner.querySelectorAll('input[name="overMode"]');
        radios.forEach(rb => rb.addEventListener('change', (ev) => {
            const isDark = ev.target.value === 'dark';
            try { if (window.world && typeof window.world.setDarkMode === 'function') window.world.setDarkMode(isDark); } catch (e) {}
            try { localStorage.setItem('sharkyDarkMode', isDark ? '1' : '0'); } catch (e) {}
        }));
    }
    // update score and selected mode
    try { const s = document.getElementById('gameOverScore'); if (s) s.innerText = 'Punkte: ' + (window.world ? (window.world.score || 0) : 0); } catch (e) {}
    try {
        const saved = localStorage.getItem('sharkyDarkMode');
        if (saved !== null) {
            const sel = document.querySelector('#gameOverOverlay input[name="overMode"][value="' + (saved === '1' ? 'dark' : 'light') + '"]');
            if (sel) sel.checked = true;
        }
    } catch (e) {}
    ov.style.display = 'flex';
    // ensure fullscreen on mobile when overlay shows
    try { enterFullscreen(); } catch (e) {}
    // if we're in fullscreen or pseudo fullscreen, add a top-right restart shortcut on the overlay
    try {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) || !!window._inPseudoFullscreen;
        if (isFs) {
            let topRestart = document.getElementById('gameOverTopRestart');
            if (!topRestart) {
                topRestart = document.createElement('button'); topRestart.id = 'gameOverTopRestart'; topRestart.innerText = 'Neustart';
                topRestart.style.position = 'fixed'; topRestart.style.right = '12px'; topRestart.style.top = '12px'; topRestart.style.zIndex = '10002'; topRestart.style.padding = '8px 10px'; topRestart.style.borderRadius = '8px'; topRestart.style.background = 'rgba(255,255,255,0.08)'; topRestart.style.color = 'white'; topRestart.style.border = 'none';
                topRestart.addEventListener('click', () => { try { triggerRestart(); hideGameOverOverlay(); } catch (e) {} });
                document.body.appendChild(topRestart);
            }
        }
    } catch (e) {}
}

function hideGameOverOverlay() {
    try { const ov = document.getElementById('gameOverOverlay'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    try { const tr = document.getElementById('gameOverTopRestart'); if (tr && tr.parentNode) tr.parentNode.removeChild(tr); } catch (e) {}
}

let _gameOverMonitored = false;
function monitorGameOver() {
    if (_gameOverMonitored) return; _gameOverMonitored = true;
    function loop() {
        try {
            if (window.world && window.world.gameOver) {
                showGameOverOverlay();
                // stop monitoring until restart clears gameOver
                _gameOverMonitored = false;
                return;
            }
        } catch (e) {}
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

// key bindings: Space => finSlap, F => shootBubble
window.addEventListener('keydown', (e) => {
    if (!world || !world.character) return;
    if (e.code === 'Space') {
        world.character.finSlap();
        e.preventDefault();
    }
    if (e.key && e.key.toLowerCase() === 'f') {
        world.character.shootBubble();
    }
});

// --- Mobile controls helpers (top-level) ---
function setupMobileControls() {
    if (window._mobileControlsSetup) return;
    window._mobileControlsSetup = true;
    const MOBILE_THRESHOLD = 720;
    // rotate overlay
    const createRotateOverlay = () => {
        let ov = document.getElementById('mobileRotateOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'mobileRotateOverlay';
            ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0';
            ov.style.width = '100%'; ov.style.height = '100%';
            ov.style.display = 'flex'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
            ov.style.background = 'rgba(0,0,0,0.85)'; ov.style.color = 'white'; ov.style.zIndex = '9999';
            ov.style.textAlign = 'center'; ov.style.padding = '20px';
            ov.innerHTML = '<div style="max-width:420px"><h2 style="margin:0 0 8px">Bitte drehen</h2><div style="font-size:16px">Drehe dein Handy einmal ins Querformat, um zu spielen.</div></div>';
            document.body.appendChild(ov);
        }
        return ov;
    };
    const updateRotateOverlay = () => {
        const ov = createRotateOverlay();
        const isPortrait = window.innerHeight > window.innerWidth;
        ov.style.display = isPortrait ? 'flex' : 'none';
        if (!isPortrait) showMobileControls(); else hideMobileControls();
    };

    const createControls = () => {
        let c = document.getElementById('mobileControls');
        if (c) return c;
    c = document.createElement('div'); c.id = 'mobileControls';
    c.style.position = 'fixed'; c.style.left = '0'; c.style.bottom = '0'; c.style.width = '100%'; c.style.height = '36%';
    // ensure the container receives pointer events and is visible above other UI; respect safe-area insets
    c.style.pointerEvents = 'auto'; c.style.zIndex = '2147483646'; c.style.opacity = '0.5';
    c.style.overflow = 'visible'; c.style.background = 'transparent';
    c.style.paddingBottom = 'env(safe-area-inset-bottom, 12px)';

    const joy = document.createElement('div'); joy.id = 'mobileJoystick';
    joy.style.position = 'absolute'; joy.style.left = '6%'; joy.style.bottom = '6%'; joy.style.width = '36%'; joy.style.height = '64%';
    joy.style.borderRadius = '12px'; joy.style.background = 'rgba(0,0,0,0.25)'; joy.style.pointerEvents = 'auto'; joy.style.touchAction = 'none';
    joy.style.display = 'flex'; joy.style.alignItems = 'center'; joy.style.justifyContent = 'center';

    const thumb = document.createElement('div'); thumb.id = 'mobileJoystickThumb'; thumb.style.width = '64px'; thumb.style.height = '64px';
    thumb.style.borderRadius = '50%'; thumb.style.background = 'rgba(255,255,255,0.28)'; thumb.style.transform = 'translate(0,0)';
    thumb.style.transition = 'transform 0.08s linear'; thumb.style.pointerEvents = 'none'; joy.appendChild(thumb);

    // crosshair overlay (center area) - simulates arrow keys when dragged
    const cross = document.createElement('div'); cross.id = 'mobileCrosshair';
    cross.style.position = 'absolute'; cross.style.left = '44%'; cross.style.bottom = '10%';
    cross.style.width = '48%'; cross.style.height = '64%';
    cross.style.pointerEvents = 'auto'; cross.style.touchAction = 'none';
    cross.style.display = 'flex'; cross.style.alignItems = 'center'; cross.style.justifyContent = 'center';
    cross.style.background = 'rgba(0,0,0,0.12)'; cross.style.borderRadius = '6px';
    // visual crosshair using SVG
    cross.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.18)" stroke-width="2"/><line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.18)" stroke-width="2"/><circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.22)"/></svg>';

    const shoot = document.createElement('button'); shoot.id = 'mobileShootBtn'; shoot.innerText = 'Blase';
    // position bottom-right
    shoot.style.position = 'absolute'; shoot.style.right = '6%'; shoot.style.bottom = '6%'; shoot.style.width = '14%'; shoot.style.height = '14%';
    shoot.style.borderRadius = '50%'; shoot.style.background = 'rgba(0,150,255,0.7)'; shoot.style.color = 'white'; shoot.style.fontSize = '16px';
    shoot.style.border = 'none'; shoot.style.pointerEvents = 'auto'; shoot.style.touchAction = 'none';

    c.appendChild(joy); c.appendChild(cross); c.appendChild(shoot); document.body.appendChild(c);

        let active = false; let pointerId = null; let origin = null;
        const resetThumb = () => { thumb.style.transform = 'translate(0,0)'; if (!window._crossActive) window.input.left = window.input.right = window.input.up = window.input.down = false; };

        joy.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); active = true; pointerId = ev.pointerId; origin = { x: ev.clientX, y: ev.clientY }; try { joy.setPointerCapture(pointerId); } catch (e) {} });
        joy.addEventListener('pointermove', (ev) => {
            if (!active || ev.pointerId !== pointerId) return; ev.preventDefault();
            if (window._crossActive) return; // if crosshair is active, prefer it
            const dx = ev.clientX - origin.x; const dy = ev.clientY - origin.y; const max = 80;
            const tx = Math.max(-max, Math.min(max, dx)); const ty = Math.max(-max, Math.min(max, dy));
            thumb.style.transform = `translate(${tx}px, ${ty}px)`;
            const nx = tx / max; const ny = ty / max;
            window.input.left = nx < -0.3; window.input.right = nx > 0.3; window.input.up = ny < -0.3; window.input.down = ny > 0.3;
        });
        const release = (ev) => { if (pointerId !== null && ev.pointerId !== undefined && ev.pointerId !== pointerId) return; active = false; pointerId = null; origin = null; resetThumb(); try { if (ev.target && ev.target.releasePointerCapture) ev.target.releasePointerCapture(ev.pointerId); } catch (e) {} };
        joy.addEventListener('pointerup', release); joy.addEventListener('pointercancel', release);

        shoot.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { if (window.world && window.world.character && typeof window.world.character.shootBubble === 'function') window.world.character.shootBubble(); } catch (e) {} });

        // crosshair pointer handling: map relative pos to arrow keys
        cross.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); window._crossActive = true; try { cross.setPointerCapture(ev.pointerId); } catch (e) {} });
        cross.addEventListener('pointermove', (ev) => {
            if (!window._crossActive) return; ev.preventDefault();
            const rect = cross.getBoundingClientRect();
            const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
            const dx = ev.clientX - cx; const dy = ev.clientY - cy;
            // normalize by half-dimensions
            const nx = dx / (rect.width / 2); const ny = dy / (rect.height / 2);
            window.input.left = nx < -0.25; window.input.right = nx > 0.25;
            window.input.up = ny < -0.25; window.input.down = ny > 0.25;
        });
        const crossRelease = (ev) => { ev && ev.preventDefault(); ev && ev.stopPropagation(); window._crossActive = false; window.input.left = window.input.right = window.input.up = window.input.down = false; try { if (ev && ev.target && ev.target.releasePointerCapture) ev.target.releasePointerCapture(ev.pointerId); } catch (e) {} };
        cross.addEventListener('pointerup', crossRelease); cross.addEventListener('pointercancel', crossRelease);

        window._mobileControls = { container: c, rotateOverlayId: 'mobileRotateOverlay' };
        try { updateRotateOverlay(); } catch (e) {}
        window.addEventListener('orientationchange', updateRotateOverlay); window.addEventListener('resize', updateRotateOverlay);
    // enter mobile mode adjustments
    try { enterMobileMode(); } catch (e) {}
        return c;
    };

    function showMobileControls() { const c = document.getElementById('mobileControls'); if (c) c.style.display = 'block'; }
    function hideMobileControls() { const c = document.getElementById('mobileControls'); if (c) c.style.display = 'none'; }
    function teardownMobileControls() { try { const c = document.getElementById('mobileControls'); if (c && c.parentNode) c.parentNode.removeChild(c); } catch (e) {} try { const ov = document.getElementById('mobileRotateOverlay'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} window._mobileControlsSetup = false; window._mobileControls = null; }
}

// Global rotate prompt: show when device is in portrait on touch/narrow screens
function showRotatePrompt() {
    try {
        let ov = document.getElementById('globalRotateOverlay');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'globalRotateOverlay';
            ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
            ov.style.display = 'flex'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
            ov.style.background = 'rgba(0,0,0,0.88)'; ov.style.color = 'white'; ov.style.zIndex = '2147483650';
            ov.style.textAlign = 'center'; ov.style.padding = '0'; ov.style.inset = '0'; ov.style.boxSizing = 'border-box';
            // create an inner container that is fixed centered via transform to guarantee exact centering
            const inner = document.createElement('div');
            inner.style.position = 'fixed';
            inner.style.left = '50%'; inner.style.top = '50%';
            inner.style.transform = 'translate(-50%, -50%)';
            inner.style.maxWidth = 'min(92vw,420px)';
            inner.style.width = 'min(92vw,420px)';
            inner.style.maxHeight = '80vh';
            inner.style.overflowY = 'auto';
            inner.style.boxSizing = 'border-box';
            inner.style.padding = 'env(safe-area-inset-top,18px) env(safe-area-inset-right,16px) env(safe-area-inset-bottom,18px) env(safe-area-inset-left,16px)';
            inner.style.borderRadius = '10px';
            inner.style.background = 'rgba(255,255,255,0.02)';
            inner.style.webkitOverflowScrolling = 'touch';
            // title
            const title = document.createElement('h2'); title.style.margin = '0 0 8px'; title.innerText = 'Bitte drehen';
            // message text: responsive, wrapped, readable
            const msg = document.createElement('div'); msg.style.fontSize = 'clamp(14px, 4vw, 18px)'; msg.style.lineHeight = '1.35'; msg.style.color = 'white'; msg.style.wordBreak = 'break-word'; msg.style.textAlign = 'center'; msg.innerText = 'Drehe dein Gerät ins Querformat (Landscape), um das Spiel zu starten.';
            inner.appendChild(title); inner.appendChild(msg); ov.appendChild(inner);
            document.body.appendChild(ov);
        }
        ov.style.display = 'flex';
        ov.style.pointerEvents = 'auto';
    } catch (e) {}
}

function hideRotatePrompt() {
    try {
        const ov = document.getElementById('globalRotateOverlay');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    } catch (e) {}
}

// helper to create a consistent mobile control button
function createMobileButton(id, label) {
    const b = document.createElement('button');
    b.id = id; b.innerText = label;
    b.style.width = '64px'; b.style.height = '64px'; b.style.borderRadius = '12px'; b.style.background = 'rgba(255,255,255,0.06)';
    b.style.color = 'white'; b.style.border = 'none'; b.style.fontSize = '20px'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center';
    b.style.pointerEvents = 'auto'; b.style.touchAction = 'none';
    return b;
}

function enterMobileMode() {
    try {
        if (_origMobileState) return; // already entered
        _origMobileState = {
            bodyDisplay: document.body.style.display || '',
            htmlOverflow: document.documentElement.style.overflow || '',
            bodyOverflow: document.body.style.overflow || '',
            canvasStyleW: (canvas ? canvas.style.width : ''),
            canvasStyleH: (canvas ? canvas.style.height : ''),
            hiddenElements: []
        };
        // hide everything except canvas and mobile overlays (store original display values so we can restore)
        try {
            const allowed = new Set(['gameCanvas','startScreen','globalRotateOverlay','mobileOverlayControls','mobileBottomBar','mobileControls','mobileRotateOverlay','pseudoFsExitBtn']);
            const bodyChildren = Array.from(document.body.children);
            bodyChildren.forEach(el => {
                try {
                    if (!el) return;
                    // if this element is the canvas node (by id or node) allow it
                    if ((el.id && allowed.has(el.id)) || el === canvas) return;
                    // save original display
                    _origMobileState.hiddenElements.push({ el: el, display: el.style.display || '' });
                    el.style.display = 'none';
                } catch (e) {}
            });
        } catch (e) {}
        // disable scrolling
        try { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; } catch (e) {}
        // force the canvas to fill the viewport and be the only visible element
        try {
            if (!canvas) canvas = document.getElementById('gameCanvas');
            if (canvas) {
                // store previous inline styles
                _origMobileState.canvasFullStyle = {
                    position: canvas.style.position || '', left: canvas.style.left || '', top: canvas.style.top || '', width: canvas.style.width || '', height: canvas.style.height || '', zIndex: canvas.style.zIndex || ''
                };
                canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0';
                canvas.style.width = '100vw'; canvas.style.height = '100vh'; canvas.style.zIndex = '2147483645';
                try { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } catch (e) {}
            }
        // ensure start screen (if present) remains above the canvas and interactive
        try {
            const ss = document.getElementById('startScreen');
            if (ss) {
                ss.style.zIndex = '2147483647';
                ss.style.pointerEvents = 'auto';
            }
        } catch (e) {}
        } catch (e) {}
        // remove any existing overlays to avoid duplicates
        try { ['mobileOverlayControls','mobileBottomBar','mobileSimpleDir','mobileControls'].forEach(id=>{ const e=document.getElementById(id); if(e && e.parentNode) e.parentNode.removeChild(e); }); } catch (e) {}
        // create a single bottom-left crosshair control for mobile (removes previous overlays)
        try {
            // remove any prior overlay elements to ensure only our crosshair exists
            ['mobileOverlayControls','mobileBottomBar','mobileSimpleDir','mobileControls','mobileCrosshairMain'].forEach(id=>{ const e=document.getElementById(id); if(e && e.parentNode) e.parentNode.removeChild(e); });
            let ch = document.getElementById('mobileCrosshairMain');
            if (!ch) {
                ch = document.createElement('div'); ch.id = 'mobileCrosshairMain';
                ch.style.position = 'fixed'; ch.style.left = '6%'; ch.style.bottom = '6%'; ch.style.width = '120px'; ch.style.height = '120px';
                ch.style.zIndex = '2147483647'; ch.style.pointerEvents = 'auto'; ch.style.display = 'flex'; ch.style.alignItems = 'center'; ch.style.justifyContent = 'center';
                ch.style.background = 'rgba(0,0,0,0.18)'; ch.style.borderRadius = '12px';
                ch.innerHTML = '<svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="18" stroke="rgba(255,255,255,0.9)" stroke-width="3" fill="rgba(0,0,0,0)"/><line x1="50" y1="8" x2="50" y2="28" stroke="rgba(255,255,255,0.9)" stroke-width="3"/><line x1="50" y1="72" x2="50" y2="92" stroke="rgba(255,255,255,0.9)" stroke-width="3"/><line x1="8" y1="50" x2="28" y2="50" stroke="rgba(255,255,255,0.9)" stroke-width="3"/><line x1="72" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.9)" stroke-width="3"/></svg>';
                document.body.appendChild(ch);

                // pointer handling: drag sets movement flags, tap fires
                let active = false; let pid = null; let origin = null;
                ch.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); active = true; pid = ev.pointerId; origin = { x: ev.clientX, y: ev.clientY }; try { ch.setPointerCapture && ch.setPointerCapture(ev.pointerId); } catch (e) {};
                    // immediate shoot on tap
                    try { if (window.world && window.world.character && typeof window.world.character.shootBubble === 'function') window.world.character.shootBubble(); } catch (e) {}
                });
                ch.addEventListener('pointermove', (ev) => {
                    if (!active || ev.pointerId !== pid) return; ev.preventDefault();
                    const dx = ev.clientX - origin.x; const dy = ev.clientY - origin.y; const max = 40;
                    const nx = Math.max(-1, Math.min(1, dx / max)); const ny = Math.max(-1, Math.min(1, dy / max));
                    window.input.left = nx < -0.3; window.input.right = nx > 0.3; window.input.up = ny < -0.3; window.input.down = ny > 0.3;
                });
                const release = (ev) => { if (pid !== null && ev.pointerId !== undefined && ev.pointerId !== pid) return; active = false; pid = null; origin = null; window.input.left = window.input.right = window.input.up = window.input.down = false; try { if (ev.target && ev.target.releasePointerCapture) ev.target.releasePointerCapture(ev.pointerId); } catch (e) {} };
                ch.addEventListener('pointerup', release); ch.addEventListener('pointercancel', release);
            }
            // ensure there's also a shoot button bottom-right for easier access (keep single instance)
            try {
                const existingShoot = document.getElementById('mobileShootBtnMain');
                if (existingShoot && existingShoot.parentNode) existingShoot.parentNode.removeChild(existingShoot);
                const sb = document.createElement('button'); sb.id = 'mobileShootBtnMain'; sb.innerText = 'Blase';
                sb.style.position = 'fixed'; sb.style.right = '6%'; sb.style.bottom = '6%'; sb.style.width = '84px'; sb.style.height = '84px';
                sb.style.borderRadius = '50%'; sb.style.background = 'rgba(0,150,255,0.85)'; sb.style.color = 'white'; sb.style.fontSize = '16px'; sb.style.border = 'none';
                sb.style.zIndex = '2147483647'; sb.style.pointerEvents = 'auto'; sb.style.touchAction = 'none';
                sb.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { if (window.world && window.world.character && typeof window.world.character.shootBubble === 'function') window.world.character.shootBubble(); } catch (e) {} });
                document.body.appendChild(sb);
            } catch (e) {}
        } catch (e) {}
    } catch (e) {}
}

function exitMobileMode() {
    try {
        if (!_origMobileState) return;
        // restore previously hidden elements
        try {
            if (_origMobileState.hiddenElements && Array.isArray(_origMobileState.hiddenElements)) {
                _origMobileState.hiddenElements.forEach(item => { try { if (item && item.el) item.el.style.display = item.display || ''; } catch (e) {} });
            }
        } catch (e) {}
        try { document.documentElement.style.overflow = _origMobileState.htmlOverflow || ''; document.body.style.overflow = _origMobileState.bodyOverflow || ''; } catch (e) {}
        try {
            if (canvas) {
                // restore canvas full style if present
                if (_origMobileState.canvasFullStyle) {
                    const s = _origMobileState.canvasFullStyle;
                    canvas.style.position = s.position || '';
                    canvas.style.left = s.left || '';
                    canvas.style.top = s.top || '';
                    canvas.style.width = s.width || '';
                    canvas.style.height = s.height || '';
                    canvas.style.zIndex = s.zIndex || '';
                } else {
                    canvas.style.width = _origMobileState.canvasStyleW || '';
                    canvas.style.height = _origMobileState.canvasStyleH || '';
                }
            }
        } catch (e) {}
        // remove mobile overlay controls if present
        try { const mo = document.getElementById('mobileOverlayControls'); if (mo && mo.parentNode) mo.parentNode.removeChild(mo); } catch (e) {}
        // reset input flags
        try { window.input.up = window.input.down = window.input.left = window.input.right = false; } catch (e) {}
        _origMobileState = null;
    } catch (e) {}
}


function hideMobileControls() { try { const c = document.getElementById('mobileControls'); if (c) c.style.display = 'none'; } catch (e) {} }
function showMobileControls() { try { const c = document.getElementById('mobileControls'); if (c) c.style.display = 'block'; } catch (e) {} }
function teardownMobileControls() { try { const c = document.getElementById('mobileControls'); if (c && c.parentNode) c.parentNode.removeChild(c); } catch (e) {} try { const ov = document.getElementById('mobileRotateOverlay'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {} window._mobileControlsSetup = false; window._mobileControls = null; }

// input state for movement
window.input = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') window.input.up = true;
    if (k === 'arrowdown' || k === 's') window.input.down = true;
    if (k === 'arrowleft' || k === 'a') window.input.left = true;
    if (k === 'arrowright' || k === 'd') window.input.right = true;
});
window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') window.input.up = false;
    if (k === 'arrowdown' || k === 's') window.input.down = false;
    if (k === 'arrowleft' || k === 'a') window.input.left = false;
    if (k === 'arrowright' || k === 'd') window.input.right = false;
});

// Restart handler (press R to restart after game over)
window.addEventListener('keydown', (e) => {
    if (!window.world) return;
    const k = e.key.toLowerCase();
    if (k === 'r' && window.world.gameOver) {
        triggerRestart();
    }
});

// central restart helper used by UI button and R-key
function triggerRestart() {
    if (!window.world) return;
    try {
        if (typeof window.world.restartGame === 'function') {
            window.world.restartGame();
            return;
        }
    } catch (e) {}
    // fallback: manual reset (ensure enemiesEaten is reset too)
    window.world.gameOver = false;
    window.world.bossActive = false;
    window.world.score = 2000;
    window.world.enemies = [];
    window.world.bubbles = [];
    window.world.enemiesEaten = 0;
    if (window.world.character) {
        window.world.character.health = window.world.character.maxHealth || 100;
        const cw = window.world.canvas.width;
        const ch = window.world.canvas.height;
        const cwid = (window.world.character.width) ? window.world.character.width : 32;
        const chei = (window.world.character.height) ? window.world.character.height : 48;
        window.world.character.x = Math.round((cw - cwid) / 2);
        window.world.character.y = Math.round((ch - chei) / 2);
    }
    window.world.populateEnemies();
}

// wire the restart button if present
try {
    const rbtn = document.getElementById('restartBtn');
    if (rbtn) rbtn.addEventListener('click', () => { triggerRestart(); });
} catch (e) {}

