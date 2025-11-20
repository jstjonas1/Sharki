/**
 * Player character with movement, animations, health, and bubble shooting.
 * @extends MovableObject
 */
class Character extends MovableObject {
    /**
     * Initialize the player character with idle animation and default properties.
     */
    /**
     * Create character instance.
     */
    constructor() {
        super();
        this._initializeImage();
        this._initializeStats();
        this._initializeMovement();
        this._initializeAnimation();
        this._preloadAnimations();
    }

    /**
     * Initialize character image.
     */
    _initializeImage() {
        try {
            this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {
                this.loadImage('./assets/img/sharki/1sharkie/1idle/1.png').catch(() => {});
            });
        } catch (e) {
            try { super.loadImage('./assets/img/sharki/1sharkie/1idle/1.png'); } catch (e2) {}
        }
    }

    /**
     * Initialize character stats.
     */
    _initializeStats() {
        this.z = 2;
        this.maxHealth = 100;
        this.health = 100;
        this._attackCooldown = 0;
        this._lastHitTime = 0;
        this._invulnMs = 1000;
        this.flipX = false;
    }

    /**
     * Initialize movement properties.
     */
    _initializeMovement() {
        this.speed = 3;
        this.vx = 0; this.vy = 0;
        this._targetVx = 0; this._targetVy = 0;
        this._accelTime = 500;
        this._decelTime = 1000;
        this._velLerp = 0;
    }

    /**
     * Initialize animation state.
     */
    _initializeAnimation() {
        this.animState = 'idle';
        this.animationLoop = true;
        this._onAnimationEnd = null;
    }

    /**
     * Preload all character animations.
     */
    _preloadAnimations() {
        try {
            this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/2long_idle/', ['i{i}.png','{i}.png'], 14, 180).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/3swim/', ['{i}.png','i{i}.png'], 7, 90).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/fin_slap/', ['{i}.png'], 8, 60).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/bubble_trap/', ['bubble.png','poisoned_bubble_for_whale.png','preview.gif'], 1, 80).catch(() => {});
        } catch (e) {}
    }

    /**
     * Perform melee fin slap attack.
     * @returns {boolean} True if attack performed
     */
    finSlap() {
        if (this._attackCooldown > 0) return false;
        this._attackCooldown = 500;
        const attackBox = this._getFinSlapAttackBox();
        this._damageEnemiesInBox(attackBox, 2);
        return true;
    }

    /**
     * Get fin slap attack box.
     * @returns {Object} Attack box {x, y, w, h}
     */
    _getFinSlapAttackBox() {
        const dir = this.flipX ? -1 : 1;
        const range = 40;
        const ax = dir > 0 ? this.x + this.width : this.x - range;
        return { x: ax, y: this.y, w: range, h: this.height };
    }

    /**
     * Damage enemies in attack box.
     * @param {Object} box - Attack box
     * @param {number} damage - Damage amount
     */
    _damageEnemiesInBox(box, damage) {
        if (typeof window !== 'undefined' && window.world && Array.isArray(window.world.enemies)) {
            window.world.enemies.forEach(enemy => {
                if (enemy._dead) return;
                if (box.x < enemy.x + enemy.width && box.x + box.w > enemy.x && box.y < enemy.y + enemy.height && box.y + box.h > enemy.y) {
                    if (typeof enemy.takeDamage === 'function') enemy.takeDamage(damage);
                }
            });
        }
    }

    /**
     * Shoot a bubble projectile in the facing direction, costs 0.5% of current score.
     * @returns {boolean} True if bubble was shot, false if on cooldown
     */
    shootBubble() {
        if (this._attackCooldown > 0) return false;
        this._attackCooldown = 400;
        const dir = this.flipX ? -1 : 1;
        const bx = this.x + this.width / 2 + dir * (this.width / 2 + 4);
        const by = this.y + this.height / 2;
        this._spawnBubble(bx, by, dir);
        this._playBubbleAnimation();
        return true;
    }

    /**
     * Spawn bubble and deduct score cost.
     * @param {number} bx - Bubble X
     * @param {number} by - Bubble Y
     * @param {number} dir - Direction
     */
    _spawnBubble(bx, by, dir) {
        if (typeof window !== 'undefined' && window.world && typeof window.world.spawnBubble === 'function') {
            this._deductBubbleCost();
            window.world.spawnBubble(bx, by, dir);
            try { if (window.SFX) window.SFX.play('blub', 0.8); } catch (e) {}
        }
    }

    /**
     * Deduct 1% score cost for bubble.
     */
    _deductBubbleCost() {
        try {
            if (typeof window.world.score === 'number') {
                const cost = Math.max(1, Math.round(window.world.score * 0.01));
                window.world.score = Math.max(0, window.world.score - cost);
            }
        } catch (e) {}
    }

    /**
     * Play bubble attack animation.
     */
    _playBubbleAnimation() {
        try {
            this.animState = 'attack_bubble';
            this.animationLoop = false;
            this._onAnimationEnd = () => { this.animationLoop = true; this.animState = 'idle'; };
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/bubble_trap/', ['bubble.png','poisoned_bubble_for_whale.png','preview.gif'], 1, 80).catch(() => {});
        } catch (e) {}
    }

    /**
     * Apply damage to the character with invulnerability period.
     * @param {number} amount - Damage amount to apply
     */
    takeDamage(amount) {
        const now = Date.now();
        if (now - this._lastHitTime < this._invulnMs) return; // temporarily invulnerable
        this._lastHitTime = now;
        this.health = Math.max(0, this.health - amount);
    }

    /**
     * Update character position, animation state, and handle input.
     * @param {number} dt - Delta time in milliseconds
     */
    /**
     * Update character state and position.
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt) {
        this._updateCooldowns(dt);
        this._updateVisualSize(dt);
        this._handleInput(dt);
        this._updateAnimation();
    }

    /**
     * Update attack cooldown.
     * @param {number} dt
     */
    _updateCooldowns(dt) {
        if (this._attackCooldown > 0) this._attackCooldown = Math.max(0, this._attackCooldown - dt);
    }

    /**
     * Update visual size timer.
     * @param {number} dt
     */
    _updateVisualSize(dt) {
        if (typeof this.visualSizeTimer === 'number' && this.visualSizeTimer > 0) {
            this.visualSizeTimer = Math.max(0, this.visualSizeTimer - dt);
            if (this.visualSizeTimer === 0) this.visualSizeMultiplier = 1;
        }
    }

    /**
     * Handle keyboard input and movement.
     * @param {number} dt
     */
    _handleInput(dt) {
        try {
            const input = (typeof window !== 'undefined' && window.input) ? window.input : null;
            if (!input) return;
            this._processInput(input);
            this._applyVelocity(dt);
            this._moveCharacter(dt);
            this._clampPosition();
        } catch (e) {}
    }

    /**
     * Process input to target velocity.
     * @param {Object} input
     */
    _processInput(input) {
        let vx = 0, vy = 0;
        if (input.left) vx -= 1;
        if (input.right) vx += 1;
        if (input.up) vy -= 1;
        if (input.down) vy += 1;
        if (vx !== 0 && vy !== 0) { const inv = 1 / Math.sqrt(2); vx *= inv; vy *= inv; }
        this._targetVx = vx;
        this._targetVy = vy;
    }

    /**
     * Apply acceleration/deceleration to velocity.
     * @param {number} dt
     */
    _applyVelocity(dt) {
        const targetMag = Math.hypot(this._targetVx, this._targetVy);
        const curMag = Math.hypot(this.vx, this.vy);
        if (targetMag > curMag + 1e-3) {
            const step = Math.min(1, dt / this._accelTime);
            this.vx += (this._targetVx - this.vx) * step; this.vy += (this._targetVy - this.vy) * step;
        } else if (targetMag < curMag - 1e-3) {
            const step = Math.min(1, dt / this._decelTime);
            this.vx += (this._targetVx - this.vx) * step; this.vy += (this._targetVy - this.vy) * step;
        } else {
            this.vx = this._targetVx; this.vy = this._targetVy;
        }
    }

    /**
     * Move character by velocity.
     * @param {number} dt
     */
    _moveCharacter(dt) {
        const pxPerSec = (this.speed || 1) * 60;
        this.x += this.vx * pxPerSec * (dt / 1000);
        this.y += this.vy * pxPerSec * (dt / 1000);
        this._currentSpeed = Math.hypot(this.vx * pxPerSec, this.vy * pxPerSec);
        if (this.vx < 0) this.flipX = true;
        else if (this.vx > 0) this.flipX = false;
    }

    /**
     * Clamp position to canvas bounds.
     */
    _clampPosition() {
        if (typeof window !== 'undefined' && window.world && window.world.canvas) {
            const cw = window.world.canvas.width; const ch = window.world.canvas.height;
            const halfW = (this.width || 32) / 2; const halfH = (this.height || 32) / 2;
            this.x = Math.max(-halfW, Math.min(cw - halfW, this.x));
            this.y = Math.max(-halfH, Math.min(ch - halfH, this.y));
        }
    }

    /**
     * Update animation state based on movement.
     */
    _updateAnimation() {
        try {
            const speed = Math.hypot(this.vx, this.vy);
            if (this._attackCooldown > 0 && this.animState !== 'attack') this._playAttackAnim();
            else if (speed > 0.05 && this.animState !== 'swim') this._playSwimAnim();
            else if (speed <= 0.05) this._playIdleAnim();
        } catch (e) {}
    }

    /**
     * Play attack animation.
     */
    _playAttackAnim() {
        this.animState = 'attack'; this.animationLoop = false;
        this._onAnimationEnd = () => { this.animationLoop = true; this.animState = 'idle'; };
        this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/fin_slap/', ['{i}.png'], 8, 60).catch(() => {});
    }

    /**
     * Play swim animation.
     */
    _playSwimAnim() {
        this.animState = 'swim'; this.animationLoop = true;
        this.loadFramesPattern('./assets/img/sharki/1sharkie/3swim/', ['{i}.png'], 7, 80).catch(() => {});
    }

    /**
     * Play idle animation (random long/short).
     */
    _playIdleAnim() {
        if (this.animState !== 'long_idle' && Math.random() < 0.01) {
            this.animState = 'long_idle'; this.animationLoop = true;
            this.loadFramesPattern('./assets/img/sharki/1sharkie/2long_idle/', ['i{i}.png','{i}.png'], 14, 180).catch(() => {});
        } else if (this.animState !== 'idle' && Math.random() >= 0.01) {
            this.animState = 'idle'; this.animationLoop = true;
            this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {});
        }
    }

    moveUp() { }
    moveDown() { }

}

