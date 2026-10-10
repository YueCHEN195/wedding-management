import { sign, verify } from 'hono/jwt';
import type { Role } from '@shared/types';
import { env } from '../env';

export interface SessionPayload {
  id: number;
  username: string;
  role: Role;
  exp: number;
  // 兼容 Hono JWTPayload 的索引签名
  [key: string]: unknown;
}

const ALG = 'HS256';
const WEEK_SECONDS = 60 * 60 * 24 * 7;

export function createToken(user: { id: number; username: string; role: Role }): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + WEEK_SECONDS,
  };
  return sign(payload, env.jwtSecret, ALG);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const decoded = await verify(token, env.jwtSecret, ALG);
    return decoded as SessionPayload;
  } catch {
    return null;
  }
}
