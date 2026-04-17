import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateIcon(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563EB" rx="${size * 0.18}"/>
  <text x="50%" y="54%" font-family="sans-serif" font-size="${size * 0.45}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">W</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(__dirname, `../public/icon-${size}.png`));

  console.log(`Generated icon-${size}.png`);
}

await generateIcon(192);
await generateIcon(512);
