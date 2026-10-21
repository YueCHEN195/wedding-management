import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import { wedding } from '../../shared/wedding';
import { qrPng } from './qrcode';
import { MEDIA_OUTPUTS, type DisplayFormat } from '../../shared/media';
import { ARTWORK_TOKENS, artworkText, escapeXml } from './mediaPresentation';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function publicPath(p: string): string {
  return path.join(PUBLIC_DIR, p.replace(/^\//, ''));
}

const SHARE_OUTPUT = { width: 1080, height: 1920, dpi: 72 } as const;
// QR slots are fixed artwork geometry, not a responsive UI size.
const QR_SIZES = { share: 254, table: 820, sign: 1120 } as const;
// Confirmed sign uses the y=260..710 band of the 1600px portrait reference.
// Normalize to the display asset's height so asset resolution does not change the crop.
const SIGN_PHOTO_CROP = { referenceHeight: 1600, top: 260, height: 450 } as const;

async function renderArtwork(url: string, format: 'share' | DisplayFormat) {
  const spec = format === 'share' ? SHARE_OUTPUT : MEDIA_OUTPUTS[format];
  const template = await readFile(
    new URL(`../assets/wedding/${format}.svg`, import.meta.url),
    'utf8',
  );
  const photoSource = sharp(publicPath(wedding.outputImages[format]));
  if (format === 'sign') {
    const { width, height } = await photoSource.metadata();
    if (!width || !height) throw new Error('导视照片尺寸无法读取');
    photoSource.extract({
      left: 0,
      top: Math.round((height * SIGN_PHOTO_CROP.top) / SIGN_PHOTO_CROP.referenceHeight),
      width,
      height: Math.round((height * SIGN_PHOTO_CROP.height) / SIGN_PHOTO_CROP.referenceHeight),
    });
  }
  const photo = await photoSource.png().toBuffer();
  const qr = await qrPng(url, QR_SIZES[format], { roundedFrame: true });
  const values: Record<string, string> = {
    ...ARTWORK_TOKENS,
    ...Object.fromEntries(
      Object.entries(artworkText(url)).map(([key, value]) => [key, escapeXml(value)]),
    ),
    photo: `data:image/png;base64,${photo.toString('base64')}`,
    qr: `data:image/png;base64,${qr.toString('base64')}`,
  };
  const svg = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Missing artwork field: ${key}`);
    return values[key];
  });
  return sharp(Buffer.from(svg))
    .resize(spec.width, spec.height)
    .withMetadata({ density: spec.dpi })
    .png()
    .toBuffer();
}

/** Preserve the existing personal invite URL and endpoint, replacing the demo artwork. */
export async function renderPoster(inviteUrl: string): Promise<Buffer> {
  return renderArtwork(inviteUrl, 'share');
}

export function renderCheckinDisplay(checkinUrl: string, format: DisplayFormat) {
  return renderArtwork(checkinUrl, format);
}

/** 将多个文件打包为 zip（内存） */
export async function zipBuffers(
  files: { name: string; buffer: Buffer | Uint8Array }[],
): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, Buffer.from(f.buffer));
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
