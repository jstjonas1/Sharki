/**
 * Main canvas element reference.
 * @type {HTMLCanvasElement|null}
 */
let canvas;
/**
 * Active game world instance.
 * @type {World|undefined|null}
 */
let world;
/**
 * Tracks whether the start menu is currently open (prevents end overlays).
 * @type {boolean}
 */
let _menuOpen = false;

/**
 * Lightweight sound effect helper with simple preload and fire-and-forget playback.
 * @namespace SFX
 */
const SFX = (() => {
    const cache = {};
    const state = { volume: 1, muted: false };
    /**
     * Preload an audio file into memory.
     * @param {string} key Unique identifier for this sound.
     * @param {string} src URL to the audio file.
     */
    function load(key, src) {
        try { const a = new Audio(src); a.preload = 'auto'; cache[key] = a; } catch (e) {}
    }
    /**
     * Play a preloaded sound at the specified volume.
     * @param {string} key Identifier previously loaded with load().
     * @param {number} [vol=1] Volume in range [0,1].
     */
    function play(key, vol = 1) {
        try {
            const base = cache[key]; if (!base) return;
            const node = base.cloneNode();
            const local = Math.max(0, Math.min(1, vol));
            const master = Math.max(0, Math.min(1, state.volume || 0));
            node.volume = state.muted ? 0 : Math.max(0, Math.min(1, local * master));
            node.play().catch(() => {});
        } catch (e) {}
    }
    /**
     * Set the master volume for all sound effects.
     * @param {number} v Volume level in range [0,1].
     */
    function setVolume(v) {
        const nv = (typeof v === 'number') ? v : 1;
        state.volume = Math.max(0, Math.min(1, nv));
        try { localStorage.setItem('sharkyVolume', String(Math.round(state.volume * 100))); } catch (_) {}
    }
    /**
     * Mute or unmute all sound effects.
     * @param {boolean} m True to mute, false to unmute.
     */
    function setMuted(m) {
        state.muted = !!m;
        try { localStorage.setItem('sharkyMuted', state.muted ? '1' : '0'); } catch (_) {}
    }
    /**
     * Get the current master volume level.
     * @returns {number} Volume in range [0,1].
     */
    function getVolume() { return Math.max(0, Math.min(1, state.volume || 0)); }
    /**
     * Check if sound effects are currently muted.
     * @returns {boolean}
     */
    function isMuted() { return !!state.muted; }
    
    try {
        const mv = parseInt(localStorage.getItem('sharkyVolume') || '100', 10);
        if (!isNaN(mv)) state.volume = Math.max(0, Math.min(1, mv / 100));
        const mm = localStorage.getItem('sharkyMuted');
        if (mm === '1' || mm === '0') state.muted = (mm === '1');
    } catch (_) {}
    return { load, play, setVolume, setMuted, getVolume, isMuted };
})();
window.SFX = SFX;

/**
 * Background music controller with separate volume/mute and autoplay fallback.
 * @namespace BGM
 */
const BGM = (() => {
    let audio = null;
    const state = { volume: 1, muted: false, started: false, _resumeHooked: false };
    const SRC = './audio/music.mp3';
    /**
     * Ensure audio element is created and configured.
     * @private
     */
    function _ensureAudio() {
        if (!audio) {
            try {
                audio = new Audio(SRC);
                audio.preload = 'auto';
                audio.loop = true;
                _applyVolume();
            } catch (e) { audio = null; }
        }
    }
    /**
     * Apply current volume and mute settings to audio element.
     * @private
     */
    function _applyVolume() { if (audio) audio.volume = state.muted ? 0 : Math.max(0, Math.min(1, state.volume || 0)); }
    /**
     * Ensure background music has started playing.
     * @async
     */
    async function ensureStarted() {
        try {
            _ensureAudio(); if (!audio) return;
            if (state.started && !audio.paused) return;
            await audio.play();
            state.started = true;
        } catch (e) { /* likely autoplay blocked */ }
    }
    /**
     * Set the background music volume.
     * @param {number} v Volume level in range [0,1].
     */
    function setVolume(v) {
        const nv = (typeof v === 'number') ? v : 1;
        state.volume = Math.max(0, Math.min(1, nv));
        try { localStorage.setItem('sharkyMusicVolume', String(Math.round(state.volume * 100))); } catch (_) {}
        _applyVolume();
    }
    /**
     * Mute or unmute background music.
     * @param {boolean} m True to mute, false to unmute.
     */
    function setMuted(m) {
        state.muted = !!m;
        try { localStorage.setItem('sharkyMusicMuted', state.muted ? '1' : '0'); } catch (_) {}
        _applyVolume();
    }
    /**
     * Check if background music is currently muted.
     * @returns {boolean}
     */
    function isMuted() { return !!state.muted; }
    /**
     * Get the current background music volume level.
     * @returns {number} Volume in range [0,1].
     */
    function getVolume() { return Math.max(0, Math.min(1, state.volume || 0)); }
    /**
     * Hook event listeners to auto-resume music on user interaction.
     */
    function hookAutoResume() {
        if (state._resumeHooked) return; state._resumeHooked = true;
        const one = async () => {
            await ensureStarted();
            try { document.removeEventListener('pointerdown', one); } catch (_){ }
            try { document.removeEventListener('keydown', one); } catch (_){ }
        };
        try { document.addEventListener('pointerdown', one, { once: true }); } catch (_){ }
        try { document.addEventListener('keydown', one, { once: true }); } catch (_){ }
    }
    
    try {
        const mv = parseInt(localStorage.getItem('sharkyMusicVolume') || '100', 10);
        if (!isNaN(mv)) state.volume = Math.max(0, Math.min(1, mv / 100));
        const mm = localStorage.getItem('sharkyMusicMuted');
        if (mm === '1' || mm === '0') state.muted = (mm === '1');
    } catch (_) {}
    return { ensureStarted, setVolume, setMuted, isMuted, getVolume, hookAutoResume };
})();
window.BGM = BGM;

/**
 * Global input state for keyboard and touch controls.
 * @type {{up:boolean,down:boolean,left:boolean,right:boolean}}
 */
window.input = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (k === 'arrowup' || k === 'w') window.input.up = true;
    if (k === 'arrowdown' || k === 's') window.input.down = true;
    if (k === 'arrowleft' || k === 'a') window.input.left = true;
    if (k === 'arrowright' || k === 'd') window.input.right = true;
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

/**
 * Get the value of a checked radio group.
 * @param {string} name Radio group name.
 * @param {string} defVal Default when none selected.
 * @returns {string}
 */
function getSelected(name, defVal) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : defVal;
}

/**
 * Hide the start menu screen.
 */
function hideStartMenu() {
    const ss = document.getElementById('startScreen');
    if (ss) ss.style.display = 'none';
    _menuOpen = false;
}

/**
 * Restore saved game mode selection.
 */
function restoreSavedMode() {
    const savedMode = localStorage.getItem('sharkyStartMode');
    if (savedMode) {
        const rb = document.querySelector('input[name="startMode"][value="' + savedMode + '"]');
        if (rb) rb.checked = true;
    }
}

/**
 * Restore saved difficulty selection.
 */
function restoreSavedDifficulty() {
    const savedDiff = localStorage.getItem('sharkyDifficulty');
    if (savedDiff) {
        const rb = document.querySelector('input[name="difficulty"][value="' + savedDiff + '"]');
        if (rb) rb.checked = true;
    }
}

/**
 * Restore saved dark mode toggle states from localStorage.
 */
function restoreSavedDarkMode() {
    const dark = localStorage.getItem('sharkyDarkMode') === '1';
    const d1 = document.getElementById('darkToggleInline');
    const d2 = document.getElementById('darkToggle');
    if (d1) d1.checked = dark;
    if (d2) d2.checked = dark;
}

/**
 * Restore saved sound controls from localStorage.
 */
function restoreSavedSoundControls() {
    const mt = document.getElementById('muteToggleInline');
    const vr = document.getElementById('volumeRange');
    const vl = document.getElementById('volLabel');
    try {
        const sv = parseInt(localStorage.getItem('sharkyVolume') || '100', 10);
        const sm = localStorage.getItem('sharkyMuted') === '1';
        if (mt) mt.checked = sm;
        if (vr) vr.value = String(isNaN(sv) ? 100 : Math.max(0, Math.min(100, sv)));
        if (vl) vl.textContent = ((isNaN(sv) ? 100 : Math.max(0, Math.min(100, sv)))) + '%';
    } catch (e) {}
}

/**
 * Restore saved music controls from localStorage.
 */
function restoreSavedMusicControls() {
    const mmt = document.getElementById('musicMuteToggle');
    const mvr = document.getElementById('musicVolumeRange');
    const mvl = document.getElementById('musicVolLabel');
    try {
        const mv = parseInt(localStorage.getItem('sharkyMusicVolume') || '100', 10);
        const mm = localStorage.getItem('sharkyMusicMuted') === '1';
        if (mmt) mmt.checked = mm;
        if (mvr) mvr.value = String(isNaN(mv) ? 100 : Math.max(0, Math.min(100, mv)));
        if (mvl) mvl.textContent = ((isNaN(mv) ? 100 : Math.max(0, Math.min(100, mv)))) + '%';
    } catch (e) {}
}

/**
 * Show the start menu screen and restore saved settings.
 */
function showStartMenu() {
    const ss = document.getElementById('startScreen');
    if (!ss) return;
    try { hideHighscoresUI(); } catch (e) {}
    try { hideGameOverUI(); } catch (e) {}
    ss.style.display = 'flex';
    ss.style.pointerEvents = 'auto';
    ss.style.zIndex = '10010';
    _menuOpen = true;
    try { BGM.ensureStarted(); BGM.hookAutoResume(); } catch (e) {}
    restoreAllSavedSettings();
}

/**
 * Restore all saved UI settings.
 */
function restoreAllSavedSettings() {
    try {
        restoreSavedMode();
        restoreSavedDifficulty();
        restoreSavedDarkMode();
        restoreSavedSoundControls();
        restoreSavedMusicControls();
    } catch (e) {}
}

/**
 * Apply and persist dark mode, and sync toggles.
 * @param {boolean} checked
 */
function applyDarkModeUI(checked) {
    try { localStorage.setItem('sharkyDarkMode', checked ? '1' : '0'); } catch (e) {}
    if (world && typeof world.setDarkMode === 'function') world.setDarkMode(checked);
    const d1 = document.getElementById('darkToggleInline'); if (d1) d1.checked = checked;
    const d2 = document.getElementById('darkToggle'); if (d2) d2.checked = checked;
}

/**
 * Save game settings to localStorage.
 * @param {string} mode
 * @param {string} difficulty
 */
function saveGameSettings(mode, difficulty) {
    try { localStorage.setItem('sharkyStartMode', mode); } catch (e) {}
    try { localStorage.setItem('sharkyDifficulty', difficulty); } catch (e) {}
    try { localStorage.setItem('sharkyDarkMode', mode === 'dark' ? '1' : '0'); } catch (e) {}
}

/**
 * Destroy existing world instance.
 */
function destroyWorld() {
    if (world) {
        try { world.destroy && world.destroy(); } catch (e) {}
        try { world.running = false; } catch (e) {}
        try { window.world = null; } catch (e) {}
        world = null;
    }
}

/**
 * Start the game with selected settings.
 */
function startGame() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const mode = getSelected('startMode', 'light');
    const difficulty = getSelected('difficulty', 'normal');
    saveGameSettings(mode, difficulty);
    closeAllOverlays();
    destroyWorld();
    createAndConfigureWorld(canvas, mode, difficulty);
    hideStartMenu();
}

/**
 * Close all UI overlays.
 */
function closeAllOverlays() {
    try { hideHighscoresUI(); } catch (e) {}
    try { hideGameOverUI(); } catch (e) {}
}

/**
 * Create and configure world instance.
 * @param {HTMLCanvasElement} canvas
 * @param {string} mode
 * @param {string} difficulty
 */
function createAndConfigureWorld(canvas, mode, difficulty) {
    world = new World(canvas, { autoStart: false });
    try { window.world = world; } catch (e) {}
    world.difficulty = difficulty;
    if (typeof world.applyDifficultySettings === 'function') world.applyDifficultySettings();
    const dark = (mode === 'dark') || (localStorage.getItem('sharkyDarkMode') === '1');
    if (typeof world.setDarkMode === 'function') world.setDarkMode(dark);
    world.start();
}

/**
 * Wire up dark mode toggle listeners.
 * @param {HTMLElement} d1
 * @param {HTMLElement} d2
 */
function setupDarkModeListeners(d1, d2) {
    if (d1) d1.addEventListener('change', (e) => applyDarkModeUI(!!e.target.checked));
    if (d2) d2.addEventListener('change', (e) => applyDarkModeUI(!!e.target.checked));
}

/**
 * Wire up sound control listeners.
 * @param {HTMLElement} muteInline
 * @param {HTMLElement} volumeRange
 * @param {HTMLElement} volLabel
 */
function setupSoundControls(muteInline, volumeRange, volLabel) {
    const syncVolLabel = () => { if (volLabel && volumeRange) volLabel.textContent = `${volumeRange.value}%`; };
    if (muteInline) muteInline.addEventListener('change', (e) => {
        const m = !!e.target.checked; SFX.setMuted(m);
    });
    if (volumeRange) {
        try { const sv = parseInt(localStorage.getItem('sharkyVolume') || '100', 10); if (!isNaN(sv)) volumeRange.value = String(Math.max(0, Math.min(100, sv))); } catch(_){}
        syncVolLabel();
        volumeRange.addEventListener('input', () => { syncVolLabel(); SFX.setVolume((parseInt(volumeRange.value,10)||0)/100); });
        volumeRange.addEventListener('change', () => { syncVolLabel(); SFX.setVolume((parseInt(volumeRange.value,10)||0)/100); });
    }
}

/**
 * Wire up music control listeners.
 * @param {HTMLElement} musicMute
 * @param {HTMLElement} musicRange
 * @param {HTMLElement} musicVolLabel
 */
function setupMusicControls(musicMute, musicRange, musicVolLabel) {
    const syncMusicLabel = () => { if (musicVolLabel && musicRange) musicVolLabel.textContent = `${musicRange.value}%`; };
    if (musicMute) musicMute.addEventListener('change', (e) => { const m = !!e.target.checked; BGM.setMuted(m); BGM.ensureStarted(); });
    if (musicRange) {
        try { const mv = parseInt(localStorage.getItem('sharkyMusicVolume') || '100', 10); if (!isNaN(mv)) musicRange.value = String(Math.max(0, Math.min(100, mv))); } catch(_){ }
        syncMusicLabel();
        const apply = () => { syncMusicLabel(); BGM.setVolume((parseInt(musicRange.value,10)||0)/100); BGM.ensureStarted(); };
        musicRange.addEventListener('input', apply);
        musicRange.addEventListener('change', apply);
    }
}

/**
 * Wire up touch toggle listener.
 * @param {HTMLElement} touchToggle
 */
function setupTouchToggle(touchToggle) {
    window.__userAutoDisabled = false;
    window.__userForcedTouch = undefined;
    if (!touchToggle) return;
    if (!hasTouchCapability()) disableTouchToggle(touchToggle);
    touchToggle.addEventListener('change', (e) => handleTouchToggleChange(e));
}

/**
 * Disable touch toggle on non-touch devices.
 * @param {HTMLElement} touchToggle
 */
function disableTouchToggle(touchToggle) {
    touchToggle.disabled = true;
    touchToggle.checked = false;
    const label = touchToggle.parentElement;
    if (label) label.title = 'Touch mode not available (no touch device detected)';
}

/**
 * Handle touch toggle change event.
 * @param {Event} e
 */
function handleTouchToggleChange(e) {
    const want = !!e.target.checked;
    window.__userAutoDisabled = true;
    window.__userForcedTouch = want;
    try { localStorage.setItem('sharkyTouchForced', want ? '1' : '0'); } catch (err) {}
    if (typeof window.setTouchOverlayOn === 'function') window.setTouchOverlayOn(want);
}

/**
 * Restore saved touch mode preference.
 * @param {HTMLElement} touchToggle
 */
function restoreTouchMode(touchToggle) {
    try {
        const saved = localStorage.getItem('sharkyTouchForced');
        if (saved === '1' || saved === '0') {
            window.__userAutoDisabled = true;
            window.__userForcedTouch = (saved === '1');
            if (touchToggle) touchToggle.checked = (saved === '1');
            if (typeof window.setTouchOverlayOn === 'function') window.setTouchOverlayOn(saved === '1');
        }
    } catch (e) {}
}

/**
 * Setup mobile device detection and orientation handling.
 */
function setupMobileDetection() {
    try {
        const isMobileDevice = detectMobileDevice();
        window.__isMobileDevice = isMobileDevice;
        
        if (isMobileDevice && !window.__userAutoDisabled && typeof window.__userForcedTouch === 'undefined') {
            handleMobileOrientation();
            window.addEventListener('resize', handleMobileOrientation);
            window.addEventListener('orientationchange', handleMobileOrientation);
        } else if (!isMobileDevice) {
            hideMobileRotatePrompt();
        }
    } catch (e) {}
}

/**
 * Preload sound effects.
 */
function preloadSounds() {
    try {
        SFX.load('blub', './audio/blub.mp3');
        SFX.load('essen', './audio/essen.mp3');
        SFX.load('naw', './audio/naw.mp3');
        SFX.load('wow', './audio/wow.mp3');
        SFX.load('nicescore', './audio/nicescore.mp3');
    } catch (e) {}
}

/**
 * Initialize the game UI, controls, and overlays.
 */
function init() {
    canvas = document.getElementById('gameCanvas');
    const tbtn = document.getElementById('touchModeBtn');
    if (tbtn) tbtn.style.display = 'none';
    showStartMenu();
    setupButtonListeners();
    setupAllControls();
    initializeOverlays();
    preloadSounds();
}

/**
 * Setup button event listeners.
 */
function setupButtonListeners() {
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
        startBtn.addEventListener('click', () => { try { BGM.ensureStarted(); } catch(e){} });
    }
    const howTo = document.getElementById('howToBtn');
    if (howTo) howTo.addEventListener('click', () => { try { showHowToOverlay(); } catch (e) {} });
    const r = document.getElementById('restartBtn');
    if (r) r.addEventListener('click', () => { if (world) world.restartGame(); });
}

/**
 * Setup all control panels.
 */
function setupAllControls() {
    setupDarkModeListeners(document.getElementById('darkToggleInline'), document.getElementById('darkToggle'));
    setupSoundControls(document.getElementById('muteToggleInline'), document.getElementById('volumeRange'), document.getElementById('volLabel'));
    setupMusicControls(document.getElementById('musicMuteToggle'), document.getElementById('musicVolumeRange'), document.getElementById('musicVolLabel'));
    const touchToggle = document.getElementById('touchToggle');
    setupTouchToggle(touchToggle);
    restoreTouchMode(touchToggle);
}

/**
 * Initialize all overlays and detection.
 */
function initializeOverlays() {
    monitorEndState();
    ensurePauseOverlay();
    ensureTouchOverlay();
    ensureMobileRotatePrompt();
    setupMobileDetection();
}

window.init = init;

/**
 * Tracks visibility state of game over and victory UI.
 * @type {boolean}
 */
let _endUiVisible = false;
/**
 * Tracks visibility state of victory UI.
 * @type {boolean}
 */
let _victoryUiVisible = false;
/**
 * Suppresses end overlay display until this timestamp.
 * @type {number}
 */
let _suppressEndOverlayUntil = 0;

/**
 * Monitor and show/hide end state UI (game over or victory).
 */
function monitorEndState() {
    function tick() {
        try {
            updateEndStateUI();
        } catch (e) {}
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

/**
 * Update end state UI visibility based on game state.
 */
function updateEndStateUI() {
    const now = Date.now();
    const suppressed = _suppressEndOverlayUntil && now < _suppressEndOverlayUntil;
    const hsEl = document.getElementById('highscoresUI');
    const hsOpen = !!(hsEl && hsEl.style.display !== 'none');
    if (_menuOpen) {
        if (_endUiVisible) hideGameOverUI();
        if (_victoryUiVisible) hideVictoryUI();
    } else if (world && world.gameOver && !suppressed && !hsOpen) {
        if (!_endUiVisible) showGameOverUI();
        if (_victoryUiVisible) hideVictoryUI();
    } else if (world && world.victory && !suppressed && !hsOpen) {
        if (!_victoryUiVisible) showVictoryUI();
        if (_endUiVisible) hideGameOverUI();
    } else {
        if (_endUiVisible) hideGameOverUI();
        if (_victoryUiVisible) hideVictoryUI();
    }
}

/**
 * Ensure a full-screen overlay container exists.
 * @param {string} id Element id.
 * @returns {HTMLDivElement}
 */
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
    el.style.zIndex = '10010';
    document.body.appendChild(el);
    return el;
}

/**
 * Show the how to play overlay with game instructions.
 */
function showHowToOverlay() {
    const ov = buildOverlay('howToUI');
    ov.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'howto-inner';
    inner.innerHTML = _getHowToContent();
    ov.appendChild(inner);
    const closeBtn = inner.querySelector('button');
    if (closeBtn) closeBtn.addEventListener('click', () => { ov.style.display = 'none'; });
    ov.style.display = 'flex';
}

/**
 * Get HTML content for how to play overlay.
 * @returns {string}
 */
function _getHowToContent() {
    return `
        <h2>How to play</h2>
        <ul>
            <li>Move with Arrow keys or WASD.</li>
            <li>Shoot a bubble with F (or the on-screen button). Each shot costs 0.5% of your current points.</li>
            <li>You can only eat fish that are smaller or the same size as you. Touching a bigger fish means Game Over.</li>
            <li>When the progress bar reaches 100%, the Boss appears. Defeat it by shooting bubbles and don't get hit.</li>
        </ul>
        <div class="howto-close">
            <button>Close</button>
        </div>
    `;
}

/**
 * Create game over UI content structure.
 * @returns {{inner: HTMLDivElement, nameInput: HTMLInputElement, confirmBtn: HTMLButtonElement}}
 */
function createGameOverContent() {
    const inner = document.createElement('div');
    inner.className = 'gameover-inner';
    const { score, secs, diff } = _getGameStats();
    _appendGameOverElements(inner, score, secs, diff);
    const nameInput = inner.querySelector('.gameover-name-input');
    const confirmBtn = inner.querySelector('button');
    return { inner, nameInput, confirmBtn };
}

/**
 * Append game over UI elements to container.
 * @param {HTMLDivElement} container - Container element
 * @param {number} score - Player score
 * @param {number} secs - Time in seconds
 * @param {string} diff - Difficulty level
 */
function _appendGameOverElements(container, score, secs, diff) {
    container.innerHTML = `
        <h2>Game Over</h2>
        <img class="gameover-img" src="./assets/img/sharki/1sharkie/6dead/1poisoned/9.png" alt="Sharkie Game Over">
        <div class="gameover-info">Score: ${score} • Time: ${secs}s • ${diff}</div>
        <div class="gameover-name-wrap">
            <label class="gameover-name-label">Name for High Score:</label>
            <input class="gameover-name-input" id="playerName" type="text" maxlength="24">
        </div>
        <div class="gameover-btn-row">
            <button>Confirm</button>
        </div>
    `;
    _restoreSavedPlayerName(container.querySelector('.gameover-name-input'));
}

/**
 * Handle game over confirmation.
 * @param {HTMLInputElement} nameInput
 */
function handleGameOverConfirm(nameInput) {
    try {
        const name = (nameInput.value || 'Player').trim();
        try { localStorage.setItem('sharkyPlayerName', name); } catch (e) {}
        const s = world ? (world.score || 0) : 0;
        const t = world ? (world._finalElapsedMs || world.elapsedMs || 0) : 0;
        const d = world ? (world.difficulty || 'normal') : 'normal';
        const reported = (d && d.toString().toLowerCase() === 'easy') ? Math.round(s * 0.5) : s;
        if (typeof saveHighscoreRecord === 'function') saveHighscoreRecord({ name, score: reported, difficulty: d, timeMs: t, when: Date.now() });
        try { if (window.SFX) window.SFX.play('nicescore', 1); } catch (_) {}
        hideGameOverUI();
        showHighscoresUI();
    } catch (e) {}
}

/**
 * Show the game over UI overlay.
 */
function showGameOverUI() {
    const ov = buildOverlay('gameOverUI');
    ov.innerHTML = '';
    const { inner, nameInput, confirmBtn } = createGameOverContent();
    ov.appendChild(inner);
    confirmBtn.addEventListener('click', () => handleGameOverConfirm(nameInput));
    ov.style.display = 'flex';
    _endUiVisible = true;
}

/**
 * Hide the game over UI overlay.
 */
function hideGameOverUI() {
    const ov = document.getElementById('gameOverUI');
    if (ov) ov.style.display = 'none';
    _endUiVisible = false;
}

/**
 * Create victory UI content structure.
 * @returns {{inner: HTMLDivElement, nameInput: HTMLInputElement, confirmBtn: HTMLButtonElement}}
 */
function createVictoryContent() {
    const inner = document.createElement('div');
    inner.className = 'victory-inner';
    const { score, secs, diff } = _getGameStats();
    _appendVictoryElements(inner, score, secs, diff);
    const nameInput = inner.querySelector('.victory-name-input');
    const confirmBtn = inner.querySelector('button');
    return { inner, nameInput, confirmBtn };
}

/**
 * Get current game statistics.
 * @returns {{score: number, secs: number, diff: string}}
 */
function _getGameStats() {
    const score = world ? (world.score || 0) : 0;
    const secs = world ? Math.round((world._finalElapsedMs || world.elapsedMs || 0) / 1000) : 0;
    const diff = world ? (world.difficulty || 'normal') : 'normal';
    return { score, secs, diff };
}

/**
 * Append victory UI elements to container.
 * @param {HTMLDivElement} container - Container element
 * @param {number} score - Player score
 * @param {number} secs - Time in seconds
 * @param {string} diff - Difficulty level
 */
function _appendVictoryElements(container, score, secs, diff) {
    container.innerHTML = `
        <h2>You Win!</h2>
        <img class="victory-img" src="./assets/img/sharki/1sharkie/1idle/1.png" alt="Sharkie Victory">
        <div class="victory-info">Score: ${score} • Time: ${secs}s • ${diff}</div>
        <div class="victory-name-wrap">
            <label class="victory-name-label">Name for High Score:</label>
            <input class="victory-name-input" id="playerNameVictory" type="text" maxlength="24">
        </div>
        <div class="victory-btn-row">
            <button>Confirm</button>
        </div>
    `;
    _restoreSavedPlayerName(container.querySelector('.victory-name-input'));
}

/**
 * Restore saved player name from localStorage.
 * @param {HTMLInputElement} input - Name input element
 */
function _restoreSavedPlayerName(input) {
    try {
        const prev = localStorage.getItem('sharkyPlayerName');
        if (prev) input.value = prev;
    } catch (e) {}
}

/**
 * Handle victory confirmation.
 * @param {HTMLInputElement} nameInput
 */
function handleVictoryConfirm(nameInput) {
    try {
        const name = (nameInput.value || 'Player').trim();
        try { localStorage.setItem('sharkyPlayerName', name); } catch (e) {}
        const s = world ? (world.score || 0) : 0;
        const t = world ? (world._finalElapsedMs || world.elapsedMs || 0) : 0;
        const d = world ? (world.difficulty || 'normal') : 'normal';
        const reported = (d && d.toString().toLowerCase() === 'easy') ? Math.round(s * 0.5) : s;
        if (typeof saveHighscoreRecord === 'function') saveHighscoreRecord({ name, score: reported, difficulty: d, timeMs: t, when: Date.now() });
        try { if (window.SFX) window.SFX.play('nicescore', 1); } catch (_) {}
        hideVictoryUI();
        showHighscoresUI();
    } catch (e) {}
}

function showVictoryUI() {
    const ov = buildOverlay('victoryUI');
    ov.innerHTML = '';
    const { inner, nameInput, confirmBtn } = createVictoryContent();
    ov.appendChild(inner);
    confirmBtn.addEventListener('click', () => handleVictoryConfirm(nameInput));
    ov.style.display = 'flex';
    _victoryUiVisible = true;
}

/**
 * Hide the victory UI overlay.
 */
function hideVictoryUI() {
    const ov = document.getElementById('victoryUI');
    if (ov) ov.style.display = 'none';
    _victoryUiVisible = false;
}

/**
 * Show highscores overlay with top scores.
 */
function showHighscoresUI() {
    const ov = buildOverlay('highscoresUI');
    ov.innerHTML = '';
    _appendHighscoresContent(ov);
    ov.style.display = 'flex';
}

/**
 * Append highscores content to overlay.
 * @param {HTMLElement} ov - Overlay element
 */
function _appendHighscoresContent(ov) {
    const inner = document.createElement('div');
    inner.className = 'highscores-inner';
    inner.innerHTML = `
        <h3>High Scores</h3>
        <div id="hsList" class="highscores-list"></div>
        <div class="highscores-actions">
            <button id="hsRestartBtn">Restart</button>
            <button id="hsMenuBtn">Back to Menu</button>
        </div>
    `;
    ov.appendChild(inner);
    _attachHighscoresHandlers();
    _populateHighscoresList();
}

/**
 * Attach event handlers to highscores buttons.
 */
function _attachHighscoresHandlers() {
    document.getElementById('hsRestartBtn').addEventListener('click', _handleHighscoresRestart);
    document.getElementById('hsMenuBtn').addEventListener('click', _handleHighscoresToMenu);
}

/**
 * Handle highscores restart button click.
 */
function _handleHighscoresRestart() {
    hideHighscoresUI();
    hideGameOverUI();
    hideVictoryUI();
    _suppressEndOverlayUntil = Date.now() + 600;
    if (world) { world.gameOver = false; world.victory = false; world.restartGame(); }
}

/**
 * Handle highscores back to menu button click.
 */
function _handleHighscoresToMenu() {
    _menuOpen = true;
    if (world) { world.gameOver = false; world.victory = false; world.running = false; }
    _suppressEndOverlayUntil = Date.now() + 600;
    hideHighscoresUI();
    hideGameOverUI();
    hideVictoryUI();
    showStartMenu();
}

/**
 * Populate highscores list with data.
 */
function _populateHighscoresList() {
    const list = document.getElementById('hsList');
    if (!list) return;
    const data = _getSortedHighscores();
    list.innerHTML = '';
    if (!data.length) {
        list.innerHTML = '<div class="highscore-empty">-</div>';
    } else {
        data.forEach((r, i) => _appendHighscoreRow(list, r, i));
    }
}

/**
 * Get sorted highscores data.
 * @returns {Array} Sorted highscores
 */
function _getSortedHighscores() {
    try {
        const arr = (typeof getTopHighscores === 'function') ? (getTopHighscores(10, false) || []) : [];
        const data = Array.isArray(arr) ? arr.slice() : [];
        data.sort((a,b) => {
            const as = (a && (a.score ?? a.finalScore)) || 0;
            const bs = (b && (b.score ?? b.finalScore)) || 0;
            const at = Math.max(0, Math.round(((a && a.timeMs) || 0) / 1000));
            const bt = Math.max(0, Math.round(((b && b.timeMs) || 0) / 1000));
            const ae = as - at * 10;
            const be = bs - bt * 10;
            if (be !== ae) return be - ae;
            return (a.timeMs || 0) - (b.timeMs || 0);
        });
        return data;
    } catch (e) { return []; }
}

/**
 * Append a highscore row to the list.
 * @param {HTMLElement} list - List container
 * @param {Object} record - Highscore record
 * @param {number} index - Row index
 */
function _appendHighscoreRow(list, record, index) {
    const row = document.createElement('div');
    row.className = 'highscore-row';
    const left = document.createElement('div');
    left.className = 'highscore-row-left';
    left.innerText = `${index+1}. ${record.name || 'Player'}`;
    const right = document.createElement('div');
    right.className = 'highscore-row-right';
    try {
        const secs = Math.max(0, Math.round((record.timeMs || 0) / 1000));
        const mm = Math.floor(secs / 60);
        const ss = String(secs % 60).padStart(2, '0');
        right.innerText = `${record.score || 0} • ${mm}:${ss}`;
    } catch (_) {
        right.innerText = `${record.score || 0}`;
    }
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
}

/**
 * Hide the highscores UI overlay.
 */
function hideHighscoresUI() {
    const ov = document.getElementById('highscoresUI');
    if (ov) ov.style.display = 'none';
}

/**
 * Create pause overlay if it doesn't exist.
 */
function ensurePauseOverlay() {
        if (document.getElementById('pauseOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'pauseOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.display = 'none'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.5)'; ov.style.zIndex = '10010'; ov.style.color = 'white';
        const inner = document.createElement('div'); inner.style.background = '#0b2233'; inner.style.padding = '16px'; inner.style.borderRadius = '10px'; inner.style.textAlign = 'center';
    const t = document.createElement('div'); t.innerText = 'Paused'; t.style.fontSize = '20px'; t.style.marginBottom = '10px';
    const btn = document.createElement('button'); btn.innerText = 'Resume'; btn.style.padding = '8px 12px';
        btn.addEventListener('click', () => { try { if (world) world.paused = false; } catch(e){} hidePauseOverlay(); });
        inner.appendChild(t); inner.appendChild(btn); ov.appendChild(inner);
        document.body.appendChild(ov);
    }

/**
 * Show the pause overlay.
 */
function showPauseOverlay() { const ov = document.getElementById('pauseOverlay'); if (ov) ov.style.display = 'flex'; }

/**
 * Hide the pause overlay.
 */
function hidePauseOverlay() { const ov = document.getElementById('pauseOverlay'); if (ov) ov.style.display = 'none'; }
window.showPauseOverlay = showPauseOverlay; window.hidePauseOverlay = hidePauseOverlay;

    /** Create Touch Controls overlay if missing. */
    let _touchButtons = null;
    /**
     * Create touch button element.
     * @param {string} label
     * @param {number} x
     * @param {number} y
     * @returns {HTMLButtonElement}
     */
    function createTouchButton(label, x, y) {
        const b = document.createElement('button');
        b.innerText = label;
        b.style.position = 'absolute';
        b.style.left = x + 'px';
        b.style.top = y + 'px';
        b.style.opacity = '0.75';
        b.style.borderRadius = '50%';
        b.style.width = '60px';
        b.style.height = '60px';
        b.style.border = '1px solid rgba(255,255,255,0.2)';
        b.style.background = 'rgba(0,0,0,0.35)';
        b.style.color = 'white';
        b.style.touchAction = 'none';
        return b;
    }

    /**
     * Attach press handlers to touch button.
     * @param {HTMLButtonElement} btn
     * @param {Function} on
     * @param {Function} off
     */
    function attachTouchPress(btn, on, off) {
        const down = (e) => { e.preventDefault(); on(); };
        const up = (e) => { e.preventDefault(); off(); };
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); });
        btn.addEventListener('gesturestart', (e) => { try { e.preventDefault(); } catch (_) {} });
        btn.addEventListener('gesturechange', (e) => { try { e.preventDefault(); } catch (_) {} });
        btn.addEventListener('gestureend', (e) => { try { e.preventDefault(); } catch (_) {} });
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
    }

    /**
     * Create dpad buttons.
     * @returns {{bUp: HTMLButtonElement, bDown: HTMLButtonElement, bLeft: HTMLButtonElement, bRight: HTMLButtonElement, pad: HTMLDivElement}}
     */
    function createDpadButtons() {
        const pad = document.createElement('div');
        pad.style.position = 'absolute';
        pad.style.left = '16px';
        pad.style.bottom = '16px';
        pad.style.width = '180px';
        pad.style.height = '180px';
        pad.style.pointerEvents = 'auto';
        const bUp = createTouchButton('↑', 60, 0);
        const bDown = createTouchButton('↓', 60, 120);
        const bLeft = createTouchButton('←', 0, 60);
        const bRight = createTouchButton('→', 120, 60);
        pad.appendChild(bUp); pad.appendChild(bDown); pad.appendChild(bLeft); pad.appendChild(bRight);
        return { bUp, bDown, bLeft, bRight, pad };
    }

    /**
     * Create action buttons.
     * @returns {{bBubble: HTMLButtonElement, act: HTMLDivElement}}
     */
    function createActionButtons() {
        const act = document.createElement('div');
        act.style.position = 'absolute';
        act.style.right = '16px';
        act.style.bottom = '16px';
        act.style.width = '200px';
        act.style.height = '120px';
        act.style.pointerEvents = 'auto';
        const bBubble = createTouchButton('Bubble', 60, 0);
        bBubble.style.borderRadius = '12px';
        bBubble.style.width = '100px';
        bBubble.style.height = '60px';
        act.appendChild(bBubble);
        return { bBubble, act };
    }

    /**
     * Wire up dpad and action button inputs.
     * @param {Object} dpad
     * @param {Object} actions
     */
    function wireTouchButtons(dpad, actions) {
        attachTouchPress(dpad.bUp, () => window.input.up = true, () => window.input.up = false);
        attachTouchPress(dpad.bDown, () => window.input.down = true, () => window.input.down = false);
        attachTouchPress(dpad.bLeft, () => window.input.left = true, () => window.input.left = false);
        attachTouchPress(dpad.bRight, () => window.input.right = true, () => window.input.right = false);
        attachTouchPress(actions.bBubble, () => { try { if (world && world.character) world.character.shootBubble(); } catch (e) {} }, () => {});
    }

/**
 * Create touch overlay if it doesn't exist.
 */
function ensureTouchOverlay() {
        if (document.getElementById('touchOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'touchOverlay';
        ov.style.position = 'fixed';
        ov.style.left = '0';
        ov.style.top = '0';
        ov.style.width = '100%';
        ov.style.height = '100%';
        ov.style.pointerEvents = 'none';
        ov.style.display = 'none';
        ov.style.zIndex = '9000';
        ov.style.webkitTouchCallout = 'none';
        ov.style.webkitUserSelect = 'none';
        ov.style.userSelect = 'none';
        const dpad = createDpadButtons();
        const actions = createActionButtons();
        ov.appendChild(dpad.pad);
        ov.appendChild(actions.act);
        document.body.appendChild(ov);
        wireTouchButtons(dpad, actions);
        _touchButtons = { pad: dpad.pad, act: actions.act };
    }

/**
 * Tracks if no-scroll mode is active.
 * @type {boolean}
 */
let _noScrollActive = false;

/**
 * Touch mode resize handler reference.
 * @type {Function|null}
 */
let _touchResizeHandler = null;

/**
 * Touch mode orientation handler reference.
 * @type {Function|null}
 */
let _touchOrientHandler = null;

/**
 * Saved canvas style for restoration.
 * @type {Object|null}
 */
let _canvasPrevStyle = null;

/**
 * Check if device is in landscape orientation.
 * @returns {boolean}
 */
function isLandscape() { return (window.innerWidth || 0) >= (window.innerHeight || 0); }

/**
 * Create rotate overlay if it doesn't exist.
 */
function ensureRotateOverlay() {
        if (document.getElementById('rotateOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'rotateOverlay';
        ov.style.position = 'fixed'; ov.style.left = '0'; ov.style.top = '0'; ov.style.width = '100%'; ov.style.height = '100%';
        ov.style.display = 'none'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.8)'; ov.style.zIndex = '10020'; ov.style.color = 'white'; ov.style.pointerEvents = 'auto';
        const inner = document.createElement('div'); inner.style.textAlign = 'center'; inner.style.maxWidth = '80vw';
    const t = document.createElement('div'); t.innerText = 'Please rotate your device (landscape).'; t.style.fontSize = '20px'; t.style.marginBottom = '10px';
        inner.appendChild(t); ov.appendChild(inner); document.body.appendChild(ov);
    }

/**
 * Show the rotate device overlay.
 */
function showRotateOverlay() { ensureRotateOverlay(); const ov = document.getElementById('rotateOverlay'); if (ov) ov.style.display = 'flex'; }

/**
 * Hide the rotate device overlay.
 */
function hideRotateOverlay() { const ov = document.getElementById('rotateOverlay'); if (ov) ov.style.display = 'none'; }

/**
 * Enable or disable scroll prevention.
 * @param {boolean} on
 */
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

/**
 * Prevent default touch behavior when overlay is active.
 * @param {Event} e
 */
function _preventDefaultTouch(e) { if (window.__touchOverlayOn) { try { e.preventDefault(); } catch (err) {} } }

/**
 * Save current canvas style for later restoration.
 */
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

/**
 * Restore previously saved canvas style.
 */
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

/**
 * Resize canvas to fill the viewport.
 */
function resizeCanvasToViewport() {
        if (!canvas) return;
        canvas.style.position = 'fixed';
        canvas.style.left = '0'; canvas.style.top = '0';
        canvas.style.width = '100vw'; canvas.style.height = '100vh';
        canvas.style.zIndex = '0';
        try { canvas.width = window.innerWidth || 0; canvas.height = window.innerHeight || 0; } catch (e) {}
    }

/**
 * Enter fullscreen mode if supported.
 */
async function enterFullscreen() {
        try {
            const el = document.body || document.documentElement || canvas;
            if (el && el.requestFullscreen) {
                await el.requestFullscreen({ navigationUI: 'hide' });
            }
        } catch (e) {}
    }

/**
 * Exit fullscreen mode if active.
 */
async function exitFullscreen() {
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    }

/**
 * Attach resize and orientation listeners for touch mode.
 */
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

/**
 * Remove touch mode listeners.
 */
function detachTouchModeListeners() {
        try { if (_touchResizeHandler) window.removeEventListener('resize', _touchResizeHandler); } catch (e) {}
        try { if (_touchOrientHandler) window.removeEventListener('orientationchange', _touchOrientHandler); } catch (e) {}
        _touchResizeHandler = null; _touchOrientHandler = null;
    }

    /**
     * Enable touch overlay mode.
     */
    async function enableTouchMode() {
        if (!hasTouchCapability()) {
            console.log('Touch mode not available: no touch capability detected');
            return;
        }
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
    }

    /**
     * Disable touch overlay mode.
     */
    async function disableTouchMode() {
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

    /**
     * Toggle the touch overlay, fullscreen behavior and orientation enforcement.
     * @param {boolean} on
     */
    async function setTouchOverlayOn(on) {
        if (on && !hasTouchCapability()) {
            console.log('Cannot enable touch mode: device has no touch capability');
            window.__touchOverlayOn = false;
            try { const t = document.getElementById('touchToggle'); if (t) t.checked = false; } catch (e) {}
            return;
        }
        window.__touchOverlayOn = !!on;
        try { const t = document.getElementById('touchToggle'); if (t) t.checked = !!on; } catch (e) {}
        ensureRotateOverlay();
        const ov = document.getElementById('touchOverlay');
        if (ov) ov.style.display = on ? 'block' : 'none';
        if (on) {
            await enableTouchMode();
        } else {
            await disableTouchMode();
        }
    }
    
    /**
     * Detect if device is a mobile device (smartphone/tablet).
     * @returns {boolean}
     */
    function detectMobileDevice() {
        try {
            const vw = window.innerWidth || document.documentElement.clientWidth || 0;
            const vh = window.innerHeight || document.documentElement.clientHeight || 0;
            const smallScreen = (vw <= 768 && vh <= 1024) || (vh <= 768 && vw <= 1024);
            
            const ua = navigator.userAgent || '';
            const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
            
            const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            
            return smallScreen && (mobileUA || hasTouch);
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Detect if device has touch capabilities.
     * @returns {boolean}
     */
    function hasTouchCapability() {
        try {
            return ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Handle portrait orientation on mobile.
     */
    function handlePortraitMode() {
        showMobileRotatePrompt();
        if (typeof window.setTouchOverlayOn === 'function') {
            window.setTouchOverlayOn(false);
        }
    }

    /**
     * Handle landscape orientation on mobile.
     */
    function handleLandscapeMode() {
        hideMobileRotatePrompt();
        if (hasTouchCapability() && !window.__userAutoDisabled && typeof window.__userForcedTouch === 'undefined') {
            const touchToggle = document.getElementById('touchToggle');
            if (touchToggle) touchToggle.checked = true;
            if (typeof window.setTouchOverlayOn === 'function') {
                window.setTouchOverlayOn(true);
            }
        }
    }

    /**
     * Handle mobile orientation: show rotate prompt in portrait, enable touch mode in landscape.
     */
    function handleMobileOrientation() {
        try {
            if (!window.__isMobileDevice) return;
            const isPortrait = !isLandscape();
            if (isPortrait) {
                handlePortraitMode();
            } else {
                handleLandscapeMode();
            }
        } catch (e) {}
    }
    
    /**
     * Create rotate icon SVG.
     * @returns {HTMLDivElement}
     */
    function createRotateIcon() {
        const icon = document.createElement('div');
        icon.innerHTML = `
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                <path d="M12 18h.01"/>
            </svg>
        `;
        icon.style.cssText = `
            animation: rotateDevice 2s infinite;
            margin-bottom: 20px;
        `;
        return icon;
    }

    /**
     * Create rotate prompt text.
     * @returns {HTMLDivElement}
     */
    function createRotateText() {
        const text = document.createElement('div');
        text.innerHTML = '<h2 style="margin: 0 0 10px; font-size: 24px;">Bitte drehe dein Gerät</h2><p style="margin: 0; font-size: 16px; opacity: 0.8;">Für das beste Spielerlebnis nutze bitte den Querformat-Modus</p>';
        return text;
    }

    /**
     * Inject rotate animation CSS.
     */
    function injectRotateAnimation() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rotateDevice {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(90deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Ensure mobile rotate prompt overlay exists.
     */
    function ensureMobileRotatePrompt() {
        if (document.getElementById('mobileRotatePrompt')) return;
        const overlay = document.createElement('div');
        overlay.id = 'mobileRotatePrompt';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            flex-direction: column;
            padding: 20px;
            box-sizing: border-box;
        `;
        const content = document.createElement('div');
        content.style.cssText = `
            text-align: center;
            color: white;
            font-family: Arial, sans-serif;
        `;
        const icon = createRotateIcon();
        const text = createRotateText();
        content.appendChild(icon);
        content.appendChild(text);
        overlay.appendChild(content);
        injectRotateAnimation();
        document.body.appendChild(overlay);
    }
    
    /**
     * Show mobile rotate prompt overlay.
     */
    function showMobileRotatePrompt() {
        const overlay = document.getElementById('mobileRotatePrompt');
        if (overlay) overlay.style.display = 'flex';
    }
    
    /**
     * Hide mobile rotate prompt overlay.
     */
    function hideMobileRotatePrompt() {
        const overlay = document.getElementById('mobileRotatePrompt');
        if (overlay) overlay.style.display = 'none';
    }
    
    window.setTouchOverlayOn = setTouchOverlayOn;
    window.__touchOverlayOn = false;
    setTouchOverlayOn(false);
