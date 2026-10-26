import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { wedding } from '../shared/wedding.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = resolve(root, 'public');
const output = resolve(publicRoot, 'assets/wedding/optimized');
const previewWidth = 160;
const previewQuality = 40;
const photos = {};
await mkdir(output, { recursive: true });
const sources = [
  ...new Set([
    wedding.images.cover,
    wedding.images.checkin,
    wedding.images.detail,
    ...wedding.images.gallery,
  ]),
];
for (const source of sources) {
  const path = resolve(publicRoot, `.${source}`);
  if (!path.startsWith(publicRoot + sep)) throw new Error('照片必须位于public目录内');
  const original = await readFile(path);
  const metadata = await sharp(original).metadata();
  const stem = basename(path, extname(path));
  const preview = await sharp(original)
    .rotate()
    .resize({ width: previewWidth, withoutEnlargement: true })
    .webp({ quality: previewQuality, effort: 6 })
    .toBuffer();
  const save = async (data, label, extension) => {
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const name = `${stem}-${label}-${hash}${extension}`;
    await writeFile(resolve(output, name), data);
    return `/assets/wedding/optimized/${name}`;
  };
  photos[source] = {
    src: await save(original, 'full', extname(path)),
    preview: await save(preview, 'preview', '.webp'),
    width: metadata.width,
    height: metadata.height,
  };
  console.log(
    `${stem}: preview ${preview.length} bytes, original ${original.length} bytes (unchanged)`,
  );
}
await writeFile(
  resolve(root, 'web/src/guest/optimized-photos.json'),
  JSON.stringify(photos, null, 2) + '\n',
);
