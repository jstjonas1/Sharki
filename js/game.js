
let canvas;
let world;

function init() {
    canvas = document.getElementById('gameCanvas');
    world = new World(canvas);
    ctx = canvas.getContext('2d');

    
}

