import { useEffect, useRef } from 'react';
import { Form, type FormInstance } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuestCandidate } from '@shared/types';
import { attendanceFromRsvp } from '@shared/attendance';
export function useRsvpAttendance(
  form: FormInstance,
  name: string,
  query: UseQueryResult<GuestCandidate[], Error>,
  enabled: boolean,
) {
  const selection = Form.useWatch('guestId', form) as number | 'new' | undefined;
  const lastIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      lastIdentity.current = null;
      return;
    }
    if (!query.isSuccess) return;
    const guest =
      typeof selection === 'number'
        ? query.data.find((g) => g.id === selection)
        : selection !== 'new' && query.data.length === 1 && !query.data[0].checkedIn
          ? query.data[0]
          : undefined;
    const identity = JSON.stringify([name, selection === 'new' ? 'new' : (guest?.id ?? null)]);
    // 只在换人或首次打开时带入，后台刷新不能覆盖工作人员已修改的人数。
    if (lastIdentity.current === identity) return;
    lastIdentity.current = identity;
    const defaults = attendanceFromRsvp(guest);
    form.setFieldsValue({
      actualHeadcountInput: String(defaults.actualHeadcount),
      actualChildrenInput: String(defaults.actualChildrenCount),
    });
  }, [enabled, form, name, query.isSuccess, query.data, selection]);
}
