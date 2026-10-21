import QRCode from 'qrcode';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

// Geometry follows the confirmed cat QR. Never paint over reserved function modules.
const QR_STYLE = {
  quiet: 4,
  ink: '#252923',
  paper: '#ffffff',
  radius: 0.38,
  patchRadius: 4.6,
  iconSize: 8,
  eyeSize: 7,
  eyeRadius: 1.7,
  eyeInnerRadius: 1.1,
  eyeDotRadius: 0.85,
  maxVersion: 40,
  frameMargin: 1,
  frameRadius: 3,
} as const;

export function catQrMatrix(text: string) {
  const first = QRCode.create(text, { errorCorrectionLevel: 'H' });
  for (let version = first.version; version <= QR_STYLE.maxVersion; version++) {
    const matrix =
      version === first.version
        ? first.modules
        : QRCode.create(text, { version, errorCorrectionLevel: 'H' }).modules;
    const center = matrix.size / 2;
    let safe = true;
    for (let y = 0; y < matrix.size && safe; y++)
      for (let x = 0; x < matrix.size; x++)
        if (
          Math.hypot(
            Math.max(Math.abs(x + 0.5 - center) - 0.5, 0),
            Math.max(Math.abs(y + 0.5 - center) - 0.5, 0),
          ) < QR_STYLE.patchRadius &&
          matrix.isReserved(y, x)
        ) {
          safe = false;
          break;
        }
    if (safe) return matrix;
  }
  throw new Error('链接过长，无法安全放置猫头图案，请缩短站点地址');
}

/** Standalone codes use integer module pixels; framed artwork fits its approved slot proportionally. */
export async function qrPng(
  text: string,
  size = 512,
  { roundedFrame = false }: { roundedFrame?: boolean } = {},
): Promise<Buffer> {
  // Extra paper outside the full four-module square quiet zone allows rounded
  // artwork corners without clipping the quiet zone. Standalone codes stay square.
  const padding = QR_STYLE.quiet + (roundedFrame ? QR_STYLE.frameMargin : 0);
  const m = catQrMatrix(text),
    n = m.size,
    grid = n + padding * 2;
  const cell = roundedFrame ? size / grid : Math.floor(size / grid);
  if (cell < 2) throw new Error('二维码尺寸不足，请使用更大的输出尺寸');
  const offset = roundedFrame ? 0 : Math.floor((size - grid * cell) / 2);
  const eyes = [
    [0, 0],
    [n - QR_STYLE.eyeSize, 0],
    [0, n - QR_STYLE.eyeSize],
  ];
  let shapes = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (
        !m.get(y, x) ||
        eyes.some(
          ([a, b]) => x >= a && x < a + QR_STYLE.eyeSize && y >= b && y < b + QR_STYLE.eyeSize,
        )
      )
        continue;
      shapes += `<rect x="${x + padding}" y="${y + padding}" width="1" height="1" rx="${m.isReserved(y, x) ? 0 : QR_STYLE.radius}"/>`;
    }
  for (const [x, y] of eyes) {
    const a = x + padding,
      b = y + padding;
    shapes += `<rect x="${a}" y="${b}" width="7" height="7" rx="${QR_STYLE.eyeRadius}"/><rect x="${a + 1}" y="${b + 1}" width="5" height="5" rx="${QR_STYLE.eyeInnerRadius}" fill="${QR_STYLE.paper}"/><rect x="${a + 2}" y="${b + 2}" width="3" height="3" rx="${QR_STYLE.eyeDotRadius}"/>`;
  }
  const icon = await readFile(new URL('../../public/assets/wedding/cat-head.png', import.meta.url));
  const center = grid / 2,
    iconStart = center - QR_STYLE.iconSize / 2;
  const frameRadius = roundedFrame ? cell * QR_STYLE.frameRadius : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${frameRadius}" fill="${QR_STYLE.paper}"/><g transform="translate(${offset} ${offset}) scale(${cell})"><g fill="${QR_STYLE.ink}">${shapes}</g><circle cx="${center}" cy="${center}" r="${QR_STYLE.patchRadius}" fill="${QR_STYLE.paper}"/><image x="${iconStart}" y="${iconStart}" width="${QR_STYLE.iconSize}" height="${QR_STYLE.iconSize}" href="data:image/png;base64,${icon.toString('base64')}"/></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
