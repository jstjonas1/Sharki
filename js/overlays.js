/**
 * Overlay and UI management module.
 * Handles game over, victory, highscores, pause, and how-to overlays.
 */

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
 * @private
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
 * @param {HTMLDivElement} container
 * @param {number} score
 * @param {number} secs
 * @param {string} diff
 * @private
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
        const s = window.world ? (window.world.score || 0) : 0;
        const t = window.world ? (window.world._finalElapsedMs || window.world.elapsedMs || 0) : 0;
        const d = window.world ? (window.world.difficulty || 'normal') : 'normal';
        const reported = (d && d.toString().toLowerCase() === 'easy') ? Math.round(s * 0.5) : s;
        if (typeof saveHighscoreRecord === 'function') {
            saveHighscoreRecord({ name, score: reported, difficulty: d, timeMs: t, when: Date.now() });
        }
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
    window._endUiVisible = true;
}

/**
 * Hide the game over UI overlay.
 */
function hideGameOverUI() {
    const ov = document.getElementById('gameOverUI');
    if (ov) ov.style.display = 'none';
    window._endUiVisible = false;
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
 * @private
 */
function _getGameStats() {
    const score = window.world ? (window.world.score || 0) : 0;
    const secs = window.world ? Math.round((window.world._finalElapsedMs || window.world.elapsedMs || 0) / 1000) : 0;
    const diff = window.world ? (window.world.difficulty || 'normal') : 'normal';
    return { score, secs, diff };
}

/**
 * Append victory UI elements to container.
 * @param {HTMLDivElement} container
 * @param {number} score
 * @param {number} secs
 * @param {string} diff
 * @private
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
 * @param {HTMLInputElement} input
 * @private
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
        const s = window.world ? (window.world.score || 0) : 0;
        const t = window.world ? (window.world._finalElapsedMs || window.world.elapsedMs || 0) : 0;
        const d = window.world ? (window.world.difficulty || 'normal') : 'normal';
        const reported = (d && d.toString().toLowerCase() === 'easy') ? Math.round(s * 0.5) : s;
        if (typeof saveHighscoreRecord === 'function') {
            saveHighscoreRecord({ name, score: reported, difficulty: d, timeMs: t, when: Date.now() });
        }
        try { if (window.SFX) window.SFX.play('nicescore', 1); } catch (_) {}
        hideVictoryUI();
        showHighscoresUI();
    } catch (e) {}
}

/**
 * Show the victory UI overlay.
 */
function showVictoryUI() {
    const ov = buildOverlay('victoryUI');
    ov.innerHTML = '';
    const { inner, nameInput, confirmBtn } = createVictoryContent();
    ov.appendChild(inner);
    confirmBtn.addEventListener('click', () => handleVictoryConfirm(nameInput));
    ov.style.display = 'flex';
    window._victoryUiVisible = true;
}

/**
 * Hide the victory UI overlay.
 */
function hideVictoryUI() {
    const ov = document.getElementById('victoryUI');
    if (ov) ov.style.display = 'none';
    window._victoryUiVisible = false;
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
 * @param {HTMLElement} ov
 * @private
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
 * @private
 */
function _attachHighscoresHandlers() {
    document.getElementById('hsRestartBtn').addEventListener('click', _handleHighscoresRestart);
    document.getElementById('hsMenuBtn').addEventListener('click', _handleHighscoresToMenu);
}

/**
 * Handle highscores restart button click.
 * @private
 */
function _handleHighscoresRestart() {
    hideHighscoresUI();
    hideGameOverUI();
    hideVictoryUI();
    window._suppressEndOverlayUntil = Date.now() + 600;
    if (window.world) {
        window.world.gameOver = false;
        window.world.victory = false;
        window.world.restartGame();
    }
}

/**
 * Handle highscores back to menu button click.
 * @private
 */
function _handleHighscoresToMenu() {
    window._menuOpen = true;
    if (window.world) {
        window.world.gameOver = false;
        window.world.victory = false;
        window.world.running = false;
    }
    window._suppressEndOverlayUntil = Date.now() + 600;
    hideHighscoresUI();
    hideGameOverUI();
    hideVictoryUI();
    window.showStartMenu();
}

/**
 * Populate highscores list with data.
 * @private
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
 * @returns {Array}
 * @private
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
 * @param {HTMLElement} list
 * @param {Object} record
 * @param {number} index
 * @private
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
    const inner = document.createElement('div');
    inner.className = 'pause-inner';
    const t = document.createElement('div');
    t.className = 'pause-title';
    t.innerText = 'Paused';
    const btn = document.createElement('button');
    btn.innerText = 'Resume';
    btn.addEventListener('click', () => {
        try { if (window.world) window.world.paused = false; } catch(e){}
        hidePauseOverlay();
    });
    inner.appendChild(t);
    inner.appendChild(btn);
    ov.appendChild(inner);
    document.body.appendChild(ov);
}

/**
 * Show the pause overlay.
 */
function showPauseOverlay() {
    const ov = document.getElementById('pauseOverlay');
    if (ov) ov.style.display = 'flex';
}

/**
 * Hide the pause overlay.
 */
function hidePauseOverlay() {
    const ov = document.getElementById('pauseOverlay');
    if (ov) ov.style.display = 'none';
}

// Export to window
window.buildOverlay = buildOverlay;
window.showHowToOverlay = showHowToOverlay;
window.showGameOverUI = showGameOverUI;
window.hideGameOverUI = hideGameOverUI;
window.showVictoryUI = showVictoryUI;
window.hideVictoryUI = hideVictoryUI;
window.showHighscoresUI = showHighscoresUI;
window.hideHighscoresUI = hideHighscoresUI;
window.ensurePauseOverlay = ensurePauseOverlay;
window.showPauseOverlay = showPauseOverlay;
window.hidePauseOverlay = hidePauseOverlay;
