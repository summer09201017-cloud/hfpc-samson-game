// 從 scripts/logo.svg 產生 PWA 所需的各種尺寸圖示到 public/icons/
// 執行:node scripts/gen-icons.mjs(需要 sharp)
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(__dirname, 'logo.svg'))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const targets = [
  [192, 'pwa-192x192.png'],
  [512, 'pwa-512x512.png'],
  [512, 'maskable-512x512.png'],
  [180, 'apple-touch-icon-180x180.png'],
]

for (const [size, name] of targets) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(join(outDir, name))
  console.log('已產生', name)
}
