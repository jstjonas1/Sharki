class JellyFish extends Enemy {
    constructor(x, y, width = 60, height = 80, speed = 1, score = null, speedFactor = null) {
        super(x, y, width, height, speed, score);
        if (typeof speedFactor === 'number') this.speedFactor = speedFactor;
        this.z = 1;
    const base = 'assets/img/sharki/2enemy/2jelly_fish/regular_damage/';
        const paths = ['lila1.png','lila2.png','lila3.png','lila4.png'].map(p => base + p);
        this.loadFrames(paths, 140).catch(() => this.loadImage(base + 'lila1.png'));
    this.vx = this.vx || -1;
          
            try {
                const sf = (typeof this.speedFactor === 'number') ? this.speedFactor : 0.5;
                this.frameInterval = Math.max(30, Math.round(140 / (0.5 + sf)));
            } catch (e) {}
          
          
            try {
                if (typeof this.score === 'number') {
                    this.score = Math.round(this.score * 1.3);
                  
                    if (typeof this.applySizeFromScore === 'function') this.applySizeFromScore();
                }
            } catch (e) {}
          
            this.visualSizeMultiplier = 0.7;
    }

    update(dt) {
        try {
            let charSpeed = (this.speed || 1);
            if (typeof window !== 'undefined' && window.world && window.world.character && typeof window.world.character.speed === 'number') {
                charSpeed = window.world.character.speed;
            }
            const effectiveFactor = Math.min((typeof this.speedFactor === 'number' ? this.speedFactor : 1.0), 1.0);
            const speedPxPerSec = charSpeed * 60 * effectiveFactor; // px/sec
            const moveAmount = speedPxPerSec * (dt / 1000);
            this.x += this.vx * moveAmount;
          
            const bobAmp = Math.max(4, Math.round(this.height * 0.06));
            const bobFreq = 0.002 + (0.003 * (1 - effectiveFactor));
            this.y += Math.sin(Date.now() * bobFreq + (this._bobOffset || 0)) * (bobAmp * (dt/1000));
          
            this._currentSpeed = Math.abs((this.vx || 0) * speedPxPerSec);
        } catch (err) {
            const speedPxPerSec = (this.speed || 1) * 60 * 0.6;
            this.x += this.vx * speedPxPerSec * (dt / 1000);
            this._currentSpeed = Math.abs((this.vx || 0) * speedPxPerSec);
        }
        if (!this._bobOffset) this._bobOffset = Math.random() * Math.PI * 2;
        if (this.vx < 0) this.flipX = false; else if (this.vx > 0) this.flipX = true;
        if (this.x + this.width < -50 || this.x > (typeof window !== 'undefined' && window.world ? window.world.canvas.width + 50 : 800)) {
            this._dead = true;
        }
    }
}


