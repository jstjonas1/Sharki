/**
 * Lightweight sound effect helper with simple preload and fire-and-forget playback.
 * @namespace SFX
 */
const SFX = (() => {
    const cache = {};
    const state = { volume: 1, muted: false };
    /**
     * Preload an audio file into memory.
     * @param {string} key Unique identifier for this sound.
     * @param {string} src URL to the audio file.
     */
    function load(key, src) {
        try { const a = new Audio(src); a.preload = 'auto'; cache[key] = a; } catch (e) {}
    }

    /**
     * Play a preloaded sound at the specified volume.
     * @param {string} key Identifier previously loaded with load().
     * @param {number} [vol=1] Volume in range [0,1].
     */
    function play(key, vol = 1) {
        try {
            const base = cache[key]; if (!base) return;
            const node = base.cloneNode();
            const local = Math.max(0, Math.min(1, vol));
            const master = Math.max(0, Math.min(1, state.volume || 0));
            node.volume = state.muted ? 0 : Math.max(0, Math.min(1, local * master));
            node.play().catch(() => {});
        } catch (e) {}
    }

    /**
     * Set the master volume for all sound effects.
     * @param {number} v Volume level in range [0,1].
     */
    function setVolume(v) {
        const nv = (typeof v === 'number') ? v : 1;
        state.volume = Math.max(0, Math.min(1, nv));
        try { localStorage.setItem('sharkyVolume', String(Math.round(state.volume * 100))); } catch (_) {}
    }

    /**
     * Mute or unmute all sound effects.
     * @param {boolean} m True to mute, false to unmute.
     */
    function setMuted(m) {
        state.muted = !!m;
        try { localStorage.setItem('sharkyMuted', state.muted ? '1' : '0'); } catch (_) {}
    }

    /**
     * Get the current master volume level.
     * @returns {number} Volume in range [0,1].
     */
    function getVolume() { return Math.max(0, Math.min(1, state.volume || 0)); }

    /**
     * Check if sound effects are currently muted.
     * @returns {boolean}
     */
    function isMuted() { return !!state.muted; }

    try {
        const mv = parseInt(localStorage.getItem('sharkyVolume') || '100', 10);
        if (!isNaN(mv)) state.volume = Math.max(0, Math.min(1, mv / 100));
        const mm = localStorage.getItem('sharkyMuted');
        if (mm === '1' || mm === '0') state.muted = (mm === '1');
    } catch (_) {}

    return { load, play, setVolume, setMuted, getVolume, isMuted };
})();

window.SFX = SFX;

/**
 * Background music controller with separate volume/mute and autoplay fallback.
 * @namespace BGM
 */
const BGM = (() => {
    let audio = null;
    const state = { volume: 1, muted: false, started: false, _resumeHooked: false };
    const SRC = './audio/music.mp3';
    /**
     * Ensure audio element is created and configured.
     * @private
     */
    function _ensureAudio() {
        if (!audio) {
            try {
                audio = new Audio(SRC);
                audio.preload = 'auto';
                audio.loop = true;
                _applyVolume();
            } catch (e) { audio = null; }
        }
    }

    /**
     * Apply current volume and mute settings to audio element.
     * @private
     */
    function _applyVolume() { if (audio) audio.volume = state.muted ? 0 : Math.max(0, Math.min(1, state.volume || 0)); }

    /**
     * Ensure background music has started playing.
     * @async
     */
    async function ensureStarted() {
        try {
            _ensureAudio(); if (!audio) return;
            if (state.started && !audio.paused) return;
            await audio.play();
            state.started = true;
        } catch (e) { /* likely autoplay blocked */ }
    }

    /**
     * Set the background music volume.
     * @param {number} v Volume level in range [0,1].
     */
    function setVolume(v) {
        const nv = (typeof v === 'number') ? v : 1;
        state.volume = Math.max(0, Math.min(1, nv));
        try { localStorage.setItem('sharkyMusicVolume', String(Math.round(state.volume * 100))); } catch (_) {}
        _applyVolume();
    }

    /**
     * Mute or unmute background music.
     * @param {boolean} m True to mute, false to unmute.
     */
    function setMuted(m) {
        state.muted = !!m;
        try { localStorage.setItem('sharkyMusicMuted', state.muted ? '1' : '0'); } catch (_) {}
        _applyVolume();
    }

    /**
     * Check if background music is currently muted.
     * @returns {boolean}
     */
    function isMuted() { return !!state.muted; }

    /**
     * Get the current background music volume level.
     * @returns {number} Volume in range [0,1].
     */
    function getVolume() { return Math.max(0, Math.min(1, state.volume || 0)); }

    /**
     * Hook event listeners to auto-resume music on user interaction.
     */
    function hookAutoResume() {
        if (state._resumeHooked) return; state._resumeHooked = true;
        const one = async () => {
            await ensureStarted();
            try { document.removeEventListener('pointerdown', one); } catch (_){ }
            try { document.removeEventListener('keydown', one); } catch (_){ }
        };
        try { document.addEventListener('pointerdown', one, { once: true }); } catch (_){ }
        try { document.addEventListener('keydown', one, { once: true }); } catch (_){ }
    }

    try {
        const mv = parseInt(localStorage.getItem('sharkyMusicVolume') || '100', 10);
        if (!isNaN(mv)) state.volume = Math.max(0, Math.min(1, mv / 100));
        const mm = localStorage.getItem('sharkyMusicMuted');
        if (mm === '1' || mm === '0') state.muted = (mm === '1');
    } catch (_) {}

    return { ensureStarted, setVolume, setMuted, isMuted, getVolume, hookAutoResume };
})();

window.BGM = BGM;
