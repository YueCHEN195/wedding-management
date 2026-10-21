/** Pixel layouts retain the approved artwork; print sizes still need printer review. */
export const MEDIA_OUTPUTS = {
  table: { title: '签到桌牌', width: 1748, height: 2480, dpi: 300 },
  sign: { title: '入口导视', width: 2400, height: 3600, dpi: 102 },
  qr: { title: '签到二维码', width: 640, height: 640, dpi: 72 },
} as const;
export type MediaFormat = keyof typeof MEDIA_OUTPUTS;
export type DisplayFormat = Exclude<MediaFormat, 'qr'>;
export interface MediaOutputInfo {
  url: string;
  preview: boolean;
}
