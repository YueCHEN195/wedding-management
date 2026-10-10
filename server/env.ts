import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './data/wedding.db',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
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
