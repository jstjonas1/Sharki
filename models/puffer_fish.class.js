/**
 * Puffer fish enemy with horizontal swimming.
 * @extends Enemy
 */
class PufferFish extends Enemy {
    /**
     * Create a puffer fish enemy.
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} speed - Movement speed
     * @param {number|null} score - Score value
     * @param {number|null} speedFactor - Speed multiplier
     */
    constructor(x, y, width = 80, height = 60, speed = 1, score = null, speedFactor = null) {
        super(x, y, width, height, speed, score);
        if (typeof speedFactor === 'number') this.speedFactor = speedFactor;
        this.z = 1;
        this._loadPufferFrames();
        this.vx = this.vx || -1;
        this._initializeFrameInterval();
    }

    /**
     * Load puffer fish animation frames.
     */
    _loadPufferFrames() {
        const base = 'assets/img/sharki/2enemy/1puffer_fish_3_color_options/1swim/';
        const paths = ['1_1.png','1_2.png','1_3.png','1_4.png','1_5.png'].map(p => base + p);
        this.loadFrames(paths, 120).catch(() => this.loadImage(base + '1_1.png'));
    }

    /**
     * Initialize frame interval based on speed factor.
     */
    _initializeFrameInterval() {
        try {
            const sf = (typeof this.speedFactor === 'number') ? this.speedFactor : 0.5;
            this.frameInterval = Math.max(30, Math.round(120 / (0.5 + sf)));
        } catch (e) {}
    }

    /**
     * Update puffer fish position.
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt) {
        try {
            this._moveHorizontally(dt);
        } catch (err) {
            this._moveFallback(dt);
        }
        this._updateFlip();
        this._checkOffscreen();
    }

    /**
     * Move puffer fish horizontally.
     * @param {number} dt - Delta time
     */
    _moveHorizontally(dt) {
        const charSpeed = this._getCharacterSpeed();
        const effectiveFactor = Math.min((typeof this.speedFactor === 'number' ? this.speedFactor : 1.0), 1.0);
        const speedPxPerSec = charSpeed * 60 * effectiveFactor;
        const moveAmount = speedPxPerSec * (dt / 1000);
        this.x += this.vx * moveAmount;
        this._currentSpeed = Math.abs((this.vx || 0) * speedPxPerSec);
    }

    /**
     * Fallback movement when error occurs.
     * @param {number} dt - Delta time
     */
    _moveFallback(dt) {
        const speedPxPerSec = (this.speed || 1) * 60 * 0.7;
        this.x += this.vx * speedPxPerSec * (dt / 1000);
        this._currentSpeed = Math.abs((this.vx || 0) * speedPxPerSec);
    }

    /**
     * Update horizontal flip based on velocity.
     */
    _updateFlip() {
        if (this.vx < 0) this.flipX = false; 
        else if (this.vx > 0) this.flipX = true;
    }

    /**
     * Check if puffer fish moved offscreen and mark dead.
     */
    _checkOffscreen() {
        const canvasWidth = (typeof window !== 'undefined' && window.world) ? window.world.canvas.width : 800;
        if (this.x + this.width < -50 || this.x > canvasWidth + 50) {
            this._dead = true;
        }
    }
}