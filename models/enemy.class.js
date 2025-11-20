/**
 * Enemy fish that moves randomly and can be eaten by the player.
 * @extends MovableObject
 */
class Enemy extends MovableObject {
    /**
     * Create an enemy with score-based size and random movement.
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} speed - Movement speed
     * @param {number|null} score - Score value (determines size)
     */
    constructor(x, y, width, height, speed, score = null) {
        super(x, y, width, height, speed);
        this.x = typeof x === 'number' ? x : (Math.random() * 500 + 200);
        this.vx = 0;
        this.vy = 0;
        this._changeDirTimer = 0;
        this._changeDirInterval = 1000 + Math.random() * 2000;
        this.maxHealth = 5;
        this.health = this.maxHealth;
        this._dead = false;
        this.score = (typeof score === 'number') ? score : Math.floor(200 + Math.random() * (100000 - 200 + 1));
        this.applySizeFromScore();
        this.speedFactor = Math.max(0.05, Math.min(1.0, 0.05 + Math.random() * 0.95));
    }

    /**
     * Update enemy position with random direction changes.
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt){
        if (this._handleStoppedState(dt)) return;
        this._updateDirectionTimer(dt);
        this._applyMovement(dt);
    }

    /**
     * Handle stopped state timing.
     * @param {number} dt - Delta time
     * @returns {boolean} True if stopped
     */
    _handleStoppedState(dt) {
        if (this.isStopped) {
            this._stopTimer += dt;
            if (this._stopTimer >= this._stopDuration) {
                this.isStopped = false;
                this._stopTimer = 0;
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Update direction change timer and possibly change direction.
     * @param {number} dt - Delta time
     */
    _updateDirectionTimer(dt) {
        this._changeDirTimer += dt;
        if (this._changeDirTimer >= this._changeDirInterval) {
            this._changeDirTimer = 0;
            this._changeDirInterval = 1000 + Math.random() * 2000;
            this._randomizeDirection();
        }
    }

    /**
     * Randomize movement direction or stop.
     */
    _randomizeDirection() {
        if (Math.random() < 0.25) {
            this.isStopped = true;
            this._stopDuration = 300 + Math.random() * 1500;
            this._stopTimer = 0;
            this.vx = 0;
            this.vy = 0;
        } else {
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle);
            this.vy = Math.sin(angle);
        }
    }

    /**
     * Apply movement based on velocity and speed.
     * @param {number} dt - Delta time
     */
    _applyMovement(dt) {
        const charSpeed = this._getCharacterSpeed();
        const effectiveFactor = Math.min(this.speedFactor, 1.0);
        const speedPxPerSec = charSpeed * 60 * effectiveFactor;
        const moveAmount = speedPxPerSec * (dt / 1000);
        this.x += this.vx * moveAmount;
        this.y += this.vy * moveAmount;
        this._currentSpeed = Math.hypot((this.vx || 0) * speedPxPerSec, (this.vy || 0) * speedPxPerSec);
    }

    /**
     * Get character speed from world.
     * @returns {number} Character speed
     */
    _getCharacterSpeed() {
        if (typeof window !== 'undefined' && window.world && window.world.character && typeof window.world.character.speed === 'number') {
            return window.world.character.speed;
        }
        return this.speed || 1;
    }

    /**
     * Apply damage to the enemy.
     * @param {number} amount - Damage amount to apply
     */
    takeDamage(amount) {
        if (this._dead) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this._dead = true;
        }
    }

    /**
     * Apply size based on score value.
     */
    applySizeFromScore() {
    const s = MovableObject.sizeFromScore(this.score);
    this.height = s.height;
    this.width = s.width;
    }

    /**
     * Draw enemy to canvas context.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawTo(ctx) {
      
        try {
            if (typeof super.drawTo === 'function') super.drawTo(ctx);
            else if (this.img) ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        } catch (e) {}
    }

}
