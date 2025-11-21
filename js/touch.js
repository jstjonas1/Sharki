/**
 * Touch controls and mobile device handling module.
 * Manages touch overlay, fullscreen mode, and device orientation.
 */

/** Touch buttons reference. */
let _touchButtons = null;

/** Track if no-scroll mode is active. */
let _noScrollActive = false;

/** Touch mode resize handler reference. */
let _touchResizeHandler = null;

/** Touch mode orientation handler reference. */
let _touchOrientHandler = null;

/** Saved canvas style for restoration. */
let _canvasPrevStyle = null;

/**
 * Create touch button element.
 * @param {string} label
 * @param {number} x
 * @param {number} y
 * @returns {HTMLButtonElement}
 */
function createTouchButton(label, x, y) {
    const b = document.createElement('button');
    b.className = 'touch-button';
    b.innerText = label;
    b.style.left = x + 'px';
    b.style.top = y + 'px';
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
    pad.className = 'touch-dpad';
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
    act.className = 'touch-actions';
    const bBubble = createTouchButton('Bubble', 60, 0);
    bBubble.classList.add('touch-button-bubble');
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
    attachTouchPress(actions.bBubble, () => {
        try { if (window.world && window.world.character) window.world.character.shootBubble(); } catch (e) {}
    }, () => {});
}

/**
 * Create touch overlay if it doesn't exist.
 */
function ensureTouchOverlay() {
    if (document.getElementById('touchOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'touchOverlay';
    const dpad = createDpadButtons();
    const actions = createActionButtons();
    ov.appendChild(dpad.pad);
    ov.appendChild(actions.act);
    document.body.appendChild(ov);
    wireTouchButtons(dpad, actions);
    _touchButtons = { pad: dpad.pad, act: actions.act };
}

/**
 * Check if device is in landscape orientation.
 * @returns {boolean}
 */
function isLandscape() {
    return (window.innerWidth || 0) >= (window.innerHeight || 0);
}

/**
 * Create rotate overlay if it doesn't exist.
 */
function ensureRotateOverlay() {
    if (document.getElementById('rotateOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'rotateOverlay';
    const inner = document.createElement('div');
    inner.className = 'rotate-overlay-inner';
    const t = document.createElement('div');
    t.className = 'rotate-overlay-text';
    t.innerText = 'Please rotate your device (landscape).';
    inner.appendChild(t);
    ov.appendChild(inner);
    document.body.appendChild(ov);
}

/**
 * Show the rotate device overlay.
 */
function showRotateOverlay() {
    ensureRotateOverlay();
    const ov = document.getElementById('rotateOverlay');
    if (ov) ov.style.display = 'flex';
}

/**
 * Hide the rotate device overlay.
 */
function hideRotateOverlay() {
    const ov = document.getElementById('rotateOverlay');
    if (ov) ov.style.display = 'none';
}

/**
 * Enable or disable scroll prevention.
 * @param {boolean} on
 */
function setNoScroll(on) {
    const body = document.body;
    const html = document.documentElement;
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
 * @private
 */
function _preventDefaultTouch(e) {
    if (window.__touchOverlayOn) {
        try { e.preventDefault(); } catch (err) {}
    }
}

/**
 * Save current canvas style for later restoration.
 */
function saveCanvasStyle() {
    if (!window.canvas) return;
    _canvasPrevStyle = {
        position: window.canvas.style.position,
        left: window.canvas.style.left,
        top: window.canvas.style.top,
        width: window.canvas.style.width,
        height: window.canvas.style.height,
        zIndex: window.canvas.style.zIndex
    };
}

/**
 * Restore previously saved canvas style.
 */
function restoreCanvasStyle() {
    if (!window.canvas || !_canvasPrevStyle) return;
    const s = _canvasPrevStyle;
    _canvasPrevStyle = null;
    window.canvas.style.position = s.position || '';
    window.canvas.style.left = s.left || '';
    window.canvas.style.top = s.top || '';
    window.canvas.style.width = s.width || '';
    window.canvas.style.height = s.height || '';
    window.canvas.style.zIndex = s.zIndex || '';
}

/**
 * Resize canvas to fill the viewport.
 */
function resizeCanvasToViewport() {
    if (!window.canvas) return;
    window.canvas.style.position = 'fixed';
    window.canvas.style.left = '0';
    window.canvas.style.top = '0';
    window.canvas.style.width = '100vw';
    window.canvas.style.height = '100vh';
    window.canvas.style.zIndex = '0';
    try {
        window.canvas.width = window.innerWidth || 0;
        window.canvas.height = window.innerHeight || 0;
    } catch (e) {}
}

/**
 * Enter fullscreen mode if supported.
 */
async function enterFullscreen() {
    try {
        const el = document.body || document.documentElement || window.canvas;
        if (el && el.requestFullscreen) {
            await el.requestFullscreen({ navigationUI: 'hide' });
        }
    } catch (e) {}
}

/**
 * Exit fullscreen mode if active.
 */
async function exitFullscreen() {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
    } catch (e) {}
}

/**
 * Attach resize and orientation listeners for touch mode.
 */
function attachTouchModeListeners() {
    if (_touchResizeHandler || _touchOrientHandler) return;
    _touchResizeHandler = () => {
        if (!window.__touchOverlayOn) return;
        if (isLandscape()) {
            hideRotateOverlay();
            resizeCanvasToViewport();
        } else {
            showRotateOverlay();
            exitFullscreen();
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
    _touchResizeHandler = null;
    _touchOrientHandler = null;
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
        if (window.canvas) {
            window.canvas.width = 720;
            window.canvas.height = 480;
            window.canvas.style.width = '720px';
            window.canvas.style.height = '480px';
        }
    } catch (e) {}
}

/**
 * Check if touch mode is allowed based on capabilities and screen size.
 * @param {boolean} on
 * @returns {boolean}
 * @private
 */
function _isTouchModeAllowed(on) {
    if (!on) return true;
    const isMobileScreen = window.innerWidth <= 1024;
    return hasTouchCapability() || isMobileScreen;
}

/**
 * Toggle the touch overlay, fullscreen behavior and orientation enforcement.
 * @param {boolean} on
 */
async function setTouchOverlayOn(on) {
    if (!_isTouchModeAllowed(on)) {
        console.log('Cannot enable touch mode: no touch capability and not mobile screen');
        window.__touchOverlayOn = false;
        try { const t = document.getElementById('touchToggle'); if (t) t.checked = false; } catch (e) {}
        return;
    }
    _applyTouchOverlayState(on);
    if (on) await enableTouchMode();
    else await disableTouchMode();
}

/**
 * Apply touch overlay state to UI elements.
 * @param {boolean} on
 * @private
 */
function _applyTouchOverlayState(on) {
    window.__touchOverlayOn = !!on;
    try { const t = document.getElementById('touchToggle'); if (t) t.checked = !!on; } catch (e) {}
    ensureTouchOverlay();
    ensureRotateOverlay();
    const ov = document.getElementById('touchOverlay');
    if (ov) ov.style.display = on ? 'block' : 'none';
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
 * Handle mobile orientation changes.
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
 * Ensure mobile rotate prompt overlay exists.
 */
function ensureMobileRotatePrompt() {
    if (document.getElementById('mobileRotatePrompt')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mobileRotatePrompt';
    const content = document.createElement('div');
    content.className = 'rotate-prompt-content';
    const icon = document.createElement('div');
    icon.className = 'rotate-icon';
    icon.innerHTML = Templates.getRotationIcon();
    const text = document.createElement('div');
    text.className = 'rotate-text';
    text.innerHTML = Templates.getRotationPromptContent();
    content.appendChild(icon);
    content.appendChild(text);
    overlay.appendChild(content);
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

// Export to window
window.ensureTouchOverlay = ensureTouchOverlay;
window.setTouchOverlayOn = setTouchOverlayOn;
window.detectMobileDevice = detectMobileDevice;
window.hasTouchCapability = hasTouchCapability;
window.handleMobileOrientation = handleMobileOrientation;
window.ensureMobileRotatePrompt = ensureMobileRotatePrompt;
window.showMobileRotatePrompt = showMobileRotatePrompt;
window.hideMobileRotatePrompt = hideMobileRotatePrompt;
window.__touchOverlayOn = false;

// Initialize
setTouchOverlayOn(false);
