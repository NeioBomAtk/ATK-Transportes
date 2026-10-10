const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The regex matches the pattern anywhere
const regex = /onmouseover="this\.style\.transform='scale\(1\.5\)'; this\.style\.zIndex='10'; this\.style\.position='relative';"[\s\r\n]*onmouseout="this\.style\.transform='scale\(1\)'; this\.style\.zIndex='1';"/g;

html = html.replace(regex, 'onclick="zoomGridApostila(this)" onmouseover="zoomGridApostila(this)"');

fs.writeFileSync('index.html', html, 'utf8');
