// Highscores helper (localStorage-backed)
// Exposes: loadHighscores, saveHighscores, saveHighscoreRecord, getTopHighscores
(function () {
    function loadHighscores() {
        try {
            const raw = localStorage.getItem('sharkyHighscores');
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr;
        } catch (e) { return []; }
    }

    function saveHighscores(list) {
        try { localStorage.setItem('sharkyHighscores', JSON.stringify(list || [])); } catch (e) {}
    }

    function saveHighscoreRecord(rec) {
        try {
            // ensure record has finalScore computed (use provided or calculate)
            try {
                if (typeof calculateFinalScore === 'function') {
                    rec.finalScore = rec.finalScore || calculateFinalScore(rec.difficulty || 'normal', rec.score || 0, rec.timeMs || 0);
                } else {
                    rec.finalScore = rec.finalScore || (rec.score || 0);
                }
            } catch (e) { rec.finalScore = rec.finalScore || (rec.score || 0); }

            // If this is an Easy-mode record, save it separately and do not insert into the primary ranking.
            const isEasy = (rec && rec.difficulty && rec.difficulty.toString().toLowerCase() === 'easy');
            if (isEasy) {
                try {
                    const easyRaw = localStorage.getItem('sharkyHighscores_easy');
                    const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
                    easyList.push(rec);
                    // Sort by raw score desc; if equal, faster time ranks higher (1s faster beats like +10 points)
                    easyList.sort((a,b) => {
                        const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                        if (bs !== as) return bs - as;
                        return (a.timeMs || 0) - (b.timeMs || 0);
                    });
                    const cappedEasy = easyList.slice(0,50);
                    try { localStorage.setItem('sharkyHighscores_easy', JSON.stringify(cappedEasy)); } catch (e) {}
                    return cappedEasy;
                } catch (e) { return []; }
            }

            const list = loadHighscores();
            list.push(rec);
            // Sort by raw score desc; if equal, faster time ranks higher (1s faster beats like +10 points)
            list.sort((a,b) => {
                const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                if (bs !== as) return bs - as;
                return (a.timeMs || 0) - (b.timeMs || 0);
            });
            // cap to 50 entries
            const capped = list.slice(0,50);
            saveHighscores(capped);
            return capped;
        } catch (e) { return []; }
    }

    // Calculate a final score applying difficulty multiplier and a time penalty multiplier.
    // difficulty: 'easy' -> 0.5, 'normal' -> 1, 'hard' -> 1.5
    // time penalty: decreases score the longer the play time. We use a simple linear decay with a floor
    // so very long runs are not reduced to zero. Feel free to tune timeScale and minTimeFactor.
    function calculateFinalScore(difficulty, baseScore, timeMs) {
        try {
            const diff = (difficulty || 'normal').toString().toLowerCase();
            const diffMap = { easy: 0.5, normal: 1.0, hard: 1.5 };
            const dMul = diffMap[diff] || 1.0;
            const seconds = (timeMs || 0) / 1000;
            // timeScale controls how quickly score decays with time (in seconds). Larger -> slower decay.
            const timeScale = 180; // 3 minutes
            const minTimeFactor = 0.5; // never go below 50%
            // linear decay: 1 - (seconds / timeScale), clamped to [minTimeFactor, 1]
            let timeFactor = 1 - (seconds / timeScale);
            if (timeFactor < minTimeFactor) timeFactor = minTimeFactor;
            if (timeFactor > 1) timeFactor = 1;
            const final = Math.round((baseScore || 0) * dMul * timeFactor);
            return final;
        } catch (e) { return Math.round(baseScore || 0); }
    }

    // By default exclude easy-mode runs from the top ranking display.
    // Call getTopHighscores(n, true) to include Easy records.
    function getTopHighscores(n, includeEasy) {
        try {
            const list = loadHighscores() || [];
            const filtered = Array.isArray(list) ? list.filter(r => includeEasy === true ? true : ((r && r.difficulty) ? r.difficulty.toString().toLowerCase() !== 'easy' : true)) : [];
            // if caller requested includeEasy, merge easy list on top of filtered list
            if (includeEasy === true) {
                try {
                    const easyRaw = localStorage.getItem('sharkyHighscores_easy');
                    const easyList = easyRaw ? (JSON.parse(easyRaw) || []) : [];
                    // merge and sort overall
                    const merged = (easyList || []).concat(filtered || []);
                    merged.sort((a,b) => {
                        const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                        if (bs !== as) return bs - as;
                        return (a.timeMs || 0) - (b.timeMs || 0);
                    });
                    return merged.slice(0, n || 10);
                } catch (e) { /* fallback to filtered */ }
            }
            // Ensure filtered is sorted consistently even without easy entries merged
            filtered.sort((a,b) => {
                const as = (a.score || a.finalScore || 0); const bs = (b.score || b.finalScore || 0);
                if (bs !== as) return bs - as;
                return (a.timeMs || 0) - (b.timeMs || 0);
            });
            return filtered.slice(0, n || 10);
        } catch (e) { return []; }
    }

    // export to global scope
    window.loadHighscores = loadHighscores;
    window.saveHighscores = saveHighscores;
    window.saveHighscoreRecord = saveHighscoreRecord;
    window.getTopHighscores = getTopHighscores;
    window.calculateFinalScore = calculateFinalScore;
})();
