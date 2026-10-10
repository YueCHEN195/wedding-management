import QRCode from 'qrcode';

/** 生成二维码 PNG（Buffer） */
export function qrPng(text: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}
