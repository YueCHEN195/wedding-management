import { useState } from 'react';
import { message, type FormInstance } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuestDTO, GuestDetailDTO } from '@shared/types';
import { mergeGuestDraft } from './mergeGuestDraft';

/** Both guest editors use the same original snapshot and conflict recovery. */
export function useGuestDraft(
  form: FormInstance<Partial<GuestDTO>>,
  detail: UseQueryResult<GuestDetailDTO, Error>,
) {
  const [baseGuest, setBaseGuest] = useState<GuestDTO | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const recheck = async () => {
    if (!baseGuest || rechecking) return false;
    setRechecking(true);
    try {
      const latest = await detail.refetch();
      if (!latest.isSuccess || latest.data.guest.archivedAt != null) return false;
      form.setFieldsValue(mergeGuestDraft(baseGuest, latest.data.guest, form.getFieldsValue()));
      setBaseGuest(latest.data.guest);
      message.info('已保留你的修改并载入最新档案，请核对后保存');
      return true;
    } finally {
      setRechecking(false);
    }
  };
  return { baseGuest, setBaseGuest, rechecking, recheck };
}
