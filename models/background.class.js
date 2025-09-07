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
        // load initial (light)
        if (this.lightPath) this.loadImage(this.lightPath).catch(() => {});
    }

    setDarkMode(isDark) {
        this.isDark = !!isDark;
        const path = this.isDark && this.darkPath ? this.darkPath : this.lightPath;
        if (path) {
            // attempt to load chosen path safely: only set if load succeeds
            const probe = new Image();
            probe.onload = () => { this.loadImage(path).catch(() => {}); };
            probe.onerror = () => {
                // fallback: try lightPath if dark failed
                if (this.lightPath && path !== this.lightPath) this.loadImage(this.lightPath).catch(() => {});
            };
            probe.src = path;
        }
    }

    // draw background so it always fills canvas height, preserving aspect ratio
    drawTo(ctx) {
        try {
            if (this.img instanceof Image && this.img.complete) {
                const trim = this.img._trim || { sx: 0, sy: 0, sw: this.img.naturalWidth, sh: this.img.naturalHeight };
                const canvasH = ctx.canvas.height || this.height || 480;
                const scale = canvasH / (trim.sh || 1);
                const dw = Math.max(1, Math.round(trim.sw * scale));
                const dh = Math.max(1, Math.round(trim.sh * scale));
                // center horizontally by default
                const dx = Math.round((ctx.canvas.width - dw) / 2);
                const dy = 0;
                ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, dx, dy, dw, dh);
                this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
                return;
            }
        } catch (e) {
            // fall through to default
        }
        // fallback to parent drawing (may draw a placeholder)
        if (typeof super.drawTo === 'function') super.drawTo(ctx);
    }
}
