/*
 * Genera los PNG de marca (PWA, favicon, iconos iOS/Android, og:image e isotipos
 * para móvil) a partir de la geometría del isotipo C1 (apps/web/public/brand/*.svg).
 * Uso (no añade dependencias al repositorio):
 *   mkdir /tmp/brand-icons && cd /tmp/brand-icons && npm init -y && npm i sharp
 *   node <ruta-al-repo>/docs/brand/generate-icons.cjs
 * Requiere `sharp` resoluble desde el directorio actual (NODE_PATH o node_modules).
 */
const sharp = require(require.resolve('sharp', { paths: [process.cwd()] }));
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../apps');
const web = path.join(root, 'web/public');
const mobile = path.join(root, 'mobile');

const C =
  'M740 262H535C400 262 295 380 295 512C295 640 395 742 520 742H630Q645 742 655 732L746 635Q752 626 740 618H535C475 618 432 570 432 512C432 455 475 400 535 400H612Q622 400 630 392L746 280Q752 264 740 262Z';
const ONE =
  'M840 243H930Q948 243 948 262V655Q948 695 910 712L828 757Q806 762 806 740V410Q806 400 796 400H690Q676 396 686 385L825 250Q832 243 840 243Z';

// Isotipo centrado en un lienzo de `size`; `scale` es el ancho relativo (mark mide 680x540).
const mark = (size, scale, fill = '#ffffff') => {
  const w = 680 * (size * scale) / 680;
  const k = (size * scale) / 680;
  const tx = (size - 680 * k) / 2 - 280 * k;
  const ty = (size - 540 * k) / 2 - 230 * k;
  return `<g transform="translate(${tx} ${ty}) scale(${k})" fill="${fill}"><path d="${C}"/><path d="${ONE}"/></g>`;
};

const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#3046eb"/><stop offset="0.5" stop-color="#4037f7"/><stop offset="1" stop-color="#6344dc"/>
</linearGradient></defs>`;

// radius: fracción del lado (0 = a sangre completa).
const tile = (size, radius, scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${gradient}
<rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)"/>${mark(size, scale)}</svg>`
  );

const write = async (file, buffer, size, flatten = false) => {
  let img = sharp(buffer, { density: 384 }).resize(size, size);
  if (flatten) img = img.flatten({ background: '#4037f7' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await img.png({ compressionLevel: 9 }).toFile(file);
  console.log('ok', path.relative(root, file));
};

(async () => {
  // Web / PWA
  await write(path.join(web, 'pwa-192x192.png'), tile(512, 0.22, 0.62), 192);
  await write(path.join(web, 'pwa-512x512.png'), tile(512, 0.22, 0.62), 512);
  await write(path.join(web, 'maskable-512x512.png'), tile(512, 0, 0.46), 512);
  await write(path.join(web, 'apple-touch-icon-180x180.png'), tile(512, 0, 0.56), 180);
  await write(path.join(web, 'favicon-64x64.png'), tile(512, 0.22, 0.66), 64);

  // Android launcher (ic_launcher.png por densidad)
  const android = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(android)) {
    await write(
      path.join(mobile, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`),
      tile(512, 0.22, 0.62),
      size
    );
  }

  // iOS (sin transparencia, el sistema aplica la máscara)
  const iosDir = path.join(mobile, 'ios/Runner/Assets.xcassets/AppIcon.appiconset');
  const contents = JSON.parse(fs.readFileSync(path.join(iosDir, 'Contents.json'), 'utf8'));
  for (const item of contents.images) {
    const base = parseFloat(item.size.split('x')[0]);
    const scale = parseInt(item.scale, 10);
    await write(path.join(iosDir, item.filename), tile(512, 0, 0.58), Math.round(base * scale), true);
  }

  // Imagen para compartir (og:image) 1200x630
  const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3046eb"/><stop offset="0.5" stop-color="#4037f7"/><stop offset="1" stop-color="#6344dc"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<g transform="translate(110 90) scale(0.42) translate(-280 -230)" fill="#fff"><path d="${C}"/><path d="${ONE}"/></g>
<text x="110" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="#ffffff">Tus planes.</text>
<text x="110" y="530" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="#cfd0ff">Su progreso.</text>
<text x="440" y="232" font-family="Segoe UI, Arial, sans-serif" font-size="60" font-weight="700" fill="#ffffff">CouchOne Fit</text>
</svg>`);
  fs.mkdirSync(path.join(web, 'brand'), { recursive: true });
  await sharp(og).png({ compressionLevel: 9 }).toFile(path.join(web, 'brand/og-image.png'));
  console.log('ok og-image');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

const brand = path.join(root, 'web/public/brand');
(async () => {
  const out = path.join(mobile, 'assets/brand');
  fs.mkdirSync(out, { recursive: true });
  const color = fs.readFileSync(path.join(brand, 'logomark.svg'));
  const white = fs.readFileSync(path.join(brand, 'logomark-white.svg'));
  await sharp(color, { density: 300 }).resize({ width: 512 }).png({ compressionLevel: 9 }).toFile(path.join(out, 'logomark.png'));
  await sharp(white, { density: 300 }).resize({ width: 512 }).png({ compressionLevel: 9 }).toFile(path.join(out, 'logomark_white.png'));
  // Pantalla de arranque Android (marca blanca sobre el degradado de marca)
  await sharp(white, { density: 300 }).resize({ width: 288 }).png({ compressionLevel: 9 })
    .toFile(path.join(mobile, 'android/app/src/main/res/drawable/launch_mark.png'));
  // Isotipo en PNG para la web (correo, documentos)
  await sharp(color, { density: 300 }).resize({ width: 1024 }).png({ compressionLevel: 9 }).toFile(path.join(brand, 'logomark.png'));
  console.log('ok');
})().catch((e) => { console.error(e); process.exit(1); });
