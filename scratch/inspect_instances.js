const fs = require('fs');

let content = fs.readFileSync('data.js', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(content).project;

const layouts = data[5];
const hasilAkhir = layouts.find(l => l[0] === 'hasil akhir');
const layer0 = hasilAkhir[6][0];
const instances = layer0[14];

console.log('Instances count:', instances.length);
for (const inst of instances) {
  // inst format: [ [x, y, z, w, h, angle, opacity ...], typeId, ... ]
  const coords = inst[0];
  const typeId = inst[1];
  const type = data[3][typeId];
  const typeName = type ? type[0] : 'unknown';
  const anims = type && type[7] ? type[7][0] : null;
  const frame0 = anims && anims[7] ? anims[7][0] : null;
  const imgPath = frame0 ? frame0[0] : '';
  console.log(`Obj ${typeName} (${imgPath}):`, coords);
}
