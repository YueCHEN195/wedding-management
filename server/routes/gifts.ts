import { Hono } from 'hono';
import { and, desc, eq, isNull, isNotNull, like } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { gifts, guests } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { giftToDTO } from '../lib/dto';
import { now, parsePage, str } from '../lib/util';
import { enumQuery, giftCreateSchema, giftPatchSchema, GIFT_INPUT_MESSAGE, InputError, inputErrorHandler, parseId, parseInput } from '../lib/validation';
import type { GiftMethod } from '../../shared/types';

export const giftRoutes = new Hono<AppEnv>();
giftRoutes.use('*', requireAuth);
giftRoutes.onError(inputErrorHandler);

giftRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const method = enumQuery(url.searchParams.get('method'), ['cash', 'wechat', 'alipay'] as const);
  const keyword = str(url.searchParams.get('keyword'));

  const conds = [];
  const state = enumQuery(url.searchParams.get('state'), ['voided', 'all'] as const);
  if (state === 'voided') conds.push(isNotNull(gifts.voidedAt));
  else if (state !== 'all') conds.push(isNull(gifts.voidedAt));
  if (method) conds.push(eq(gifts.method, method));
  if (keyword) conds.push(like(gifts.guestName, `%${keyword}%`));
  const where = conds.length ? and(...conds) : undefined;

  const all = db.select().from(gifts).where(where).orderBy(desc(gifts.recordedAt)).all();
  const items = all.slice(offset, offset + pageSize);

  // 仅管理员可看到汇总；工作人员只看单笔
  const role = c.get('user').role;
  let summary = null;
  if (role === 'admin') {
    const effective = all.filter((g) => g.voidedAt == null);
    const total = effective.reduce((s, g) => s + g.amount, 0);
    const byMethodMap = new Map<GiftMethod, { amount: number; count: number }>();
    for (const g of effective) {
      const cur = byMethodMap.get(g.method) ?? { amount: 0, count: 0 };
      cur.amount += g.amount;
      cur.count++;
      byMethodMap.set(g.method, cur);
    }
    summary = {
      total,
      count: effective.length,
      byMethod: [...byMethodMap.entries()].map(([m, v]) => ({ method: m, amount: v.amount, count: v.count })),
    };
  }

  return c.json({
    ok: true,
    data: { items: items.map(giftToDTO), total: all.length, page, pageSize, summary },
  });
});

giftRoutes.post('/', requireAdmin, async (c) => {
  const body = parseInput(giftCreateSchema, await c.req.json().catch(() => null), GIFT_INPUT_MESSAGE);
  const row = sqlite.transaction(() => {
    if (body.guestId != null) {
      const guest = db.select().from(guests).where(eq(guests.id, body.guestId)).get();
      if (!guest || guest.name !== body.guestName) throw new InputError('所选宾客不存在或与姓名不符，请重新核对宾客编号');
    }
    return db.insert(gifts).values({ ...body, guestId: body.guestId ?? null, checkinId: null, recordedAt: now() }).returning().get();
  }).immediate();
  return c.json({ ok: true, data: giftToDTO(row) });
});

giftRoutes.patch('/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'));
  const patch = parseInput(giftPatchSchema, await c.req.json().catch(() => null), GIFT_INPUT_MESSAGE + '；编辑时不能改名、改绑宾客或修改作废状态');
  const row = sqlite.transaction(() => {
    const current = db.select().from(gifts).where(eq(gifts.id, id)).get();
    if (!current || current.voidedAt != null) return null;
    return db.update(gifts).set(patch).where(eq(gifts.id, id)).returning().get();
  }).immediate();
  if (!row) return c.json({ ok: false, error: { code: 'CONFLICT', message: '记录已作废或不存在，不能编辑，请刷新后查看' } }, 409);
  return c.json({ ok: true, data: giftToDTO(row) });
});

giftRoutes.delete('/:id', requireAdmin, (c) => c.json({ ok: false, error: { code: 'DELETE_DISABLED', message: '不再支持永久删除，请刷新页面使用归档、驳回、撤销或作废，并核对影响范围' } }, 409));
