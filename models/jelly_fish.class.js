/**
 * Jellyfish enemy with vertical bobbing motion.
 * @extends Enemy
 */
class JellyFish extends Enemy {
    /**
     * Create a jellyfish enemy.
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} speed - Movement speed
     * @param {number|null} score - Score value
     * @param {number|null} speedFactor - Speed multiplier
     */
    constructor(x, y, width = 60, height = 80, speed = 1, score = null, speedFactor = null) {
        super(x, y, width, height, speed, score);
        if (typeof speedFactor === 'number') this.speedFactor = speedFactor;
        this.z = 1;
        this._loadJellyfishFrames();
        this.vx = this.vx || -1;
        this._initializeJellyfishProperties();
        this.visualSizeMultiplier = 0.7;
    }

    /**
     * Load jellyfish animation frames.
     */
    _loadJellyfishFrames() {
        const base = 'assets/img/sharki/2enemy/2jelly_fish/regular_damage/';
        const paths = ['lila1.png','lila2.png','lila3.png','lila4.png'].map(p => base + p);
        this.loadFrames(paths, 140).catch(() => this.loadImage(base + 'lila1.png'));
    }

    /**
     * Initialize jellyfish-specific properties.
     */
    _initializeJellyfishProperties() {
        try {
            const sf = (typeof this.speedFactor === 'number') ? this.speedFactor : 0.5;
            this.frameInterval = Math.max(30, Math.round(140 / (0.5 + sf)));
        } catch (e) {}
        this._increaseScoreValue();
    }

    /**
     * Increase score value by 30% for jellyfish.
     */
    _increaseScoreValue() {
        try {
            if (typeof this.score === 'number') {
                this.score = Math.round(this.score * 1.3);
                if (typeof this.applySizeFromScore === 'function') this.applySizeFromScore();
            }
        } catch (e) {}
    }

    /**
     * Update jellyfish position and animation.
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt) {
        try {
            this._moveHorizontally(dt);
            this._applyBobbing(dt);
        } catch (err) {
            this._moveFallback(dt);
        }
        this._ensureBobOffset();
        this._updateFlip();
        this._checkOffscreen();
    }

    /**
     * Move jellyfish horizontally.
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
     * Apply vertical bobbing motion.
     * @param {number} dt - Delta time
     */
    _applyBobbing(dt) {
        const effectiveFactor = Math.min((typeof this.speedFactor === 'number' ? this.speedFactor : 1.0), 1.0);
        const bobAmp = Math.max(4, Math.round(this.height * 0.06));
        const bobFreq = 0.002 + (0.003 * (1 - effectiveFactor));
        this.y += Math.sin(Date.now() * bobFreq + (this._bobOffset || 0)) * (bobAmp * (dt/1000));
    }

    /**
     * Fallback movement when error occurs.
     * @param {number} dt - Delta time
     */
    _moveFallback(dt) {
        const speedPxPerSec = (this.speed || 1) * 60 * 0.6;
        this.x += this.vx * speedPxPerSec * (dt / 1000);
        this._currentSpeed = Math.abs((this.vx || 0) * speedPxPerSec);
    }

    /**
     * Ensure bob offset is initialized.
     */
    _ensureBobOffset() {
        if (!this._bobOffset) this._bobOffset = Math.random() * Math.PI * 2;
    }

    /**
     * Update horizontal flip based on velocity.
     */
    _updateFlip() {
        if (this.vx < 0) this.flipX = false; 
        else if (this.vx > 0) this.flipX = true;
    }

    /**
     * Check if jellyfish moved offscreen and mark dead.
     */
    _checkOffscreen() {
        const canvasWidth = (typeof window !== 'undefined' && window.world) ? window.world.canvas.width : 800;
        if (this.x + this.width < -50 || this.x > canvasWidth + 50) {
            this._dead = true;
        }
    }
}


