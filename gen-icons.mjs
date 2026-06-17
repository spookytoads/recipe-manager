/**
 * Rasterize public/favicon.svg into the PNG sizes iOS + Android/PWA need.
 * Run once locally after changing the icon:  node gen-icons.mjs
 * (sharp is installed ad-hoc with `npm i sharp --no-save` — not a project dep.)
 */
import { readFileSync } from 'fs'
import sharp from 'sharp'

const svg = readFileSync('public/favicon.svg')
const targets = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
]

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(file)
  console.log(`wrote ${file} (${size}x${size})`)
}
