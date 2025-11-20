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
          
            try {
                if (typeof calculateFinalScore === 'function') {
                    rec.finalScore = rec.finalScore || calculateFinalScore(rec.difficulty || 'normal', rec.score || 0, rec.timeMs || 0);
                } else {
                    rec.finalScore = rec.finalScore || (rec.score || 0);
                }
            } catch (e) { rec.finalScore = rec.finalScore || (rec.score || 0); }

          
            const isEasy = (rec && rec.difficulty && rec.difficulty.toString().toLowerCase() === 'easy');
            if (isEasy) {
                try {
                    const easyRaw = localStorage.getItem('sharkyHighscores_easy');
                    const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
                    easyList.push(rec);
                  
                    easyList.sort((a,b) => {
                        const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                        const at = Math.max(0, Math.round((a.timeMs || 0) / 1000));
                        const bt = Math.max(0, Math.round((b.timeMs || 0) / 1000));
                        const ae = as - at * 10; const be = bs - bt * 10;
                        if (be !== ae) return be - ae;
                        return (a.timeMs || 0) - (b.timeMs || 0);
                    });
                    const cappedEasy = easyList.slice(0,50);
                    try { localStorage.setItem('sharkyHighscores_easy', JSON.stringify(cappedEasy)); } catch (e) {}
                    return cappedEasy;
                } catch (e) { return []; }
            }

            const list = loadHighscores();
            list.push(rec);
          
            list.sort((a,b) => {
                const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                const at = Math.max(0, Math.round((a.timeMs || 0) / 1000));
                const bt = Math.max(0, Math.round((b.timeMs || 0) / 1000));
                const ae = as - at * 10; const be = bs - bt * 10;
                if (be !== ae) return be - ae;
                return (a.timeMs || 0) - (b.timeMs || 0);
            });
          
            const capped = list.slice(0,50);
            saveHighscores(capped);
            return capped;
        } catch (e) { return []; }
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
            const diff = (difficulty || 'normal').toString().toLowerCase();
            const diffMap = { easy: 0.5, normal: 1.0, hard: 1.5 };
            const dMul = diffMap[diff] || 1.0;
            const seconds = (timeMs || 0) / 1000;
            const timeScale = 180;
            const minTimeFactor = 0.5;
            let timeFactor = 1 - (seconds / timeScale);
            if (timeFactor < minTimeFactor) timeFactor = minTimeFactor;
            if (timeFactor > 1) timeFactor = 1;
            const final = Math.round((baseScore || 0) * dMul * timeFactor);
            return final;
        } catch (e) { return Math.round(baseScore || 0); }
    }

    /**
     * Get top N highscores, optionally including easy mode.
     * @param {number} n - Number of scores to return
     * @param {boolean} includeEasy - Whether to include easy mode scores
     * @returns {Array} Top highscores
     */
    function getTopHighscores(n, includeEasy) {
        try {
            const list = loadHighscores() || [];
            const filtered = Array.isArray(list) ? list.filter(r => includeEasy === true ? true : ((r && r.difficulty) ? r.difficulty.toString().toLowerCase() !== 'easy' : true)) : [];
          
            if (includeEasy === true) {
                try {
                    const easyRaw = localStorage.getItem('sharkyHighscores_easy');
                    const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
                  
                    const merged = (easyList || []).concat(filtered || []);
                    merged.sort((a,b) => {
                        const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                        const at = Math.max(0, Math.round((a.timeMs || 0) / 1000));
                        const bt = Math.max(0, Math.round((b.timeMs || 0) / 1000));
                        const ae = as - at * 10; const be = bs - bt * 10;
                        if (be !== ae) return be - ae;
                        return (a.timeMs || 0) - (b.timeMs || 0);
                    });
                    return merged.slice(0, n || 10);
                } catch (e) { /* fallback to filtered */ }
            }
          
            filtered.sort((a,b) => {
                const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                const at = Math.max(0, Math.round((a.timeMs || 0) / 1000));
                const bt = Math.max(0, Math.round((b.timeMs || 0) / 1000));
                const ae = as - at * 10; const be = bs - bt * 10;
                if (be !== ae) return be - ae;
                return (a.timeMs || 0) - (b.timeMs || 0);
            });
            return filtered.slice(0, n || 10);
        } catch (e) { return []; }
    }

  
    window.loadHighscores = loadHighscores;
    window.saveHighscores = saveHighscores;
    window.saveHighscoreRecord = saveHighscoreRecord;
    window.getTopHighscores = getTopHighscores;
    window.calculateFinalScore = calculateFinalScore;
})();
