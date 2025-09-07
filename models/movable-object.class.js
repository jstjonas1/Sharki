class MovableObject {
    height = 150;
    width = 100;
    speed = 1;
    y = 180;
    x = 50;

    
    loadImage(path) {
        this.img = new Image();   
        this.img.src = path;
    }

    moveRight() {

    }

    moveLeft() {

    }
















    loadFrames(paths = [], scale = 0.25, frameInterval = 100) {
        this.frames = [];
        this.frameIndex = 0;
        this.frameInterval = frameInterval;
        const loaders = paths.map(p => new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Failed to load ' + p));
            i.src = p;
        }));
        this._loadPromise = Promise.all(loaders).then(images => {
            this.frames = images;
            // set primary img to first frame for compatibility
            this.img = images[0];
            const w = Math.max(8, Math.round(this.img.naturalWidth * scale));
            const h = Math.max(8, Math.round(this.img.naturalHeight * scale));
            this.width = w;
            this.height = h;
            this.isLoaded = true;
            return this;
        });
        return this._loadPromise;
    }

    // Load a sequence of images but don't assign them to the active `frames` slot.
    // Returns a Promise that resolves to an array of Image objects.
    loadImageSequence(paths = [], scale = 0.25, frameInterval = 100) {
        const loaders = paths.map(p => new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Failed to load ' + p));
            i.src = p;
        }));
        return Promise.all(loaders).then(images => {
            // don't overwrite active frames/img here; caller will decide when to swap
            return images;
        });
    }

    move(dx, dy) {
        this.x += dx * this.speed;
        this.y += dy * this.speed;
    }

    draw(ctx) {
    // advance animation timer (if any)
    if (this.frames && this.frames.length > 1) {
        this._frameTimer += Math.max(16, (typeof window !== 'undefined' && window.performance && window.performance.now) ? 16 : 16);
        // we can't access dt easily here; use simple modulus
        const now = Date.now();
        // rotate frames using interval and Date
        if (!this._lastFrameTick) this._lastFrameTick = Date.now();
        const delta = Date.now() - this._lastFrameTick;
        if (delta >= this.frameInterval) {
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
            this.img = this.frames[this.frameIndex];
            this._lastFrameTick = Date.now();
        }
    }

    if (this.img instanceof HTMLImageElement && this.img.complete && this.img.naturalWidth) {
            const imgW = this.img.naturalWidth;
            const imgH = this.img.naturalHeight;
            const boxW = this.width;
            const boxH = this.height;
            const imgAspect = imgW / imgH;
            const boxAspect = boxW / boxH;

            let drawW, drawH;
            if (imgAspect > boxAspect) {
                drawW = boxW;
                drawH = boxW / imgAspect;
            } else {
                drawH = boxH;
                drawW = boxH * imgAspect;
            }

            const drawX = this.x + (boxW - drawW) / 2;
            const drawY = this.y + (boxH - drawH) / 2;

            try {
                if (this.flipX) {
                    // draw flipped horizontally around the image center
                    ctx.save();
                    const cx = drawX + drawW / 2;
                    const cy = drawY + drawH / 2;
                    ctx.translate(cx, cy);
                    ctx.scale(-1, 1);
                    ctx.drawImage(this.img, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();
                } else {
                    ctx.drawImage(this.img, drawX, drawY, drawW, drawH);
                }
            } catch (e) {
                ctx.fillStyle = "red";
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        } else {
            ctx.fillStyle = "red";
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}
