/**
 * Generates a real PNG source icon (appicon.png) with no third-party deps, so
 * `tauri icon` can derive the full platform icon set. Encodes a 1024×1024 RGBA
 * PNG by hand using Node's zlib (deflate + crc32).
 */
import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const SIZE = 1024;

// Mission-control palette: dark panel field with an accent block.
const BG = [0x09, 0x0d, 0x14, 0xff];
const ACCENT = [0x4f, 0x8c, 0xff, 0xff];

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const inBlock =
      x > SIZE * 0.3 && x < SIZE * 0.7 && y > SIZE * 0.3 && y < SIZE * 0.7;
    const [r, g, b, a] = inBlock ? ACCENT : BG;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }
}

// Prepend the per-scanline filter byte (0 = None).
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const src = y * SIZE * 4;
  const dst = y * (1 + SIZE * 4);
  raw[dst] = 0;
  pixels.copy(raw, dst + 1, src, src + SIZE * 4);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("appicon.png", png);
console.log(`wrote appicon.png (${png.length} bytes, ${SIZE}x${SIZE})`);
