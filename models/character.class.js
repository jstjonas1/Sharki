/** Player character with movement, animations, and actions. */
class Character extends MovableObject {
    constructor() {
    try {
        super();
    this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {
            this.loadImage('./assets/img/sharki/1sharkie/1idle/1.png').catch(() => {});
        });
    } catch (e) {
        try { super().loadImage('./assets/img/sharki/1sharkie/1idle/1.png'); } catch (e2) {}
    }
        this.z = 2;
        this.maxHealth = 100;
        this.health = 100;
        this._attackCooldown = 0;
        this._lastHitTime = 0;
        this._invulnMs = 1000;
        this.flipX = false;
    this.speed = 3;
    this.vx = 0; this.vy = 0;
    this._targetVx = 0; this._targetVy = 0;
    this._accelTime = 500;
    this._decelTime = 1000;
    this._velLerp = 0;
        this.animState = 'idle';
        this.animationLoop = true;
        this._onAnimationEnd = null;
        try {
            this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/2long_idle/', ['i{i}.png','{i}.png'], 14, 180).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/3swim/', ['{i}.png','i{i}.png'], 7, 90).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/fin_slap/', ['{i}.png'], 8, 60).catch(() => {});
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/bubble_trap/', ['bubble.png','poisoned_bubble_for_whale.png','preview.gif'], 1, 80).catch(() => {});
        } catch (e) {}
    }

    // Fin slap: immediate close-range hit. Deals 2 damage to any enemy
    // within a small box in front of the character.
    finSlap() {
        if (this._attackCooldown > 0) return false;
        this._attackCooldown = 500;

        const dir = this.flipX ? -1 : 1;
        const range = 40; // pixels in front
        const ax = dir > 0 ? this.x + this.width : this.x - range;
        const aw = range;
        const ay = this.y;
        const ah = this.height;

        if (typeof window !== 'undefined' && window.world && Array.isArray(window.world.enemies)) {
            window.world.enemies.forEach(enemy => {
                if (enemy._dead) return;
                if (ax < enemy.x + enemy.width && ax + aw > enemy.x && ay < enemy.y + enemy.height && ay + ah > enemy.y) {
                    if (typeof enemy.takeDamage === 'function') enemy.takeDamage(2);
                }
            });
        }

        return true;
    }

    /** Shoot a bubble projectile. */
    shootBubble() {
        if (this._attackCooldown > 0) return false;
        this._attackCooldown = 400;
        const dir = this.flipX ? -1 : 1;
        const bx = this.x + this.width / 2 + dir * (this.width / 2 + 4);
        const by = this.y + this.height / 2;
        if (typeof window !== 'undefined' && window.world && typeof window.world.spawnBubble === 'function') {
                try {
                    if (typeof window.world.score === 'number') {
                        const cost = Math.max(1, Math.round(window.world.score * 0.01));
                        window.world.score = Math.max(0, window.world.score - cost);
                    }
                } catch (e) {}
                window.world.spawnBubble(bx, by, dir);
                try { if (window.SFX) window.SFX.play('blub', 0.8); } catch (e) {}
        }
        // play bubble-shoot animation (non-looping) at 80ms per frame
        try {
            this.animState = 'attack_bubble';
            this.animationLoop = false;
            this._onAnimationEnd = () => { this.animationLoop = true; this.animState = 'idle'; };
            this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/bubble_trap/', ['bubble.png','poisoned_bubble_for_whale.png','preview.gif'], 1, 80).catch(() => {});
        } catch (e) {}
        return true;
    }

    takeDamage(amount) {
        const now = Date.now();
        if (now - this._lastHitTime < this._invulnMs) return; // temporarily invulnerable
        this._lastHitTime = now;
        this.health = Math.max(0, this.health - amount);
        console.log('Character took', amount, 'damage. Health=', this.health);
        if (this.health <= 0) {
            console.log('Character died');
            // TODO: handle respawn or game over
        }
    }

    // called each frame by the world
    update(dt) {
        if (this._attackCooldown > 0) this._attackCooldown = Math.max(0, this._attackCooldown - dt);

        // handle temporary visual size boost timer
        if (typeof this.visualSizeTimer === 'number' && this.visualSizeTimer > 0) {
            this.visualSizeTimer = Math.max(0, this.visualSizeTimer - dt);
            if (this.visualSizeTimer === 0) {
                this.visualSizeMultiplier = 1;
            }
        }

        // movement via global input state (arrow keys or WASD) with acceleration/deceleration
        try {
            const input = (typeof window !== 'undefined' && window.input) ? window.input : null;
            if (input) {
                let vx = 0, vy = 0;
                if (input.left) vx -= 1;
                if (input.right) vx += 1;
                if (input.up) vy -= 1;
                if (input.down) vy += 1;
                // normalize diagonal so diagonal isn't faster
                if (vx !== 0 && vy !== 0) {
                    const inv = 1 / Math.sqrt(2);
                    vx *= inv; vy *= inv;
                }
                // set target direction
                this._targetVx = vx;
                this._targetVy = vy;
                // determine whether accelerating or decelerating
                const targetMag = Math.hypot(this._targetVx, this._targetVy);
                const curMag = Math.hypot(this.vx, this.vy);
                // decide lerp factor per ms
                if (targetMag > curMag + 1e-3) {
                    // accelerating towards target over _accelTime
                    const step = Math.min(1, dt / this._accelTime);
                    this.vx += (this._targetVx - this.vx) * step;
                    this.vy += (this._targetVy - this.vy) * step;
                } else if (targetMag < curMag - 1e-3) {
                    // decelerating over _decelTime
                    const step = Math.min(1, dt / this._decelTime);
                    this.vx += (this._targetVx - this.vx) * step;
                    this.vy += (this._targetVy - this.vy) * step;
                } else {
                    // small adjustments
                    this.vx = this._targetVx; this.vy = this._targetVy;
                }

                // now move according to current velocity vector scaled by base speed
                const pxPerSec = (this.speed || 1) * 60;
                this.x += this.vx * pxPerSec * (dt / 1000);
                this.y += this.vy * pxPerSec * (dt / 1000);
                // store current movement speed in px/sec for animation timing
                this._currentSpeed = Math.hypot(this.vx * pxPerSec, this.vy * pxPerSec);
                // flipX based on current movement
                if (this.vx < 0) this.flipX = true;
                else if (this.vx > 0) this.flipX = false;
                // clamp to world bounds if available
                if (typeof window !== 'undefined' && window.world && window.world.canvas) {
                    const cw = window.world.canvas.width;
                    const ch = window.world.canvas.height;
                    // allow up to 50% of the character sprite to go off-screen
                    const halfW = (this.width || 32) / 2;
                    const halfH = (this.height || 32) / 2;
                    this.x = Math.max(-halfW, Math.min(cw - halfW, this.x));
                    this.y = Math.max(-halfH, Math.min(ch - halfH, this.y));
                }
            }
        } catch (e) {
            // ignore input errors
        }

            // Animation state switching: prefer swim when moving, long_idle when stationary for long, idle otherwise
            try {
                const speed = Math.hypot(this.vx, this.vy);
                if (this._attackCooldown > 0 && this.animState !== 'attack') {
                    // play attack animation once
                    this.animState = 'attack';
                    this.animationLoop = false;
                    this._onAnimationEnd = () => { this.animationLoop = true; this.animState = 'idle'; };
                    this.loadFramesPattern('./assets/img/sharki/1sharkie/4attack/fin_slap/', ['{i}.png'], 8, 60).catch(() => {});
                } else if (speed > 0.05) {
                    if (this.animState !== 'swim') {
                        this.animState = 'swim';
                        this.animationLoop = true;
                        this.loadFramesPattern('./assets/img/sharki/1sharkie/3swim/', ['{i}.png'], 7, 80).catch(() => {});
                    }
                } else {
                    // stationary: pick long_idle if available based on random timer
                    if (this.animState !== 'long_idle' && Math.random() < 0.01) {
                        this.animState = 'long_idle';
                        this.animationLoop = true;
                        this.loadFramesPattern('./assets/img/sharki/1sharkie/2long_idle/', ['i{i}.png','{i}.png'], 14, 180).catch(() => {});
                    } else if (this.animState !== 'idle' && Math.random() >= 0.01) {
                        this.animState = 'idle';
                        this.animationLoop = true;
                        this.loadFramesPattern('./assets/img/sharki/1sharkie/1idle/', ['{i}.png'], 18, 120).catch(() => {});
                    }
                }
            } catch (e) {}
    }

    moveUp() { }
    moveDown() { }

}

