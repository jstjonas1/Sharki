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
  character  = null;
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
  /** Difficulty mode: 'easy' | 'normal' | 'hard' | 'infinity'. */
  difficulty = 'normal';
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
  /** Spawn interval in milliseconds between spawn attempts when below desired count. */
  _spawnInterval = 500;
  bubbles = [];
  enemiesEaten = 0;
  /** UI & runtime state. */
  paused = false;
  _uiRects = { pause: null, touch: null };
  /**
   * Derive dark mode path from light path.
   * @param {string} lp - light path
   * @returns {string} dark path
   */
  _deriveDarkPath(lp) {
    try {
      if (lp.indexOf('/layers/') !== -1) return this._deriveDarkPathLayers(lp);
      if (lp.indexOf('/1light/') !== -1) return lp.replace('/1light/', '/dark/');
      return lp.replace(/\/(l)([^\/]*)$/, '/d$2');
    } catch (err) {
      return lp;
    }
  }

  /**
   * Derive dark path for layers structure.
   * @param {string} lp - light path
   * @returns {string} dark path
   * @private
   */
  _deriveDarkPathLayers(lp) {
    const parts = lp.split('/');
    const fname = parts.pop();
    const folder = parts.join('/');
    if (folder.endsWith('/1light')) return lp.replace('/layers/1light/', '/dark/');
    if (/^l/.test(fname)) return folder + '/' + fname.replace(/^l/, 'd');
    return folder + '/d.png';
  }

  /**
   * Initialize background objects.
   */
  _initBackgrounds() {
    try {
      this.backgroundObjects = this.backgroundLightPaths.map(lp => {
        const dp = this._deriveDarkPath(lp);
        return new BackgroundObject(lp, dp);
      });
    } catch (e) { this.backgroundObjects = []; }
  }

  /**
   * Setup keyboard handler for restart.
   */
  _setupKeyboardHandler() {
    try {
      this._kbdHandler = (ev) => {
        if (!ev) return;
        if ((ev.key === 'r' || ev.key === 'R') && (this.gameOver || this.victory)) {
          try { this.restartGame(); } catch (e) {}
        }
      };
      window.addEventListener('keydown', this._kbdHandler);
    } catch (e) {}
  }

  /**
   * Setup canvas pointer handler.
   */
  _setupCanvasPointer() {
    try {
      this._onCanvasPointer = (ev) => this._handleCanvasPointer(ev);
      this.canvas.addEventListener('pointerdown', this._onCanvasPointer);
    } catch (e) {}
  }

  /**
   * Position character in canvas center.
   */
  _positionCharacter() {
    try {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const cwid = (this.character && this.character.width) ? this.character.width : 32;
      const chei = (this.character && this.character.height) ? this.character.height : 48;
      this.character.x = Math.round((cw - cwid) / 2);
      this.character.y = Math.round((ch - chei) / 2);
    } catch (e) {}
  }

  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this._initializeCanvas();
    this._initializeState(options);
    this._initializeCharacter();
    this._initializeHandlers();
    if (this._autoStart) this.start();
  }

  /**
   * Initialize canvas context.
   * @private
   */
  _initializeCanvas() {
    try { this.ctx = this.canvas.getContext('2d'); } catch (e) { this.ctx = null; }
    this._lastTick = Date.now();
  }

  /**
   * Initialize world state.
   * @param {Object} options - World options
   * @private
   */
  _initializeState(options) {
    this.running = false;
    this._autoStart = !!(options.autoStart !== undefined ? options.autoStart : true);
    this._initialRampStart = Date.now();
    this._initialRampDuration = 10000;
    this._initialRampTarget = 15;
  }

  /**
   * Initialize character and backgrounds.
   * @private
   */
  _initializeCharacter() {
    this.character = new Character();
    this._initBackgrounds();
    this._positionCharacter();
  }

  /**
   * Initialize event handlers.
   * @private
   */
  _initializeHandlers() {
    this._setupKeyboardHandler();
    this._setupCanvasPointer();
  }

  /**
   * Clean up event listeners to allow safe disposal/recreation.
   */
  destroy() {
    try { if (this._kbdHandler) window.removeEventListener('keydown', this._kbdHandler); } catch (e) {}
  try { if (this._onCanvasPointer) this.canvas.removeEventListener('pointerdown', this._onCanvasPointer); } catch (e) {}
    this.running = false;
  }

  /**
   * Start the world's main game loop and initialize difficulty settings.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._lastTick = Date.now();
    this._startTime = Date.now();
    this.elapsedMs = 0;
    try { this.applyDifficultySettings(); } catch (e) {}
    try {
      const d = (this.difficulty || 'normal').toString().toLowerCase();
      if (d === 'infinity') this.score = 10000;
        else if (d === 'easy') this.score = 30000;
      else this.score = 2000;
    } catch (e) { this.score = 2000; }
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

  /**
   * Circle-to-circle collision detection.
   * @param {Object} a - First circle
   * @param {Object} b - Second circle
   * @returns {boolean}
   */
  _circleCircleCollide(a, b) {
    if (!a || !b || typeof a.cx !== 'number' || typeof a.cy !== 'number' || typeof a.r !== 'number' || typeof b.cx !== 'number' || typeof b.cy !== 'number' || typeof b.r !== 'number') return false;
    const dx = a.cx - b.cx;
    const dy = a.cy - b.cy;
    const dist2 = dx * dx + dy * dy;
    const rsum = a.r + b.r;
    return dist2 <= rsum * rsum;
  }

  /**
   * Circle-to-rectangle collision detection.
   * @param {Object} c - Circle
   * @param {Object} r - Rectangle
   * @returns {boolean}
   */
  _circleRectCollide(c, r) {
    if (!c || !r || typeof c.cx !== 'number' || typeof c.cy !== 'number' || typeof c.r !== 'number') return false;
    const rx = r.x;
    const ry = r.y;
    const rw = r.width;
    const rh = r.height;
    const closestX = Math.max(rx, Math.min(c.cx, rx + rw));
    const closestY = Math.max(ry, Math.min(c.cy, ry + rh));
    const dx = c.cx - closestX;
    const dy = c.cy - closestY;
    return (dx * dx + dy * dy) <= (c.r * c.r);
  }

  /**
   * Check collision between two hitboxes.
   * @param {Object} hb1 
   * @param {Object} hb2 
   * @returns {boolean}
   */
  _checkCollision(hb1, hb2) {
    if (typeof hb1.cx === 'number' && typeof hb2.cx === 'number') return this._circleCircleCollide(hb1, hb2);
    else if (typeof hb1.cx === 'number') return this._circleRectCollide(hb1, hb2);
    else if (typeof hb2.cx === 'number') return this._circleRectCollide(hb2, hb1);
    else return (hb1.x < hb2.x + hb2.width && hb1.x + hb1.width > hb2.x && hb1.y < hb2.y + hb2.height && hb1.y + hb1.height > hb2.y);
  }

  /**
   * Handle bubble hitting enemy.
   * @param {Object} e - Enemy
   * @param {Object} b - Bubble
   */
  _handleBubbleEnemyCollision(e, b) {
    if (e instanceof Boss) {
      if (typeof e.takeDamage === 'function') e.takeDamage(1);
    } else {
      if (typeof e.takeDamage === 'function') e.takeDamage(1);
    }
    try {
      b._born = 0;
    } catch (err) {
      b.life = 0;
    }
  }

  /**
   * Process all bubble-enemy collisions.
   */
  _processBubbleCollisions() {
    this.bubbles.forEach(b => {
      this.enemies.forEach(e => {
        if (e._dead) return;
        const hb = b.getHitBox ? b.getHitBox() : { x: b.x, y: b.y, width: b.width, height: b.height };
        const he = e.getHitBox ? e.getHitBox() : { x: e.x, y: e.y, width: e.width, height: e.height };
        const collided = this._checkCollision(hb, he);
        if (collided) {
          this._handleBubbleEnemyCollision(e, b);
        }
      });
    });
  }

  /**
   * Calculate score gain from eating enemy.
   * @param {number} enemyScore 
   * @returns {number}
   */
  _calculateScoreGain(enemyScore) {
    let baseFraction = 0.2;
    try {
      const d = (this.difficulty || 'normal').toString().toLowerCase();
      if (d === 'infinity') baseFraction = 0.025;
      else if (d === 'easy') baseFraction = 1.0;
    } catch (e2) {}
    return Math.round(enemyScore * baseFraction);
  }

  /**
   * Handle character eating an enemy.
   * @param {Object} e - Enemy
   */
  _handleEatEnemy(e) {
    e._dead = true;
    this.enemiesEaten = (this.enemiesEaten || 0) + 1;
    try {
      if (window.SFX) window.SFX.play('essen', 0.9);
    } catch (err) {}
    const gainedBase = this._calculateScoreGain(e.score || 0);
    const worldCap = (this.difficulty === 'infinity') ? 999999 : 120000;
    this.score = Math.min(worldCap, this.score + gainedBase);
    try {
      if (this.character) {
        this.character.visualSizeMultiplier = 1.3;
        this.character.visualSizeTimer = 100;
      }
    } catch (err) {}
  }

  /**
   * Process character-enemy collision.
   * @param {Object} e - Enemy
   */
  _processCharacterEnemyCollision(e) {
    const hc = this.character.getHitBox ? this.character.getHitBox() : { x: this.character.x, y: this.character.y, width: this.character.width, height: this.character.height };
    const he = e.getHitBox ? e.getHitBox() : { x: e.x, y: e.y, width: e.width, height: e.height };
    const touch = this._checkCollision(hc, he);
    if (!touch) return;
    if (e instanceof Boss) {
      this.triggerGameOver();
    } else {
      this._handleNormalEnemyCollision(e);
    }
  }

  /**
   * Handle collision with normal (non-boss) enemy.
   * @param {Object} e - Enemy
   * @private
   */
  _handleNormalEnemyCollision(e) {
    const enemyScore = (e.score || 0);
    const playerEffective = this._getEffectivePlayerScore();
    if (playerEffective >= enemyScore) {
      this._handleEatEnemy(e);
    } else {
      this.triggerGameOver();
    }
  }

  /**
   * Get effective player score (adjusted for difficulty).
   * @returns {number} Effective score
   * @private
   */
  _getEffectivePlayerScore() {
    try {
      if ((this.difficulty || 'normal').toString().toLowerCase() === 'easy') {
        return Math.round(this.score * 1.25);
      }
    } catch (_) {}
    return this.score;
  }

  /**
   * Process all character-enemy collisions.
   */
  _processCharacterCollisions() {
    this.enemies.forEach(e => {
      if (e._dead) return;
      this._processCharacterEnemyCollision(e);
    });
  }

  /**
   * Calculate desired enemy count with initial ramp.
   * @returns {number}
   */
  _calculateDesiredEnemies() {
    if (this._initialRampStart && Date.now() - this._initialRampStart < this._initialRampDuration) {
      const t = (Date.now() - this._initialRampStart) / this._initialRampDuration;
      const rampTarget = Math.max(this.minEnemies, Math.min(this._initialRampTarget, this._initialRampTarget));
      const target = Math.round(this.minEnemies + (rampTarget - this.minEnemies) * t);
      return Math.min(this.maxEnemies, Math.max(this.minEnemies, target + Math.floor(Math.random() * 2)));
    } else {
      return Math.min(this.maxEnemies, Math.max(this.minEnemies, Math.floor(Math.random() * (this.maxEnemies - this.minEnemies + 1))));
    }
  }

  /**
   * Update enemy spawning.
   * @param {number} dt 
   * @param {number} desired 
   */
  _updateSpawning(dt, desired) {
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

  /**
   * Update character and enemy sizes.
   */
  _updateSizes() {
    const s = MovableObject.sizeFromScore(this.score);
    this.character.height = s.height;
    this.character.width = s.width;
    this.enemies.forEach(e => {
      if (typeof e.applySizeFromScore === 'function') e.applySizeFromScore();
    });
  }

  /**
   * Check and trigger boss fight if conditions met.
   */
  _checkBossTrigger() {
    try {
      if (this.difficulty !== 'infinity' && !this.bossActive) {
        const _minScore = 2000;
        const _maxForProgress = 120000;
        const raw = (typeof this.score === 'number') ? this.score : 0;
        let pct = 0;
        if (raw <= _minScore) pct = 0;
        else if (raw >= _maxForProgress) pct = 1;
        else pct = (raw - _minScore) / (_maxForProgress - _minScore);
        pct = Math.max(0, Math.min(1, pct));
        if (pct >= 1 && raw >= 120000) {
          this.startBossFight();
        }
      }
    } catch (e) {}
  }

  /**
   * Update all game objects, handle collisions, and spawn logic.
   * @param {number} dt - Delta time in milliseconds
   */
  update(dt) {
    try {
      if (this.running && !this.gameOver && !this.victory) {
        this.elapsedMs = (this.elapsedMs || 0) + dt;
      }
    } catch (e) {}
    if (this.gameOver || this.victory || this.paused) return;
    if (this.character && typeof this.character.update === 'function') this.character.update(dt);
    this.enemies.forEach(e => {
      if (!e._dead && typeof e.update === 'function') e.update(dt);
    });
    this.bubbles.forEach(b => b.update(dt));
    this._processBubbleCollisions();
    this._processCharacterCollisions();
    this.enemies = this.enemies.filter(e => !e._dead);
    if (this.bossActive) {
      const anyBoss = this.enemies.some(e => e instanceof Boss && !e._dead);
      if (!anyBoss) {
        this.bossActive = false;
        this.triggerVictory();
      }
    }
    this.bubbles = this.bubbles.filter(b => !b.isExpired());
    if (!this.bossActive) {
      const desired = this._calculateDesiredEnemies();
      this._updateSpawning(dt, desired);
    }
    this._updateSizes();
    this._checkBossTrigger();
  }

  /**
   * Render all game objects, UI elements, and overlays to the canvas.
   */
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.addObjectsToMap(this.backgroundObjects);
    this._drawBackgrounds();
    this._drawEnemies();
    this._drawBossHealthUI();
    this._drawBubbles();
    this._drawCharacter();
    try { this._drawTopRightUi(this.ctx); } catch (e) {}
    this._drawGameOverOverlay();
    this._drawVictoryOverlay();
    this._drawHUD();
  }

  /**
   * Draw all background objects.
   */
  _drawBackgrounds() {
    this.backgroundObjects.forEach(b => { if (typeof b.drawTo === 'function') b.drawTo(this.ctx); else this.addToMap(b); });
  }

  /**
   * Draw all enemies.
   */
  _drawEnemies() {
    this.enemies.forEach(e => { if (typeof e.drawTo === 'function') e.drawTo(this.ctx); else this.addToMap(e); });
  }

  /**
   * Draw boss health bar UI if boss exists.
   */
  _drawBossHealthUI() {
    try {
      this.enemies.forEach(e => {
        if (e instanceof Boss && !e._dead) {
          const ctx = this.ctx;
          const barW = 150; const barH = 20; const padding = 10;
          const bx = this.canvas.width - barW - padding; const by = 50;
          this._renderBossHealthBar(ctx, bx, by, barW, barH, e);
        }
      });
    } catch (e) {}
  }

  /**
   * Render boss health bar at specified position.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} bx - Bar X position
   * @param {number} by - Bar Y position
   * @param {number} barW - Bar width
   * @param {number} barH - Bar height
   * @param {Boss} boss - Boss enemy instance
   */
  _renderBossHealthBar(ctx, bx, by, barW, barH, boss) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    const hitsLeft = (typeof boss.health === 'number') ? boss.health : (boss.maxHealth || 20) - (boss.hitCount || 0);
    const total = (typeof boss.maxHealth === 'number') ? boss.maxHealth : 20;
    const frac = Math.max(0, Math.min(1, hitsLeft / total));
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(bx, by, Math.round(barW * frac), barH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('BOSS', bx - 5, by + barH);
    ctx.restore();
  }

  /**
   * Draw all bubbles.
   */
  _drawBubbles() {
    this.bubbles.forEach(b => { if (typeof b.drawTo === 'function') b.drawTo(this.ctx); else this.addToMap(b); });
  }

  /**
   * Draw character.
   */
  _drawCharacter() {
    if (this.character) {
      if (typeof this.character.drawTo === 'function') this.character.drawTo(this.ctx); else this.addToMap(this.character);
    }
  }

  /**
   * Draw game over overlay with character and text.
   */
  _drawGameOverOverlay() {
    if (!this.gameOver) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const cx = this.canvas.width / 2; const cy = this.canvas.height / 2 - 40; const w = 160; const h = 160;
    this._drawGameOverCharacter(ctx, cx, cy, w, h);
    this._drawGameOverX(ctx, cx, cy, w, h);
    this._drawGameOverText(ctx, cx, cy, w, h);
    ctx.restore();
  }

  /**
   * Draw character image in game over overlay.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} w - Width
   * @param {number} h - Height
   */
  _drawGameOverCharacter(ctx, cx, cy, w, h) {
    if (this.character && this.character.img instanceof Image && this.character.img.complete) {
      try { ctx.drawImage(this.character.img, cx - w/2, cy - h/2, w, h); } catch (e) {}
    } else {
      ctx.fillStyle = 'white'; ctx.fillRect(cx - w/2, cy - h/2, w, h);
    }
  }

  /**
   * Draw red X over character in game over overlay.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} w - Width
   * @param {number} h - Height
   */
  _drawGameOverX(ctx, cx, cy, w, h) {
    ctx.strokeStyle = 'red'; ctx.lineWidth = 6;
    const ex = cx + w*0.12; const ey = cy - h*0.12; const exs = 18;
    ctx.beginPath();
    ctx.moveTo(ex - exs, ey - exs); ctx.lineTo(ex + exs, ey + exs);
    ctx.moveTo(ex + exs, ey - exs); ctx.lineTo(ex - exs, ey + exs);
    ctx.stroke();
  }

  /**
   * Draw game over text.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} w - Width
   * @param {number} h - Height
   */
  _drawGameOverText(ctx, cx, cy, w, h) {
    ctx.fillStyle = 'white'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('You were eaten', cx, cy + h/2 + 40);
    ctx.font = '18px monospace';
    ctx.fillText('Final Score: ' + (this.score || 0), cx, cy + h/2 + 70);
  }

  /**
   * Draw victory overlay with pulsing character.
   */
  _drawVictoryOverlay() {
    if (!this.victory) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const cx = this.canvas.width / 2; const cy = this.canvas.height / 2 - 40;
    const baseW = 140; const baseH = 140;
    const pulse = this._calculateVictoryPulse();
    this._drawVictoryCharacter(ctx, cx, cy, baseW, baseH, pulse);
    this._drawVictoryText(ctx, cx, cy, baseW, baseH);
    ctx.restore();
  }

  /**
   * Calculate pulsing scale for victory animation.
   * @returns {number} Pulse scale
   * @private
   */
  _calculateVictoryPulse() {
    try {
      const t = Date.now() - (this._victoryStart || Date.now());
      return 1 + 0.08 * Math.sin(t / 200);
    } catch (e) {
      return 1;
    }
  }

  /**
   * Draw pulsing character in victory overlay.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} baseW - Base width
   * @param {number} baseH - Base height
   * @param {number} pulse - Pulse scale
   */
  _drawVictoryCharacter(ctx, cx, cy, baseW, baseH, pulse) {
    if (this.character && this.character.img instanceof Image && this.character.img.complete) {
      try {
        const w = Math.round(baseW * pulse); const h = Math.round(baseH * pulse);
        ctx.drawImage(this.character.img, cx - w/2, cy - h/2, w, h);
      } catch (e) {}
    } else {
      ctx.fillStyle = 'white'; ctx.fillRect(cx - baseW/2, cy - baseH/2, baseW, baseH);
    }
  }

  /**
   * Draw victory text.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} baseW - Base width
   * @param {number} baseH - Base height
   */
  _drawVictoryText(ctx, cx, cy, baseW, baseH) {
    ctx.fillStyle = 'gold'; ctx.font = '40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('You Win!', cx, cy + baseH/2 + 50);
    ctx.font = '20px monospace'; ctx.fillStyle = 'white';
    ctx.fillText('Final Score: ' + (this.score || 0), cx, cy + baseH/2 + 80);
  }

  /**
   * Draw HUD with stats and progress bar.
   */
  _drawHUD() {
    try {
      const hudX = 12; const hudY = 12;
      const ctx2 = this.ctx;
      const timeStr = this._formatElapsedTime();
      const boxW = 340; const boxH = 72;
      this._drawHUDBackground(ctx2, hudX, hudY, boxW, boxH);
      this._drawHUDStats(ctx2, hudX, hudY, timeStr);
      this._drawHUDProgressBar(ctx2, hudX, hudY, boxW);
    } catch (e) {}
  }

  /**
   * Format elapsed time as MM:SS.
   * @returns {string} Formatted time string
   * @private
   */
  _formatElapsedTime() {
    try {
      const totalSec = Math.max(0, Math.round((this.elapsedMs || 0) / 1000));
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `${mins}:${secs.toString().padStart(2,'0')}`;
    } catch (e) {
      return '0:00';
    }
  }

  /**
   * Draw HUD background box.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} hudX - HUD X position
   * @param {number} hudY - HUD Y position
   * @param {number} boxW - Box width
   * @param {number} boxH - Box height
   */
  _drawHUDBackground(ctx, hudX, hudY, boxW, boxH) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hudX - 6, hudY - 6, boxW, boxH);
  }

  /**
   * Draw HUD stats text.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} hudX - HUD X position
   * @param {number} hudY - HUD Y position
   * @param {string} timeStr - Formatted time string
   */
  _drawHUDStats(ctx, hudX, hudY, timeStr) {
    ctx.fillStyle = 'white'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Eaten: ' + (this.enemiesEaten || 0), hudX, hudY + 14);
    ctx.fillText('Score: ' + (this.score || 0), hudX, hudY + 34);
    ctx.fillText('Time: ' + timeStr, hudX + 200, hudY + 24);
    try { ctx.fillText('Mode: ' + (this.difficulty || 'normal'), hudX + 200, hudY + 44); } catch (e) {}
  }

  /**
   * Draw HUD progress bar.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} hudX - HUD X position
   * @param {number} hudY - HUD Y position
   * @param {number} boxW - Box width
   */
  _drawHUDProgressBar(ctx, hudX, hudY, boxW) {
    try {
      const pct = this._calculateProgressPercentage();
      const barX = hudX; const barY = hudY + 44; const barW = boxW - 24; const barH = 10;
      this._renderProgressBarBackground(ctx, barX, barY, barW, barH);
      this._renderProgressBarFill(ctx, barX, barY, barW, barH, pct);
      this._renderProgressBarLabel(ctx, barX, barY, barW, barH, pct);
      ctx.restore();
    } catch (e) {}
  }

  /**
   * Calculate progress percentage from score.
   * @returns {number} Progress percentage (0-1)
   * @private
   */
  _calculateProgressPercentage() {
    const minScore = 2000;
    const maxScore = (this.difficulty === 'infinity') ? (this.bossTriggerScore || 999999) : 120000;
    const raw = (typeof this.score === 'number') ? this.score : (this.score || 0);
    let pct = 0;
    if (raw <= minScore) pct = 0; else if (raw >= maxScore) pct = 1; else pct = (raw - minScore) / (maxScore - minScore);
    return Math.max(0, Math.min(1, pct));
  }

  /**
   * Render progress bar background.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} barX - Bar X position
   * @param {number} barY - Bar Y position
   * @param {number} barW - Bar width
   * @param {number} barH - Bar height
   */
  _renderProgressBarBackground(ctx, barX, barY, barW, barH) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    World._roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();
  }

  /**
   * Render progress bar fill.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} barX - Bar X position
   * @param {number} barY - Bar Y position
   * @param {number} barW - Bar width
   * @param {number} barH - Bar height
   * @param {number} pct - Progress percentage
   */
  _renderProgressBarFill(ctx, barX, barY, barW, barH, pct) {
    const fillW = Math.round(barW * pct);
    if (fillW > 0) {
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, '#3ab0ff'); g.addColorStop(1, '#00e0a8');
      ctx.fillStyle = g;
      World._roundRect(ctx, barX, barY, fillW, barH, 6);
      ctx.fill();
    }
  }

  /**
   * Render progress bar percentage label.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} barX - Bar X position
   * @param {number} barY - Bar Y position
   * @param {number} barW - Bar width
   * @param {number} barH - Bar height
   * @param {number} pct - Progress percentage
   */
  _renderProgressBarLabel(ctx, barX, barY, barW, barH, pct) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(pct * 100) + '%', barX + barW, barY + barH + 12);
  }

  /**
   * Trigger game over state and play game over sound.
   */
  triggerGameOver() {
  this.gameOver = true;
  try { this._finalElapsedMs = this.elapsedMs || 0; } catch (e) { this._finalElapsedMs = 0; }
  try { if (window.SFX) window.SFX.play('naw', 1); } catch (_) {}
  }

  /**
   * Trigger victory state and play victory sound.
   */
  triggerVictory() {
  this.victory = true;
  try { this._finalElapsedMs = this.elapsedMs || 0; } catch (e) { this._finalElapsedMs = 0; }
  this._victoryStart = Date.now();
  try { if (window.SFX) window.SFX.play('wow', 1); } catch (_) {}
  }

  /**
   * Reset game state and restart.
   */
  restartGame() {
    this._resetScore();
    this._resetGameState();
    this._resetCharacter();
    this.populateEnemies(0);
    this.running = true;
    this._startTime = Date.now();
    if (!this._lastTick) this._lastTick = Date.now();
  }

  /**
   * Reset score based on difficulty.
   */
  _resetScore() {
    try {
      const d = (this.difficulty || 'normal').toString().toLowerCase();
      if (d === 'infinity') this.score = 10000;
      else if (d === 'easy') this.score = 30000;
      else this.score = 2000;
    } catch (_) { this.score = 2000; }
  }

  /**
   * Reset game state variables.
   */
  _resetGameState() {
    this.elapsedMs = 0; this._finalElapsedMs = 0; this.enemiesEaten = 0;
    this.gameOver = false; this.victory = false; this.bossActive = false;
    this.enemies = []; this.bubbles = [];
    this._initialRampStart = Date.now(); this._spawnTimer = 0;
    this._spawnWindowStart = Date.now(); this._spawnedInWindow = 0;
  }

  /**
   * Reset character position and health.
   */
  _resetCharacter() {
    try {
      const cw = this.canvas.width; const ch = this.canvas.height;
      const cwid = (this.character && this.character.width) ? this.character.width : 32;
      const chei = (this.character && this.character.height) ? this.character.height : 48;
      this.character.x = Math.round((cw - cwid) / 2);
      this.character.y = Math.round((ch - chei) / 2);
      this.character.health = this.character.maxHealth || 100;
      this.character._attackCooldown = 0;
    } catch (e) {}
  }

  /**
   * Toggle dark mode for all background objects.
   * @param {boolean} enabled - Whether dark mode should be enabled
   */
  setDarkMode(enabled) {
    if (!this.backgroundObjects || !this.backgroundObjects.length) return;
    this.backgroundObjects.forEach(b => { if (typeof b.setDarkMode === 'function') b.setDarkMode(enabled); });
  }

  /**
   * Spawn a bubble projectile.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} dir - Direction (1 for right, -1 for left)
   */
  spawnBubble(x, y, dir = 1) {
    const b = new Bubble(x, y, dir);
    this.bubbles.push(b);
  }

  /**
   * Populate the world with enemies based on difficulty settings.
   * @param {number|null} count - Optional specific count, otherwise uses min/max range
   */
  populateEnemies(count = null) {
    const baseNum = count || Math.floor(Math.random() * (this.maxEnemies - this.minEnemies + 1)) + this.minEnemies;
    const requested = Math.max(1, Math.round(baseNum * (this.spawnMultiplier || 1)));
    const num = this._checkSpawnRate(requested);
    if (num <= 0) return;
    const charScoreEquivalent = this._calculateCharacterScoreEquivalent();
    const neededEdible = this._calculateNeededEdible(num, charScoreEquivalent);
    this._spawnEnemies(num, neededEdible, charScoreEquivalent);
  }

  /**
   * Check spawn rate limit and return allowed count.
   * @param {number} requested - Requested spawn count
   * @returns {number} Allowed spawn count
   */
  _checkSpawnRate(requested) {
    const now = Date.now();
    if (now - this._spawnWindowStart >= 1000) {
      this._spawnWindowStart = now;
      this._spawnedInWindow = 0;
    }
    const allowed = Math.max(0, (this.spawnRateMaxPerSec || 3) - this._spawnedInWindow);
    const num = Math.min(requested, allowed);
    this._spawnedInWindow += num;
    return num;
  }

  /**
   * Calculate character score equivalent based on size.
   * @returns {number} Character score equivalent
   */
  _calculateCharacterScoreEquivalent() {
    const minScore = 2000, maxScore = this.enemyScoreCap || 120000;
    const minH = 50, maxH = 250;
    const ch = (this.character && this.character.height) ? this.character.height : minH;
    const t = (ch - minH) / (maxH - minH);
    return Math.round(minScore + (maxScore - minScore) * Math.max(0, Math.min(1, t)));
  }

  /**
   * Calculate how many edible enemies are needed.
   * @param {number} num - Number of enemies to spawn
   * @param {number} charScoreEquivalent - Character score equivalent
   * @returns {number} Number of edible enemies needed
   */
  _calculateNeededEdible(num, charScoreEquivalent) {
    const currentCount = this.enemies.filter(e => !(e instanceof Boss) && !e._dead).length;
    const currentEdible = this.enemies.filter(e => !(e instanceof Boss) && !e._dead && typeof e.score === 'number' && e.score <= charScoreEquivalent).length;
    const desiredTotal = currentCount + num;
    const frac = (typeof this.minEdibleFraction === 'number') ? this.minEdibleFraction : 0.3;
    const minEdibleNeeded = Math.ceil(frac * desiredTotal);
    return Math.max(0, minEdibleNeeded - currentEdible);
  }

  /**
   * Spawn enemies with given constraints.
   * @param {number} num - Number to spawn
   * @param {number} neededEdible - Edible count needed
   * @param {number} charScoreEquivalent - Character score equivalent
   */
  _spawnEnemies(num, neededEdible, charScoreEquivalent) {
    let edibleLeft = neededEdible;
    for (let i = 0; i < num; i++) {
      const makeEdible = edibleLeft > 0;
      if (makeEdible) edibleLeft--;
      const type = Math.random() < 0.5 ? 'puffer' : 'jelly';
      const enemy = this._createEnemy(type, makeEdible, charScoreEquivalent);
      this.enemies.push(enemy);
    }
  }

  /**
   * Create a single enemy with given parameters.
   * @param {string} type - 'puffer' or 'jelly'
   * @param {boolean} makeEdible - Whether enemy should be edible
   * @param {number} charScoreEquivalent - Character score equivalent
   * @returns {Object} Enemy instance
   */
  _createEnemy(type, makeEdible, charScoreEquivalent) {
    const enemy = this._instantiateEnemy(type);
    const scoreVal = this._calculateEnemyScore(makeEdible, charScoreEquivalent);
    this._configureEnemy(enemy, scoreVal);
    return enemy;
  }

  /**
   * Instantiate enemy of specified type.
   * @param {string} type - 'puffer' or 'jelly'
   * @returns {Object} Enemy instance
   * @private
   */
  _instantiateEnemy(type) {
    return (type === 'puffer') ? new PufferFish() : new JellyFish();
  }

  /**
   * Configure enemy with score, position, and speed.
   * @param {Object} enemy - Enemy instance
   * @param {number} scoreVal - Score value
   * @private
   */
  _configureEnemy(enemy, scoreVal) {
    try { enemy.speedFactor = this.getUniqueEnemySpeed(); } catch (e) {}
    enemy.score = scoreVal;
    enemy.applySizeFromScore && enemy.applySizeFromScore();
    enemy.y = Math.random() * (this.canvas.height - 60);
    const fromRight = Math.random() < 0.5;
    this._positionEnemy(enemy, fromRight);
  }

  /**
   * Calculate enemy score based on edibility.
   * @param {boolean} makeEdible - Whether enemy is edible
   * @param {number} charScoreEquivalent - Character score equivalent
   * @returns {number} Enemy score
   */
  _calculateEnemyScore(makeEdible, charScoreEquivalent) {
    const minEnemyScore = 200;
    const low = minEnemyScore;
    const high = this.enemyScoreCap || 120000;
    if (makeEdible) {
      const upper = Math.max(low, Math.min(high, charScoreEquivalent));
      return Math.floor(low + Math.random() * (Math.max(upper, low) - low + 1));
    } else {
      const lower = Math.max(low, charScoreEquivalent + 1);
      return Math.floor(lower + Math.random() * (high - lower + 1));
    }
  }

  /**
   * Position enemy on left or right side.
   * @param {Object} enemy - Enemy instance
   * @param {boolean} fromRight - Whether to spawn from right side
   */
  _positionEnemy(enemy, fromRight) {
    if (fromRight) { enemy.x = this.canvas.width + Math.random() * 200; enemy.vx = -1; }
    else { enemy.x = -Math.random() * 200 - enemy.width; enemy.vx = 1; }
  }

  /**
   * Draw top-right UI buttons (pause only).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  _drawTopRightUi(ctx) {
    if (!ctx) return;
    const {btnH, pauseW, x2, y} = this._getTopRightUiLayout();
    this._drawTopRightPauseOnly(ctx, x2, y, pauseW, btnH);
  }

  /**
   * Get layout parameters for top-right UI.
   * @returns {Object} Layout parameters
   * @private
   */
  _getTopRightUiLayout() {
    return {
      pad: 10, btnH: 30, pauseW: 70,
      x2: this.canvas.width - 10, y: 10
    };
  }

  /**
   * Draw top-right UI with pause only.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x2 - Right edge X
   * @param {number} y - Y position
   * @param {number} pauseW - Pause button width
   * @param {number} btnH - Button height
   * @private
   */
  _drawTopRightPauseOnly(ctx, x2, y, pauseW, btnH) {
    const px = x2 - pauseW; const py = y;
    this._uiRects.pause = { x: px, y: py, w: pauseW, h: btnH };
    this._drawPauseButton(ctx, px, py, pauseW, btnH);
  }

  /**
   * Draw pause button.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} px - Button X
   * @param {number} py - Button Y
   * @param {number} pauseW - Button width
   * @param {number} btnH - Button height
   */
  _drawPauseButton(ctx, px, py, pauseW, btnH) {
    ctx.save();
    World._roundRect(ctx, px, py, pauseW, btnH, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.paused ? 'Resume' : 'Pause', px + pauseW / 2, py + btnH / 2);
    ctx.restore();
  }

  /**
   * Handle canvas pointer events (clicking pause button).
   * @param {PointerEvent} ev - Pointer event
   */
  _handleCanvasPointer(ev) {
    try {
      if (!this._uiRects || !this._uiRects.pause) return;
      const {hit} = this._getPointerCoordinates(ev);
      if (hit(this._uiRects.pause)) return this._handlePauseClick(ev);
    } catch (e) {}
  }

  /**
   * Get pointer coordinates and hit test function.
   * @param {PointerEvent} ev - Pointer event
   * @returns {Object} Coordinates and hit test
   */
  _getPointerCoordinates(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    const hit = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    return {x, y, hit};
  }

  /**
   * Handle pause button click.
   * @param {PointerEvent} ev - Pointer event
   */
  _handlePauseClick(ev) {
    ev.preventDefault(); ev.stopPropagation();
    this.paused = !this.paused;
    try {
      if (this.paused && typeof window.showPauseOverlay === 'function') window.showPauseOverlay();
      if (!this.paused && typeof window.hidePauseOverlay === 'function') window.hidePauseOverlay();
    } catch (e) {}
  }

  /**
   * Apply difficulty-specific spawn and game settings.
   */
  applyDifficultySettings() {
    try {
      const d = (this.difficulty || 'normal').toString().toLowerCase();
      this._setDefaultDifficultySettings();
      if (d === 'easy') this._applyEasySettings();
      else if (d === 'hard') this._applyHardSettings();
      else if (d === 'infinity') this._applyInfinitySettings();
      else this._applyNormalSettings();
    } catch (e) {}
  }

  /**
   * Set default difficulty settings.
   */
  _setDefaultDifficultySettings() {
    this.spawnMultiplier = 1;
    this.spawnRateMaxPerSec = 5;
    this.maxEnemies = 25;
    this.enemyScoreCap = 120000;
    this.bossTriggerScore = 120000;
  }

  /**
   * Apply easy mode settings.
   */
  _applyEasySettings() {
    try { this.minEdibleFraction = 0.6; } catch (e) {}
    this.spawnMultiplier = 0.8; this.spawnRateMaxPerSec = 4; this.maxEnemies = 16; this.enemyScoreCap = 90000;
    try {
      this._initialRampDuration = Math.max(3000, Math.round((this._initialRampDuration || 10000) * 0.5));
      this._initialRampTarget = Math.max(18, Math.round((this._initialRampTarget || 15) * 1.2));
    } catch (e) {}
    this.bossTriggerScore = 120000;
  }

  /**
   * Apply hard mode settings.
   */
  _applyHardSettings() {
    this.spawnMultiplier = 2.5; this.spawnRateMaxPerSec = 14;
    this.maxEnemies = Math.max(60, Math.round((this.maxEnemies || 25) * 3));
    try { this.minEnemies = Math.max(18, Math.round((this.minEnemies || 15) * 1.2)); } catch (e) {}
    try { this.minEdibleFraction = 0.15; } catch (e) {}
    try {
      this._initialRampDuration = Math.max(15000, (this._initialRampDuration || 10000) * 1.5);
      this._initialRampTarget = Math.max(this._initialRampTarget || 15, Math.round((this._initialRampTarget || 15) * 0.95));
    } catch (e) {}
  }

  /**
   * Apply infinity mode settings.
   */
  _applyInfinitySettings() {
    this.spawnMultiplier = 2; this.spawnRateMaxPerSec = 12;
    this.maxEnemies = Math.max(40, this.maxEnemies * 2);
    this.enemyScoreCap = 130000;
    this.bossTriggerScore = 999999;
  }

  /**
   * Apply normal mode settings.
   */
  _applyNormalSettings() {
    this.spawnMultiplier = 1.25;
    this.spawnRateMaxPerSec = 5;
    this.maxEnemies = 25;
  }

  getUniqueEnemySpeed() {
    const min = 0.05, max = 1.0, minDelta = 0.08;
    let attempts = 0;
    while (attempts < 60) {
      const val = this._generateRandomSpeed(min, max);
      const conflict = this._checkSpeedConflict(val, minDelta);
      if (!conflict) return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
      attempts++;
    }
    return this._getFallbackSpeed(min, max);
  }

  /**
   * Generate random speed with weighted distribution.
   * @param {number} min - Minimum speed
   * @param {number} max - Maximum speed
   * @returns {number} Random speed value
   * @private
   */
  _generateRandomSpeed(min, max) {
    const r = Math.random();
    if (r < 0.35) return min + Math.random() * (0.25 - min);
    if (r > 0.65) return 0.7 + Math.random() * (max - 0.7);
    return min + Math.random() * (max - min);
  }

  /**
   * Check if speed conflicts with existing enemies.
   * @param {number} val - Speed value to check
   * @param {number} minDelta - Minimum allowed difference
   * @returns {boolean} True if conflict exists
   * @private
   */
  _checkSpeedConflict(val, minDelta) {
    return this.enemies.some(e => (typeof e.speedFactor === 'number') && Math.abs(e.speedFactor - val) < minDelta);
  }

  /**
   * Get fallback speed when no unique speed found.
   * @param {number} min - Minimum speed
   * @param {number} max - Maximum speed
   * @returns {number} Fallback speed
   * @private
   */
  _getFallbackSpeed(min, max) {
    const v = min + Math.random() * (max - min);
    let out = Math.max(min, Math.min(max, Math.round(v * 100) / 100));
    try { if ((this.difficulty || 'normal').toString().toLowerCase() === 'easy') out = Math.max(min, Math.min(max, Math.round(out * 0.85 * 100) / 100)); } catch(_){}
    return out;
  }

  /**
   * Start the boss fight by clearing normal enemies and spawning the boss.
   */
  startBossFight() {
    this.bossActive = true;
      this.enemies = [];
      const b = new Boss();
    b.x = this.canvas.width + 100;
    b.y = Math.max(0, (this.canvas.height - b.height) / 2);
      b.vx = -0.6;
    this.enemies.push(b);
  }

  addToMap(mo) {
    if (!mo) return;
    if (mo.img instanceof Image ? mo.img.complete : false) {
      this.ctx.drawImage(mo.img, mo.x, mo.y, mo.width, mo.height);
    } else {
    this.ctx.fillStyle = 'rgba(0,0,0,.25)';
    this.ctx.fillRect(mo.x, mo.y, mo.width, mo.height);
    }
  }

  addObjectsToMap(objects) {
    const list = Array.isArray(objects) ? objects : [objects];
    list.forEach(o => this.addToMap(o));
  }
}
