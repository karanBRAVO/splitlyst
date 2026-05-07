#!/usr/bin/env node
/**
 * Generates PWA icons as real PNG files using sharp.
 * Run: node scripts/generate-icons.js
 * Requires: sharp (already in dependencies)
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]

async function buildSvg(size) {
  const radius = Math.floor(size * 0.2)
  const fontSize = Math.floor(size * 0.42)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="50%" y="54%" font-family="sans-serif" font-size="${fontSize}"
        font-weight="bold" fill="white" text-anchor="middle"
        dominant-baseline="middle">⚡</text>
</svg>`
  )
}

async function main() {
  for (const size of sizes) {
    const svg = await buildSvg(size)
    const filename = size === 180 ? 'apple-touch-icon' : `icon-${size}`

    await sharp(svg)
      .png()
      .toFile(path.join(iconsDir, `${filename}.png`))
    console.log(`✓ ${filename}.png  (${size}×${size})`)
  }
  console.log('\nAll icons generated as real PNG files.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
