/**
 * 婚礼信息（写死在代码中，作为 demo 占位，后续由新人替换真实内容）
 */
export const wedding = {
  groomName: '张伟',
  brideName: '李娜',
  /** ISO 时间，带时区 */
  date: '2026-12-20T18:00:00+08:00',
  venue: {
    name: '示例酒店',
    hall: '宴会厅',
    address: '示例省示例市示例区示例路 1 号',
    lat: 0,
    lng: 0,
  },
  contact: {
    name: '联系人',
    phone: '13800000000',
  },
  coverTitle: '诚挚邀请',
  invitationText: '诚挚邀请您见证我们的幸福时刻',
  closingText: '届时恭候您的光临',
  story: '这里是一段新人故事（demo 占位）。',
  schedule: [
    { time: '17:00', title: '迎宾' },
    { time: '18:00', title: '仪式' },
    { time: '18:30', title: '晚宴' },
  ],
  images: {
    cover: '/assets/cover.svg',
    gallery: ['/assets/gallery-1.svg'],
  },
  poster: {
    base: '/assets/poster.svg',
    /** 二维码在底图上的位置与大小（像素） */
    qr: { x: 380, y: 1560, size: 300 },
  },
} as const;

export type Wedding = typeof wedding;
