class Boss extends Enemy {
    constructor() {
        super();
        // try to load a short floating animation sequence; fallback to single frame
    this.loadFramesPattern('./assets/img/sharki/2enemy/3final_enemy/2floating/', ['{i}.png'], 8, 180).catch(() => {
            this.loadImage('./assets/img/sharki/2enemy/3final_enemy/2floating/1.png').catch(() => {});
        });
        this.z = 1;
    // boss uses hitCount from bubbles (requires 10 bubble hits to destroy)
    this.maxHealth = 10; // number of bubble hits required
    this.health = this.maxHealth;
    this.hitCount = 0; // explicit bubble hit counter
        this.vx = -0.6; // will be adjusted when entering
    }

    // Boss moves freely; use update to apply velocity
    update(dt) {
        // chase the player: compute direction towards character and move with a fixed px/sec speed
        try {
            const world = (typeof window !== 'undefined') ? window.world : null;
            const cx = world && world.character ? (world.character.x + (world.character.width||0)/2) : null;
            const cy = world && world.character ? (world.character.y + (world.character.height||0)/2) : null;
            // base speed in px/sec
            const baseSpeed = 80 * (this.speed || 1);
            if (typeof cx === 'number' && typeof cy === 'number') {
                const mycx = this.x + (this.width||0)/2;
                const mycy = this.y + (this.height||0)/2;
                const dx = cx - mycx;
                const dy = cy - mycy;
                const dist = Math.hypot(dx, dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                this.vx = nx; this.vy = ny; // normalized direction
                const movedX = nx * baseSpeed * (dt / 1000);
                const movedY = ny * baseSpeed * (dt / 1000);
                this.x += movedX;
                this.y += movedY;
                // store actual speed in px/sec for animation timing
                this._currentSpeed = Math.hypot(nx * baseSpeed, ny * baseSpeed);
            } else {
                // fallback to previous linear motion
                const speedPxPerSec = (this.speed || 1) * 60 * 0.8;
                this.x += (this.vx || 0) * speedPxPerSec * (dt / 1000);
                this.y += (this.vy || 0) * speedPxPerSec * (dt / 1000);
                this._currentSpeed = Math.hypot((this.vx || 0) * speedPxPerSec, (this.vy || 0) * speedPxPerSec);
            }
            // keep in bounds vertically
            if (typeof window !== 'undefined' && window.world) {
                const h = window.world.canvas.height;
                this.y = Math.max(0, Math.min(h - this.height, this.y));
            }
        } catch (e) {
            // on error, fallback to previous behaviour
            const speedPxPerSec = (this.speed || 1) * 60 * 0.8;
            this.x += (this.vx || 0) * speedPxPerSec * (dt / 1000);
            this.y += (this.vy || 0) * speedPxPerSec * (dt / 1000);
        }
    }

    // Override takeDamage to count bubble hits; only bubbles should call takeDamage(1)
    takeDamage(amount) {
        // Each bubble hit counts as one towards the hitCount
        try {
            if (typeof amount === 'number' && amount > 0) {
                this.hitCount += Math.round(amount);
                this.health = Math.max(0, this.maxHealth - this.hitCount);
                console.log('Boss hit by bubble. hits=', this.hitCount, 'remaining=', this.health);
                if (this.hitCount >= this.maxHealth) {
                    this._dead = true;
                }
            }
        } catch (e) {}
    }

}