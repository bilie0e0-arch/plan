import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0f766e"/>
  <circle cx="256" cy="256" r="118" fill="none" stroke="#f7f6f3" stroke-width="40"/>
  <circle cx="256" cy="256" r="30" fill="#f7f6f3"/>
</svg>`)

await mkdir('public/icons', { recursive: true })
for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
await sharp(svg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
console.log('icons written')
