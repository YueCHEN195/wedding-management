import { Hono } from 'hono';
import { and, desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { gifts } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { giftToDTO } from '../lib/dto';
import { now, optionalStr, parsePage, str } from '../lib/util';
import type { GiftMethod } from '../../shared/types';

export const giftRoutes = new Hono<AppEnv>();
giftRoutes.use('*', requireAuth);

giftRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const method = url.searchParams.get('method');
  const keyword = str(url.searchParams.get('keyword'));

  const conds = [];
  if (method) conds.push(eq(gifts.method, method as GiftMethod));
  if (keyword) conds.push(like(gifts.guestName, `%${keyword}%`));
  const where = conds.length ? and(...conds) : undefined;

  const all = db.select().from(gifts).where(where).orderBy(desc(gifts.recordedAt)).all();
  const items = all.slice(offset, offset + pageSize);

  // 仅管理员可看到汇总；工作人员只看单笔
  const role = c.get('user').role;
  let summary = null;
  if (role === 'admin') {
    const total = all.reduce((s, g) => s + g.amount, 0);
    const byMethodMap = new Map<GiftMethod, { amount: number; count: number }>();
    for (const g of all) {
      const cur = byMethodMap.get(g.method) ?? { amount: 0, count: 0 };
      cur.amount += g.amount;
      cur.count++;
      byMethodMap.set(g.method, cur);
    }
    summary = {
      total,
      count: all.length,
      byMethod: [...byMethodMap.entries()].map(([m, v]) => ({ method: m, amount: v.amount, count: v.count })),
    };
  }

  return c.json({
    ok: true,
    data: { items: items.map(giftToDTO), total: all.length, page, pageSize, summary },
  });
});

giftRoutes.post('/', requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.guestName);
  const amount = Number(body.amount);
  if (!name) return c.json({ ok: false, error: { code: 'VALIDATION', message: '姓名必填' } }, 400);
  if (!Number.isFinite(amount) || amount < 0) {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: '金额不合法' } }, 400);
  }
  const row = db
    .insert(gifts)
    .values({
      guestId: body.guestId != null ? Number(body.guestId) : null,
      guestName: name,
      amount,
      method: (optionalStr(body.method) as GiftMethod | null) ?? 'cash',
      note: optionalStr(body.note),
      checkinId: null,
      recordedAt: now(),
    })
    .returning()
    .get();
  return c.json({ ok: true, data: giftToDTO(row) });
});

giftRoutes.patch('/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(gifts).where(eq(gifts.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '记录不存在' } }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof gifts.$inferInsert> = {};
  if ('guestName' in body && str(body.guestName)) patch.guestName = str(body.guestName);
  if ('amount' in body && Number.isFinite(Number(body.amount))) patch.amount = Math.max(0, Number(body.amount));
  if ('method' in body) patch.method = str(body.method) as GiftMethod;
  if ('note' in body) patch.note = optionalStr(body.note);
  const row = db.update(gifts).set(patch).where(eq(gifts.id, id)).returning().get();
  return c.json({ ok: true, data: giftToDTO(row) });
});

giftRoutes.delete('/:id', requireAdmin, (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(gifts).where(eq(gifts.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '记录不存在' } }, 404);
  db.delete(gifts).where(eq(gifts.id, id)).run();
  return c.json({ ok: true, data: true });
});
