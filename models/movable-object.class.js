class MovableObject {
    height = 150;
    width = 100;
    speed = 1;
    y = 180;
    x = 50;
    z = 0;

    /**
     * Load a single image for this object.
     * @param {string} path - Path to the image file
     * @returns {Promise} Promise that resolves when image is loaded
     */
    loadImage(path) {
        const img = new Image();
        try { this._firstFramePath = path; this.img = img; } catch (e) {}
        const p = this._createImageLoadPromise(img, path);
        this._trackPendingLoad(p);
        return p;
    }

    /**
     * Create promise for image loading.
     * @param {Image} img - Image element
     * @param {string} path - Image path
     * @returns {Promise} Load promise
     */
    _createImageLoadPromise(img, path) {
        return new Promise((resolve, reject) => {
            img.onload = () => { this.img = img; resolve(this); };
            img.onerror = () => reject(new Error('Failed to load ' + path));
            img.src = path;
        });
    }

    /**
     * Track pending load in window._pendingLoads.
     * @param {Promise} p - Promise to track
     */
    _trackPendingLoad(p) {
        try { 
            if (typeof window !== 'undefined') { 
                window._pendingLoads = window._pendingLoads || []; 
                window._pendingLoads.push(p); 
            } 
        } catch (e) {}
    }

    /**
     * Compute the visible (non-transparent) bounding box of an image.
     * @param {Image} img - Image to analyze
     * @returns {Object} Trim data {sx, sy, sw, sh}
     */
    static computeTrim(img) {
        if (!img || !(img instanceof Image) || !img.complete) return { sx: 0, sy: 0, sw: img.naturalWidth || 0, sh: img.naturalHeight || 0 };
        if (img._trim) return img._trim;
        const {w, h, canvas, ctx} = this._createTrimCanvas(img);
        try {
            const data = ctx.getImageData(0, 0, w, h).data;
            const bounds = this._findVisibleBounds(data, w, h);
            img._trim = this._calculateTrimRect(bounds, w, h);
        } catch (e) {
            img._trim = { sx: 0, sy: 0, sw: w, sh: h };
        }
        return img._trim;
    }

    /**
     * Create canvas for trim computation.
     * @param {Image} img - Image to process
     * @returns {Object} {w, h, canvas, ctx}
     * @private
     */
    static _createTrimCanvas(img) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        return {w, h, canvas, ctx};
    }

    /**
     * Find visible pixel bounds in image data.
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} w - Width
     * @param {number} h - Height
     * @returns {Object} {minX, minY, maxX, maxY, has}
     * @private
     */
    static _findVisibleBounds(data, w, h) {
        let minX = w, minY = h, maxX = 0, maxY = 0;
        let has = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4 + 3;
                if (data[idx] > 0) {
                    has = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        return {minX, minY, maxX, maxY, has};
    }

    /**
     * Calculate trim rectangle from bounds.
     * @param {Object} bounds - Bounds data
     * @param {number} w - Image width
     * @param {number} h - Image height
     * @returns {Object} Trim rect {sx, sy, sw, sh}
     * @private
     */
    static _calculateTrimRect(bounds, w, h) {
        if (!bounds.has) {
            return { sx: 0, sy: 0, sw: w, sh: h };
        }
        return {
            sx: bounds.minX,
            sy: bounds.minY,
            sw: (bounds.maxX - bounds.minX + 1),
            sh: (bounds.maxY - bounds.minY + 1)
        };
    }

    /**
     * Calculate object size based on score value.
     * @param {number} score - Score value
     * @returns {Object} Size {height, width}
     */
    static sizeFromScore(score) {
        const minScore = 1000, maxScore = 100000;
        const minH = 25, maxH = 250;
        const clamped = Math.max(minScore, Math.min(maxScore, typeof score === 'number' ? score : minScore));
        const t = (clamped - minScore) / (maxScore - minScore);
        const h = Math.round(minH + (maxH - minH) * t);
        const w = Math.max(16, Math.round(h * 0.6));
        return { height: h, width: w };
    }

    /**
     * Load multiple image frames for animation.
     * @param {Array<string>} paths - Array of image paths
     * @param {number} frameInterval - Milliseconds between frames
     * @returns {Promise} Promise resolving to this object
     */
    loadFrames(paths = [], frameInterval = 100) {
        this._initializeFrameData(paths, frameInterval);
        const loaders = this._createFrameLoaders(paths);
        this._trackPendingLoads(loaders);
        return this._processLoadedFrames(loaders);
    }

    /**
     * Initialize frame data structure.
     * @param {Array} paths - Image paths
     * @param {number} frameInterval - Frame interval
     */
    _initializeFrameData(paths, frameInterval) {
        this.frames = [];
        this.frameIndex = 0;
        this.frameInterval = frameInterval;
        try { 
            if (Array.isArray(paths) && paths.length > 0) { 
                this._firstFramePath = paths[0]; 
                try { this.img = new Image(); this.img.src = paths[0]; } catch (e) {} 
            } 
        } catch (e) {}
    }

    /**
     * Create image loaders for all frame paths.
     * @param {Array} paths - Image paths
     * @returns {Array} Array of promises
     */
    _createFrameLoaders(paths) {
        return paths.map(p => new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Failed to load ' + p));
            i.src = p;
        }));
    }

    /**
     * Track multiple pending loads.
     * @param {Array} loaders - Array of promises
     */
    _trackPendingLoads(loaders) {
        try { 
            if (typeof window !== 'undefined') { 
                window._pendingLoads = window._pendingLoads || []; 
                window._pendingLoads.push(...loaders); 
            } 
        } catch (e) {}
    }

    /**
     * Process loaded frame images.
     * @param {Array} loaders - Array of promises
     * @returns {Promise} Promise resolving to this
     */
    _processLoadedFrames(loaders) {
        return Promise.all(loaders).then(images => {
            this.frames = images;
            this.img = this.frames[0];
            this.frameTrims = this.frames.map(f => MovableObject.computeTrim(f));
            this._setInitialDimensions();
            this._lastFrameTick = Date.now();
            return this;
        });
    }

    /**
     * Set initial width/height from first frame trim.
     */
    _setInitialDimensions() {
        if (!this.width || !this.height) {
            const t0 = this.frameTrims[0] || { sw: this.img.naturalWidth, sh: this.img.naturalHeight };
            this.width = t0.sw || this.img.naturalWidth || this.width;
            this.height = t0.sh || this.img.naturalHeight || this.height;
        }
    }

    /**
     * Load frames using a pattern (e.g., {i}.png) or from manifest.
     * @param {string} base - Base path for frames
     * @param {Array<string>} patternList - Patterns with {i} placeholder
     * @param {number} maxTries - Maximum frame indices to try
     * @param {number} frameInterval - Milliseconds between frames
     * @returns {Promise} Promise resolving to this object
     */
    loadFramesPattern(base, patternList = ['{i}.png'], maxTries = 12, frameInterval = 100) {
        if (this._tryLoadFromManifest(base, frameInterval)) {
            return this._tryLoadFromManifest(base, frameInterval);
        }
        this._setFirstFrameGuess(base, patternList);
        return this._probePatternFrames(base, patternList, maxTries, frameInterval);
    }

    /**
     * Try loading from FRAMES_MANIFEST if available.
     * @param {string} base - Base path
     * @param {number} frameInterval - Frame interval
     * @returns {Promise|null} Promise or null
     */
    _tryLoadFromManifest(base, frameInterval) {
        try {
            if (typeof window !== 'undefined' && window.FRAMES_MANIFEST && Array.isArray(window.FRAMES_MANIFEST[base])) {
                const list = window.FRAMES_MANIFEST[base].map(fn => base + fn);
                return this.loadFrames(list, frameInterval);
            }
        } catch (e) {}
        return null;
    }

    /**
     * Set first frame guess for early display.
     * @param {string} base - Base path
     * @param {Array} patternList - Pattern list
     */
    _setFirstFrameGuess(base, patternList) {
        try {
            const guess = base + patternList[0].replace('{i}', 1);
            this._firstFramePath = guess;
            try { this.img = new Image(); this.img.src = guess; } catch (e) {}
        } catch (e) {}
    }

    /**
     * Probe and load frames matching patterns.
     * @param {string} base - Base path
     * @param {Array} patternList - Pattern list
     * @param {number} maxTries - Max indices
     * @param {number} frameInterval - Frame interval
     * @returns {Promise} Promise resolving to this
     */
    _probePatternFrames(base, patternList, maxTries, frameInterval) {
        const tryLoad = (path) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = path;
        });
        return new Promise(async (resolve, reject) => {
            const frames = await this._scanPatternIndices(base, patternList, maxTries, tryLoad);
            if (frames.length === 0) return reject(new Error('pattern load failed'));
            this._finalizePatternFrames(frames, frameInterval);
            resolve(this);
        });
    }

    /**
     * Scan indices for pattern matches.
     * @param {string} base - Base path
     * @param {Array} patternList - Pattern list
     * @param {number} maxTries - Max indices
     * @param {Function} tryLoad - Load function
     * @returns {Promise<Array>} Frame images
     */
    async _scanPatternIndices(base, patternList, maxTries, tryLoad) {
        const frames = [];
        const {missStop, state} = this._initScanState();
        for (let i = 1; i <= maxTries; i++) {
            const found = await this._tryPatternIndex(base, patternList, i, tryLoad, frames);
            if (this._shouldStopScan(found, frames.length, state, missStop)) break;
        }
        return frames;
    }

    /**
     * Initialize scan state.
     * @returns {Object} {missStop, state}
     * @private
     */
    _initScanState() {
        return { missStop: 3, state: { consecutiveMisses: 0 } };
    }

    /**
     * Check if scan should stop.
     * @param {boolean} found - Whether frame was found
     * @param {number} framesLength - Current frames count
     * @param {Object} state - Scan state
     * @param {number} missStop - Miss stop threshold
     * @returns {boolean} True if should stop
     * @private
     */
    _shouldStopScan(found, framesLength, state, missStop) {
        if (!found) {
            state.consecutiveMisses++;
            return framesLength > 0 && state.consecutiveMisses >= missStop;
        } else {
            state.consecutiveMisses = 0;
            return false;
        }
    }

    /**
     * Try loading a specific index with all patterns.
     * @param {string} base - Base path
     * @param {Array} patternList - Pattern list
     * @param {number} i - Index
     * @param {Function} tryLoad - Load function
     * @param {Array} frames - Frames array to push to
     * @returns {Promise<boolean>} True if found
     */
    async _tryPatternIndex(base, patternList, i, tryLoad, frames) {
        for (const pat of patternList) {
            const name = pat.replace('{i}', i);
            const path = base + name;
            const p = tryLoad(path);
            try { if (typeof window !== 'undefined') { window._pendingLoads = window._pendingLoads || []; window._pendingLoads.push(p); } } catch (e) {}
            const img = await p;
            if (img) {
                frames.push(img);
                return true;
            }
        }
        return false;
    }

    /**
     * Finalize pattern frames after loading.
     * @param {Array} frames - Loaded frames
     * @param {number} frameInterval - Frame interval
     */
    _finalizePatternFrames(frames, frameInterval) {
        this.frames = frames;
        this.frameIndex = 0;
        this.frameInterval = frameInterval;
        this.frameTrims = this.frames.map(f => MovableObject.computeTrim(f));
        this.img = this.frames[0];
        this._setInitialDimensions();
        this._lastFrameTick = Date.now();
    }

    /**
     * Draw this object to the canvas context.
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     */
    drawTo(ctx) {
        if (this.frames && this.frames.length > 1) {
            this._updateFrameAnimation();
        }
        if (this.img instanceof Image && this.img.complete) {
            this._drawMainImage(ctx);
        } else {
            if (!this._tryDrawFromAssetCache(ctx)) {
                ctx.fillStyle = 'rgba(255,0,0,.25)';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
    }

    /**
     * Update frame animation based on timing.
     */
    _updateFrameAnimation() {
        const now = Date.now();
        if (!this._lastFrameTick) this._lastFrameTick = now;
        const speedRatio = this._calculateSpeedRatio();
        const effInterval = this._getEffectiveFrameInterval(speedRatio);
        const delta = now - this._lastFrameTick;
        if (delta >= effInterval) {
            this._advanceFrame(now);
        }
    }

    /**
     * Calculate speed ratio for animation timing.
     * @returns {number} Speed ratio
     */
    _calculateSpeedRatio() {
        try {
            const world = (typeof window !== 'undefined') ? window.world : null;
            const charBasePx = (world && world.character && typeof world.character.speed === 'number') ? (world.character.speed * 60) : ((this.speed || 1) * 60);
            const cur = (typeof this._currentSpeed === 'number') ? this._currentSpeed : 0;
            return charBasePx > 0 ? cur / charBasePx : 0;
        } catch (e) { return 0; }
    }

    /**
     * Get effective frame interval based on speed.
     * @param {number} speedRatio - Speed ratio
     * @returns {number} Interval in ms
     */
    _getEffectiveFrameInterval(speedRatio) {
        return Math.max(25, Math.round((this.frameInterval || 100) / (0.5 + speedRatio)));
    }

    /**
     * Advance to next frame.
     * @param {number} now - Current timestamp
     */
    _advanceFrame(now) {
        const nextIndex = this.frameIndex + 1;
        if (this.animationLoop === false) {
            this._advanceNonLooping(nextIndex, now);
        } else {
            this.frameIndex = nextIndex % this.frames.length;
            this.img = this.frames[this.frameIndex];
            this._lastFrameTick = now;
        }
    }

    /**
     * Advance non-looping animation.
     * @param {number} nextIndex - Next frame index
     * @param {number} now - Timestamp
     */
    _advanceNonLooping(nextIndex, now) {
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
    }

    /**
     * Draw main image with trimming and scaling.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _drawMainImage(ctx) {
        const trim = this._getTrimData();
        try {
            const { dx, dy, dw, dh } = this._calculateDrawDimensions(trim);
            if (this.flipX) {
                this._drawFlipped(ctx, trim, dx, dy, dw, dh);
            } else {
                ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, dx, dy, dw, dh);
            }
            this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
        } catch (e) {
            this._drawFallbackImage(ctx);
        }
    }

    /**
     * Get trim data for current image.
     * @returns {Object} Trim data
     */
    _getTrimData() {
        return this.img._trim || (this.frameTrims && this.frameTrims[this.frameIndex]) || 
               { sx: 0, sy: 0, sw: this.img.naturalWidth, sh: this.img.naturalHeight };
    }

    /**
     * Calculate final draw dimensions with scaling and visual multiplier.
     * @param {Object} trim - Trim data
     * @returns {Object} {dx, dy, dw, dh}
     */
    _calculateDrawDimensions(trim) {
        const targetW = this.width || trim.sw;
        const targetH = this.height || trim.sh;
        const {baseW, baseH, offsetX, offsetY} = this._calculateBaseScaling(trim, targetW, targetH);
        const vMult = (typeof this.visualSizeMultiplier === 'number') ? this.visualSizeMultiplier : 1;
        const dw = Math.max(1, Math.round(baseW * vMult));
        const dh = Math.max(1, Math.round(baseH * vMult));
        const dx = Math.round(this.x + offsetX - (dw - baseW) / 2);
        const dy = Math.round(this.y + offsetY - (dh - baseH) / 2);
        return { dx, dy, dw, dh };
    }

    /**
     * Calculate base scaling dimensions.
     * @param {Object} trim - Trim data
     * @param {number} targetW - Target width
     * @param {number} targetH - Target height
     * @returns {Object} {baseW, baseH, offsetX, offsetY}
     * @private
     */
    _calculateBaseScaling(trim, targetW, targetH) {
        const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
        const baseW = Math.max(1, Math.round(trim.sw * scale));
        const baseH = Math.max(1, Math.round(trim.sh * scale));
        const offsetX = Math.round((targetW - baseW) / 2);
        const offsetY = Math.round((targetH - baseH) / 2);
        return {baseW, baseH, offsetX, offsetY};
    }

    /**
     * Draw image flipped horizontally.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} trim - Trim data
     * @param {number} dx - X position
     * @param {number} dy - Y position
     * @param {number} dw - Width
     * @param {number} dh - Height
     */
    _drawFlipped(ctx, trim, dx, dy, dw, dh) {
        ctx.save();
        const cx = dx + dw / 2;
        const cy = dy + dh / 2;
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        ctx.drawImage(this.img, trim.sx, trim.sy, trim.sw, trim.sh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }

    /**
     * Draw fallback image when main draw fails.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    _drawFallbackImage(ctx) {
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
            ctx.fillStyle = 'rgba(255,0,0,.25)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            this._lastDraw = { x: this.x, y: this.y, width: this.width, height: this.height };
        }
    }

    /**
     * Try drawing from asset cache.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @returns {boolean} True if drawn successfully
     */
    _tryDrawFromAssetCache(ctx) {
        try {
            const path = this._firstFramePath;
            if (path && typeof window !== 'undefined' && window._assetCache && window._assetCache[path] instanceof Image && window._assetCache[path].complete) {
                const aimg = window._assetCache[path];
                const trim = aimg._trim || { sx: 0, sy: 0, sw: aimg.naturalWidth, sh: aimg.naturalHeight };
                const { dx, dy, dw, dh } = this._calculateCacheDrawDimensions(trim);
                ctx.drawImage(aimg, trim.sx, trim.sy, trim.sw, trim.sh, dx, dy, dw, dh);
                this._lastDraw = { x: dx, y: dy, width: dw, height: dh };
                return true;
            }
        } catch (e) {}
        return false;
    }

    /**
     * Calculate draw dimensions for asset cache image.
     * @param {Object} trim - Trim data
     * @returns {Object} {dx, dy, dw, dh}
     */
    _calculateCacheDrawDimensions(trim) {
        const targetW = this.width || trim.sw;
        const targetH = this.height || trim.sh;
        const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
        const dw = Math.max(1, Math.round(trim.sw * scale));
        const dh = Math.max(1, Math.round(trim.sh * scale));
        const offsetX = Math.round((targetW - dw) / 2);
        const offsetY = Math.round((targetH - dh) / 2);
        return { dx: this.x + offsetX, dy: this.y + offsetY, dw, dh };
    }

    /**
     * Get circular hitbox for collision detection.
     * @returns {Object} Hitbox {cx, cy, r, x, y, width, height}
     */
    getHitBox() {
        const { dx, dy, dw, dh } = this._getDrawDimensions();
        const cx = Math.round(dx + dw / 2);
        const cy = Math.round(dy + dh / 2);
        const r = Math.max(0, Math.round(Math.min(dw, dh) * 0.5 * 0.9));
        return { cx: cx, cy: cy, r: r, x: dx, y: dy, width: dw, height: dh };
    }

    /**
     * Get draw dimensions for hitbox calculation.
     * @returns {Object} {dx, dy, dw, dh}
     */
    _getDrawDimensions() {
        if (this._lastDraw) {
            return { dx: this._lastDraw.x, dy: this._lastDraw.y, dw: this._lastDraw.width, dh: this._lastDraw.height };
        }
        if (this.img && this.img._trim) {
            return this._calculateTrimmedDimensions();
        }
        return { dx: this.x, dy: this.y, dw: this.width, dh: this.height };
    }

    /**
     * Calculate dimensions from trim data.
     * @returns {Object} {dx, dy, dw, dh}
     */
    _calculateTrimmedDimensions() {
        const trim = this.img._trim;
        const targetW = this.width || trim.sw;
        const targetH = this.height || trim.sh;
        const scale = Math.min(targetW / trim.sw, targetH / trim.sh);
        const dw = Math.max(1, Math.round(trim.sw * scale));
        const dh = Math.max(1, Math.round(trim.sh * scale));
        const offsetX = Math.round((targetW - dw) / 2);
        const offsetY = Math.round((targetH - dh) / 2);
        return { dx: this.x + offsetX, dy: this.y + offsetY, dw, dh };
    }

    /**
     * Move object to the right (placeholder method).
     */
    moveRight() {

    }

    /**
     * Move object to the left (placeholder method).
     */
    moveLeft() {

    }





}