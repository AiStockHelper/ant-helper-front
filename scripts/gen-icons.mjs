// public/icon.svg 와 같은 도형을 PNG 로 래스터라이즈합니다. (외부 의존성 없음)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const legs = [
  [[29, 14], [23, 7]],
  [[35, 14], [41, 7]],
  [[32, 29], [19, 23], [14, 27]],
  [[32, 29], [17, 34], [13, 40]],
  [[32, 31], [21, 44], [18, 51]],
  [[32, 29], [45, 23], [50, 27]],
  [[32, 29], [47, 34], [51, 40]],
  [[32, 31], [43, 44], [46, 51]],
]
const segments = []
for (const line of legs) for (let i = 0; i < line.length - 1; i++) segments.push([line[i], line[i + 1]])

function distToSegment(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function inAnt(x, y) {
  if (Math.hypot(x - 32, y - 18) <= 5.6) return true
  if (Math.hypot(x - 32, y - 29.5) <= 5) return true
  if (((x - 32) / 8) ** 2 + ((y - 45) / 9.5) ** 2 <= 1) return true
  return segments.some((s) => distToSegment(x, y, s) <= 1.3)
}

function inRoundedRect(x, y, r) {
  if (x < 0 || y < 0 || x > 64 || y > 64) return false
  const cx = Math.min(Math.max(x, r), 64 - r)
  const cy = Math.min(Math.max(y, r), 64 - r)
  return Math.hypot(x - cx, y - cy) <= r
}

function background(x, y) {
  const t = Math.min(1, Math.max(0, (x * 50 + y * 58 - 8 * 50 - 4 * 58) / (50 * 50 + 58 * 58)))
  return [139 + (109 - 139) * t, 92 + (40 - 92) * t, 246 + (217 - 246) * t]
}

function render(size, { maskable }) {
  const ss = 3
  const scale = maskable ? 0.72 : 1
  const px = Buffer.alloc(size * size * 4)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const x = ((i + (si + 0.5) / ss) / size) * 64
          const y = ((j + (sj + 0.5) / ss) / size) * 64
          const inside = maskable ? true : inRoundedRect(x, y, 15)
          if (!inside) continue
          const ax = (x - 32) / scale + 32
          const ay = (y - 32) / scale + 32
          const [br, bg, bb] = inAnt(ax, ay) ? [255, 255, 255] : background(x, y)
          r += br; g += bg; b += bb; a += 1
        }
      }
      const n = ss * ss
      const o = (j * size + i) * 4
      if (a > 0) {
        px[o] = Math.round(r / a)
        px[o + 1] = Math.round(g / a)
        px[o + 2] = Math.round(b / a)
      }
      px[o + 3] = Math.round((a / n) * 255)
    }
  }
  return px
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]
for (const [name, size, maskable] of targets) {
  writeFileSync(join(outDir, name), png(size, render(size, { maskable })))
  console.log('wrote', name)
}
