// Rebuilds js/data/recipes.seed.js from data/recipes.json so the app works when opened straight from disk.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'data', 'recipes.json'), 'utf8'));
const out = '/* Starting recipes. Generated from data/recipes.json (run: node tools/build-seed.js). */\nwindow.KM_SEED = ' + JSON.stringify(recipes) + ';\n';
fs.writeFileSync(path.join(root, 'js', 'data', 'recipes.seed.js'), out);
console.log('Wrote ' + recipes.length + ' recipes');
