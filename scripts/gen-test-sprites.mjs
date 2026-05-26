/**
 * 零依赖生成测试用 sprite sheet PNG（纯手写 PNG 格式）
 * 运行：node scripts/gen-test-sprites.mjs
 * 输出：scripts/test-sprites/*.png
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'test-sprites')
mkdirSync(OUT, { recursive: true })

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crc])
}

/**
 * 生成 RGBA 像素的 PNG Buffer
 * pixels: Uint8Array, width×height×4 (RGBA)
 */
function encodePNG(pixels, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Raw image data: filter byte + row
  const raw = Buffer.alloc((1 + width * 4) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0  // filter=None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (1 + width * 4) + 1 + x * 4
      raw[dst]     = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
    }
  }
  const compressed = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 解析颜色 #rrggbb → [r,g,b]
function hex(h) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 生成一张 N 帧横拼 sprite sheet */
function makeSheet(frames, color, alpha = 220) {
  const W = 128 * frames, H = 128
  const pixels = new Uint8Array(W * H * 4)  // 全透明
  const [r, g, b] = hex(color)

  for (let fi = 0; fi < frames; fi++) {
    const ox = fi * 128
    // 画一个圆（猫的占位）
    const cx = ox + 64, cy = 64, radius = 50
    for (let y = 0; y < 128; y++) {
      for (let x = ox; x < ox + 128; x++) {
        const dx = x - cx, dy = y - cy
        if (dx * dx + dy * dy <= radius * radius) {
          // 每帧 alpha 有轻微变化模拟呼吸
          const frameAlpha = Math.floor(alpha * (0.7 + 0.3 * (fi / Math.max(frames - 1, 1))))
          const idx = (y * W + x) * 4
          pixels[idx]     = r
          pixels[idx + 1] = g
          pixels[idx + 2] = b
          pixels[idx + 3] = frameAlpha
        }
      }
    }
  }
  return encodePNG(pixels, W, H)
}

const SPRITES = [
  { name: 'walk_sheet',     frames: 5, color: '#4a90d9' },
  { name: 'sit_sheet',      frames: 4, color: '#7b68ee' },
  { name: 'sit_idle_sheet', frames: 3, color: '#9370db' },
  { name: 'sleep_sheet',    frames: 4, color: '#50c878' },
  { name: 'sneak_sheet',    frames: 4, color: '#ff8c42' },
  { name: 'liedown_sheet',  frames: 5, color: '#ff6b6b' },
  { name: 'rest_sheet',     frames: 2, color: '#ffd93d' },
]

for (const { name, frames, color } of SPRITES) {
  const buf = makeSheet(frames, color)
  const p = join(OUT, `${name}.png`)
  writeFileSync(p, buf)
  console.log(`✓ ${name}.png  ${128 * frames}×128`)
}
console.log(`\n完成！文件在：${OUT}`)
