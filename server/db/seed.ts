import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { guests, users } from './schema';
import { env } from '../env';

async function ensureUser(username: string, password: string, role: 'admin' | 'staff') {
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    console.log(`[seed] 账号已存在，跳过：${username}`);
    return;
  }
  db.insert(users)
    .values({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      createdAt: Date.now(),
    })
    .run();
  console.log(`[seed] 已创建账号：${username}（${role}）`);
}

function ensureDemoGuests() {
  const count = db.select().from(guests).all().length;
  if (count > 0) {
    console.log('[seed] 已存在宾客数据，跳过 demo 宾客');
    return;
  }
  const demo = [
    { name: '张三', salutation: '张先生', phone: '13800000001', groupName: '朋友', side: 'male' as const },
    { name: '李四', salutation: '李女士', phone: '13800000002', groupName: '同事', side: 'female' as const },
    { name: '王五', salutation: null, phone: null, groupName: '亲戚', side: 'both' as const },
  ];
  const now = Date.now();
  for (const g of demo) {
    db.insert(guests)
      .values({
        ...g,
        inviteToken: randomBytes(16).toString('hex'),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
  console.log(`[seed] 已写入 ${demo.length} 条 demo 宾客`);
}

async function main() {
  await ensureUser(env.admin.username, env.admin.password, 'admin');
  await ensureUser(env.staff.username, env.staff.password, 'staff');
  ensureDemoGuests();
  console.log('[seed] 完成');
}

main();
