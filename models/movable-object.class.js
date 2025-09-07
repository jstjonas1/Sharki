class MovableObject {
    height = 150;
    width = 100;
    speed = 1;
    y = 180;
    x = 50;
    z = 0;

    
    // load a single image
    loadImage(path) {
        // create a temporary image and only assign to this.img on successful load
    const img = new Image();
    // set as early fallback so callers can start drawing this image when it completes
    try { this._firstFramePath = path; this.img = img; } catch (e) {}
        const p = new Promise((resolve, reject) => {
            img.onload = () => {
                this.img = img;
                resolve(this);
            };
            img.onerror = () => reject(new Error('Failed to load ' + path));
            img.src = path;
        });
        try { if (typeof window !== 'undefined') { window._pendingLoads = window._pendingLoads || []; window._pendingLoads.push(p); } } catch (e) {}
        return p;
    }

    // compute the trimmed bounding box of non-transparent pixels for an Image
    static computeTrim(img) {
        if (!img || !(img instanceof Image) || !img.complete) return { sx: 0, sy: 0, sw: img.naturalWidth || 0, sh: img.naturalHeight || 0 };
        if (img._trim) return img._trim;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cx = c.getContext('2d');
        cx.clearRect(0, 0, w, h);
        cx.drawImage(img, 0, 0);
        try {
            const data = cx.getImageData(0, 0, w, h).data;
            let minX = w, minY = h, maxX = 0, maxY = 0;
            let has = false;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4 + 3; // alpha channel
                    if (data[idx] > 0) {
                        has = true;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (!has) {
                img._trim = { sx: 0, sy: 0, sw: w, sh: h };
            } else {
                img._trim = { sx: minX, sy: minY, sw: (maxX - minX + 1), sh: (maxY - minY + 1) };
            }
        } catch (e) {
            // Security error or other; fallback to full image
            img._trim = { sx: 0, sy: 0, sw: w, sh: h };
        }
        return img._trim;
    }

    // shared helper: compute width/height from a score using the canonical mapping
    static sizeFromScore(score) {
        const minScore = 1000, maxScore = 100000;
        const minH = 25, maxH = 250;
        const clamped = Math.max(minScore, Math.min(maxScore, typeof score === 'number' ? score : minScore));
        const t = (clamped - minScore) / (maxScore - minScore);
        const h = Math.round(minH + (maxH - minH) * t);
        const w = Math.max(16, Math.round(h * 0.6));
        return { height: h, width: w };
    }

    // load multiple frames and enable animation
    loadFrames(paths = [], frameInterval = 100) {
        this.frames = [];
        this.frameIndex = 0;
        this.frameInterval = frameInterval;
    // early-first-frame: remember first path and start loading single-image fallback
    try { if (Array.isArray(paths) && paths.length > 0) { this._firstFramePath = paths[0]; try { this.img = new Image(); this.img.src = paths[0]; } catch (e) {} } } catch (e) {}
        const loaders = paths.map(p => new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Failed to load ' + p));
            i.src = p;
        }));
        // register loaders globally so callers can wait for all pending loads
        try { if (typeof window !== 'undefined') { window._pendingLoads = window._pendingLoads || []; window._pendingLoads.push(...loaders); } } catch (e) {}
        return Promise.all(loaders).then(images => {
            this.frames = images;
            this.img = this.frames[0];
            // set default width/height from first frame if not set
            // compute trims for frames and set default width/height from trimmed first frame if not set
            this.frameTrims = this.frames.map(f => MovableObject.computeTrim(f));
            if (!this.width || !this.height) {
                const t0 = this.frameTrims[0] || { sw: this.img.naturalWidth, sh: this.img.naturalHeight };
                this.width = t0.sw || this.img.naturalWidth || this.width;
                this.height = t0.sh || this.img.naturalHeight || this.height;
            }
            this._lastFrameTick = Date.now();
            return this;
        });
    }

    // attempt to load frames using a naming pattern like 'base + i + ext'
    loadFramesPattern(base, patternList = ['{i}.png'], maxTries = 12, frameInterval = 100) {
        // If a global manifest exists for this base path, use it to avoid probing
        try {
            if (typeof window !== 'undefined' && window.FRAMES_MANIFEST && Array.isArray(window.FRAMES_MANIFEST[base])) {
                const list = window.FRAMES_MANIFEST[base].map(fn => base + fn);
                return this.loadFrames(list, frameInterval);
            }
        } catch (e) {}

        // safer pattern loader: probe sequentially and stop after a few consecutive misses
        // set an early-first-frame fallback (try first index path) so the game can show a sprite while probing
        try {
            const guess = base + patternList[0].replace('{i}', 1);
            this._firstFramePath = guess;
            try { this.img = new Image(); this.img.src = guess; } catch (e) {}
        } catch (e) {}
        const tryLoad = (path) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = path;
        });

    return new Promise(async (resolve, reject) => {
            const probes = [];
            const frames = [];
            let consecutiveMisses = 0;
            const missStop = 3; // stop after this many consecutive indices with no match
            for (let i = 1; i <= maxTries; i++) {
                let foundThisIndex = false;
                for (const pat of patternList) {
                    const name = pat.replace('{i}', i);
                    const path = base + name;
                    // try load but don't reject on failure
                    // eslint-disable-next-line no-await-in-loop
                    const p = tryLoad(path);
                    try { if (typeof window !== 'undefined') { window._pendingLoads = window._pendingLoads || []; window._pendingLoads.push(p); } } catch (e) {}
                    probes.push(p);
                    const img = await p;
                    if (img) {
                        frames.push(img);
                        foundThisIndex = true;
                        consecutiveMisses = 0;
                        break; // prefer first matching pattern for this index
                    }
                }
                if (!foundThisIndex) {
                    consecutiveMisses++;
                    if (frames.length > 0 && consecutiveMisses >= missStop) break;
                }
            }

            if (frames.length === 0) return reject(new Error('pattern load failed'));

            // assign frames directly (we already have Image instances)
            this.frames = frames;
            this.frameIndex = 0;
            this.frameInterval = frameInterval;
            this.frameTrims = this.frames.map(f => MovableObject.computeTrim(f));
            this.img = this.frames[0];
            if (!this.width || !this.height) {
                const t0 = this.frameTrims[0] || { sw: this.img.naturalWidth, sh: this.img.naturalHeight };
                this.width = t0.sw || this.img.naturalWidth || this.width;
                this.height = t0.sh || this.img.naturalHeight || this.height;
            }
            this._lastFrameTick = Date.now();
            resolve(this);
        });
    }

    // drawing with simple frame animation
    drawTo(ctx) {
        // advance frames (animation speed adapts to movement speed when available)
        if (this.frames && this.frames.length > 1) {
            const now = Date.now();
            if (!this._lastFrameTick) this._lastFrameTick = now;
            // compute a speed ratio based on actual movement speed in px/sec (not normalized vx/vy)
            // use _currentSpeed (set by subclasses in update) and normalize relative to character base px/sec
            let speedRatio = 0;
            try {
                const world = (typeof window !== 'undefined') ? window.world : null;
                const charBasePx = (world && world.character && typeof world.character.speed === 'number') ? (world.character.speed * 60) : ((this.speed || 1) * 60);
                const cur = (typeof this._currentSpeed === 'number') ? this._currentSpeed : 0;
                if (charBasePx > 0) speedRatio = cur / charBasePx;
            } catch (e) { speedRatio = 0; }
            // effective interval: higher movement speed => lower interval (faster animation)
            // formula: divide base interval by (0.5 + speedRatio) so stationary = slower, moving = faster
            const effInterval = Math.max(25, Math.round((this.frameInterval || 100) / (0.5 + speedRatio)));
            const delta = now - this._lastFrameTick;
            if (delta >= effInterval) {
                const nextIndex = this.frameIndex + 1;
                if (this.animationLoop === false) {
                    // non-looping: stop at last frame and call end callback
                    if (nextIndex >= this.frames.length) {
                        this.frameIndex = this.frames.length - 1;
                        this.img = this.frames[this.frameIndex];
                        this._lastFrameTick = now;
                        if (typeof this._onAnimationEnd === 'function') {
                            const cb = this._onAnimationEnd;
                            this._onAnimationEnd = null;
                            try { cb(); } catch (e) {}
                        }
                    } else {
                        this.frameIndex = nextIndex;
                        this.img = this.frames[this.frameIndex];
                        this._lastFrameTick = now;
                    }
                } else {
                    this.frameIndex = nextIndex % this.frames.length;
                    this.img = this.frames[this.frameIndex];
                    this._lastFrameTick = now;
                }
            }
        }

        if (this.img instanceof Image && this.img.complete) {
            // use trim if available on the image
            const trim = this.img._trim || (this.frameTrims && this.frameTrims[this.frameIndex]) || { sx: 0, sy: 0, sw: this.img.naturalWidth, sh: this.img.naturalHeight };
            try {
                // compute display size preserving aspect ratio (contain within this.width x this.height)
                const targetW = this.width || trim.sw;
                const targetH = this.height || trim.sh;
                const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
                const dw = Math.max(1, Math.round(trim.sw * scale));
                const dh = Math.max(1, Math.round(trim.sh * scale));
                const offsetX = Math.round((targetW - dw) / 2);
                const offsetY = Math.round((targetH - dh) / 2);
                const dx = this.x + offsetX;
                const dy = this.y + offsetY;

                // apply visual size multiplier if present (for temporary visual growth)
                const vMult = (typeof this.visualSizeMultiplier === 'number') ? this.visualSizeMultiplier : 1;
                const dwFinal = Math.max(1, Math.round(dw * vMult));
                const dhFinal = Math.max(1, Math.round(dh * vMult));
                // recenter if size changed
                const dxFinal = Math.round(dx - (dwFinal - dw) / 2);
                const dyFinal = Math.round(dy - (dhFinal - dh) / 2);
                if (this.flipX) {
                    ctx.save();
                    // flip around the center of the drawn area
                    const cx = dxFinal + dwFinal / 2;
                    const cy = dyFinal + dhFinal / 2;
                    ctx.translate(cx, cy);
                    ctx.scale(-1, 1);
                    ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, -dwFinal / 2, -dhFinal / 2, dwFinal, dhFinal);
                    ctx.restore();
                } else {
                    ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, dxFinal, dyFinal, dwFinal, dhFinal);
                }
                // cache last drawn rect for hitbox calculations
                this._lastDraw = { x: dxFinal, y: dyFinal, width: dwFinal, height: dhFinal };
                // cache last drawn rect for hitbox calculations
                this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
            } catch (e) {
                // fallback to previous behavior
                try {
                    if (this.flipX) {
                        ctx.save();
                        const cx = this.x + this.width / 2;
                        const cy = this.y + this.height / 2;
                        ctx.translate(cx, cy);
                        ctx.scale(-1, 1);
                        ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
                        ctx.restore();
                    } else {
                        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
                    }
                    this._lastDraw = { x: this.x, y: this.y, width: this.width, height: this.height };
                } catch (e2) {
                    // final fallback: rectangle
                    ctx.fillStyle = 'rgba(255,0,0,.25)';
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                    this._lastDraw = { x: this.x, y: this.y, width: this.width, height: this.height };
                }
            }
        } else {
            // try global asset cache for a first-frame image path before drawing placeholder
            try {
                const path = this._firstFramePath;
                if (path && typeof window !== 'undefined' && window._assetCache && window._assetCache[path] instanceof Image && window._assetCache[path].complete) {
                    const aimg = window._assetCache[path];
                    const trim = aimg._trim || { sx: 0, sy: 0, sw: aimg.naturalWidth, sh: aimg.naturalHeight };
                    const targetW = this.width || trim.sw;
                    const targetH = this.height || trim.sh;
                    const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
                    const dw = Math.max(1, Math.round(trim.sw * scale));
                    const dh = Math.max(1, Math.round(trim.sh * scale));
                    const offsetX = Math.round((targetW - dw) / 2);
                    const offsetY = Math.round((targetH - dh) / 2);
                    const dx = this.x + offsetX;
                    const dy = this.y + offsetY;
                    ctx.drawImage(aimg, trim.sx, trim.sy, trim.sw, trim.sh, dx, dy, dw, dh);
                    this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
                    return;
                }
            } catch (e) {}
            ctx.fillStyle = 'rgba(255,0,0,.25)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // get a circular hitbox based on the actually drawn image (10% smaller radius)
    getHitBox() {
        // prefer last drawn rect if available (set in drawTo)
        let dx = this.x, dy = this.y, dw = this.width, dh = this.height;
        if (this._lastDraw) {
            dx = this._lastDraw.x; dy = this._lastDraw.y; dw = this._lastDraw.width; dh = this._lastDraw.height;
        }
        // fallback to trim if we have image but haven't drawn yet
        else if (this.img && this.img._trim) {
            const trim = this.img._trim;
            // compute width/height preserving aspect using this.width/height as target
            const targetW = this.width || trim.sw;
            const targetH = this.height || trim.sh;
            const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
            dw = Math.max(1, Math.round(trim.sw * scale));
            dh = Math.max(1, Math.round(trim.sh * scale));
            const offsetX = Math.round((targetW - dw) / 2);
            const offsetY = Math.round((targetH - dh) / 2);
            dx = this.x + offsetX; dy = this.y + offsetY;
        }

        const cx = Math.round(dx + dw / 2);
        const cy = Math.round(dy + dh / 2);
        // radius is half min dimension, reduced by 10% for a 10% smaller hitbox
        const r = Math.max(0, Math.round(Math.min(dw, dh) * 0.5 * 0.9));
        return { cx: cx, cy: cy, r: r, x: dx, y: dy, width: dw, height: dh };
    }

    moveRight() {

    }

    moveLeft() {

    }





}