import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');

const iconSvgPath = path.join(publicDir, 'icon.svg');
const faviconSvgPath = path.join(publicDir, 'favicon.svg');
const tempBasePng = path.join(publicDir, 'temp-base-512.png');
const tempFavPng = path.join(publicDir, 'temp-fav-128.png');

console.log('[Icon Gen] Generating raster assets from SVG via sips...');

// 1. Render base 512x512 PNG from icon.svg
execSync(`sips -s format png "${iconSvgPath}" --out "${tempBasePng}"`, { stdio: 'inherit' });

// 2. Produce icon-512.png
const icon512Path = path.join(publicDir, 'icon-512.png');
execSync(`sips -z 512 512 "${tempBasePng}" --out "${icon512Path}"`, { stdio: 'inherit' });

// 3. Produce icon-192.png
const icon192Path = path.join(publicDir, 'icon-192.png');
execSync(`sips -z 192 192 "${tempBasePng}" --out "${icon192Path}"`, { stdio: 'inherit' });

// 4. Produce apple-touch-icon.png (180x180)
const appleTouchPath = path.join(publicDir, 'apple-touch-icon.png');
execSync(`sips -z 180 180 "${tempBasePng}" --out "${appleTouchPath}"`, { stdio: 'inherit' });

// 5. Render standalone favicon PNGs from favicon.svg
execSync(`sips -s format png "${faviconSvgPath}" --out "${tempFavPng}"`, { stdio: 'inherit' });

const favSizes = [16, 32, 48];
const tempFavImages = [];

for (const size of favSizes) {
  const tempPath = path.join(publicDir, `temp-fav-${size}.png`);
  execSync(`sips -z ${size} ${size} "${tempFavPng}" --out "${tempPath}"`, { stdio: 'inherit' });
  const buf = fs.readFileSync(tempPath);
  tempFavImages.push({ size, buffer: buf });
  fs.unlinkSync(tempPath);
}

// 6. Build multi-resolution favicon.ico containing PNG entries
function createIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const entriesTotalSize = entrySize * images.length;
  let currentOffset = headerSize + entriesTotalSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const entryBuffers = [];
  const imageBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // size of image data
    entry.writeUInt32LE(currentOffset, 12); // image offset

    entryBuffers.push(entry);
    imageBuffers.push(img.buffer);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, ...entryBuffers, ...imageBuffers]);
}

const icoBuffer = createIco(tempFavImages);
const faviconIcoPath = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(faviconIcoPath, icoBuffer);

// Clean up temp base PNGs
if (fs.existsSync(tempBasePng)) fs.unlinkSync(tempBasePng);
if (fs.existsSync(tempFavPng)) fs.unlinkSync(tempFavPng);

console.log('[Icon Gen] Successfully generated:');
console.log(' - public/icon.svg');
console.log(' - public/favicon.svg');
console.log(' - public/favicon.ico');
console.log(' - public/icon-192.png');
console.log(' - public/icon-512.png');
console.log(' - public/apple-touch-icon.png');
