const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('images/bg_feedbackakhir-sheet0.png');
let offset = 8, width = 0, height = 0, idatChunks = [];
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  if (type === 'IHDR') {
    width = buf.readUInt32BE(offset + 8);
    height = buf.readUInt32BE(offset + 12);
  } else if (type === 'IDAT') idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
  else if (type === 'IEND') break;
  offset += 12 + len;
}
const idat = Buffer.concat(idatChunks);
const raw = zlib.inflateSync(idat);
const stride = 1 + width * 4;
const pixels = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y++) {
  const filter = raw[y * stride];
  const rowStart = y * stride + 1;
  const prevRowStart = (y - 1) * width * 4;
  const curRowStart = y * width * 4;
  for (let x = 0; x < width * 4; x++) {
    const rawByte = raw[rowStart + x];
    const a = (x >= 4) ? pixels[curRowStart + x - 4] : 0;
    const b = (y > 0) ? pixels[prevRowStart + x] : 0;
    const c = (y > 0 && x >= 4) ? pixels[prevRowStart + x - 4] : 0;
    let val = rawByte;
    if (filter === 1) val = (rawByte + a) & 0xff;
    else if (filter === 2) val = (rawByte + b) & 0xff;
    else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      let pr = c;
      if (pa <= pb && pa <= pc) pr = a;
      else if (pb <= pc) pr = b;
      val = (rawByte + pr) & 0xff;
    }
    pixels[curRowStart + x] = val;
  }
}

const y = Math.round(0.65 * height);
console.log('Sample pixels from x=480 to 860 at y=', y);
for (let x = 480; x <= 860; x += 20) {
  const idx = (y * width + x) * 4;
  console.log(`x=${x} (${(x/width*100).toFixed(1)}%): RGB(${pixels[idx]}, ${pixels[idx+1]}, ${pixels[idx+2]})`);
}

// Check Scalloped Title banner extent at y=260, 280, 300, 320, 340
console.log('\n--- Checking Title Banner bounds ---');
for (let curY = 220; curY <= 380; curY += 20) {
  let minX = 9999, maxX = -1;
  for (let x = 400; x < 1800; x++) {
    const idx = (curY * width + x) * 4;
    const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2];
    if (r > 245 && g > 230 && b > 205 && (r - b) < 45) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX > minX) {
    console.log(`y=${curY} (${(curY/height*100).toFixed(1)}%): x=${minX}..${maxX} (${(minX/width*100).toFixed(2)}%..${(maxX/width*100).toFixed(2)}%), width=${maxX-minX} (${((maxX-minX)/width*100).toFixed(2)}%), center=${(((minX+maxX)/2)/width*100).toFixed(2)}%`);
  }
}
