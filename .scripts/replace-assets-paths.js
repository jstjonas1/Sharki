const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pattern = /\.\./g; // we'll be cautious and only replace ../assets occurrences by checking context
const target = '../assets/';
const replacement = 'assets/';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile()) {
      try {
        const ext = path.extname(e.name).toLowerCase();
        if (['.js', '.html', '.css'].indexOf(ext) === -1) return;
        let txt = fs.readFileSync(full, 'utf8');
        if (txt.indexOf('../assets/') >= 0) {
          const newTxt = txt.split('../assets/').join('assets/');
          fs.writeFileSync(full, newTxt, 'utf8');
          console.log('Patched', path.relative(root, full));
        }
      } catch (e) { console.error('err', full, e.message); }
    }
  });
}

console.log('Scanning', root);
walk(root);
console.log('Done');
