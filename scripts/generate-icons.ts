/**
 * Renders the PWA / favicon PNGs from the SVG sources in public/icons.
 *
 *   npx tsx scripts/generate-icons.ts
 *
 * - icon.svg          rounded icon ("any" purpose, favicon)
 * - icon-maskable.svg full-bleed icon for Android masks and the Apple touch icon
 *
 * Uses sharp, which ships with Next.js.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const iconsDir = path.join(process.cwd(), "public", "icons");
const rounded = fs.readFileSync(path.join(iconsDir, "icon.svg"));
const maskable = fs.readFileSync(path.join(iconsDir, "icon-maskable.svg"));

const outputs: Array<{ source: Buffer; size: number; file: string }> = [
  { source: rounded, size: 192, file: "public/icons/icon-192.png" },
  { source: rounded, size: 512, file: "public/icons/icon-512.png" },
  { source: maskable, size: 192, file: "public/icons/icon-maskable-192.png" },
  { source: maskable, size: 512, file: "public/icons/icon-maskable-512.png" },
  // iOS applies its own rounded mask, so the touch icon must be full-bleed
  { source: maskable, size: 180, file: "public/icons/apple-touch-icon.png" },
  { source: rounded, size: 32, file: "public/favicon.png" },
];

async function main() {
  for (const { source, size, file } of outputs) {
    await sharp(source, { density: 384 }).resize(size, size).png().toFile(path.join(process.cwd(), file));
    console.log(`wrote ${file} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
