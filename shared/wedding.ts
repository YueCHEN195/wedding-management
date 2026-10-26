/** Confirmed wedding details and user-authorized, metadata-stripped display assets. */
export const wedding = {
  groomName: '陈玥',
  brideName: '杨涵茹',
  /** ISO time with the wedding's local timezone. */
  date: '2026-11-22T12:08:00+08:00',
  venue: {
    name: '徐记海鲜（滨江新城店）',
    hall: '厅位待确认',
    address: '湖南省长沙市岳麓区含光路当代滨江十号栋',
    lat: 0,
    lng: 0,
  },
  contact: { name: '', phone: '' },
  coverTitle: '良辰有你。',
  invitationText: '这一天的喜悦，想与你一同珍藏。',
  closingText: '期待与你，一同见证这一刻。',
  story: '',
  schedule: [{ time: '12:08', title: '开席' }],
  images: {
    cover: '/assets/wedding/couple-portrait.webp',
    checkin: '/assets/wedding/couple-portrait.webp',
    detail: '/assets/wedding/night-sparklers.webp',
    gallery: ['/assets/wedding/couple-portrait.webp', '/assets/wedding/night-sparklers.webp'],
  },
  // Output compositions have their own approved photo bindings; page imagery can change independently.
  outputImages: {
    share: '/assets/wedding/couple-portrait.webp',
    sign: '/assets/wedding/couple-portrait.webp',
    table: '/assets/wedding/night-sparklers.webp',
  },
} as const;

export type Wedding = typeof wedding;
