import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET;
if (nodeEnv === 'production' && (!jwtSecret?.trim() || jwtSecret === 'dev-secret-change-me')) {
  throw new Error('生产环境必须配置非空且非默认的 JWT_SECRET');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './data/wedding.db',
  jwtSecret: jwtSecret ?? 'dev-secret-change-me',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin123',
  },
  staff: {
    username: process.env.STAFF_USERNAME ?? 'staff',
    password: process.env.STAFF_PASSWORD ?? 'staff123',
  },
};
