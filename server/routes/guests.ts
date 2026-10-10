import { Hono } from 'hono';
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, gifts, guests, rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { checkinToDTO, giftToDTO, guestToDTO, inviteUrl, rsvpToDTO } from '../lib/dto';
import { generateToken, now, optionalStr, parsePage, str } from '../lib/util';
import { attachmentHeaders, binaryResponse, XLSX_MIME } from '../lib/http';
import { qrPng } from '../services/qrcode';
import { renderPoster, zipBuffers } from '../services/media';
import { buildWorkbook, parseGuestWorkbook } from '../services/excel';
import type { RsvpRow } from '../db/schema';
import type { Attending, GuestStatus, Side } from '../../shared/types';

export const guestRoutes = new Hono<AppEnv>();
guestRoutes.use('*', requireAuth);

/** 列表（管理员 / 工作人员只读） */
guestRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const keyword = str(url.searchParams.get('keyword'));
  const status = url.searchParams.get('status');
  const groupName = url.searchParams.get('groupName');
  const side = url.searchParams.get('side');

  const conds = [];
  if (keyword) conds.push(or(like(guests.name, `%${keyword}%`), like(guests.phone, `%${keyword}%`)));
  if (status) conds.push(eq(guests.status, status as GuestStatus));
  if (groupName) conds.push(eq(guests.groupName, groupName));
  if (side) conds.push(eq(guests.side, side as Side));
  const where = conds.length ? and(...conds) : undefined;

  const total = db.select({ value: count() }).from(guests).where(where).get()?.value ?? 0;
  const rows = db
    .select()
    .from(guests)
    .where(where)
    .orderBy(desc(guests.createdAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  const ids = rows.map((r) => r.id);
  const attendingMap = new Map<number, Attending>();
  if (ids.length) {
    for (const r of db.select().from(rsvps).where(inArray(rsvps.guestId, ids)).all()) {
      if (r.guestId != null) attendingMap.set(r.guestId, r.attending as Attending);
    }
  }

  return c.json({
    ok: true,
    data: { items: rows.map((r) => guestToDTO(r, attendingMap.get(r.id) ?? null)), total, page, pageSize },
  });
});

/** 分组列表（用于筛选下拉） */
guestRoutes.get('/groups', (c) => {
  const rows = db.selectDistinct({ groupName: guests.groupName }).from(guests).all();
  return c.json({ ok: true, data: rows.map((r) => r.groupName).filter((v): v is string => !!v) });
});

/** 新增 */
guestRoutes.post('/', requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  if (!name) return c.json({ ok: false, error: { code: 'VALIDATION', message: '姓名必填' } }, 400);
  const ts = now();
  const row = db
    .insert(guests)
    .values({
      name,
      salutation: optionalStr(body.salutation),
      phone: optionalStr(body.phone),
      groupName: optionalStr(body.groupName),
      side: (optionalStr(body.side) as Side | null) ?? null,
      note: optionalStr(body.note),
      inviteToken: generateToken(),
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    })
    .returning()
    .get();
  return c.json({ ok: true, data: guestToDTO(row) });
});

/** 修改 */
guestRoutes.patch('/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<typeof guests.$inferInsert> = { updatedAt: now() };
  if ('name' in body && str(body.name)) patch.name = str(body.name);
  if ('salutation' in body) patch.salutation = optionalStr(body.salutation);
  if ('phone' in body) patch.phone = optionalStr(body.phone);
  if ('groupName' in body) patch.groupName = optionalStr(body.groupName);
  if ('side' in body) patch.side = (optionalStr(body.side) as Side | null) ?? null;
  if ('note' in body) patch.note = optionalStr(body.note);

  const row = db.update(guests).set(patch).where(eq(guests.id, id)).returning().get();
  return c.json({ ok: true, data: guestToDTO(row) });
});

/** 删除（回执级联删除；签到/礼金保留但解除关联） */
guestRoutes.delete('/:id', requireAdmin, (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  db.delete(rsvps).where(eq(rsvps.guestId, id)).run();
  db.update(checkins).set({ guestId: null }).where(eq(checkins.guestId, id)).run();
  db.update(gifts).set({ guestId: null }).where(eq(gifts.guestId, id)).run();
  db.delete(guests).where(eq(guests.id, id)).run();
  return c.json({ ok: true, data: true });
});

/** 标记已发送 */
guestRoutes.post('/:id/mark-sent', requireAdmin, (c) => {
  const id = Number(c.req.param('id'));
  const row = db
    .update(guests)
    .set({ status: 'sent', invitedAt: now(), updatedAt: now() })
    .where(eq(guests.id, id))
    .returning()
    .get();
  if (!row) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  return c.json({ ok: true, data: guestToDTO(row) });
});

/** 单个宾客详情（回执 / 签到 / 礼金） */
guestRoutes.get('/:id/detail', requireAdmin, (c) => {
  const id = Number(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const rsvpRow = db.select().from(rsvps).where(eq(rsvps.guestId, id)).orderBy(desc(rsvps.submittedAt)).get();
  const checkinRows = db.select().from(checkins).where(eq(checkins.guestId, id)).orderBy(desc(checkins.submittedAt)).all();
  const giftRows = db.select().from(gifts).where(eq(gifts.guestId, id)).orderBy(desc(gifts.recordedAt)).all();
  const giftTotal = giftRows.reduce((s, g) => s + g.amount, 0);
  return c.json({
    ok: true,
    data: {
      guest: guestToDTO(guest, rsvpRow?.attending ?? null),
      rsvp: rsvpRow ? rsvpToDTO(rsvpRow as RsvpRow) : null,
      checkins: checkinRows.map((r) => checkinToDTO(r)),
      gifts: giftRows.map(giftToDTO),
      giftTotal,
    },
  });
});

/** 专属二维码 */
guestRoutes.get('/:id/qr', async (c) => {
  const id = Number(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const buf = await qrPng(inviteUrl(guest.inviteToken), 512);
  return binaryResponse(buf, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
});

/** 专属海报 */
guestRoutes.get('/:id/poster', async (c) => {
  const id = Number(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const buf = await renderPoster(inviteUrl(guest.inviteToken));
  return binaryResponse(buf, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
});

/** 批量海报 ZIP（仅管理员） */
guestRoutes.get('/posters/export', requireAdmin, async (c) => {
  const rows = db.select().from(guests).orderBy(asc(guests.id)).all();
  const files: { name: string; buffer: Buffer }[] = [];
  for (const g of rows) {
    const png = await renderPoster(inviteUrl(g.inviteToken));
    const safe = g.name.replace(/[\\/:*?"<>|]/g, '_');
    files.push({ name: `${safe}_${g.id}.png`, buffer: png });
  }
  const zip = await zipBuffers(files);
  return binaryResponse(zip, attachmentHeaders('海报.zip', 'application/zip'));
});

/** 导入 Excel */
guestRoutes.post('/import', requireAdmin, async (c) => {
  const form = await c.req.parseBody();
  const file = form['file'];
  if (!(file instanceof File)) {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: '请上传 Excel 文件' } }, 400);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { guests: parsed, failed } = await parseGuestWorkbook(buffer);
  const ts = now();
  let created = 0;
  for (const g of parsed) {
    db.insert(guests)
      .values({
        name: g.name,
        salutation: g.salutation,
        phone: g.phone,
        groupName: g.groupName,
        side: g.side,
        inviteToken: generateToken(),
        status: 'pending',
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    created++;
  }
  return c.json({ ok: true, data: { created, failed } });
});

/** 导出 Excel */
guestRoutes.get('/export', requireAdmin, async (c) => {
  const rows = db.select().from(guests).orderBy(asc(guests.id)).all();
  const statusLabel: Record<string, string> = { pending: '待邀请', sent: '已发送', viewed: '已查看', rsvp: '已回执' };
  const sideLabel: Record<string, string> = { male: '男方', female: '女方', both: '双方' };
  const buf = await buildWorkbook([
    {
      name: '宾客',
      columns: [
        { header: '姓名', key: 'name', width: 14 },
        { header: '称谓', key: 'salutation', width: 12 },
        { header: '手机号', key: 'phone', width: 16 },
        { header: '分组', key: 'groupName', width: 12 },
        { header: '归属方', key: 'side', width: 10 },
        { header: '状态', key: 'status', width: 10 },
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
});
