const fs = require('fs');

let content = fs.readFileSync('data.js', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(content).project;

const layouts = data[5];
const hasilAkhir = layouts.find(l => l[0] === 'hasil akhir');
console.log('hasilAkhir length:', hasilAkhir.length);
for (let i = 0; i < hasilAkhir.length; i++) {
  const item = hasilAkhir[i];
  console.log(`index ${i}: type=${typeof item}, isArr=${Array.isArray(item)}, len=${item && item.length}`);
}
// If layers is an array of arrays
for (let i = 0; i < hasilAkhir.length; i++) {
  const item = hasilAkhir[i];
  if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
    console.log(`\nArray at index ${i} has ${item.length} sub-arrays. First sub-array length: ${item[0].length}`);
    console.log('First sub-array:', item[0]);
  }
}
