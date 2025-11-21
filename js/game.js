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

// Export globals
window._menuOpen = false;
window._endUiVisible = false;
window._victoryUiVisible = false;
window._suppressEndOverlayUntil = 0;

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
    window._menuOpen = false;
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
    window._menuOpen = true;
    try { BGM.ensureStarted(); BGM.hookAutoResume(); } catch (e) {}
    restoreAllSavedSettings();
}
window.showStartMenu = showStartMenu;

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
    _showGameUI();
    createAndConfigureWorld(canvas, mode, difficulty);
    hideStartMenu();
}

/**
 * Show game canvas and controls.
 * @private
 */
function _showGameUI() {
    const canvas = document.getElementById('gameCanvas');
    const controls = document.getElementById('controls');
    if (canvas) canvas.style.display = 'block';
    if (controls) controls.style.display = 'block';
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
            window.addEventListener('resize', _handleMobileResize);
            window.addEventListener('orientationchange', handleMobileOrientation);
        } else if (!isMobileDevice) {
            hideMobileRotatePrompt();
        }
    } catch (e) {}
}

/**
 * Handle resize events on mobile devices.
 * @private
 */
function _handleMobileResize() {
    handleMobileOrientation();
    _autoEnableTouchOnCapableDevices();
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
    _autoEnableTouchOnCapableDevices();
}

/**
 * Automatically enable touch controls on touch-capable devices or small screens.
 * @private
 */
function _autoEnableTouchOnCapableDevices() {
    const isMobileScreen = window.innerWidth <= 1024;
    if (hasTouchCapability() || isMobileScreen) {
        window.__userAutoDisabled = false;
        window.__userForcedTouch = true;
        if (typeof window.setTouchOverlayOn === 'function') {
            window.setTouchOverlayOn(true);
        }
        _tryEnterFullscreen();
    }
}

/**
 * Try to enter fullscreen mode.
 * @private
 */
function _tryEnterFullscreen() {
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen && !document.fullscreenElement) {
            elem.requestFullscreen().catch(() => {});
        }
    } catch (e) {}
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
    const suppressed = window._suppressEndOverlayUntil && now < window._suppressEndOverlayUntil;
    const hsEl = document.getElementById('highscoresUI');
    const hsOpen = !!(hsEl && hsEl.style.display !== 'none');
    if (window._menuOpen) {
        if (window._endUiVisible) hideGameOverUI();
        if (window._victoryUiVisible) hideVictoryUI();
    } else if (world && world.gameOver && !suppressed && !hsOpen) {
        if (!window._endUiVisible) showGameOverUI();
        if (window._victoryUiVisible) hideVictoryUI();
    } else if (world && world.victory && !suppressed && !hsOpen) {
        if (!window._victoryUiVisible) showVictoryUI();
        if (window._endUiVisible) hideGameOverUI();
    } else {
        if (window._endUiVisible) hideGameOverUI();
        if (window._victoryUiVisible) hideVictoryUI();
    }
}

