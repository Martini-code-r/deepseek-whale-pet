const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'refs', 'chibi-source.png');
const outDir = path.join(root, 'assets');
fs.mkdirSync(outDir, { recursive: true });

const src = PNG.sync.read(fs.readFileSync(srcPath));
const { width: W, height: H, data } = src;

let minX = W;
let minY = H;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 8) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < minX || maxY < minY) throw new Error('No opaque pixels found.');

const pad = 8;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad);
maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const out = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * W + (minX + x)) * 4;
    const di = (y * cw + x) * 4;
    out.data[di] = data[si];
    out.data[di + 1] = data[si + 1];
    out.data[di + 2] = data[si + 2];
    out.data[di + 3] = data[si + 3];
  }
}
fs.writeFileSync(path.join(outDir, 'pet.png'), PNG.sync.write(out));

// Coarse alpha mask for pixel-accurate click-through in the transparent window.
const maskW = 64;
const maskH = Math.max(1, Math.round((ch / cw) * maskW));
let mask = '';
for (let my = 0; my < maskH; my++) {
  for (let mx = 0; mx < maskW; mx++) {
    const x0 = Math.floor((mx / maskW) * cw);
    const x1 = Math.min(cw, Math.ceil(((mx + 1) / maskW) * cw));
    const y0 = Math.floor((my / maskH) * ch);
    const y1 = Math.min(ch, Math.ceil(((my + 1) / maskH) * ch));
    let hit = 0;
    for (let y = y0; y < y1 && !hit; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        if (out.data[(y * cw + x) * 4 + 3] > 28) {
          hit = 1;
          break;
        }
      }
    }
    mask += hit;
  }
}
fs.writeFileSync(
  path.join(outDir, 'alpha-mask.js'),
  `window.PET_ALPHA_MASK=${JSON.stringify({ w: maskW, h: maskH, data: mask })};\n`
);

// Big head, so a head-and-shoulders crop makes the best avatar.
const faceSize = Math.min(Math.round(cw * 0.66), Math.round(ch * 0.58));
const faceX = Math.max(0, Math.round((cw - faceSize) / 2));
const faceY = Math.max(0, Math.round(ch * 0.04));
const icon = new PNG({ width: faceSize, height: faceSize });
for (let y = 0; y < faceSize; y++) {
  for (let x = 0; x < faceSize; x++) {
    const si = ((faceY + y) * cw + (faceX + x)) * 4;
    const di = (y * faceSize + x) * 4;
    icon.data[di] = out.data[si];
    icon.data[di + 1] = out.data[si + 1];
    icon.data[di + 2] = out.data[si + 2];
    icon.data[di + 3] = out.data[si + 3];
  }
}
fs.writeFileSync(path.join(outDir, 'icon.png'), PNG.sync.write(icon));

const meta = {
  source: `${W}x${H}`,
  crop: { x: minX, y: minY, width: cw, height: ch },
  aspect: +(ch / cw).toFixed(4),
  face: { x: faceX, y: faceY, size: faceSize }
};
fs.writeFileSync(path.join(outDir, 'art-meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
