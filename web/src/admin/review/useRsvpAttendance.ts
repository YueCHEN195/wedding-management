import { useEffect, useRef } from 'react';
import { Form, type FormInstance } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuestCandidate } from '@shared/types';
import { attendanceFromRsvp } from '@shared/attendance';
import {
  defaultGuestChoice,
  guestSelectionState,
  type GuestChoice,
  type GuestSelectionContext,
} from './guestSelection';
interface Options extends GuestSelectionContext {
  enabled: boolean;
  waitingForName?: boolean;
  draftKey?: string | number | null;
}
export function useRsvpAttendance(
  form: FormInstance,
  name: string,
  query: UseQueryResult<GuestCandidate[], Error>,
  options: Options,
) {
  const selection = Form.useWatch('guestId', { form, preserve: true }) as GuestChoice;
  const initialized = useRef<string | null>(null);
  const lastIdentity = useRef<string | null>(null);
  const { enabled, waitingForName, draftKey, checkinId, preferredGuestId, relatedPendingIds } =
    options;
  useEffect(() => {
    if (!enabled) {
      initialized.current = null;
      lastIdentity.current = null;
      return;
    }
    if (waitingForName || !query.isSuccess) return;
    const draft = JSON.stringify([name, draftKey]);
    let choice = selection;
    // Defaults are assigned only once per draft, never on a realtime refresh.
    if (initialized.current !== draft) {
      initialized.current = draft;
      choice = defaultGuestChoice(query.data, { checkinId, preferredGuestId, relatedPendingIds });
      form.setFieldValue('guestId', choice);
    }
    const identity = JSON.stringify([draft, choice ?? null]);
    if (lastIdentity.current === identity) return;
    lastIdentity.current = identity;
    const guest = typeof choice === 'number' ? query.data.find((g) => g.id === choice) : undefined;
    const defaults = attendanceFromRsvp(guest);
    form.setFieldsValue({
      actualHeadcountInput: String(defaults.actualHeadcount),
      actualChildrenInput: String(defaults.actualChildrenCount),
    });
  }, [
    enabled,
    waitingForName,
    draftKey,
    checkinId,
    preferredGuestId,
    relatedPendingIds,
    form,
    name,
    query.isSuccess,
    query.data,
    selection,
  ]);
  return guestSelectionState(query.data ?? [], selection, options);
}
