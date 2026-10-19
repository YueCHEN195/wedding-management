import { wedding } from '@shared/wedding';
export function openMap() {
  const { name, address, lat, lng } = wedding.venue;
  const q = encodeURIComponent(`${name} ${address}`.trim());
  const ua = navigator.userAgent;
  const hasCoord = lat !== 0 || lng !== 0;
  if (/Android/i.test(ua)) {
    window.location.href = hasCoord
      ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`
      : `geo:0,0?q=${q}`;
  } else {
    window.location.href = hasCoord
      ? `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`
      : `https://maps.apple.com/?q=${q}`;
  }
}

export async function share() {
  const url = window.location.href;
  try {
    if (navigator.share) await navigator.share({ title: '婚礼邀请', url });
    else {
      await navigator.clipboard.writeText(url);
      alert('链接已复制');
    }
  } catch {
    /* 取消分享 */
  }
}
