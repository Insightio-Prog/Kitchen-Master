// Builds one self-contained HTML file with the CSS and all scripts inlined.
//   node tools/build-single.js            -> dist/kitchen-master.html  (full page, works offline apart from fonts)
//   node tools/build-single.js --fragment <out>  -> page fragment for publishing as a Claude artifact
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const css = read('css/styles.css');
const inl = html.replace(/<link rel="stylesheet" href="css\/styles.css">/, () => '<style>\n' + css + '</style>')
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => '<script>\n' + read(src).replace(/<\/script>/gi, '<\\/script>') + '</script>');
const i = process.argv.indexOf('--fragment');
if (i > -1) {
  const out = process.argv[i + 1];
  const frag = inl.replace(/^[\s\S]*?<title>/, '<title>').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '');
  fs.writeFileSync(out, frag);
  console.log('Wrote fragment ' + out);
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'kitchen-master.html'), inl);
  console.log('Wrote dist/kitchen-master.html');
}
