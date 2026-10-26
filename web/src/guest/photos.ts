import { wedding } from '@shared/wedding';
import generated from './optimized-photos.json';

type Photo = { src: string; preview: string; width?: number; height?: number };
const photos: Record<string, Photo> = generated;

export function guestPhoto(src: string): Photo {
  return photos[src] ?? { src, preview: src };
}

/** Fetch the tiny cover first and the original in parallel, ahead of the API. */
export function preloadInvitationPhoto(pathname: string) {
  if (!/^\/invite(?:\/|$)/.test(pathname)) return;
  const photo = guestPhoto(wedding.images.cover);
  for (const src of new Set([photo.preview, photo.src])) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    link.fetchPriority = 'high';
    document.head.append(link);
  }
}
