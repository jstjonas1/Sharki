/**
 * Game world: manages state, update loop, rendering, spawning, and interactions.
 */
class World {
  /** Draw a rounded rectangle path into a 2D context. */
  static _roundRect(ctx, x, y, w, h, r) {
    if (!ctx) return;
    const radius = typeof r === 'number' ? r : 6;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  /** Background light image paths; dark variants are derived at construction. */
  backgroundLightPaths = [
    './assets/img/sharki/3background/layers/5water/l.png',
    './assets/img/sharki/3background/layers/4fondo_2/l.png',
    './assets/img/sharki/3background/layers/3fondo_1/l.png',
    './assets/img/sharki/3background/layers/2floor/l.png',
    './assets/img/sharki/3background/layers/1light/completo.png'
  ];
  backgroundObjects = [];
  character  = new Character();
  enemies    = [];
  /** Game start timestamp (ms). */
  _startTime = null;
  elapsedMs = 0;
  /** Spawn configuration. */
  minEnemies = 15;
  maxEnemies = 25;
  /** Fraction of enemies that should be edible [0..1]. */
  minEdibleFraction = 0.3;
  /** Multiplier to increase requested spawn counts. */
  spawnMultiplier = 2;
  /** Per-second spawn rate limit. */
  spawnRateMaxPerSec = 5;
  /** Difficulty mode. */
  difficulty = 'normal'; // 'easy' | 'normal' | 'hard' | 'infinity'
  /** Enemy score cap when generating enemies. */
  enemyScoreCap = 120000;
  /** Boss trigger score threshold. */
  bossTriggerScore = 120000;
  /** Internal spawn window tracking. */
  _spawnWindowStart = Date.now();
  _spawnedInWindow = 0;
  spawnSide = 'random';
  bossActive = false;
  score = 2000;
  _spawnTimer = 0;
  _spawnInterval = 500; // ms between spawn attempts when below desired (halved to double spawn rate)
  bubbles = [];
  enemiesEaten = 0;
  /** UI & runtime state. */
  paused = false;
  _uiRects = { pause: null, touch: null };

  // constructor: initialize instance with canvas and options
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    try { this.ctx = canvas.getContext('2d'); } catch (e) { this.ctx = null; }
    this._lastTick = Date.now();
    this.running = false; // start only when start() called
    this._autoStart = !!(options.autoStart !== undefined ? options.autoStart : true);

    // create BackgroundObject instances with derived dark paths (prefer same-folder d.png or replace leading 'l'->'d')
    try {
      this.backgroundObjects = this.backgroundLightPaths.map(lp => {
        let dp = null;
        try {
          // if this is a layer path, prefer a sibling 'd.png' or replace a leading 'l' in filename with 'd'
          if (lp.indexOf('/layers/') !== -1) {
            const parts = lp.split('/');
            const fname = parts.pop();
            const folder = parts.join('/');
            if (folder.endsWith('/1light')) {
              // common case: 1light/completo.png -> dark/completo.png
              dp = lp.replace('/layers/1light/', '/dark/');
            } else if (/^l/.test(fname)) {
              dp = folder + '/' + fname.replace(/^l/, 'd');
            } else {
              dp = folder + '/d.png';
            }
          } else if (lp.indexOf('/1light/') !== -1) {
            dp = lp.replace('/1light/', '/dark/');
          } else {
            // fallback: try replacing 'l' prefix with 'd'
            dp = lp.replace(/\/(l)([^\/]*)$/, '/d$2');
          }
        } catch (err) { dp = lp; }
        return new BackgroundObject(lp, dp);
      });
    } catch (e) { this.backgroundObjects = []; }

    // initial population ramp (smoothly go from minEnemies -> initialTarget over duration)
    this._initialRampStart = Date.now();
    this._initialRampDuration = 10000; // ms to reach target
  this._initialRampTarget = 15; // desired enemies after ramp

  // key: restart on R after end-state
    try {
      this._kbdHandler = (ev) => {
        if (!ev) return;
        if ((ev.key === 'r' || ev.key === 'R') && (this.gameOver || this.victory)) {
          try { this.restartGame(); } catch (e) {}
        }
      };
      window.addEventListener('keydown', this._kbdHandler);
    } catch (e) {}

    // canvas UI: handle clicks on Pause button and Touch slider
    try {
      this._onCanvasPointer = (ev) => this._handleCanvasPointer(ev);
      this.canvas.addEventListener('pointerdown', this._onCanvasPointer);
    } catch (e) {}

    // position character in canvas center (use character size or defaults)
    try {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const cwid = (this.character && this.character.width) ? this.character.width : 32;
      const chei = (this.character && this.character.height) ? this.character.height : 48;
      this.character.x = Math.round((cw - cwid) / 2);
      this.character.y = Math.round((ch - chei) / 2);
    } catch (e) {}

    // ensure a quick initial population so at least ~15 enemies are visible early
    // do not populate instantly; allow ramp in update() to spawn smoothly
    if (this._autoStart) {
      this.start();
    }
  }

  // Clean up listeners to allow safe disposal/recreation
  destroy() {
    try { if (this._kbdHandler) window.removeEventListener('keydown', this._kbdHandler); } catch (e) {}
  try { if (this._onCanvasPointer) this.canvas.removeEventListener('pointerdown', this._onCanvasPointer); } catch (e) {}
    this.running = false;
  }

  // start the world's main loop (useful to defer until assets loaded)
  start() {
    if (this.running) return;
    this.running = true;
    this._lastTick = Date.now();
  // start/continue timer
  this._startTime = Date.now();
  this.elapsedMs = 0;
  // apply difficulty adjustments before the world starts spawning
  try { this.applyDifficultySettings(); } catch (e) {}
  // set starting score depending on difficulty (infinity starts higher)
  try { this.score = (this.difficulty === 'infinity') ? 10000 : 2000; } catch (e) { this.score = 2000; }
    requestAnimationFrame(() => this.gameLoop());
  }

  gameLoop() {
    const now = Date.now();
    const dt = now - (this._lastTick || now);
    this._lastTick = now;
  this.update(dt);
  this.draw();
    if (this.running) requestAnimationFrame(() => this.gameLoop());
  }

  update(dt) {
  // update timer before pausing for game over/victory
  try { if (this.running && !this.gameOver && !this.victory) { this.elapsedMs = (this.elapsedMs || 0) + dt; } } catch (e) {}
  if (this.gameOver || this.victory || this.paused) return; // pause updates when game over, victory, or paused
    // update character
  if (this.character && typeof this.character.update === 'function') this.character.update(dt);
    // update enemies
  this.enemies.forEach(e => { if (!e._dead && typeof e.update === 'function') e.update(dt); });
    // update bubbles and handle collisions
  this.bubbles.forEach(b => b.update(dt));

  // collision helpers (circle vs circle and circle vs rect)
    const circleCircleCollide = (a, b) => {
      if (!a || !b || typeof a.cx !== 'number' || typeof a.cy !== 'number' || typeof a.r !== 'number' || typeof b.cx !== 'number' || typeof b.cy !== 'number' || typeof b.r !== 'number') return false;
      const dx = a.cx - b.cx; const dy = a.cy - b.cy; const dist2 = dx * dx + dy * dy; const rsum = a.r + b.r; return dist2 <= rsum * rsum;
    };
    const circleRectCollide = (c, r) => {
      if (!c || !r || typeof c.cx !== 'number' || typeof c.cy !== 'number' || typeof c.r !== 'number') return false;
      // find closest point on rect to circle center
      const rx = r.x; const ry = r.y; const rw = r.width; const rh = r.height;
      const closestX = Math.max(rx, Math.min(c.cx, rx + rw));
      const closestY = Math.max(ry, Math.min(c.cy, ry + rh));
      const dx = c.cx - closestX; const dy = c.cy - closestY;
      return (dx * dx + dy * dy) <= (c.r * c.r);
    };

    // bubble vs enemy collision (use circle hitboxes when available)
    this.bubbles.forEach(b => {
      this.enemies.forEach(e => {
        if (e._dead) return;
        const hb = b.getHitBox ? b.getHitBox() : { x: b.x, y: b.y, width: b.width, height: b.height };
        const he = e.getHitBox ? e.getHitBox() : { x: e.x, y: e.y, width: e.width, height: e.height };
        let collided = false;
        // both circular
        if (typeof hb.cx === 'number' && typeof he.cx === 'number') collided = circleCircleCollide(hb, he);
        else if (typeof hb.cx === 'number') collided = circleRectCollide(hb, he);
        else if (typeof he.cx === 'number') collided = circleRectCollide(he, hb);
        else collided = (hb.x < he.x + he.width && hb.x + hb.width > he.x && hb.y < he.y + he.height && hb.y + hb.height > he.y);

        if (collided) {
          // If enemy is a Boss, call its takeDamage which counts hits; otherwise, normal damage
          if (e instanceof Boss) {
            if (typeof e.takeDamage === 'function') e.takeDamage(1);
          } else {
            if (typeof e.takeDamage === 'function') e.takeDamage(1);
            // normal enemies die through their health reaching zero
            if (e._dead) {
              // award score and count eaten only if the player later touches them; keep current behavior
            }
          }
          // mark bubble for immediate expiry
          try { b._born = 0; } catch (e) { b.life = 0; }
        }
      });
    });

    // enemy touches character: eat if player has >= enemy.score, otherwise GAME OVER overlay
    this.enemies.forEach(e => {
      if (e._dead) return;
  const hc = this.character.getHitBox ? this.character.getHitBox() : { x: this.character.x, y: this.character.y, width: this.character.width, height: this.character.height };
  const he = e.getHitBox ? e.getHitBox() : { x: e.x, y: e.y, width: e.width, height: e.height };
  let touch = false;
  // both circles
  if (typeof hc.cx === 'number' && typeof he.cx === 'number') touch = circleCircleCollide(hc, he);
  else if (typeof hc.cx === 'number') touch = circleRectCollide(hc, he);
  else if (typeof he.cx === 'number') touch = circleRectCollide(he, hc);
  else touch = (hc.x < he.x + he.width && hc.x + hc.width > he.x && hc.y < he.y + he.height && hc.y + hc.height > he.y);
  if (touch) {
        // if boss -> immediate heavy damage / game over
        if (e instanceof Boss) {
          // boss touch ends the game
          this.triggerGameOver();
        } else {
          // compare raw points
          if (this.score >= (e.score || 0)) {
            // eat: increase score by enemy.score and remove it
            e._dead = true;
            // track eaten enemies
            this.enemiesEaten = (this.enemiesEaten || 0) + 1;
            // play eat sound
            try { if (window.SFX) window.SFX.play('essen', 0.9); } catch (err) {}
            // calculate gained points depending on difficulty
            let baseFraction = 0.2;
            try {
              const d = (this.difficulty || 'normal').toString().toLowerCase();
              if (d === 'infinity') baseFraction = 0.025; // 2.5% in infinity mode
              else if (d === 'easy') baseFraction = 0.8; // Easy: 80% of enemy score
            } catch (e2) {}
            let gainedBase = Math.round((e.score || 0) * baseFraction);
            // apply world caps (Infinity mode increases world cap)
            const worldCap = (this.difficulty === 'infinity') ? 999999 : 120000;
            this.score = Math.min(worldCap, this.score + gainedBase);
            // visual size boost: +30% for 0.1s
            try {
              if (this.character) {
                this.character.visualSizeMultiplier = 1.3;
                this.character.visualSizeTimer = 100; // ms
              }
            } catch (err) {}
          } else {
            // player has fewer points -> game over overlay
            this.triggerGameOver();
          }
        }
      }
    });

    // remove dead enemies
    this.enemies = this.enemies.filter(e => !e._dead);
    // if boss fight was active and no boss remains -> player won
    if (this.bossActive) {
      const anyBoss = this.enemies.some(e => e instanceof Boss && !e._dead);
      if (!anyBoss) {
        // clear bossActive and trigger victory overlay
        this.bossActive = false;
        this.triggerVictory();
      }
    }
    // remove expired bubbles
    this.bubbles = this.bubbles.filter(b => !b.isExpired());

    // maintain enemy count when boss not active
    if (!this.bossActive) {
      // compute desired count; when in initial ramp, linearly increase to _initialRampTarget over _initialRampDuration
      let desired;
      if (this._initialRampStart && Date.now() - this._initialRampStart < this._initialRampDuration) {
        const t = (Date.now() - this._initialRampStart) / this._initialRampDuration;
        const rampTarget = Math.max(this.minEnemies, Math.min(this._initialRampTarget, this._initialRampTarget));
        const target = Math.round(this.minEnemies + (rampTarget - this.minEnemies) * t);
        // also add small random jitter
        desired = Math.min(this.maxEnemies, Math.max(this.minEnemies, target + Math.floor(Math.random()*2)));
      } else {
        // desired count is randomized each interval
        desired = Math.min(this.maxEnemies, Math.max(this.minEnemies, Math.floor(Math.random() * (this.maxEnemies - this.minEnemies + 1))));
      }
  // spawn gradually: use spawn timer
      if (this.enemies.length < desired) {
        this._spawnTimer += dt;
        while (this._spawnTimer >= this._spawnInterval && this.enemies.length < desired) {
          this._spawnTimer -= this._spawnInterval;
          this.populateEnemies(1);
        }
      } else {
        this._spawnTimer = 0;
      }
    }

    // scale character height by score: at 2000 -> 50px, at 100000 -> 250px
    const minScore = 2000, maxScore = 100000;
    const minH = 50, maxH = 250;
  // use centralized helper for exact same mapping as enemies
  const s = MovableObject.sizeFromScore(this.score);
  this.character.height = s.height;
  this.character.width = s.width;

  // ensure enemies sizes are consistent with their score mapping (so same-score => same-height)
  this.enemies.forEach(e => { if (typeof e.applySizeFromScore === 'function') e.applySizeFromScore(); });

    // boss fight trigger: only when the progress-to-boss bar reaches 100% (mapped to 120000 points)
    // Infinity mode has no boss — never trigger a boss fight there
    try {
      if (this.difficulty !== 'infinity' && !this.bossActive) {
        // progress mapping uses 2000 -> 0 and 120000 -> 1
        const _minScore = 2000;
        const _maxForProgress = 120000; // explicit 120k requirement for full progress
        const raw = (typeof this.score === 'number') ? this.score : 0;
        let pct = 0;
        if (raw <= _minScore) pct = 0;
        else if (raw >= _maxForProgress) pct = 1;
        else pct = (raw - _minScore) / (_maxForProgress - _minScore);
        pct = Math.max(0, Math.min(1, pct));
        // require the progress bar to be full (100%) and score to be at least 120000
        if (pct >= 1 && raw >= 120000) {
          this.startBossFight();
        }
      }
    } catch (e) {}
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.addObjectsToMap(this.backgroundObjects);
    // draw with drawTo if available to respect trims
    this.backgroundObjects.forEach(b => { if (typeof b.drawTo === 'function') b.drawTo(this.ctx); else this.addToMap(b); });
    this.enemies.forEach(e => { if (typeof e.drawTo === 'function') e.drawTo(this.ctx); else this.addToMap(e); });
    // draw boss health bar above boss(s)
    try {
      this.enemies.forEach(e => {
        if (e instanceof Boss && !e._dead) {
          const ctx = this.ctx;
          const barW = Math.max(60, e.width);
          const barH = 8;
          const bx = Math.round(e.x + (e.width - barW) / 2);
          const by = Math.round(e.y - barH - 10);
          // background
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
          // red health (based on remaining hits)
          const hitsLeft = (typeof e.health === 'number') ? e.health : (e.maxHealth || 20) - (e.hitCount || 0);
          const total = (typeof e.maxHealth === 'number') ? e.maxHealth : 20;
          const frac = Math.max(0, Math.min(1, hitsLeft / total));
          ctx.fillStyle = 'red';
          ctx.fillRect(bx, by, Math.round(barW * frac), barH);
          // border
          ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, barW, barH);
          ctx.restore();
        }
      });
    } catch (e) {}
    this.bubbles.forEach(b => { if (typeof b.drawTo === 'function') b.drawTo(this.ctx); else this.addToMap(b); });
    if (this.character) {
      if (typeof this.character.drawTo === 'function') this.character.drawTo(this.ctx); else this.addToMap(this.character);
    }

  // draw top-right UI: Pause button and Touch slider
  try { this._drawTopRightUi(this.ctx); } catch (e) {}

    // draw game over overlay if active
  if (this.gameOver) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // draw character centered larger
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2 - 40;
      const w = 160;
      const h = 160;
      if (this.character && this.character.img instanceof Image && this.character.img.complete) {
        try {
          ctx.drawImage(this.character.img, cx - w/2, cy - h/2, w, h);
        } catch (e) {}
      } else {
        ctx.fillStyle = 'white'; ctx.fillRect(cx - w/2, cy - h/2, w, h);
      }

      // draw a cross over the eye (approx at top-left quadrant of face)
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 6;
      const ex = cx + w*0.12;
      const ey = cy - h*0.12;
      const exs = 18;
      ctx.beginPath();
      ctx.moveTo(ex - exs, ey - exs);
      ctx.lineTo(ex + exs, ey + exs);
      ctx.moveTo(ex + exs, ey - exs);
      ctx.lineTo(ex - exs, ey + exs);
      ctx.stroke();

      // message
      ctx.fillStyle = 'white';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Du wurdest gefressen - Drücke R zum Neustart', cx, cy + h/2 + 40);
      // show final numeric score beneath the message
      ctx.font = '18px monospace';
      ctx.fillText('Erreichte Punktzahl: ' + (this.score || 0), cx, cy + h/2 + 70);
      ctx.restore();
    }

    // draw victory overlay if boss defeated
    if (this.victory) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // animate character pulsing slightly
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2 - 40;
      const baseW = 140; const baseH = 140;
      let pulse = 1;
      try {
        const t = Date.now() - (this._victoryStart || Date.now());
        pulse = 1 + 0.08 * Math.sin(t / 200);
      } catch (e) {}
      // draw character (use its img if available) with pulse scaling
      if (this.character && this.character.img instanceof Image && this.character.img.complete) {
        try {
          const w = Math.round(baseW * pulse);
          const h = Math.round(baseH * pulse);
          ctx.drawImage(this.character.img, cx - w/2, cy - h/2, w, h);
        } catch (e) {}
      } else {
        ctx.fillStyle = 'white'; ctx.fillRect(cx - baseW/2, cy - baseH/2, baseW, baseH);
      }

      // big 'Gewonnen' text
      ctx.fillStyle = 'gold';
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('You Win!', cx, cy + baseH/2 + 50);

      // show final numeric score beneath
      ctx.font = '20px monospace';
      ctx.fillStyle = 'white';
      ctx.fillText('Final Score: ' + (this.score || 0), cx, cy + baseH/2 + 80);

      ctx.restore();
    }

    // draw HUD (top-left): eaten count, current score, elapsed time and progress-to-boss bar
    try {
      const hudX = 12; const hudY = 12;
      const ctx2 = this.ctx;
      // compute formatted time mm:ss
      let totalSec = 0;
      try { totalSec = Math.max(0, Math.round((this.elapsedMs || 0) / 1000)); } catch (e) { totalSec = 0; }
      const mins = Math.floor(totalSec / 60); const secs = totalSec % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2,'0')}`;
      // HUD dimensions
      const boxW = 340;
      const boxH = 72; // extra room for progress bar
      ctx2.save();
      ctx2.fillStyle = 'rgba(0,0,0,0.5)';
      ctx2.fillRect(hudX - 6, hudY - 6, boxW, boxH);
      ctx2.fillStyle = 'white';
      ctx2.font = '14px sans-serif';
      ctx2.textAlign = 'left';
      ctx2.fillText('Gegessen: ' + (this.enemiesEaten || 0), hudX, hudY + 14);
      ctx2.fillText('Score: ' + (this.score || 0), hudX, hudY + 34);
  ctx2.fillText('Zeit: ' + timeStr, hudX + 200, hudY + 24);
  // show current mode/difficulty
  try { ctx2.fillText('Modus: ' + (this.difficulty || 'normal'), hudX + 200, hudY + 44); } catch (e) {}

      // progress-to-boss bar: map score 2000 -> 0, 120000 -> 1
      try {
        const minScore = 2000;
        // in infinity mode the progress bar reflects the larger soft-cap/boss threshold
        const maxScore = (this.difficulty === 'infinity') ? (this.bossTriggerScore || 999999) : 120000;
        const raw = (typeof this.score === 'number') ? this.score : (this.score || 0);
        let pct = 0;
        if (raw <= minScore) pct = 0; else if (raw >= maxScore) pct = 1; else pct = (raw - minScore) / (maxScore - minScore);
        pct = Math.max(0, Math.min(1, pct));
        const barX = hudX; const barY = hudY + 44; const barW = boxW - 24; const barH = 10;
        // background track
        ctx2.fillStyle = 'rgba(255,255,255,0.08)';
        World._roundRect(ctx2, barX, barY, barW, barH, 6);
        ctx2.fill();
        // filled portion with gradient
        const fillW = Math.round(barW * pct);
        if (fillW > 0) {
          const g = ctx2.createLinearGradient(barX, 0, barX + barW, 0);
          g.addColorStop(0, '#3ab0ff'); g.addColorStop(1, '#00e0a8');
          ctx2.fillStyle = g;
          World._roundRect(ctx2, barX, barY, fillW, barH, 6);
          ctx2.fill();
        }
        // percent text small
        ctx2.fillStyle = 'rgba(255,255,255,0.9)'; ctx2.font = '12px monospace'; ctx2.textAlign = 'right';
        ctx2.fillText(Math.round(pct * 100) + '%', barX + barW, barY + barH + 12);
      } catch (e) {}

      ctx2.restore();
    } catch (e) {}

  // (developer HUD removed)
  }

  triggerGameOver() {
  this.gameOver = true;
  // record final elapsed time for external UI
  try { this._finalElapsedMs = this.elapsedMs || 0; } catch (e) { this._finalElapsedMs = 0; }
  console.log('GAME OVER');
  }

  triggerVictory() {
  this.victory = true;
  // record final elapsed time for external UI (so saves show correct time)
  try { this._finalElapsedMs = this.elapsedMs || 0; } catch (e) { this._finalElapsedMs = 0; }
  this._victoryStart = Date.now();
  console.log('VICTORY!');
  }

  // restart the game: reset score, eaten count, enemies, bubbles and flags
  restartGame() {
    // reset basic state
  this.score = 2000;
  // reset timer
  this.elapsedMs = 0;
  this._finalElapsedMs = 0;
    this.enemiesEaten = 0;
    this.gameOver = false;
    this.victory = false;
    this.bossActive = false;
    // clear arrays
    this.enemies = [];
    this.bubbles = [];
    // reset ramp and spawn timers
    this._initialRampStart = Date.now();
    this._spawnTimer = 0;
    this._spawnWindowStart = Date.now();
    this._spawnedInWindow = 0;
    // reposition character to center
    try {
      const cw = this.canvas.width; const ch = this.canvas.height;
      const cwid = (this.character && this.character.width) ? this.character.width : 32;
      const chei = (this.character && this.character.height) ? this.character.height : 48;
      this.character.x = Math.round((cw - cwid) / 2);
      this.character.y = Math.round((ch - chei) / 2);
      // reset character state
      this.character.health = this.character.maxHealth || 100;
      this.character._attackCooldown = 0;
    } catch (e) {}
    // kick off population ramp
    this.populateEnemies(0);
    this.running = true;
  this._startTime = Date.now();
    if (!this._lastTick) this._lastTick = Date.now();
    console.log('Game restarted');
  }

  setDarkMode(enabled) {
    if (!this.backgroundObjects || !this.backgroundObjects.length) return;
    this.backgroundObjects.forEach(b => { if (typeof b.setDarkMode === 'function') b.setDarkMode(enabled); });
  }

  spawnBubble(x, y, dir = 1) {
    const b = new Bubble(x, y, dir);
    this.bubbles.push(b);
  }

  populateEnemies(count = null) {
    const baseNum = count || Math.floor(Math.random() * (this.maxEnemies - this.minEnemies + 1)) + this.minEnemies;
    const requested = Math.max(1, Math.round(baseNum * (this.spawnMultiplier || 1)));

    // enforce per-second spawn cap
    const now = Date.now();
    if (now - this._spawnWindowStart >= 1000) {
      this._spawnWindowStart = now;
      this._spawnedInWindow = 0;
    }
    const allowed = Math.max(0, (this.spawnRateMaxPerSec || 3) - this._spawnedInWindow);
    const num = Math.min(requested, allowed);
    if (num <= 0) return; // hit rate limit, skip spawning now
    this._spawnedInWindow += num;
  // derive current character-equivalent score from its height
  const minScore = 2000, maxScore = this.enemyScoreCap || 120000;
    const minH = 50, maxH = 250;
    const ch = (this.character && this.character.height) ? this.character.height : minH;
    const t = (ch - minH) / (maxH - minH);
    const charScoreEquivalent = Math.round(minScore + (maxScore - minScore) * Math.max(0, Math.min(1, t)));

    // count current edible enemies (exclude boss)
    const currentCount = this.enemies.filter(e => !(e instanceof Boss) && !e._dead).length;
    const currentEdible = this.enemies.filter(e => !(e instanceof Boss) && !e._dead && typeof e.score === 'number' && e.score <= charScoreEquivalent).length;

  const desiredTotal = currentCount + num;
  const frac = (typeof this.minEdibleFraction === 'number') ? this.minEdibleFraction : 0.3;
  const minEdibleNeeded = Math.ceil(frac * desiredTotal);
    let neededEdible = Math.max(0, minEdibleNeeded - currentEdible);

    for (let i = 0; i < num; i++) {
      // decide this enemy should be edible if we still need to meet the 30% target
      const makeEdible = neededEdible > 0;
      if (makeEdible) neededEdible--;

      // pick type and spawn side
      const type = Math.random() < 0.5 ? 'puffer' : 'jelly';
      const fromRight = Math.random() < 0.5;
      const y = Math.random() * (this.canvas.height - 60);

      // choose a score: edible -> <= charScoreEquivalent, non-edible -> > charScoreEquivalent
  const minEnemyScore = 200;
  const low = minEnemyScore;
  const high = this.enemyScoreCap || 120000;
      let scoreVal;
      if (makeEdible) {
        // uniform between low..charScoreEquivalent (but at least low)
        const upper = Math.max(low, Math.min(high, charScoreEquivalent));
        scoreVal = Math.floor(low + Math.random() * (Math.max(upper, low) - low + 1));
      } else {
        const lower = Math.max(low, charScoreEquivalent + 1);
        scoreVal = Math.floor(lower + Math.random() * (high - lower + 1));
      }

  if (type === 'puffer') {
        const p = new PufferFish();
        // assign a (mostly) unique speed factor so enemies differ visibly
        try { p.speedFactor = this.getUniqueEnemySpeed(); } catch (e) {}
        p.score = scoreVal;
        p.applySizeFromScore && p.applySizeFromScore();
        p.y = y;
        if (fromRight) { p.x = this.canvas.width + Math.random() * 200; p.vx = -1; }
        else { p.x = -Math.random() * 200 - p.width; p.vx = 1; }
        this.enemies.push(p);
  } else {
        const j = new JellyFish();
        // assign a (mostly) unique speed factor so enemies differ visibly
        try { j.speedFactor = this.getUniqueEnemySpeed(); } catch (e) {}
        j.score = scoreVal;
        j.applySizeFromScore && j.applySizeFromScore();
        j.y = y;
        if (fromRight) { j.x = this.canvas.width + Math.random() * 200; j.vx = -1; }
        else { j.x = -Math.random() * 200 - j.width; j.vx = 1; }
        this.enemies.push(j);
      }
    }
  }

  _drawTopRightUi(ctx) {
        if (!ctx) return;
        const pad = 10;
        const btnH = 30;
        const pauseW = 70; // "Pause" or "Weiter"
        const gap = 10;
        const sliderW = 90; // Touch: On/Off
        const x2 = this.canvas.width - pad;
        const y = pad;
        // Pause button rect
        const px = x2 - pauseW;
        const py = y;
        // Slider rect next to pause (left of it)
        const sx = px - gap - sliderW;
        const sy = y;
        // Store rects for hit-testing (canvas coordinates)
        this._uiRects.pause = { x: px, y: py, w: pauseW, h: btnH };
        this._uiRects.touch = { x: sx, y: sy, w: sliderW, h: btnH };

        // Draw Touch slider
        ctx.save();
        World._roundRect(ctx, sx, sy, sliderW, btnH, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
        const overlayOn = (typeof window !== 'undefined' && window.__touchOverlayOn) ? true : false;
        const knobW = Math.round(sliderW * 0.45);
        const knobPad = 3;
        const knobX = overlayOn ? (sx + sliderW - knobW - knobPad) : (sx + knobPad);
        const knobY = sy + knobPad;
        const knobH = btnH - knobPad * 2;
        World._roundRect(ctx, knobX, knobY, knobW, knobH, 6);
        ctx.fillStyle = overlayOn ? '#2ecc71' : '#7f8c8d';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(overlayOn ? 'Touch: ON' : 'Touch: OFF', sx + sliderW / 2, sy + btnH / 2);
        ctx.restore();

        // Draw Pause/Resume button
        ctx.save();
        World._roundRect(ctx, px, py, pauseW, btnH, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.paused ? 'Weiter' : 'Pause', px + pauseW / 2, py + btnH / 2);
        ctx.restore();
      }
  _handleCanvasPointer(ev) {
    try {
      if (!this._uiRects || (!this._uiRects.pause && !this._uiRects.touch)) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (ev.clientX - rect.left) * scaleX;
      const y = (ev.clientY - rect.top) * scaleY;
      const hit = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (hit(this._uiRects.pause)) {
        ev.preventDefault(); ev.stopPropagation();
        this.paused = !this.paused;
        try {
          if (this.paused && typeof window.showPauseOverlay === 'function') window.showPauseOverlay();
          if (!this.paused && typeof window.hidePauseOverlay === 'function') window.hidePauseOverlay();
        } catch (e) {}
        return;
      }
      if (hit(this._uiRects.touch)) {
        ev.preventDefault(); ev.stopPropagation();
        try {
          const current = !!window.__touchOverlayOn;
          const next = !current;
          // manual user interaction disables auto and sets explicit preference
          try { window.__userAutoDisabled = true; window.__userForcedTouch = next; } catch (e) {}
          if (typeof window.setTouchOverlayOn === 'function') window.setTouchOverlayOn(next);
          else window.__touchOverlayOn = next;
        } catch (e) { window.__touchOverlayOn = !window.__touchOverlayOn; }
        return;
      }
    } catch (e) {}
  }

  // apply difficulty-based settings: spawn multipliers, caps and special modes
  applyDifficultySettings() {
    try {
      const d = (this.difficulty || 'normal').toString().toLowerCase();
      // reset to defaults
      this.spawnMultiplier = 1;
      this.spawnRateMaxPerSec = 5;
      this.maxEnemies = 25;
      this.enemyScoreCap = 120000;
      this.bossTriggerScore = 120000;
      // per difficulty tweaks
      if (d === 'easy') {
        // fewer spawns, milder enemies
  this.spawnMultiplier = 0.9;
  this.spawnRateMaxPerSec = 6; // slightly higher rate so edible fish appear faster
  this.maxEnemies = 18;
  // in easy mode the character grows faster: shorten initial ramp duration and increase ramp target
  try { this._initialRampDuration = Math.max(3000, (this._initialRampDuration || 10000) * 0.4); this._initialRampTarget = Math.max(this._initialRampTarget || 15, Math.round((this._initialRampTarget || 15) * 1.25)); } catch (e) {}
  // make boss trigger lower so player reaches boss faster in easy mode
  this.bossTriggerScore = Math.max(30000, Math.round(this.bossTriggerScore * 0.4));
      } else if (d === 'hard') {
  // increase concurrent enemies and spawn rate for a denser experience
  // significantly raise spawn multiplier and per-second cap
  this.spawnMultiplier = 2.5;
  this.spawnRateMaxPerSec = 14;
  // allow many more simultaneous enemies on screen in hard mode
  this.maxEnemies = Math.max(60, Math.round((this.maxEnemies || 25) * 3));
  // slightly raise minimum to ensure baseline density
  try { this.minEnemies = Math.max(18, Math.round((this.minEnemies || 15) * 1.2)); } catch (e) {}
  // Hard mode: reduce edible fraction to 15% so more tough enemies roam
  try { this.minEdibleFraction = 0.15; } catch (e) {}
  // slow the initial growth so difficulty ramps gently (approx 5% of normal target growth)
  try { this._initialRampDuration = Math.max(15000, (this._initialRampDuration || 10000) * 1.5); this._initialRampTarget = Math.max(this._initialRampTarget || 15, Math.round((this._initialRampTarget || 15) * 0.95)); } catch (e) {}
      } else if (d === 'infinity') {
        // extreme mode: score cap raised, shark scales beyond usual, enemies capped lower
        this.spawnMultiplier = 2;
        this.spawnRateMaxPerSec = 12;
        this.maxEnemies = Math.max(40, this.maxEnemies * 2);
        this.enemyScoreCap = 130000; // enemy fish max at 130k
        this.bossTriggerScore = 999999; // boss triggers only at huge score
      } else {
        // normal
        this.spawnMultiplier = 1.25;
        this.spawnRateMaxPerSec = 5;
        this.maxEnemies = 25;
      }
    } catch (e) {}
  }

  // generate a speed factor for a newly spawned enemy in range [0.05,1.0]
  // tries to avoid values too close to existing enemies for visible variation
  getUniqueEnemySpeed() {
    const min = 0.05, max = 1.0, minDelta = 0.08;
    let attempts = 0;
    while (attempts < 60) {
      // bias towards extremes for greater visible spread
      const r = Math.random();
      const val = (r < 0.35) ? (min + Math.random() * (0.25 - min)) : (r > 0.65 ? (0.7 + Math.random() * (max - 0.7)) : (min + Math.random() * (max - min)));
      const conflict = this.enemies.some(e => (typeof e.speedFactor === 'number') && Math.abs(e.speedFactor - val) < minDelta);
      if (!conflict) return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
      attempts++;
    }
    // fallback: return a clamped random value (may collide)
    const v = min + Math.random() * (max - min);
    return Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  }

  startBossFight() {
    this.bossActive = true;
    // clear normal enemies
    this.enemies = [];
    // spawn boss at right edge
    const b = new Boss();
    b.x = this.canvas.width + 100;
    b.y = Math.max(0, (this.canvas.height - b.height) / 2);
    // boss moves left into screen
    b.vx = -0.6;
    this.enemies.push(b);
  }

  addToMap(mo) {
    if (!mo) return;
    if (mo.img instanceof Image ? mo.img.complete : false) {
      this.ctx.drawImage(mo.img, mo.x, mo.y, mo.width, mo.height);
    } else {
    this.ctx.fillStyle = 'rgba(255,0,0,.25)';
    this.ctx.fillRect(mo.x, mo.y, mo.width, mo.height);
    }
  }

  addObjectsToMap(objects) {
    const list = Array.isArray(objects) ? objects : [objects];
    list.forEach(o => this.addToMap(o));
  }
}
