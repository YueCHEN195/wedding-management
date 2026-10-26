import { Hono } from 'hono';
import { reviewIndex } from '../services/reviewIndex';
import { and, asc, count, desc, eq, inArray, isNull, isNotNull, like, or } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { checkins, gifts, guests, rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { checkinToDTO, giftToDTO, guestToDTO, inviteUrl, rsvpToDTO, staffGuestToDTO } from '../lib/dto';
import { generateToken, now, parsePage, str } from '../lib/util';
import { attachmentHeaders, binaryResponse, XLSX_MIME } from '../lib/http';
import { qrPng } from '../services/qrcode';
import { renderPoster, zipBuffers } from '../services/media';
import { buildWorkbook, parseGuestWorkbook } from '../services/excel';
import { enumQuery, guestCreateSchema, guestPatchSchema, GUEST_INPUT_MESSAGE, inputErrorHandler, InputError, parseId, parseInput } from '../lib/validation';
import type { RsvpRow } from '../db/schema';
import type { Attending } from '../../shared/types';

export const guestRoutes = new Hono<AppEnv>();
guestRoutes.use('*', requireAuth);
guestRoutes.onError(inputErrorHandler);

/** 列表（管理员 / 工作人员只读） */
guestRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const isAdmin = c.get('user').role === 'admin';
  const keyword = str(url.searchParams.get('keyword'));
  const status = enumQuery(url.searchParams.get('status'), ['pending', 'sent', 'viewed', 'rsvp'] as const);
  const groupName = url.searchParams.get('groupName');
  const side = enumQuery(url.searchParams.get('side'), ['male', 'female', 'both'] as const);

  const conds = [];
  const archived = enumQuery(url.searchParams.get('archived'), ['only', 'all'] as const);
  if (archived === 'only') conds.push(isNotNull(guests.archivedAt));
  else if (archived !== 'all') conds.push(isNull(guests.archivedAt));
  if (keyword) conds.push(isAdmin ? or(like(guests.name, `%${keyword}%`), like(guests.phone, `%${keyword}%`)) : like(guests.name, `%${keyword}%`));
  if (status) conds.push(eq(guests.status, status));
  if (groupName) conds.push(eq(guests.groupName, groupName));
  if (side) conds.push(eq(guests.side, side));
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
  const rsvpMap = new Map<number, RsvpRow>();
  const checkedIds = new Set<number>();
  if (ids.length) {
    for (const r of db.select().from(rsvps).where(inArray(rsvps.guestId, ids)).orderBy(asc(rsvps.submittedAt), asc(rsvps.id)).all()) {
      if (r.guestId != null) { attendingMap.set(r.guestId, r.attending as Attending); rsvpMap.set(r.guestId, r); }
    }
  }

  if (ids.length) {
    for (const r of db.select({ guestId: checkins.guestId }).from(checkins).where(and(inArray(checkins.guestId, ids), eq(checkins.status, 'confirmed'))).all()) {
      if (r.guestId != null) checkedIds.add(r.guestId);
    }
  }
  return c.json({
    ok: true,
    data: { items: rows.map((r) => isAdmin ? guestToDTO(r, attendingMap.get(r.id) ?? null, checkedIds.has(r.id)) : staffGuestToDTO(r, rsvpMap.get(r.id), checkedIds.has(r.id))), total, page, pageSize },
  });
});

/** Onsite read model; existing list/detail contracts stay unchanged. */
guestRoutes.get('/workbench', (c) => {
  const url = new URL(c.req.url);
  return c.json({ ok: true, data: reviewIndex({
    ...parsePage(c.req.url, 10), guestId: url.searchParams.has('guestId') ? parseId(url.searchParams.get('guestId')!) : undefined, keyword: str(url.searchParams.get('keyword')),
    status: enumQuery(url.searchParams.get('status'), ['pending', 'confirmed', 'unconfirmed'] as const) ?? undefined,
    side: enumQuery(url.searchParams.get('side'), ['male', 'female', 'both'] as const) ?? undefined,
  }, c.get('user').role === 'admin') });
});

/** 分组列表（用于筛选下拉） */
guestRoutes.get('/groups', (c) => {
  const rows = db.selectDistinct({ groupName: guests.groupName }).from(guests).where(isNull(guests.archivedAt)).all();
  return c.json({ ok: true, data: rows.map((r) => r.groupName).filter((v): v is string => !!v) });
});

/** 新增 */
guestRoutes.post('/', requireAdmin, async (c) => {
  const body = parseInput(guestCreateSchema, await c.req.json().catch(() => null), GUEST_INPUT_MESSAGE);
  const ts = now();
  const row = db
    .insert(guests)
    .values({
      ...body,
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
  const id = parseId(c.req.param('id'));
  const existing = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  if (existing.archivedAt != null) return c.json({ ok: false, error: { code: 'GUEST_ARCHIVED', message: '请先恢复已归档宾客再编辑' } }, 409);
  const body = parseInput(guestPatchSchema, await c.req.json().catch(() => null), GUEST_INPUT_MESSAGE);
  if (c.req.header('If-Match') !== String(existing.updatedAt))
    return c.json({ ok: false, error: { code: 'VERSION_CONFLICT', message: '宾客档案已变化或缺少原版本，请保留修改并载入最新档案核对' } }, 409);
  const patch = { ...body, updatedAt: Math.max(now(), existing.updatedAt + 1) };

  const row = db.update(guests).set(patch).where(and(eq(guests.id, id), eq(guests.updatedAt, existing.updatedAt), isNull(guests.archivedAt))).returning().get();
  if (!row) return c.json({ ok: false, error: { code: 'CONFLICT', message: '宾客已归档或变更，请刷新后重新核对' } }, 409);
  return c.json({ ok: true, data: guestToDTO(row) });
});

/** 旧物理删除入口关闭，归档保留全部关联。 */
guestRoutes.delete('/:id', requireAdmin, (c) => c.json({ ok: false, error: { code: 'DELETE_DISABLED', message: '不再支持永久删除，请刷新页面使用归档、驳回、撤销或作废，并核对影响范围' } }, 409));

/** 标记已发送 */
guestRoutes.post('/:id/mark-sent', requireAdmin, (c) => {
  const id = parseId(c.req.param('id'));
  const row = sqlite.transaction(() => {
    const existing = db.select().from(guests).where(eq(guests.id, id)).get();
    if (!existing || existing.archivedAt != null) return null;
    const hasRsvp = db.select({ id: rsvps.id }).from(rsvps).where(eq(rsvps.guestId, id)).get();
    return db.update(guests).set({
      status: hasRsvp ? 'rsvp' : existing.status === 'pending' ? 'sent' : existing.status,
      invitedAt: existing.invitedAt ?? now(), updatedAt: Math.max(now(), existing.updatedAt + 1),
    }).where(eq(guests.id, id)).returning().get();
  }).immediate();
  if (!row) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  return c.json({ ok: true, data: guestToDTO(row) });
});

/** 单个宾客详情（回执 / 签到 / 礼金） */
guestRoutes.get('/:id/detail', (c) => {
  const id = parseId(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const rsvpRow = db.select().from(rsvps).where(eq(rsvps.guestId, id)).orderBy(desc(rsvps.submittedAt), desc(rsvps.id)).get();
  const checkinRows = db.select().from(checkins).where(eq(checkins.guestId, id)).orderBy(desc(checkins.submittedAt)).all();
  if (c.get('user').role === 'staff') {
    return c.json({ ok: true, data: {
      guest: staffGuestToDTO(guest, rsvpRow, checkinRows.some((r) => r.status === 'confirmed')),
      gifts: db.select().from(gifts).where(eq(gifts.guestId, id)).all()
        .filter((gift) => checkinRows.some((record) => record.id === gift.checkinId)).map(giftToDTO),
      checkins: checkinRows.map((r) => ({ id: r.id, status: r.status, submittedAt: r.submittedAt,
        confirmedAt: r.confirmedAt, actualHeadcount: r.actualHeadcount, actualChildrenCount: r.actualChildrenCount })),
    } });
  }
  const giftRows = db.select().from(gifts).where(eq(gifts.guestId, id)).orderBy(desc(gifts.recordedAt)).all();
  const giftTotal = giftRows.filter((g) => g.voidedAt == null).reduce((s, g) => s + g.amount, 0);
  return c.json({
    ok: true,
    data: {
      guest: guestToDTO(guest, rsvpRow?.attending ?? null, checkinRows.some(r => r.status === 'confirmed')),
      rsvp: rsvpRow ? rsvpToDTO(rsvpRow as RsvpRow) : null,
      checkins: checkinRows.map((r) => checkinToDTO(r)),
      gifts: giftRows.map(giftToDTO),
      giftTotal,
    },
  });
});

/** 专属二维码 */
guestRoutes.get('/:id/qr', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const buf = await qrPng(inviteUrl(guest.inviteToken), 512);
  return binaryResponse(buf, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
});

/** 专属海报 */
guestRoutes.get('/:id/poster', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'));
  const guest = db.select().from(guests).where(eq(guests.id, id)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '宾客不存在' } }, 404);
  const buf = await renderPoster(inviteUrl(guest.inviteToken));
  return binaryResponse(buf, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
});

/** 批量海报 ZIP（仅管理员） */
guestRoutes.get('/posters/export', requireAdmin, async (_c) => {
  const rows = db.select().from(guests).where(isNull(guests.archivedAt)).orderBy(asc(guests.id)).all();
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
  const { guests: parsed, failed } = await parseGuestWorkbook(buffer).catch(() => { throw new InputError('无法读取Excel文件，请确认是有效的xlsx文件后重试'); });
  const ts = now();
  // 解析在事务外完成；有效行作为一批写入，数据库失败时整批回滚。
  const created = sqlite.transaction(() => {
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
    }
    return parsed.length;
  }).immediate();
  return c.json({ ok: true, data: { created, failed } });
});

/** 导出 Excel */
guestRoutes.get('/export', requireAdmin, async (_c) => {
  const rows = db.select().from(guests).where(isNull(guests.archivedAt)).orderBy(asc(guests.id)).all();
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
