/**
 * Boss enemy class that chases the player and requires multiple bubble hits to defeat.
 * @extends Enemy
 */
class Boss extends Enemy {
    /**
     * Initialize the boss with floating animation and health properties.
     */
    constructor() {
        super();
        this.loadFramesPattern('./assets/img/sharki/2enemy/3final_enemy/2floating/', ['{i}.png'], 8, 180).catch(() => {
            this.loadImage('./assets/img/sharki/2enemy/3final_enemy/2floating/1.png').catch(() => {});
        });
        this.z = 1;
        this.maxHealth = 10;
        this.health = this.maxHealth;
        this.hitCount = 0;
        this.vx = -0.6;
        if (this.width < 100) this.width = 100;
        if (this.height < 100) this.height = 100;
    }

    /**
     * Update boss position to chase the player character.
     * @param {number} dt - Delta time in milliseconds since last update
     */
    update(dt) {
        try {
            const world = (typeof window !== 'undefined') ? window.world : null;
            const target = this._getPlayerTarget(world);
            if (target) {
                this._chasePlayer(target, dt);
            } else {
                this._moveDefault(dt);
            }
            this._clampVerticalPosition(world);
        } catch (e) {
            this._moveDefault(dt);
        }
    }

    /**
     * Get player target coordinates.
     * @param {Object} world - World instance
     * @returns {Object|null} {cx, cy} or null
     */
    _getPlayerTarget(world) {
        if (!world || !world.character) return null;
        const cx = world.character.x + (world.character.width || 0) / 2;
        const cy = world.character.y + (world.character.height || 0) / 2;
        return (typeof cx === 'number' && typeof cy === 'number') ? { cx, cy } : null;
    }

    /**
     * Chase the player target.
     * @param {Object} target - Target {cx, cy}
     * @param {number} dt - Delta time
     */
    _chasePlayer(target, dt) {
        const direction = this._calculateChaseDirection(target);
        const baseSpeed = 80 * (this.speed || 1);
        this._applyChaseMovement(direction, baseSpeed, dt);
    }

    /**
     * Calculate normalized direction vector to target.
     * @param {Object} target - Target {cx, cy}
     * @returns {Object} {nx, ny}
     * @private
     */
    _calculateChaseDirection(target) {
        const mycx = this.x + (this.width || 0) / 2;
        const mycy = this.y + (this.height || 0) / 2;
        const dx = target.cx - mycx;
        const dy = target.cy - mycy;
        const dist = Math.hypot(dx, dy) || 1;
        return { nx: dx / dist, ny: dy / dist };
    }

    /**
     * Apply chase movement with direction and speed.
     * @param {Object} direction - {nx, ny}
     * @param {number} baseSpeed - Base speed value
     * @param {number} dt - Delta time
     * @private
     */
    _applyChaseMovement(direction, baseSpeed, dt) {
        this.vx = direction.nx;
        this.vy = direction.ny;
        this.x += direction.nx * baseSpeed * (dt / 1000);
        this.y += direction.ny * baseSpeed * (dt / 1000);
        this._currentSpeed = Math.hypot(direction.nx * baseSpeed, direction.ny * baseSpeed);
    }

    /**
     * Move with default velocity when no player target.
     * @param {number} dt - Delta time
     */
    _moveDefault(dt) {
        const speedPxPerSec = (this.speed || 1) * 60 * 0.8;
        this.x += (this.vx || 0) * speedPxPerSec * (dt / 1000);
        this.y += (this.vy || 0) * speedPxPerSec * (dt / 1000);
        this._currentSpeed = Math.hypot((this.vx || 0) * speedPxPerSec, (this.vy || 0) * speedPxPerSec);
    }

    /**
     * Clamp boss to canvas vertical bounds.
     * @param {Object} world - World instance
     */
    _clampVerticalPosition(world) {
        if (typeof window !== 'undefined' && world && world.canvas) {
            const h = world.canvas.height;
            this.y = Math.max(0, Math.min(h - this.height, this.y));
        }
    }

    /**
     * Override takeDamage to count bubble hits; only bubbles should call takeDamage(1).
     * @param {number} amount - Damage amount (bubble hits) to apply
     */
    takeDamage(amount) {
        try {
            if (typeof amount === 'number' && amount > 0) {
                this.hitCount += Math.round(amount);
                this.health = Math.max(0, this.maxHealth - this.hitCount);
                if (this.hitCount >= this.maxHealth) {
                    this._dead = true;
                }
            }
        } catch (e) {}
    }

}