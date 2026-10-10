const fs = require('fs');
let js = fs.readFileSync('js/app.js', 'utf8');

js = js.replace(/4500\);/g, '3500);');

fs.writeFileSync('js/app.js', js, 'utf8');
