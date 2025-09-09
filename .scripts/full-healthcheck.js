const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = 'localhost';
const PORT = 8088;
const root = path.resolve(__dirname, '..');

function parseManifest(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const re = /window\.FRAMES_MANIFEST\s*=\s*window\.FRAMES_MANIFEST\s*\|\|\s*{};[\s\S]*?window\.FRAMES_MANIFEST\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*\[([\s\S]*?)\];/g;
  // fallback: simpler parse by matching all occurrences of window.FRAMES_MANIFEST['...'] = [ ... ];
  const simple = /window\.FRAMES_MANIFEST\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*\[([\s\S]*?)\];/g;
  const res = {};
  let m;
  while ((m = simple.exec(txt)) !== null) {
    const base = m[1];
    const arrText = m[2];
    const files = [];
    const fileRe = /['"]([^'"]+)['"]/g;
    let f;
    while ((f = fileRe.exec(arrText)) !== null) files.push(f[1]);
    res[base] = files;
  }
  return res;
}

function buildUrls(manifestPath) {
  const urls = new Set();
  try {
    if (fs.existsSync(manifestPath)) {
      const manifest = parseManifest(manifestPath);
      for (const base in manifest) {
        const files = manifest[base];
        files.forEach(fn => {
          let p = base + fn;
          if (p.startsWith('./')) p = '/' + p.slice(2);
          else if (!p.startsWith('/')) p = '/' + p;
          urls.add(p);
        });
      }
    }
  } catch (e) { console.error('manifest parse error', e); }
  // add explicit backgrounds used by preloadCriticalAssets
  const backgrounds = [
    './assets/img/sharki/3background/layers/5water/l.png',
    './assets/img/sharki/3background/layers/4fondo_2/l.png',
    './assets/img/sharki/3background/layers/3fondo_1/l.png',
    './assets/img/sharki/3background/layers/2floor/l.png',
    './assets/img/sharki/3background/layers/1light/completo.png'
  ];
  backgrounds.forEach(p => {
    let q = p;
    if (q.startsWith('./')) q = '/' + q.slice(2);
    else if (!q.startsWith('/')) q = '/' + q;
    urls.add(q);
  });
  // add index and frames-manifest itself
  urls.add('/index.html');
  urls.add('/assets/img/sharki/frames-manifest.js');

  return Array.from(urls).sort();
}

function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    const opts = { host: HOST, port: PORT, path: url, method: 'GET', timeout };
    const req = http.request(opts, (res) => {
      const status = res.statusCode;
      // drain
      res.on('data', () => {});
      res.on('end', () => resolve({ url, status }));
    });
    req.on('timeout', () => { req.abort(); resolve({ url, status: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ url, status: 'ERROR', msg: e.message }));
    req.end();
  });
}

async function run() {
  const manifestPath = path.join(root, 'assets', 'img', 'sharki', 'frames-manifest.js');
  console.log('Reading manifest from', manifestPath);
  const urls = buildUrls(manifestPath);
  console.log('Will check', urls.length, 'URLs');
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    process.stdout.write(`Checking ${i+1}/${urls.length}: ${u} ... `);
    // small delay to avoid hammering
    // await new Promise(r => setTimeout(r, 10));
    // ensure leading slash path
    const r = await fetchUrl(u);
    console.log(r.status);
    results.push(r);
  }
  const failed = results.filter(r => !(typeof r.status === 'number' && r.status >= 200 && r.status < 400));
  console.log('\nSummary:');
  console.log('Total:', results.length, 'OK:', results.length - failed.length, 'Failed:', failed.length);
  if (failed.length) {
    console.log('\nFailed URLs:');
    failed.forEach(f => console.log(f.url, f.status, f.msg || ''));
    process.exit(2);
  }
  process.exit(0);
}

run();
