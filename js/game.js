
let canvas;
let world;

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // start screen wiring
    try {
        const startBtn = document.getElementById('startBtn');
        const startScreen = document.getElementById('startScreen');
        startBtn && startBtn.addEventListener('click', () => {
            // determine selected mode
            const sel = document.querySelector('input[name="startMode"]:checked');
            const isDark = sel && sel.value === 'dark';
            // create world and expose globally
            world = new World(canvas);
            window.world = world;
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
                if (saved !== null) {
                    darkToggle.checked = (saved === '1');
                }
            } catch (e) {}

            darkToggle.addEventListener('change', (ev) => {
                const isDark = !!ev.target.checked;
                if (window.world && typeof window.world.setDarkMode === 'function') window.world.setDarkMode(isDark);
                try { localStorage.setItem('sharkyDarkMode', isDark ? '1' : '0'); } catch (e) {}
            });
        }
    } catch (e) {}
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
        // prefer centralized restart if available
        try {
            if (typeof window.world.restartGame === 'function') {
                window.world.restartGame();
                return;
            }
        } catch (e) {}
        // fallback: manual reset (ensure enemiesEaten is reset too)
        window.world.gameOver = false;
        window.world.bossActive = false;
        window.world.score = 1000;
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
});

