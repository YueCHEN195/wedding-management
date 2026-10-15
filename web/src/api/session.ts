import type { QueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@shared/types';

/** 在跳转前完成会话切换，避免旧的401结果或旧账号请求覆盖新身份。 */
export async function replaceSession(queryClient: QueryClient, user: SessionUser | null): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  if (user) queryClient.setQueryData<SessionUser>(['me'], user);
}
