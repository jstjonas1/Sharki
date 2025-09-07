class JellyFish extends Enemy {
    constructor() {
        super().loadImage('../assets/img/sharki/2enemy/2jelly_fish/regular_damage/lila1.png');

        const base = '../assets/img/sharki/2enemy/2jelly_fish/regular_damage/';
        const frames = ['lila1.png','lila2.png','lila3.png','lila4.png'].map(f => base + f);
        this.loadFrames(frames, 0.25, 140).catch(() => {
            // fallback to a single readable image if frames fail
            this.loadImage('../assets/img/sharki/2enemy/2jelly_fish/regular_damage/lila1.png');
        });
    }

}