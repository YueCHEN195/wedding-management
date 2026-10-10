import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import { wedding } from '../../shared/wedding';
import { qrPng } from './qrcode';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function publicPath(p: string): string {
  return path.join(PUBLIC_DIR, p.replace(/^\//, ''));
}

/** 把二维码合成到海报底图上 */
export async function renderPoster(inviteUrl: string): Promise<Buffer> {
  const base = await readFile(publicPath(wedding.poster.base));
  const { x, y, size } = wedding.poster.qr;
  const qr = await qrPng(inviteUrl, size);
  return sharp(base)
    .composite([{ input: qr, left: x, top: y }])
    .png()
    .toBuffer();
}

/** 将多个文件打包为 zip（内存） */
export async function zipBuffers(files: { name: string; buffer: Buffer | Uint8Array }[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, Buffer.from(f.buffer));
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
