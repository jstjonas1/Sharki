class Water extends BackgroundObject {
    constructor(x, y, width, height, speed) {
        super();
        this.x = x || 0; this.y = y || 0; this.width = width || 1500; this.height = height || 480;
        // use known existing path under assets (no parent relative from models)
        this.loadImage('./assets/img/sharki/3background/layers/5water/d2.png').catch(() => {});
    }
}