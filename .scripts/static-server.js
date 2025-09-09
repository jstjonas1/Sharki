const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const port = 8088;
const mime = {
  '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml', '.json':'application/json', '.ttf':'font/ttf'
};
http.createServer((req,res)=>{
  try{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(root, p.replace(/^\//,''));
    if (!file.startsWith(root)) { res.statusCode=403; return res.end('Forbidden'); }
    fs.stat(file,(err,st)=>{
      if (err || !st.isFile()) { res.statusCode=404; return res.end('Not Found'); }
      const ext = path.extname(file).toLowerCase();
      const mt = mime[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mt);
      const stream = fs.createReadStream(file);
      stream.pipe(res);
    });
  }catch(e){ res.statusCode=500; res.end('Err'); }
}).listen(port, ()=> console.log('static server running on http://localhost:'+port));
