#!/usr/bin/env node
/**
 * Generates placeholder PWA icons as SVG files.
 * Replace with actual PNG icons before production deployment.
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]

for (const size of sizes) {
  const fontSize = Math.floor(size * 0.4)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.2)}" fill="url(#grad)"/>
  <text x="50%" y="55%" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">⚡</text>
</svg>`

  const filename = size === 180 ? 'apple-touch-icon' : `icon-${size}`
  fs.writeFileSync(path.join(iconsDir, `${filename}.svg`), svg)
  // Also write as .png placeholder (just the SVG content — in production, use real PNG)
  fs.writeFileSync(path.join(iconsDir, `${filename}.png`), svg)
  console.log(`Created ${filename}`)
}

console.log('\nNote: These are SVG placeholders saved as .png.')
console.log('Replace with actual PNG files using a tool like sharp or svgexport before deploying.')
