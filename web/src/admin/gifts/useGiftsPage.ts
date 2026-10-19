import { useCurrentUser } from '@/api/useCurrentUser';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { GiftMethod } from '@shared/types';
import type { RecordActionTarget } from '../components/RecordAction';
import { useGiftEditor } from './useGiftEditor';
export function useGiftsPage() {
  const [params, setParams] = useState<{
    page: number;
    pageSize: number;
    method?: GiftMethod;
    keyword?: string;
    state?: 'voided' | 'all';
  }>({
    page: 1,
    pageSize: 10,
  });
  const [action, setAction] = useState<RecordActionTarget | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const list = useQuery({ queryKey: ['gifts', params], queryFn: () => api.gifts.list(params) });
  const me = useCurrentUser();
  const isAdmin = me.data?.role === 'admin';

  const editor = useGiftEditor();
  return {
    params,
    setParams,
    action,
    setAction,
    historyId,
    setHistoryId,
    list,
    isAdmin,
    ...editor,
  };
}
export type GiftsModel = ReturnType<typeof useGiftsPage>;
