class World {
  // store light paths; dark paths will be derived and BackgroundObjects created in constructor
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
  // config
  minEnemies = 10;
  maxEnemies = 25;
  // multiplier to increase spawn counts (set to 2 for approx. double)
  spawnMultiplier = 1;
  // maximum enemies that can be spawned per second (rate limit)
  spawnRateMaxPerSec = 6;
  // internal rate window
  _spawnWindowStart = Date.now();
  _spawnedInWindow = 0;
  spawnSide = 'random';
  bossActive = false;
  score = 1000;
  _spawnTimer = 0;
  _spawnInterval = 300; // ms between spawn attempts when below desired (halved to double spawn rate)
  bubbles = [];
  enemiesEaten = 0;

  canvas; ctx;
  gameOver = false;
  victory = false;
  _victoryStart = 0;

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._lastTick = Date.now();
    this.running = true;
  // create BackgroundObject instances with derived dark paths
  try {
    this.backgroundObjects = this.backgroundLightPaths.map(lp => {
      // derive a likely dark path by replacing /layers/1light/ or /layers/ with /dark/
      let dp = lp.replace('/layers/1light/', '/dark/');
      if (dp === lp) dp = lp.replace('/layers/', '/dark/');
      return new BackgroundObject(lp, dp);
    });
  } catch (e) { this.backgroundObjects = []; }
  // initial population ramp (smoothly go from minEnemies -> initialTarget over duration)
  this._initialRampStart = Date.now();
  this._initialRampDuration = 10000; // ms to reach target
  this._initialRampTarget = 15; // desired enemies after ramp
  this.debug = false; // debug HUD toggle
  // key to toggle debug HUD: D
  try {
    window.addEventListener('keydown', (ev) => {
      if (!ev) return;
      if (ev.key === 'd' || ev.key === 'D') this.debug = !this.debug;
      if ((ev.key === 'r' || ev.key === 'R') && (this.gameOver || this.victory)) {
        try { this.restartGame(); } catch (e) {}
      }
    });
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
  if (this.gameOver || this.victory) return; // pause updates when game over or victory
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
            // increase by 20% of enemy score
            const gained = Math.round((e.score || 0) * 0.2);
            this.score = Math.min(100000, this.score + gained);
            // visual size boost: +10% for 0.1s
            try {
              if (this.character) {
                this.character.visualSizeMultiplier = 1.1;
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

    // scale character height by score: at 1000 -> 25px, at 100000 -> 250px
    const minScore = 1000, maxScore = 100000;
    const minH = 25, maxH = 250;
  // use centralized helper for exact same mapping as enemies
  const s = MovableObject.sizeFromScore(this.score);
  this.character.height = s.height;
  this.character.width = s.width;

  // ensure enemies sizes are consistent with their score mapping (so same-score => same-height)
  this.enemies.forEach(e => { if (typeof e.applySizeFromScore === 'function') e.applySizeFromScore(); });

    // boss fight trigger
    if (!this.bossActive && this.score >= maxScore) {
      this.startBossFight();
    }
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
      ctx.fillText('Gewonnen!', cx, cy + baseH/2 + 50);

      // show final numeric score beneath
      ctx.font = '20px monospace';
      ctx.fillStyle = 'white';
      ctx.fillText('Endscore: ' + (this.score || 0), cx, cy + baseH/2 + 80);

      ctx.restore();
    }

    // draw HUD (top-left): eaten count and current score
    try {
      const hudX = 12; const hudY = 12;
      const ctx2 = this.ctx;
      ctx2.save();
      ctx2.fillStyle = 'rgba(0,0,0,0.5)';
      ctx2.fillRect(hudX - 6, hudY - 6, 240, 48);
      ctx2.fillStyle = 'white';
      ctx2.font = '14px sans-serif';
      ctx2.textAlign = 'left';
      ctx2.fillText('Gegessen: ' + (this.enemiesEaten || 0), hudX, hudY + 12);
      ctx2.fillText('Score: ' + (this.score || 0), hudX, hudY + 32);
      ctx2.restore();
    } catch (e) {}

    // debug HUD: show enemy count, spawn limit, and sample speeds (toggle with D)
    try {
      if (this.debug) {
        const dbgX = 12; const dbgY = 70;
        const ctx3 = this.ctx;
        ctx3.save();
        ctx3.fillStyle = 'rgba(0,0,0,0.45)';
        ctx3.fillRect(dbgX - 6, dbgY - 6, 320, 140);
        ctx3.fillStyle = 'white';
        ctx3.font = '12px monospace';
        ctx3.textAlign = 'left';
        ctx3.fillText('Enemies: ' + (this.enemies ? this.enemies.length : 0) + ' / ' + (this.maxEnemies || 0), dbgX, dbgY + 8);
        ctx3.fillText('Spawn limit/sec: ' + (this.spawnRateMaxPerSec || 0), dbgX, dbgY + 26);
        // list up to 8 sample speeds and actual _currentSpeed
        const samples = (this.enemies || []).slice(0,8).map((e,i) => `${i+1}:${(typeof e._currentSpeed==='number'?Math.round(e._currentSpeed):'n/a')}/${(typeof e.speedFactor==='number'?e.speedFactor.toFixed(2):'n/a')}`);
        ctx3.fillText('Sample speeds(px/s/f): ' + (samples.length ? samples.join(' ') : 'none'), dbgX, dbgY + 44);
        ctx3.fillText('SpawnMultiplier: ' + (this.spawnMultiplier||1), dbgX, dbgY + 64);
        ctx3.fillText('Debug: Toggle with D', dbgX, dbgY + 84);
        ctx3.restore();
        // also draw per-enemy numeric speed over each enemy
        try {
          this.enemies.forEach((e, idx) => {
            if (!e || !e._lastDraw) return;
            const r = e._lastDraw;
            this.ctx.save();
            this.ctx.fillStyle = 'white';
            this.ctx.font = '11px monospace';
            this.ctx.textAlign = 'center';
            const txt = (typeof e._currentSpeed === 'number') ? `${Math.round(e._currentSpeed)}px/s` : '';
            this.ctx.fillText(txt, r.x + r.width/2, r.y - 10);
            this.ctx.restore();
          });
        } catch (e) {}
      }
    } catch (e) {}
  }

  triggerGameOver() {
    this.gameOver = true;
    console.log('GAME OVER');
  }

  triggerVictory() {
    this.victory = true;
    this._victoryStart = Date.now();
    console.log('VICTORY!');
  }

  // restart the game: reset score, eaten count, enemies, bubbles and flags
  restartGame() {
    // reset basic state
    this.score = 1000;
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
    const minScore = 1000, maxScore = 100000;
    const minH = 25, maxH = 250;
    const ch = (this.character && this.character.height) ? this.character.height : minH;
    const t = (ch - minH) / (maxH - minH);
    const charScoreEquivalent = Math.round(minScore + (maxScore - minScore) * Math.max(0, Math.min(1, t)));

    // count current edible enemies (exclude boss)
    const currentCount = this.enemies.filter(e => !(e instanceof Boss) && !e._dead).length;
    const currentEdible = this.enemies.filter(e => !(e instanceof Boss) && !e._dead && typeof e.score === 'number' && e.score <= charScoreEquivalent).length;

    const desiredTotal = currentCount + num;
    const minEdibleNeeded = Math.ceil(0.3 * desiredTotal);
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
      const high = 100000;
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
