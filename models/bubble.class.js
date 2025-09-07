class Bubble extends MovableObject {
    constructor(x, y, vx = 0, vy = -1, speed = 4) {
        super(x, y, 24, 24, speed);
        this.vx = vx;
        this.vy = vy;
        this.lifetime = 5000; // ms
        this._born = Date.now();
        // load bubble image if available
        this.loadImage('../assets/img/sharki/1sharkie/4attack/bubble_trap/bubble.png', 0.5).catch(() => {});
    }

    update(dt) {
        const s = this.speed;
        this.x += this.vx * s * (dt/16);
        this.y += this.vy * s * (dt/16);
    }

    isExpired() {
        return (Date.now() - this._born) > this.lifetime;
    }
}

export default Bubble;
