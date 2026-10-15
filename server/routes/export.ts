import { Hono } from 'hono';
import { asc, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, gifts, guests, rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { buildWorkbook } from '../services/excel';
import { inviteUrl } from '../lib/dto';
import { attachmentHeaders, binaryResponse, XLSX_MIME } from '../lib/http';

export const exportRoutes = new Hono<AppEnv>();
exportRoutes.use('*', requireAuth, requireAdmin);

exportRoutes.get('/:type', async (c) => {
  const type = c.req.param('type');

  if (type === 'guests') {
    const rows = db.select().from(guests).where(isNull(guests.archivedAt)).orderBy(asc(guests.id)).all();
    const statusLabel: Record<string, string> = { pending: '待邀请', sent: '已发送', viewed: '已查看', rsvp: '已回执' };
    const sideLabel: Record<string, string> = { male: '男方', female: '女方', both: '双方' };
    const buf = await buildWorkbook([
      {
        name: '宾客',
        columns: [
          { header: '姓名', key: 'name' },
          { header: '称谓', key: 'salutation' },
          { header: '手机号', key: 'phone' },
          { header: '分组', key: 'groupName' },
          { header: '归属方', key: 'side' },
          { header: '状态', key: 'status' },
          { header: '邀请链接', key: 'inviteUrl', width: 50 },
          { header: '备注', key: 'note', width: 20 },
        ],
        rows: rows.map((r) => ({
          name: r.name,
          salutation: r.salutation ?? '',
          phone: r.phone ?? '',
          groupName: r.groupName ?? '',
          side: r.side ? sideLabel[r.side] : '',
          status: statusLabel[r.status] ?? r.status,
          inviteUrl: inviteUrl(r.inviteToken),
          note: r.note ?? '',
        })),
      },
    ]);
    return binaryResponse(buf, attachmentHeaders('宾客名单.xlsx', XLSX_MIME));
  }

  if (type === 'rsvps') {
    const archivedIds = new Set(db.select().from(guests).all().filter((g) => g.archivedAt != null).map((g) => g.id));
    const rows = db.select().from(rsvps).orderBy(asc(rsvps.id)).all();
    const label: Record<string, string> = { yes: '出席', no: '不出席', maybe: '待定' };
    const buf = await buildWorkbook([
      {
        name: '回执',
        columns: [
          { header: '姓名', key: 'guestName' },
          { header: '宾客状态', key: 'guestState' },
          { header: '是否出席', key: 'attending' },
          { header: '出席人数', key: 'headcount' },
          { header: '随行儿童', key: 'childrenCount' },
          { header: '来源', key: 'source' },
          { header: '祝福留言', key: 'message', width: 40 },
          { header: '提交时间', key: 'submittedAt', width: 22 },
        ],
        rows: rows.map((r) => ({
          guestName: r.guestName,
          guestState: r.guestId != null && archivedIds.has(r.guestId) ? '宾客已归档，不计预计出席' : '当前回执',
          attending: label[r.attending] ?? r.attending,
          headcount: r.headcount,
          childrenCount: r.childrenCount,
          source: r.source === 'link' ? '专属链接' : '通用链接',
          message: r.message ?? '',
          submittedAt: new Date(r.submittedAt).toLocaleString('zh-CN'),
        })),
      },
    ]);
    return binaryResponse(buf, attachmentHeaders('回执.xlsx', XLSX_MIME));
  }

  if (type === 'checkins') {
    const rows = db.select().from(checkins).orderBy(asc(checkins.id)).all();
    const buf = await buildWorkbook([
      {
        name: '签到',
        columns: [
          { header: '姓名', key: 'guestName' },
          { header: '来源', key: 'source' },
          { header: '状态', key: 'status' },
          { header: '提交时间', key: 'submittedAt', width: 22 },
          { header: '确认时间', key: 'confirmedAt', width: 22 },
          { header: '备注', key: 'note', width: 20 },
        ],
        rows: rows.map((r) => ({
          guestName: r.guestName,
          source: r.source === 'self' ? '自助' : '补录',
          status: ({ pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已撤销' })[r.status],
          submittedAt: new Date(r.submittedAt).toLocaleString('zh-CN'),
          confirmedAt: r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('zh-CN') : '',
          note: r.note ?? '',
        })),
      },
    ]);
    return binaryResponse(buf, attachmentHeaders('签到.xlsx', XLSX_MIME));
  }

  if (type === 'gifts') {
    const rows = db.select().from(gifts).orderBy(asc(gifts.id)).all();
    const methodLabel: Record<string, string> = { wechat: '微信', alipay: '支付宝', cash: '现金' };
    const buf = await buildWorkbook([
      {
        name: '礼金',
        columns: [
          { header: '姓名', key: 'guestName' },
          { header: '记录编号', key: 'id' },
          { header: '宾客编号', key: 'guestId' },
          { header: '状态', key: 'state' },
          { header: '原登记金额(元)', key: 'amount' },
          { header: '有效金额(元)', key: 'effectiveAmount' },
          { header: '方式', key: 'method' },
          { header: '时间', key: 'recordedAt', width: 22 },
          { header: '备注', key: 'note', width: 20 },
        ],
        rows: rows.map((r) => ({
          guestName: r.guestName,
          id: r.id, guestId: r.guestId ?? '', state: r.voidedAt == null ? '有效' : '已作废',
          amount: r.amount / 100, effectiveAmount: r.voidedAt == null ? r.amount / 100 : 0,
          method: methodLabel[r.method] ?? r.method,
          recordedAt: new Date(r.recordedAt).toLocaleString('zh-CN'),
          note: r.note ?? '',
        })),
      },
    ]);
    return binaryResponse(buf, attachmentHeaders('礼金.xlsx', XLSX_MIME));
  }

  return c.json({ ok: false, error: { code: 'VALIDATION', message: '不支持的导出类型' } }, 400);
});
