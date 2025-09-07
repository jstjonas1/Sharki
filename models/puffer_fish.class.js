class PufferFish extends Enemy {
    constructor() {
        super().loadImage('../assets/img/sharki/2enemy/1puffer_fish_3_color_options/1swim/1_1.png');
    
        
    const base = '../assets/img/sharki/2enemy/1puffer_fish_3_color_options/1swim';
    const frames = ['1_1.png','1_2.png','1_3.png','1_4.png','1_5.png'].map(f => base + f);
    this.loadFrames(frames, 0.25, 120);
    }

}