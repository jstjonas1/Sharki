const http = require('http');
// Build a more comprehensive list from frames-manifest.js plus key assets
const urls = [
  '/index.html',
  '/assets/img/sharki/frames-manifest.js',
  // sharkie frames
  '/assets/img/sharki/1sharkie/1idle/1.png',
  '/assets/img/sharki/1sharkie/1idle/18.png',
  '/assets/img/sharki/1sharkie/2long_idle/i1.png',
  '/assets/img/sharki/1sharkie/2long_idle/i14.png',
  '/assets/img/sharki/1sharkie/3swim/1.png',
  '/assets/img/sharki/1sharkie/3swim/6.png',
  '/assets/img/sharki/1sharkie/4attack/fin_slap/1.png',
  '/assets/img/sharki/1sharkie/4attack/fin_slap/8.png',
  '/assets/img/sharki/1sharkie/4attack/bubble_trap/bubble.png',
  '/assets/img/sharki/3background/dark/completo.png',
  '/assets/img/sharki/2enemy/3final_enemy/2floating/1.png'
];
let pending = urls.length;
urls.forEach(u => {
  http.get({host:'localhost',port:8088,path:u}, res => {
    console.log(u, res.statusCode);
    res.resume();
    if (--pending === 0) process.exit(0);
  }).on('error', e => { console.log(u,'ERR', e.message); if (--pending === 0) process.exit(1); });
});
