import sharp from 'sharp';

const src = 'docs/icon-studio.png';

const sizes = [
  { size: 512, out: 'docs/icon-512.png' },
  { size: 192, out: 'docs/icon-192.png' },
  { size: 180, out: 'docs/icon-180.png' },
  { size: 32,  out: 'docs/favicon.png' },
];

for (const { size, out } of sizes) {
  await sharp(src)
    .trim({ threshold: 40 })
    .resize(size, size, { fit: 'contain', background: { r: 250, g: 247, b: 243, alpha: 1 } })
    .flatten({ background: { r: 250, g: 247, b: 243 } })
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}
