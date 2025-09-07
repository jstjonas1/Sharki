class JellyFish extends Enemy {
    constructor(x, y, width = 60, height = 80, speed = 1, score = null, speedFactor = null) {
        super(x, y, width, height, speed, score);
        if (typeof speedFactor === 'number') this.speedFactor = speedFactor;
        this.z = 1;
        const base = '../assets/img/sharki/2enemy/2jelly_fish/regular_damage/';
        const paths = ['lila1.png','lila2.png','lila3.png','lila4.png'].map(p => base + p);
        this.loadFrames(paths, 140).catch(() => this.loadImage(base + 'lila1.png'));
    this.vx = this.vx || -1;
            // tune animation speed so it relates to movement speed: faster jellyfish animate faster
            try {
                const sf = (typeof this.speedFactor === 'number') ? this.speedFactor : 0.5;
                this.frameInterval = Math.max(30, Math.round(140 / (0.5 + sf)));
            } catch (e) {}
            // increase their score by 30% so they grant points like a 30% larger enemy,
            // then recompute base size from that score but render visually smaller.
            try {
                if (typeof this.score === 'number') {
                    this.score = Math.round(this.score * 1.3);
                    // recompute size mapping from new score so internal size matches score
                    if (typeof this.applySizeFromScore === 'function') this.applySizeFromScore();
                }
            } catch (e) {}
            // visually appear 30% smaller than their internal size (and hitbox)
            this.visualSizeMultiplier = 0.7;
    }

    update(dt) {
        const speedPxPerSec = (this.speed || 1) * 60 * 0.6;
        this.x += this.vx * speedPxPerSec * (dt / 1000);
    if (this.vx < 0) this.flipX = false; else if (this.vx > 0) this.flipX = true;
        if (this.x + this.width < -50 || this.x > (typeof window !== 'undefined' && window.world ? window.world.canvas.width + 50 : 800)) {
            this._dead = true;
        }
    }

