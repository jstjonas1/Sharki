class BackgroundObject extends MovableObject {
    constructor(lightPath, darkPath = null) {
        super();
        this.lightPath = lightPath;
        this.darkPath = darkPath;
        this.x = 0;
        this.y = 0;
        this.width = 1500;
        this.height = 480;
        this.isDark = false;
      
        if (this.lightPath) this.loadImage(this.lightPath).catch(() => {});
    }

    setDarkMode(isDark) {
        this.isDark = !!isDark;
        const path = this.isDark && this.darkPath ? this.darkPath : this.lightPath;
        if (path) {
          
            const probe = new Image();
            probe.onload = () => { this.loadImage(path).catch(() => {}); };
            probe.onerror = () => {
              
                if (this.lightPath && path !== this.lightPath) this.loadImage(this.lightPath).catch(() => {});
            };
            probe.src = path;
        }
    }

  
    drawTo(ctx) {
        try {
            if (this.img instanceof Image && this.img.complete) {
                this._drawBackgroundImage(ctx);
                return;
            }
        } catch (e) {}
        if (typeof super.drawTo === 'function') super.drawTo(ctx);
    }

    /**
     * Draw background image scaled to canvas height.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _drawBackgroundImage(ctx) {
        const trim = this._getTrimData();
        const { dx, dy, dw, dh } = this._calculateBackgroundDimensions(ctx, trim);
        ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, dx, dy, dw, dh);
        this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
    }

    /**
     * Get trim data for background image.
     * @returns {Object} Trim data
     */
    _getTrimData() {
        return this.img._trim || { sx: 0, sy: 0, sw: this.img.naturalWidth, sh: this.img.naturalHeight };
    }

    /**
     * Calculate background draw dimensions.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} trim - Trim data
     * @returns {Object} {dx, dy, dw, dh}
     */
    _calculateBackgroundDimensions(ctx, trim) {
        const canvasH = ctx.canvas.height || this.height || 480;
        const scale = canvasH / (trim.sh || 1);
        const dw = Math.max(1, Math.round(trim.sw * scale));
        const dh = Math.max(1, Math.round(trim.sh * scale));
        const dx = Math.round((ctx.canvas.width - dw) / 2);
        const dy = 0;
        return { dx, dy, dw, dh };
    }
}
