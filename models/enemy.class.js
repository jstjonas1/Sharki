class Enemy extends MovableObject {
    constructor(x, y, width, height, speed, score = null) {
        super(x, y, width, height, speed);
        this.x = typeof x === 'number' ? x : (Math.random() * 500 + 200);
        this.vx = 0;
        this.vy = 0;
        this._changeDirTimer = 0;
        this._changeDirInterval = 1000 + Math.random() * 2000; // ms
        this.maxHealth = 5;
        this.health = this.maxHealth;
        this._dead = false;
        // score-driven size: if score provided use it, otherwise random between 200..100000
        this.score = (typeof score === 'number') ? score : Math.floor(200 + Math.random() * (100000 - 200 + 1));
        this.applySizeFromScore();
    // speedFactor: 0.05..1.0 where 1.0 equals character base speed; ensure within bounds
    // allow a wider spread so some enemies are much slower for visible variation
    this.speedFactor = Math.max(0.05, Math.min(1.0, 0.05 + Math.random() * 0.95));
    }

    // Simple update called each frame: dt in milliseconds
    update(dt){
        // If currently stopped, count down stop timer
        if (this.isStopped) {
            this._stopTimer += dt;
            if (this._stopTimer >= this._stopDuration) {
                this.isStopped = false;
                this._stopTimer = 0;
            } else {
                return; // remain stopped
            }
        }

        this._changeDirTimer += dt;
        if (this._changeDirTimer >= this._changeDirInterval) {
            this._changeDirTimer = 0;
            this._changeDirInterval = 1000 + Math.random() * 2000;
            // small chance to stop for a short random duration
            if (Math.random() < 0.25) {
                this.isStopped = true;
                this._stopDuration = 300 + Math.random() * 1500; // ms
                this._stopTimer = 0;
                this.vx = 0;
                this.vy = 0;
            } else {
                const angle = Math.random() * Math.PI * 2;
                this.vx = Math.cos(angle);
                this.vy = Math.sin(angle);
            }
        }

        // move according to vx/vy scaled by character base speed and this enemy's speedFactor
        let charSpeed = (this.speed || 1);
        if (typeof window !== 'undefined' && window.world && window.world.character && typeof window.world.character.speed === 'number') {
            charSpeed = window.world.character.speed;
        }
        // ensure enemy maximum absolute speed does not exceed character base speed
        const effectiveFactor = Math.min(this.speedFactor, 1.0);
    const speedPxPerSec = charSpeed * 60 * effectiveFactor; // px/sec
    const moveAmount = speedPxPerSec * (dt / 1000);
    this.x += this.vx * moveAmount;
    this.y += this.vy * moveAmount;
    // store actual speed in px/sec for animation timing
    this._currentSpeed = Math.hypot((this.vx || 0) * speedPxPerSec, (this.vy || 0) * speedPxPerSec);
    }

    takeDamage(amount) {
        if (this._dead) return;
        this.health = Math.max(0, this.health - amount);
        console.log(`${this.constructor.name} took ${amount} damage, hp=${this.health}`);
        if (this.health <= 0) {
            this._dead = true;
            // simple removal flag; world will filter out dead enemies
        }
    }

    // Set height/width based on score using same mapping as character
    applySizeFromScore() {
    const s = MovableObject.sizeFromScore(this.score);
    this.height = s.height;
    this.width = s.width;
    }

    // draw with a color cue that indicates relative speed (fast = warm/red, slow = cool/blue)
    drawTo(ctx) {
        // default drawing only (no speed bars for non-boss enemies)
        try {
            if (typeof super.drawTo === 'function') super.drawTo(ctx);
            else if (this.img) ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        } catch (e) {}
    }

}
