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
            const cx = world && world.character ? (world.character.x + (world.character.width||0)/2) : null;
            const cy = world && world.character ? (world.character.y + (world.character.height||0)/2) : null;
          
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
              
                this._currentSpeed = Math.hypot(nx * baseSpeed, ny * baseSpeed);
            } else {
              
                const speedPxPerSec = (this.speed || 1) * 60 * 0.8;
                this.x += (this.vx || 0) * speedPxPerSec * (dt / 1000);
                this.y += (this.vy || 0) * speedPxPerSec * (dt / 1000);
                this._currentSpeed = Math.hypot((this.vx || 0) * speedPxPerSec, (this.vy || 0) * speedPxPerSec);
            }
          
            if (typeof window !== 'undefined' && window.world) {
                const h = window.world.canvas.height;
                this.y = Math.max(0, Math.min(h - this.height, this.y));
            }
        } catch (e) {
          
            const speedPxPerSec = (this.speed || 1) * 60 * 0.8;
            this.x += (this.vx || 0) * speedPxPerSec * (dt / 1000);
            this.y += (this.vy || 0) * speedPxPerSec * (dt / 1000);
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