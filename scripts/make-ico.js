'use strict';

// Build a single-image .ico (PNG payload) for Windows shortcuts.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const png = fs.readFileSync(path.join(root, 'assets', 'icon.png'));
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header[6] = 0; // width 256
header[7] = 0; // height 256
header[8] = 0; // palette
header[9] = 0; // reserved
header.writeUInt16LE(1, 10); // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

fs.writeFileSync(path.join(root, 'assets', 'pet.ico'), Buffer.concat([header, png]));
console.log('assets/pet.ico written');
