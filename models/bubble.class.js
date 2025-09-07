class Bubble extends MovableObject {
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
        // try a likely bubble image; fallback silently if missing
        this.img.src = './assets/img/sharki/1sharkie/4attack/bubble_trap/bubble.png';
    }

    update(dt) {
        this.x += (this.vx * dt) / 1000;
        this.y += (this.vy * dt) / 1000;
    }

    isExpired() {
        return (Date.now() - this._born) > this.lifetime;
    }
}
