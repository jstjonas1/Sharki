class Boss extends Enemy {
    constructor() {
        super().loadImage('../assets/img/sharki/2enemy/3final_enemy/2floating/1.png');
        
        // try to load floating frames for idle animation
        const base = '../assets/img/sharki/2enemy/3final_enemy/2floating/';
        const frames = ['1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png','9.png','10.png','11.png','12.png','13.png'].map(f => base + f);
        this.loadFrames(frames, 0.25, 140).catch(() => {
            this.loadImage('../assets/img/sharki/2enemy/3final_enemy/1introduce/10.png');
        });
    }

}