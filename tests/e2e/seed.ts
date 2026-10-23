import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import bcrypt from 'bcryptjs';

const path = resolve(process.env.DB_PATH ?? '');
if (
  process.env.WEDDING_E2E_RUN !== '1' ||
  !dirname(path).startsWith(resolve(tmpdir()) + '/wedding-phase1-')
) {
  throw new Error('浏览器测试只能使用本次创建的临时数据库');
}
const { runMigrations } = await import('../../server/db/migrate');
const { sqlite } = await import('../../server/db/client');
runMigrations();
const password = await bcrypt.hash('Phase1-Test-Only!', 10);
const insert = sqlite.prepare(
  'INSERT INTO users(username,password_hash,role,created_at) VALUES (?,?,?,?)',
);
insert.run('phase1-admin', password, 'admin', Date.now());
insert.run('phase1-staff', password, 'staff', Date.now());
sqlite.close();
