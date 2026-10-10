import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';

export function runMigrations(): void {
  migrate(db, { migrationsFolder: './server/db/migrations' });
}

// 允许直接 `pnpm db:migrate` 执行
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations();
  console.log('[db] migrations applied');
}
