// Genera los íconos de la PWA en los tres tamaños que iOS y Android necesitan.
// Correr con `node scripts/gen-icons.mjs` después de tocar el logo o la paleta.
//
// Ícono provisorio hasta el rebranding (ver docs/roadmap.md).
// Los colores van literales: un PNG no puede leer variables CSS. Si cambian
// --accent o --accent-dark en app/globals.css, moverlos a mano acá.
import sharp from 'sharp'

const FONDO = '#171717'  // --accent-dark (neutral-900)
const ACENTO = '#eab308' // --accent (yellow-500)

// El dibujo vive dentro del rango 18..82 del viewBox. iOS redondea las
// esquinas del apple-touch-icon y Android recorta el maskable en círculo:
// lo que toque el borde se pierde. El margen es esa reserva.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${FONDO}"/>
  <g fill="${ACENTO}">
    <rect x="18" y="38" width="7" height="24" rx="2.5"/>
    <rect x="26" y="31" width="9" height="38" rx="3"/>
    <rect x="35" y="46.5" width="30" height="7" rx="2"/>
    <rect x="65" y="31" width="9" height="38" rx="3"/>
    <rect x="75" y="38" width="7" height="24" rx="2.5"/>
  </g>
</svg>`

// `flatten` + `removeAlpha`: iOS rellena de NEGRO cualquier zona transparente,
// así que el fondo va pintado y el canal alpha se cae. Las esquinas van
// rectas: el redondeo lo hace el sistema.
const render = (size, out) =>
  sharp(Buffer.from(svg))
    .resize(size, size)
    .flatten({ background: FONDO })
    .removeAlpha()
    .png()
    .toFile(out)

await render(192, 'public/icons/icon-192.png')
await render(512, 'public/icons/icon-512.png')
await render(180, 'public/apple-touch-icon.png')
console.log('íconos regenerados: 192, 512, apple-touch 180')
