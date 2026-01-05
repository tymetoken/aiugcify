// Simple script to generate placeholder icons
// Creates colored square PNGs with "AI" text

const fs = require('fs');
const path = require('path');

// Simple PNG generator for a solid color square
function createPNG(size) {
  // PNG header and IHDR chunk
  const width = size;
  const height = size;

  // Create raw pixel data (RGBA)
  const pixels = [];
  for (let y = 0; y < height; y++) {
    pixels.push(0); // Filter byte
    for (let x = 0; x < width; x++) {
      // Purple gradient background (#8B5CF6)
      pixels.push(139); // R
      pixels.push(92);  // G
      pixels.push(246); // B
      pixels.push(255); // A
    }
  }

  const pixelData = Buffer.from(pixels);

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(pixelData);

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(6, 17); // color type (RGBA)
  ihdr.writeUInt8(0, 18); // compression
  ihdr.writeUInt8(0, 19); // filter
  ihdr.writeUInt8(0, 20); // interlace
  const ihdrCrc = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk
  const idatData = Buffer.concat([Buffer.from('IDAT'), compressed]);
  const idatCrc = crc32(idatData);
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idatData.copy(idat, 4);
  idat.writeUInt32BE(idatCrc, compressed.length + 8);

  // IEND chunk
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
});

console.log('Icons generated successfully!');
