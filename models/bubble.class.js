/**
 * Bubble projectile shot by the player character.
 * @extends MovableObject
 */
class Bubble extends MovableObject {
    /**
     * Create a bubble projectile.
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} dir - Direction (1 for right, -1 for left)
     */
    constructor(x, y, dir = 1) {
        super();
        this.x = x || 0;
        this.y = y || 0;
        this.vx = (dir || 1) * 200; // px/sec
        this.vy = -40; // slight upward velocity
        this.lifetime = 3000; // ms
        this._born = Date.now();
        this.width = 16;
        this.height = 16;
        this.img = new Image();
      
        this.img.src = './assets/img/sharki/1sharkie/4attack/bubble_trap/bubble.png';
    }

    /**
     * Update bubble position.
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt) {
        this.x += (this.vx * dt) / 1000;
        this.y += (this.vy * dt) / 1000;
    }

    /**
     * Check if bubble has expired and should be removed.
     * @returns {boolean} True if expired
     */
    isExpired() {
        return (Date.now() - this._born) > this.lifetime;
    }
}
