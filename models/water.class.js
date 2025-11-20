/**
 * Water overlay layer for visual effects.
 * @extends BackgroundObject
 */
class Water extends BackgroundObject {
    /**
     * Create a water layer.
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} speed - Movement speed
     */
    constructor(x, y, width, height, speed) {
        super();
        this.x = x || 0; this.y = y || 0; this.width = width || 1500; this.height = height || 480;
      
        this.loadImage('./assets/img/sharki/3background/layers/5water/d2.png').catch(() => {});
    }
}