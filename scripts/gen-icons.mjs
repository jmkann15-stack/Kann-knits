// Generates every app icon from one SVG yarn-ball design.
// Run with: npm run icons   (outputs into /public)
import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'

const ROSE = '#B5677A'
const CREAM = '#FBF3E6'
const WRAP = '#D79AA8'
const NEEDLE = '#EAD8BF'

/** @param {{rounded: boolean, scale?: number}} o */
function yarnSvg({ rounded, scale = 1 }) {
  // `scale` shrinks the artwork toward the center (used for maskable safe zone).
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="ball"><circle cx="256" cy="282" r="132"/></clipPath></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${ROSE}"/>
  <g transform="${t}">
    <!-- needles -->
    <g stroke="${NEEDLE}" stroke-width="16" stroke-linecap="round">
      <line x1="150" y1="430" x2="392" y2="96"/>
      <line x1="362" y1="430" x2="120" y2="96"/>
    </g>
    <circle cx="398" cy="88" r="20" fill="${NEEDLE}"/>
    <circle cx="114" cy="88" r="20" fill="${NEEDLE}"/>
    <!-- ball -->
    <circle cx="256" cy="282" r="132" fill="${CREAM}"/>
    <g clip-path="url(#ball)" fill="none" stroke="${WRAP}" stroke-width="11" stroke-linecap="round">
      <path d="M110 230 Q256 150 402 230"/>
      <path d="M110 270 Q256 190 402 270"/>
      <path d="M110 310 Q256 230 402 310"/>
      <path d="M150 400 Q200 260 330 160"/>
      <path d="M200 420 Q250 290 380 190"/>
      <path d="M250 430 Q300 330 410 250"/>
    </g>
    <circle cx="256" cy="282" r="132" fill="none" stroke="${WRAP}" stroke-width="6" opacity="0.6"/>
    <!-- loose strand -->
    <path d="M170 384 C 140 430, 92 420, 84 452" fill="none" stroke="${CREAM}" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`
}

await mkdir('public', { recursive: true })

const any = Buffer.from(yarnSvg({ rounded: true }))
const square = Buffer.from(yarnSvg({ rounded: false }))
const maskable = Buffer.from(yarnSvg({ rounded: false, scale: 0.78 }))

await writeFile('public/favicon.svg', yarnSvg({ rounded: true }))
await sharp(any).resize(32, 32).png().toFile('public/favicon-32.png')
await sharp(any).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(any).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(maskable).resize(512, 512).png().toFile('public/maskable-512.png')
// Apple touch icon: full-bleed, no transparency (iOS rounds the corners itself).
await sharp(square).resize(180, 180).flatten({ background: ROSE }).png().toFile('public/apple-touch-icon.png')

console.log('Icons written to /public')
