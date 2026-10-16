/**
 * Generates valid PNG icons for PWA and Apple Touch Icon using Node.js built-in zlib.
 * Creates uncompressed/deflated RGBA raw PNG chunks (IHDR, IDAT, IEND).
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcInput);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size: number, outPath: string) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth (8), color type (6 = RGBA), compression (0), filter (0), interlace (0)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = createChunk("IHDR", ihdr);

  // Raw image scanlines: filter byte (0) + size * 4 bytes per row
  const rowLength = 1 + size * 4;
  const rawData = Buffer.alloc(rowLength * size);

  const center = size / 2;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Dark squircle rounded background
      // Check rounded corner distance
      const dx = Math.max(0, Math.abs(x - center) - (center - cornerRadius));
      const dy = Math.max(0, Math.abs(y - center) - (center - cornerRadius));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > cornerRadius) {
        // Outside squircle: transparent
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      } else {
        // Base dark background: #09090b
        let r = 9;
        let g = 9;
        let b = 11;
        const a = 255;

        // Draw blue checkmark in center: #0A84FF (r: 10, g: 132, b: 255)
        // Checkmark points: p1(0.32, 0.52), p2(0.44, 0.65), p3(0.68, 0.38)
        const nx = x / size;
        const ny = y / size;

        // Distance to segment 1: (0.30, 0.50) -> (0.43, 0.63)
        // Distance to segment 2: (0.43, 0.63) -> (0.70, 0.36)
        const thickness = 0.055;

        const isCheckmark =
          (nx >= 0.28 && nx <= 0.44 && Math.abs(ny - (0.50 + (nx - 0.28) * 0.9)) < thickness) ||
          (nx >= 0.42 && nx <= 0.72 && Math.abs(ny - (0.64 - (nx - 0.42) * 1.0)) < thickness);

        if (isCheckmark) {
          r = 10;
          g = 132;
          b = 255;
        }

        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", compressedData);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  const pngBuffer = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(outPath, pngBuffer);
}

const iconsDir = path.resolve(process.cwd(), "public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

generatePng(192, path.join(iconsDir, "icon-192.png"));
generatePng(512, path.join(iconsDir, "icon-512.png"));
generatePng(180, path.join(iconsDir, "apple-touch-icon.png"));
generatePng(32, path.resolve(process.cwd(), "public/favicon.png"));

console.log("PNG icons generated successfully.");

