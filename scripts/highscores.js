/**
 * Highscores helper (localStorage-backed).
 * Exposes: loadHighscores, saveHighscores, saveHighscoreRecord, getTopHighscores
 */
(function () {
    /**
     * Load highscores from localStorage.
     * @returns {Array} Array of highscore records
     */
    function loadHighscores() {
        try {
            const raw = localStorage.getItem('sharkyHighscores');
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr;
        } catch (e) { return []; }
    }

    /**
     * Save highscores to localStorage.
     * @param {Array} list - Array of highscore records
     */
    function saveHighscores(list) {
        try { localStorage.setItem('sharkyHighscores', JSON.stringify(list || [])); } catch (e) {}
    }

    /**
     * Save a new highscore record.
     * @param {Object} rec - Highscore record
     */
    function saveHighscoreRecord(rec) {
        try {
            _ensureFinalScore(rec);
            const isEasy = _isEasyMode(rec);
            if (isEasy) {
                return _saveEasyHighscore(rec);
            }
            return _saveNormalHighscore(rec);
        } catch (e) { return []; }
    }

    /**
     * Ensure record has a final score calculated.
     * @param {Object} rec - Highscore record
     * @private
     */
    function _ensureFinalScore(rec) {
        try {
            if (typeof calculateFinalScore === 'function') {
                rec.finalScore = rec.finalScore || calculateFinalScore(rec.difficulty || 'normal', rec.score || 0, rec.timeMs || 0);
            } else {
                rec.finalScore = rec.finalScore || (rec.score || 0);
            }
        } catch (e) { rec.finalScore = rec.finalScore || (rec.score || 0); }
    }

    /**
     * Check if record is easy mode.
     * @param {Object} rec - Highscore record
     * @returns {boolean}
     * @private
     */
    function _isEasyMode(rec) {
        return (rec && rec.difficulty && rec.difficulty.toString().toLowerCase() === 'easy');
    }

    /**
     * Save easy mode highscore.
     * @param {Object} rec - Highscore record
     * @returns {Array} Updated highscore list
     * @private
     */
    function _saveEasyHighscore(rec) {
        try {
            const easyRaw = localStorage.getItem('sharkyHighscores_easy');
            const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
            easyList.push(rec);
            _sortHighscores(easyList);
            const cappedEasy = easyList.slice(0, 50);
            try { localStorage.setItem('sharkyHighscores_easy', JSON.stringify(cappedEasy)); } catch (e) {}
            return cappedEasy;
        } catch (e) { return []; }
    }

    /**
     * Save normal/hard mode highscore.
     * @param {Object} rec - Highscore record
     * @returns {Array} Updated highscore list
     * @private
     */
    function _saveNormalHighscore(rec) {
        const list = loadHighscores();
        list.push(rec);
        _sortHighscores(list);
        const capped = list.slice(0, 50);
        saveHighscores(capped);
        return capped;
    }

    /**
     * Sort highscores by score and time.
     * @param {Array} list - List to sort in place
     * @private
     */
    function _sortHighscores(list) {
        list.sort((a, b) => {
            const as = (a.score || a.finalScore || 0);
            const bs = (b.score || b.finalScore || 0);
            const at = Math.max(0, Math.round((a.timeMs || 0) / 1000));
            const bt = Math.max(0, Math.round((b.timeMs || 0) / 1000));
            const ae = as - at * 10;
            const be = bs - bt * 10;
            if (be !== ae) return be - ae;
            return (a.timeMs || 0) - (b.timeMs || 0);
        });
    }

    /**
     * Calculate final score based on difficulty and time.
     * @param {string} difficulty - Difficulty level
     * @param {number} baseScore - Base score
     * @param {number} timeMs - Time in milliseconds
     * @returns {number} Final calculated score
     */
    function calculateFinalScore(difficulty, baseScore, timeMs) {
        try {
            const dMul = _getDifficultyMultiplier(difficulty);
            const timeFactor = _getTimeFactor(timeMs);
            return Math.round((baseScore || 0) * dMul * timeFactor);
        } catch (e) { return Math.round(baseScore || 0); }
    }

    /**
     * Get difficulty multiplier for score calculation.
     * @param {string} difficulty - Difficulty level
     * @returns {number} Multiplier value
     * @private
     */
    function _getDifficultyMultiplier(difficulty) {
        const diff = (difficulty || 'normal').toString().toLowerCase();
        const diffMap = { easy: 0.5, normal: 1.0, hard: 1.5 };
        return diffMap[diff] || 1.0;
    }

    /**
     * Get time factor for score calculation.
     * @param {number} timeMs - Time in milliseconds
     * @returns {number} Time factor between 0.5 and 1.0
     * @private
     */
    function _getTimeFactor(timeMs) {
        const seconds = (timeMs || 0) / 1000;
        const timeScale = 180;
        const minTimeFactor = 0.5;
        let timeFactor = 1 - (seconds / timeScale);
        if (timeFactor < minTimeFactor) timeFactor = minTimeFactor;
        if (timeFactor > 1) timeFactor = 1;
        return timeFactor;
    }

    /**
     * Get top N highscores, optionally including easy mode.
     * @param {number} n - Number of scores to return
     * @param {boolean} includeEasy - Whether to include easy mode scores
     * @returns {Array} Top highscores
     */
    function getTopHighscores(n, includeEasy) {
        try {
            const filtered = _getFilteredHighscores(includeEasy);
            if (includeEasy === true) {
                return _getMergedHighscores(filtered, n);
            }
            _sortHighscores(filtered);
            return filtered.slice(0, n || 10);
        } catch (e) { return []; }
    }

    /**
     * Get filtered highscores based on easy mode inclusion.
     * @param {boolean} includeEasy - Whether to include easy mode
     * @returns {Array} Filtered highscores
     * @private
     */
    function _getFilteredHighscores(includeEasy) {
        const list = loadHighscores() || [];
        return Array.isArray(list) ? list.filter(r => includeEasy === true ? true : ((r && r.difficulty) ? r.difficulty.toString().toLowerCase() !== 'easy' : true)) : [];
    }

    /**
     * Get merged highscores including easy mode.
     * @param {Array} filtered - Filtered normal/hard scores
     * @param {number} n - Number of scores to return
     * @returns {Array} Merged and sorted highscores
     * @private
     */
    function _getMergedHighscores(filtered, n) {
        try {
            const easyRaw = localStorage.getItem('sharkyHighscores_easy');
            const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
            const merged = (easyList || []).concat(filtered || []);
            _sortHighscores(merged);
            return merged.slice(0, n || 10);
        } catch (e) {
            _sortHighscores(filtered);
            return filtered.slice(0, n || 10);
        }
    }

  
    window.loadHighscores = loadHighscores;
    window.saveHighscores = saveHighscores;
    window.saveHighscoreRecord = saveHighscoreRecord;
    window.getTopHighscores = getTopHighscores;
    window.calculateFinalScore = calculateFinalScore;
})();
