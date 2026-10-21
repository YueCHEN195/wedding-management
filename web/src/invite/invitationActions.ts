import { wedding } from '@shared/wedding';
const VENUE_SEARCH_CITY = '长沙市';

/** Search the confirmed branch; no personal invitation URL or guest details are sent to maps. */
export function getMapLinks() {
  const { name, address } = wedding.venue;
  const amap = new URL('https://uri.amap.com/search');
  amap.search = new URLSearchParams({
    keyword: name,
    city: VENUE_SEARCH_CITY,
    view: 'list',
    src: 'wedding',
    callnative: '1',
  }).toString();
  const baidu = new URL('https://api.map.baidu.com/place/search');
  baidu.search = new URLSearchParams({
    query: name,
    region: VENUE_SEARCH_CITY,
    output: 'html',
    src: 'webapp.wedding',
  }).toString();
  const q = encodeURIComponent(`${address} ${name}`);
  return [
    { label: '高德地图', href: amap.href },
    { label: '百度地图', href: baidu.href },
    {
      label: '系统地图',
      href: /Android/i.test(navigator.userAgent)
        ? `geo:0,0?q=${q}`
        : `https://maps.apple.com/?q=${q}`,
    },
  ];
}

export async function share(): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: '婚礼邀请', url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
