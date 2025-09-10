let canvas;
let world;
let _menuOpen = false;

// Simple SFX helper with caching and safe play
const SFX = (() => {
    const cache = {};
    function load(key, src) {
        try { const a = new Audio(src); a.preload = 'auto'; cache[key] = a; } catch (e) {}
    }
    function play(key, vol = 1) {
        try {
            const base = cache[key]; if (!base) return;
            const node = base.cloneNode();
            node.volume = Math.max(0, Math.min(1, vol));
            node.play().catch(() => {});
        } catch (e) {}
    }
    return { load, play };
})();
window.SFX = SFX;

// Input state for movement
window.input = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (k === 'arrowup' || k === 'w') window.input.up = true;
    if (k === 'arrowdown' || k === 's') window.input.down = true;
    if (k === 'arrowleft' || k === 'a') window.input.left = true;
    if (k === 'arrowright' || k === 'd') window.input.right = true;
    // Actions
    if (world && world.character) {
        if (k === 'f') { world.character.shootBubble(); }
    }
});
window.addEventListener('keyup', (e) => {
    const k = (e.key || '').toLowerCase();
    if (k === 'arrowup' || k === 'w') window.input.up = false;
    if (k === 'arrowdown' || k === 's') window.input.down = false;
    if (k === 'arrowleft' || k === 'a') window.input.left = false;
    if (k === 'arrowright' || k === 'd') window.input.right = false;
});

function getSelected(name, defVal) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : defVal;
}

function hideStartMenu() {
    const ss = document.getElementById('startScreen');
    if (ss) ss.style.display = 'none';
    _menuOpen = false;
}

function showStartMenu() {
    const ss = document.getElementById('startScreen');
    if (!ss) return;
    // hide any overlays proactively
    try { hideHighscoresUI(); } catch (e) {}
    try { hideGameOverUI(); } catch (e) {}
    ss.style.display = 'flex';
    ss.style.pointerEvents = 'auto';
    ss.style.zIndex = '10010';
    _menuOpen = true;
    // restore saved selections
    try {
        const savedMode = localStorage.getItem('sharkyStartMode');
        if (savedMode) {
            const rb = document.querySelector('input[name="startMode"][value="' + savedMode + '"]');
            if (rb) rb.checked = true;
        }
        const savedDiff = localStorage.getItem('sharkyDifficulty');
        if (savedDiff) {
            const rb = document.querySelector('input[name="difficulty"][value="' + savedDiff + '"]');
            if (rb) rb.checked = true;
        }
        const dark = localStorage.getItem('sharkyDarkMode') === '1';
        const d1 = document.getElementById('darkToggleInline'); if (d1) d1.checked = dark;
        const d2 = document.getElementById('darkToggle'); if (d2) d2.checked = dark;
    } catch (e) {}
}

function applyDarkModeUI(checked) {
    try { localStorage.setItem('sharkyDarkMode', checked ? '1' : '0'); } catch (e) {}
    if (world && typeof world.setDarkMode === 'function') world.setDarkMode(checked);
    // sync both toggles
    const d1 = document.getElementById('darkToggleInline'); if (d1) d1.checked = checked;
    const d2 = document.getElementById('darkToggle'); if (d2) d2.checked = checked;
}

function startGame() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const mode = getSelected('startMode', 'light');
    const difficulty = getSelected('difficulty', 'normal');
    try { localStorage.setItem('sharkyStartMode', mode); } catch (e) {}
    try { localStorage.setItem('sharkyDifficulty', difficulty); } catch (e) {}
    try { localStorage.setItem('sharkyDarkMode', mode === 'dark' ? '1' : '0'); } catch (e) {}

    // Always reset the entire game state: dispose old world, clear overlays, create fresh world
    try { hideHighscoresUI(); } catch (e) {}
    try { hideGameOverUI(); } catch (e) {}
    if (world) {
        try { world.destroy && world.destroy(); } catch (e) {}
        try { world.running = false; } catch (e) {}
        try { window.world = null; } catch (e) {}
        world = null;
    }

    world = new World(canvas, { autoStart: false });
    try { window.world = world; } catch (e) {}
    world.difficulty = difficulty;
    if (typeof world.applyDifficultySettings === 'function') world.applyDifficultySettings();
    const dark = (mode === 'dark') || (localStorage.getItem('sharkyDarkMode') === '1');
    if (typeof world.setDarkMode === 'function') world.setDarkMode(dark);
    world.start();
    hideStartMenu();
}

function init() {
    // cache canvas
    canvas = document.getElementById('gameCanvas');

    // hide touch button (feature removed)
    const tbtn = document.getElementById('touchModeBtn');
    if (tbtn) tbtn.style.display = 'none';

    // load saved UI selections
    showStartMenu();

    // wire start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.addEventListener('click', startGame);

    // wire dark toggles
    const d1 = document.getElementById('darkToggleInline');
    const d2 = document.getElementById('darkToggle');
    if (d1) d1.addEventListener('change', (e) => applyDarkModeUI(!!e.target.checked));
    if (d2) d2.addEventListener('change', (e) => applyDarkModeUI(!!e.target.checked));

    // wire restart button
    const r = document.getElementById('restartBtn');
    if (r) r.addEventListener('click', () => { if (world) world.restartGame(); });

            // monitor for game over to show minimal UI
        monitorEndState();

        // ensure overlays exist
        ensurePauseOverlay();
        ensureTouchOverlay();

        // preload sounds
        try {
            SFX.load('blub', './audio/blub.mp3');
            SFX.load('essen', './audio/essen.mp3');
        } catch (e) {}
}

// Expose for inline onload
window.init = init;

// ---------------- Minimal Game Over + Highscores UI ----------------
let _endUiVisible = false;
let _suppressEndOverlayUntil = 0;

function monitorEndState() {
    function tick() {
        try {
        const now = Date.now();
        const suppressed = _suppressEndOverlayUntil && now < _suppressEndOverlayUntil;
        if (_menuOpen) {
                // ensure overlay stays closed while menu is open
                if (_endUiVisible) hideGameOverUI();
            } else if (world && world.gameOver && !suppressed) {
                if (!_endUiVisible) showGameOverUI();
            } else {
                if (_endUiVisible) hideGameOverUI();
            }
        } catch (e) {}
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function buildOverlay(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.style.position = 'fixed';
    el.style.left = '0'; el.style.top = '0'; el.style.width = '100%'; el.style.height = '100%';
    el.style.display = 'none';
    el.style.alignItems = 'center'; el.style.justifyContent = 'center';
    el.style.background = 'rgba(0,0,0,0.7)'; el.style.color = 'white';
    el.style.zIndex = '10010'; // above touch overlay (9000)
    document.body.appendChild(el);
    return el;
}

function showGameOverUI() {
    const ov = buildOverlay('gameOverUI');
    ov.innerHTML = '';
    const inner = document.createElement('div');
    inner.style.background = '#0b2233';
    inner.style.padding = '16px';
    inner.style.borderRadius = '10px';
    inner.style.width = 'min(380px,92vw)';
    inner.style.boxSizing = 'border-box';
    inner.style.textAlign = 'center';
    const score = world ? (world.score || 0) : 0;
    const secs = world ? Math.round((world._finalElapsedMs || world.elapsedMs || 0) / 1000) : 0;
    const diff = world ? (world.difficulty || 'normal') : 'normal';
    const title = document.createElement('h2'); title.innerText = 'Game Over'; title.style.margin = '0 0 8px';
    // requested image inside overlay
    const deadImg = document.createElement('img');
    deadImg.src = './assets/img/sharki/1sharkie/6dead/1poisoned/9.png';
    deadImg.alt = 'Sharkie Game Over';
    deadImg.style.display = 'block'; deadImg.style.margin = '0 auto 8px';
    deadImg.style.width = '120px'; deadImg.style.height = 'auto';
    const info = document.createElement('div'); info.style.margin = '0 0 12px'; info.innerText = `Score: ${score} • Zeit: ${secs}s • ${diff}`;
    const nameWrap = document.createElement('div'); nameWrap.style.margin = '0 0 10px'; nameWrap.style.textAlign = 'left';
    const nameLbl = document.createElement('label'); nameLbl.innerText = 'Name für Highscore:'; nameLbl.style.display = 'block'; nameLbl.style.marginBottom = '6px';
    const nameInput = document.createElement('input'); nameInput.id = 'playerName'; nameInput.type = 'text'; nameInput.maxLength = 24; nameInput.style.width = '100%'; nameInput.style.padding = '8px'; nameInput.style.borderRadius = '6px'; nameInput.style.border = '1px solid rgba(255,255,255,0.1)'; nameInput.style.background = 'transparent'; nameInput.style.color = 'white';
    try { const prev = localStorage.getItem('sharkyPlayerName'); if (prev) nameInput.value = prev; } catch (e) {}
    nameWrap.appendChild(nameLbl); nameWrap.appendChild(nameInput);
    const btnRow = document.createElement('div'); btnRow.style.display = 'flex'; btnRow.style.gap = '10px'; btnRow.style.justifyContent = 'center'; btnRow.style.flexWrap = 'wrap';
    const hsBtn = document.createElement('button'); hsBtn.innerText = 'Highscores'; hsBtn.style.padding = '8px 12px';
    const menuBtn = document.createElement('button'); menuBtn.innerText = 'Zum Menü'; menuBtn.style.padding = '8px 12px';
    btnRow.appendChild(hsBtn); btnRow.appendChild(menuBtn);
    inner.appendChild(title); inner.appendChild(deadImg); inner.appendChild(info); inner.appendChild(nameWrap); inner.appendChild(btnRow);
    ov.appendChild(inner);

    hsBtn.addEventListener('click', () => {
        try {
            const name = (nameInput.value || 'Player').trim();
            try { localStorage.setItem('sharkyPlayerName', name); } catch (e) {}
            const s = world ? (world.score || 0) : 0;
            const t = world ? (world._finalElapsedMs || world.elapsedMs || 0) : 0;
            const d = world ? (world.difficulty || 'normal') : 'normal';
            if (typeof saveHighscoreRecord === 'function') saveHighscoreRecord({ name, score: s, difficulty: d, timeMs: t, when: Date.now() });
            showHighscoresUI();
        } catch (e) {}
    });
                menuBtn.addEventListener('click', () => {
                    // mark menu open immediately and clear end-state so monitor won't re-open overlay
                    _menuOpen = true;
                    try { if (world) { world.gameOver = false; world.victory = false; world.running = false; } } catch (e) {}
                    // suppress overlay reopen briefly
                    try { _suppressEndOverlayUntil = Date.now() + 600; } catch (e) {}
                    try { hideHighscoresUI(); } catch (e) {}
                    try { hideGameOverUI(); } catch (e) {}
                    try { showStartMenu(); } catch (e) {}
                });

    ov.style.display = 'flex';
    _endUiVisible = true;
}

function hideGameOverUI() {
    const ov = document.getElementById('gameOverUI');
    if (ov) ov.style.display = 'none';
    _endUiVisible = false;
}

function showHighscoresUI() {
    const ov = buildOverlay('highscoresUI');
    ov.innerHTML = '';
    const inner = document.createElement('div');
    inner.style.background = '#07232b'; inner.style.padding = '16px'; inner.style.borderRadius = '10px'; inner.style.width = 'min(420px,92vw)'; inner.style.boxSizing = 'border-box';
    const title = document.createElement('h3'); title.innerText = 'Highscores'; title.style.margin = '0 0 10px';
    const list = document.createElement('div'); list.id = 'hsList'; list.style.maxHeight = '60vh'; list.style.overflowY = 'auto'; list.style.marginBottom = '12px';
    const close = document.createElement('button'); close.innerText = 'Schließen'; close.style.padding = '8px 12px';
    close.addEventListener('click', () => { hideHighscoresUI(); });
    inner.appendChild(title); inner.appendChild(list); inner.appendChild(close);
    ov.appendChild(inner);
    // populate
    try {
        let arr = (typeof getTopHighscores === 'function') ? (getTopHighscores(10, false) || []) : [];
        list.innerHTML = '';
        if (!arr.length) {
            const dash = document.createElement('div'); dash.style.textAlign = 'center'; dash.style.opacity = '0.8'; dash.innerText = '-'; list.appendChild(dash);
        } else {
            arr.forEach((r, i) => {
                const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.padding = '6px 4px'; row.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                const left = document.createElement('div'); left.innerText = `${i+1}. ${r.name || 'Player'}`; left.style.fontWeight = '600';
                const right = document.createElement('div'); right.style.fontFamily = 'monospace'; right.innerText = `${r.score || 0}`;
                row.appendChild(left); row.appendChild(right); list.appendChild(row);
            });
        }
    } catch (e) {}
    ov.style.display = 'flex';
}

function hideHighscoresUI() {
    const ov = document.getElementById('highscoresUI');
    if (ov) ov.style.display = 'none';
}

    // ---------------- Pause Overlay ----------------
    function ensurePauseOverlay() {
        if (document.getElementById('pauseOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'pauseOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.display = 'none'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.5)'; ov.style.zIndex = '10010'; ov.style.color = 'white';
        const inner = document.createElement('div'); inner.style.background = '#0b2233'; inner.style.padding = '16px'; inner.style.borderRadius = '10px'; inner.style.textAlign = 'center';
        const t = document.createElement('div'); t.innerText = 'Pausiert'; t.style.fontSize = '20px'; t.style.marginBottom = '10px';
        const btn = document.createElement('button'); btn.innerText = 'Weiter'; btn.style.padding = '8px 12px';
        btn.addEventListener('click', () => { try { if (world) world.paused = false; } catch(e){} hidePauseOverlay(); });
        inner.appendChild(t); inner.appendChild(btn); ov.appendChild(inner);
        document.body.appendChild(ov);
    }
    function showPauseOverlay() { const ov = document.getElementById('pauseOverlay'); if (ov) ov.style.display = 'flex'; }
    function hidePauseOverlay() { const ov = document.getElementById('pauseOverlay'); if (ov) ov.style.display = 'none'; }
    window.showPauseOverlay = showPauseOverlay; window.hidePauseOverlay = hidePauseOverlay;

    // ---------------- Touch Controls Overlay (manual ON/OFF) ----------------
    let _touchButtons = null;
    function ensureTouchOverlay() {
        if (document.getElementById('touchOverlay')) return;
        const ov = document.createElement('div'); ov.id = 'touchOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.pointerEvents = 'none'; ov.style.display = 'none'; ov.style.zIndex = '9000';
        // left: movement (up/down/left/right)
        const pad = document.createElement('div'); pad.style.position = 'absolute'; pad.style.left = '16px'; pad.style.bottom = '16px'; pad.style.width = '180px'; pad.style.height = '180px'; pad.style.pointerEvents = 'auto';
        const mkBtn = (label, x, y) => { const b = document.createElement('button'); b.innerText = label; b.style.position = 'absolute'; b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.opacity = '0.75'; b.style.borderRadius = '50%'; b.style.width = '60px'; b.style.height = '60px'; b.style.border = '1px solid rgba(255,255,255,0.2)'; b.style.background = 'rgba(0,0,0,0.35)'; b.style.color='white'; b.style.touchAction='none'; return b; };
        const bUp = mkBtn('↑', 60, 0), bDown = mkBtn('↓', 60, 120), bLeft = mkBtn('←', 0, 60), bRight = mkBtn('→', 120, 60);
        pad.appendChild(bUp); pad.appendChild(bDown); pad.appendChild(bLeft); pad.appendChild(bRight);
        // right: action (bubble only)
        const act = document.createElement('div'); act.style.position='absolute'; act.style.right='16px'; act.style.bottom='16px'; act.style.width='200px'; act.style.height='120px'; act.style.pointerEvents='auto';
        const bBubble = mkBtn('Bubble', 60, 0); bBubble.style.borderRadius='12px'; bBubble.style.width='100px'; bBubble.style.height='60px';
        act.appendChild(bBubble);
        ov.appendChild(pad); ov.appendChild(act); document.body.appendChild(ov);

        // wire touch/mouse press & release to window.input/actions
        const press = (btn, on, off) => {
            const down = (e) => { e.preventDefault(); on(); };
            const up = (e) => { e.preventDefault(); off(); };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointerleave', up);
            btn.addEventListener('pointercancel', up);
        };
        press(bUp, () => window.input.up = true, () => window.input.up = false);
        press(bDown, () => window.input.down = true, () => window.input.down = false);
        press(bLeft, () => window.input.left = true, () => window.input.left = false);
        press(bRight, () => window.input.right = true, () => window.input.right = false);
        press(bBubble, () => { try { if (world && world.character) world.character.shootBubble(); } catch(e){} }, () => {});

        _touchButtons = { pad, act };
    }
    // --- Touch full-screen + orientation handling ---
    let _noScrollActive = false;
    let _touchResizeHandler = null;
    let _touchOrientHandler = null;
    let _canvasPrevStyle = null;

    function isLandscape() { return (window.innerWidth || 0) >= (window.innerHeight || 0); }

    function ensureRotateOverlay() {
        if (document.getElementById('rotateOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'rotateOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.display = 'none'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.8)'; ov.style.zIndex = '10020'; ov.style.color = 'white'; ov.style.pointerEvents = 'auto';
        const inner = document.createElement('div'); inner.style.textAlign = 'center'; inner.style.maxWidth = '80vw';
        const t = document.createElement('div'); t.innerText = 'Bitte das Handy drehen (Querformat).'; t.style.fontSize = '20px'; t.style.marginBottom = '10px';
        inner.appendChild(t); ov.appendChild(inner); document.body.appendChild(ov);
    }
    function showRotateOverlay() { ensureRotateOverlay(); const ov = document.getElementById('rotateOverlay'); if (ov) ov.style.display = 'flex'; }
    function hideRotateOverlay() { const ov = document.getElementById('rotateOverlay'); if (ov) ov.style.display = 'none'; }

    function setNoScroll(on) {
        const body = document.body; const html = document.documentElement;
        if (on && !_noScrollActive) {
            _noScrollActive = true;
            if (body) body.style.overflow = 'hidden';
            if (html) html.style.overflow = 'hidden';
            try { window.addEventListener('touchmove', _preventDefaultTouch, { passive: false }); } catch (e) {}
        } else if (!on && _noScrollActive) {
            _noScrollActive = false;
            if (body) body.style.overflow = '';
            if (html) html.style.overflow = '';
            try { window.removeEventListener('touchmove', _preventDefaultTouch); } catch (e) {}
        }
    }
    function _preventDefaultTouch(e) { if (window.__touchOverlayOn) { try { e.preventDefault(); } catch (err) {} } }

    function saveCanvasStyle() {
        if (!canvas) return;
        _canvasPrevStyle = {
            position: canvas.style.position,
            left: canvas.style.left,
            top: canvas.style.top,
            width: canvas.style.width,
            height: canvas.style.height,
            zIndex: canvas.style.zIndex
        };
    }
    function restoreCanvasStyle() {
        if (!canvas || !_canvasPrevStyle) return;
        const s = _canvasPrevStyle; _canvasPrevStyle = null;
        canvas.style.position = s.position || '';
        canvas.style.left = s.left || '';
        canvas.style.top = s.top || '';
        canvas.style.width = s.width || '';
        canvas.style.height = s.height || '';
        canvas.style.zIndex = s.zIndex || '';
    }
    function resizeCanvasToViewport() {
        if (!canvas) return;
        canvas.style.position = 'fixed';
        canvas.style.left = '0'; canvas.style.top = '0';
        canvas.style.width = '100vw'; canvas.style.height = '100vh';
        canvas.style.zIndex = '0';
        try { canvas.width = window.innerWidth || 0; canvas.height = window.innerHeight || 0; } catch (e) {}
    }
    async function enterFullscreen() {
        try {
            const el = document.body || document.documentElement || canvas;
            if (el && el.requestFullscreen) {
                await el.requestFullscreen({ navigationUI: 'hide' });
            }
        } catch (e) {}
    }
    async function exitFullscreen() {
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    }
    function attachTouchModeListeners() {
        if (_touchResizeHandler || _touchOrientHandler) return;
        _touchResizeHandler = () => {
            if (!window.__touchOverlayOn) return;
            if (isLandscape()) {
                hideRotateOverlay(); resizeCanvasToViewport();
            } else {
                showRotateOverlay(); exitFullscreen();
            }
        };
        _touchOrientHandler = _touchResizeHandler;
        try { window.addEventListener('resize', _touchResizeHandler); } catch (e) {}
        try { window.addEventListener('orientationchange', _touchOrientHandler); } catch (e) {}
    }
    function detachTouchModeListeners() {
        try { if (_touchResizeHandler) window.removeEventListener('resize', _touchResizeHandler); } catch (e) {}
        try { if (_touchOrientHandler) window.removeEventListener('orientationchange', _touchOrientHandler); } catch (e) {}
        _touchResizeHandler = null; _touchOrientHandler = null;
    }

    async function setTouchOverlayOn(on) {
        window.__touchOverlayOn = !!on;
        ensureRotateOverlay();
        const ov = document.getElementById('touchOverlay');
        if (ov) ov.style.display = on ? 'block' : 'none';
        if (on) {
            setNoScroll(true);
            saveCanvasStyle();
            if (isLandscape()) {
                hideRotateOverlay();
                await enterFullscreen();
                resizeCanvasToViewport();
                attachTouchModeListeners();
            } else {
                showRotateOverlay();
                attachTouchModeListeners();
            }
        } else {
            hideRotateOverlay();
            detachTouchModeListeners();
            await exitFullscreen();
            setNoScroll(false);
            restoreCanvasStyle();
            try {
                if (canvas) {
                    canvas.width = 720; canvas.height = 480;
                    canvas.style.width = '720px';
                    canvas.style.height = '480px';
                }
            } catch (e) {}
        }
    }
    window.setTouchOverlayOn = setTouchOverlayOn;
    // initialize state
    window.__touchOverlayOn = false;
    setTouchOverlayOn(false);
