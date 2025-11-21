/**
 * HTML Templates for overlays and UI elements
 * All HTML markup is centralized here for better maintainability
 */

const Templates = {
    /**
     * How to Play overlay content
     * @returns {string} HTML string
     */
    getHowToPlayContent() {
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
    },

    /**
     * Game Over overlay content
     * @param {number} score - Player score
     * @param {number} secs - Time in seconds
     * @param {string} diff - Difficulty string
     * @returns {string} HTML string
     */
    getGameOverContent(score, secs, diff) {
        return `
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
    },

    /**
     * Victory overlay content
     * @param {number} score - Player score
     * @param {number} secs - Time in seconds
     * @param {string} diff - Difficulty string
     * @returns {string} HTML string
     */
    getVictoryContent(score, secs, diff) {
        return `
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
    },

    /**
     * Highscores overlay content
     * @returns {string} HTML string
     */
    getHighscoresContent() {
        return `
        <h3>High Scores</h3>
        <div id="hsList" class="highscores-list"></div>
        <div class="highscores-actions">
            <button id="hsRestartBtn">Restart</button>
            <button id="hsMenuBtn">Back to Menu</button>
        </div>
    `;
    },

    /**
     * Empty highscore list placeholder
     * @returns {string} HTML string
     */
    getEmptyHighscoreItem() {
        return '<div class="highscore-empty">-</div>';
    },

    /**
     * Rotation prompt overlay content (for mobile devices)
     * @returns {string} HTML string
     */
    getRotationPromptContent() {
        return '<h2>Bitte drehe dein Gerät</h2><p>Für das beste Spielerlebnis nutze bitte den Querformat-Modus</p>';
    },

    /**
     * SVG icon for rotation prompt
     * @returns {string} SVG HTML string
     */
    getRotationIcon() {
        return `
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <path d="M12 18h.01"/>
        </svg>
    `;
    }
};

