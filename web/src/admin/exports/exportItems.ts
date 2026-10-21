/** Descriptions mirror /api/export/:type; exporting does not inherit list filters. */
export const EXPORT_ITEMS = [
  {
    type: 'guests',
    title: '宾客名单',
    filename: '宾客名单.xlsx',
    sheet: '宾客',
    summary: '邀请、联络与分组信息',
    scope: '当前未归档宾客',
    detail: '不包含已归档宾客；邀请链接可用于打开对应请柬。',
    fields: ['姓名', '称谓', '手机号', '分组', '归属方', '状态', '邀请链接', '备注'],
  },
  {
    type: 'rsvps',
    title: '回执',
    filename: '回执.xlsx',
    sheet: '回执',
    summary: '出席意向与预计人数',
    scope: '全部回执 · 保留历史',
    detail: '包含已归档宾客的回执，并标明其不计预计出席；回执人数与现场实到分别记录。',
    fields: [
      '姓名',
      '宾客状态',
      '是否出席',
      '出席人数',
      '随行儿童',
      '来源',
      '祝福留言',
      '提交时间',
    ],
  },
  {
    type: 'checkins',
    title: '签到记录',
    filename: '签到.xlsx',
    sheet: '签到',
    summary: '现场实到与签到状态',
    scope: '全部签到状态',
    detail:
      '包含待审、已确认、已驳回和已撤销记录；历史未知人数保留“待补记”，仅已确认签到计入到场人数。',
    fields: [
      '姓名',
      '签到编号',
      '实际总人数（含儿童）',
      '其中儿童',
      '当前计入到场人数',
      '来源',
      '状态',
      '提交时间',
      '确认时间',
      '备注',
    ],
  },
  {
    type: 'gifts',
    title: '礼金',
    filename: '礼金.xlsx',
    sheet: '礼金',
    summary: '实收金额与作废留痕',
    scope: '有效与已作废礼金',
    detail: '保留原登记金额，另列有效金额；作废记录的有效金额为 0。礼金自愿，未登记不表示欠款。',
    fields: [
      '姓名',
      '记录编号',
      '宾客编号',
      '状态',
      '原登记金额(元)',
      '有效金额(元)',
      '方式',
      '时间',
      '备注',
    ],
  },
] as const;
export type ExportItem = (typeof EXPORT_ITEMS)[number];
export const MEDIA_EXPORT_ITEMS = [
  { type: 'checkin-table', format: 'table', title: '签到桌牌', filename: '签到桌牌.png' },
  { type: 'checkin-sign', format: 'sign', title: '入口导视', filename: '入口导视.png' },
  { type: 'checkin-qr', format: 'qr', title: '签到二维码', filename: '签到二维码.png' },
] as const;
export type MediaExportItem = (typeof MEDIA_EXPORT_ITEMS)[number];
export type ExportDownloadItem = ExportItem | MediaExportItem;
export type ExportType = ExportDownloadItem['type'];
