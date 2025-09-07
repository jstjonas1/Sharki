class Enemy extends MovableObject {
    constructor(x, y, width, height, speed) {
        super(x, y, width, height, speed);
        this.x = Math.random() * 500 + 200; // Start off-screen to the right
        this.vx = 0;
        this.vy = 0;
        this._changeDirTimer = 0;
        this._changeDirInterval = 1000 + Math.random() * 2000; // ms
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

        // move according to vx, vy and speed (time-based)
        // Derive a base speed from the character's configured speed so enemies
        // move at ~70% of character speed. Character.speed is used in a
        // per-frame context, so convert it to approximate pixels/second by
        // multiplying by 60 (assume ~60 FPS), then scale to 70%.
        let charSpeed = (this.speed || 1);
        if (typeof window !== 'undefined' && window.world && window.world.character && typeof window.world.character.speed === 'number') {
            charSpeed = window.world.character.speed;
        }
        const targetSpeedPerSecond = charSpeed * 60 * 0.7; // approx px/sec
        const moveAmount = targetSpeedPerSecond * (dt / 1000);
        this.x += this.vx * moveAmount;
        this.y += this.vy * moveAmount;
    }

}
