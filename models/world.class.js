class World {

    character = new Character();
    enemies = [
    new JellyFish(0, 0, 50, 100, 1),
    new PufferFish(0, 0, 150, 50, 1),
    new Boss(0, 0, 100, 510, 1)
    ];
    background = new Background();
    canvas;
    ctx;
    constructor(canvas) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;
        this.draw();
    }

    draw(){
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.character.img, this.character.x, this.character.y, this.character.width, this.character.height);
        this.enemies.forEach(enemy => {
            this.ctx.drawImage(enemy.img, enemy.x, enemy.y, enemy.width, enemy.height);
        });
        this.ctx.drawImage(this.background.img, 0, 0, this.canvas.width, this.canvas.height);
        let self = this;
        requestAnimationFrame(function() { self.draw() });
    }
}