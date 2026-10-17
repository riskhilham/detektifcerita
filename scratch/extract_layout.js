const fs = require('fs');

let content = fs.readFileSync('data.js', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(content).project;

console.log('Project original size:', data[10], data[11]); // width, height

// data[6] or search for array of layouts
let layouts = null;
for (let i = 0; i < data.length; i++) {
  if (Array.isArray(data[i]) && data[i].length > 0 && Array.isArray(data[i][0]) && typeof data[i][0][0] === 'string') {
    // check if layout names are in this array
    const names = data[i].map(x => x[0]);
    if (names.includes('hasil akhir') || names.includes('misi 1')) {
      layouts = data[i];
      console.log('Found layouts at index', i, 'total layouts:', layouts.length);
      break;
    }
  }
}

if (!layouts) {
  console.log('Could not find layouts array');
  process.exit(1);
}

const hasilAkhir = layouts.find(l => l[0] === 'hasil akhir');
console.log('Hasil akhir layout info:');
console.log('Name:', hasilAkhir[0]);
console.log('Layout dimensions (w, h):', hasilAkhir[1], hasilAkhir[2]);

// Layers are in hasilAkhir[7]
const layers = hasilAkhir[7];
console.log('Total layers:', layers.length);

for (const layer of layers) {
  console.log('\n--- Layer:', layer[0], '---');
  const instances = layer[8];
  if (instances) {
    for (const inst of instances) {
      const typeIndex = inst[1];
      const type = data[3][typeIndex]; // data[3] is types array
      const typeName = type ? type[0] : 'unknown';
      const anims = type && type[7] ? type[7][0] : null;
      const frame0 = anims && anims[7] ? anims[7][0] : null;
      const imgPath = frame0 ? frame0[0] : '';
      console.log(`Obj ${typeName} (${imgPath}): x=${inst[2]}, y=${inst[3]}, w=${inst[4]}, h=${inst[5]}, angle=${inst[6]}`);
    }
  }
}
