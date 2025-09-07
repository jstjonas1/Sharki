class PufferFish extends Enemy {
    constructor(x, y, width = 80, height = 60, speed = 1, score = null, speedFactor = null) {
        super(x, y, width, height, speed, score);
        if (typeof speedFactor === 'number') this.speedFactor = speedFactor;
        this.z = 1;
        // try to load swim frames
        const base = '../assets/img/sharki/2enemy/1puffer_fish_3_color_options/1swim/';
        const paths = ['1_1.png','1_2.png','1_3.png','1_4.png','1_5.png'].map(p => base + p);
                    this.loadFrames(paths, 120).catch(() => this.loadImage(base + '1_1.png'));
        // movement direction will be set by world when spawning
    this.vx = this.vx || -1;
                    // tune animation speed so it relates to movement speed: faster fish animate faster
                    try {
                        const sf = (typeof this.speedFactor === 'number') ? this.speedFactor : 0.5;
                        this.frameInterval = Math.max(30, Math.round(120 / (0.5 + sf)));
                    } catch (e) {}
    }

    update(dt) {
        // move horizontally according to vx
        const speedPxPerSec = (this.speed || 1) * 60 * 0.7;
        this.x += this.vx * speedPxPerSec * (dt / 1000);
    // face movement direction
    if (this.vx < 0) this.flipX = false; else if (this.vx > 0) this.flipX = true;
        // remove when off-screen fully (add some margin)
        if (this.x + this.width < -50 || this.x > (typeof window !== 'undefined' && window.world ? window.world.canvas.width + 50 : 800)) {
            this._dead = true;
        }
    }
}