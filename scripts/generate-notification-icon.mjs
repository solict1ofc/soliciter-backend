/**
 * Generates a 96x96 Android notification icon:
 *   - transparent background
 *   - white bell/service icon (simplified "S" shape inside a circle outline)
 * Output: artifacts/mobile/assets/images/notification-icon.png
 */
import { createWriteStream } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../artifacts/mobile/assets/images/notification-icon.png");

const W = 96, H = 96;

// Build RGBA pixel grid (all transparent = 0)
const rgba = new Uint8Array(W * H * 4); // all zeros = transparent

function setPixel(x, y, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  rgba[i]     = 255; // R white
  rgba[i + 1] = 255; // G white
  rgba[i + 2] = 255; // B white
  rgba[i + 3] = a;   // A
}

function fillCircle(cx, cy, r, innerR = 0) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r && (innerR === 0 || dist >= innerR)) {
        setPixel(x, y);
      }
    }
  }
}

function fillRect(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(x, y);
}

function fillRoundRect(x1, y1, x2, y2, r) {
  // Fill interior
  fillRect(x1 + r, y1, x2 - r, y2);
  fillRect(x1, y1 + r, x2, y2 - r);
  // Corners
  fillCircle(x1 + r, y1 + r, r);
  fillCircle(x2 - r, y1 + r, r);
  fillCircle(x1 + r, y2 - r, r);
  fillCircle(x2 - r, y2 - r, r);
}

// ── Draw a simple service/handshake icon ────────────────────────────
// Outer ring (circle outline) with 5px stroke
const cx = 48, cy = 48, R = 40, stroke = 5;
fillCircle(cx, cy, R, R - stroke);

// Inner "wrench-like" cross shape: two rounded rectangles rotated
// Horizontal bar
fillRoundRect(22, 44, 74, 52, 4);
// Vertical bar
fillRoundRect(44, 22, 52, 74, 4);

// Center dot
fillCircle(cx, cy, 7);

// ── PNG encoder ─────────────────────────────────────────────────────
function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// IDAT - filter byte 0 per scanline + raw RGBA
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter none
  for (let x = 0; x < W; x++) {
    const src = (y * W + x) * 4;
    const dst = y * (1 + W * 4) + 1 + x * 4;
    raw[dst]     = rgba[src];
    raw[dst + 1] = rgba[src + 1];
    raw[dst + 2] = rgba[src + 2];
    raw[dst + 3] = rgba[src + 3];
  }
}
const compressed = deflateSync(raw, { level: 9 });

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  PNG_SIG,
  chunk("IHDR", ihdr),
  chunk("IDAT", compressed),
  chunk("IEND", Buffer.alloc(0)),
]);

const ws = createWriteStream(OUT);
ws.write(png);
ws.end();
ws.on("finish", () => console.log("✅ notification-icon.png created at", OUT));
ws.on("error", e => { console.error(e); process.exit(1); });
