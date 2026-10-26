import { useEffect, useState } from 'react';
import type { FormInstance } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { CheckinDTO, GuestCandidate } from '@shared/types';
import type { CheckinFormValues } from './checkinForm';
import { useRsvpAttendance } from './useRsvpAttendance';
interface Options {
  form: FormInstance<CheckinFormValues>;
  manualForm: FormInstance<CheckinFormValues>;
  confirming: CheckinDTO | null;
  manualOpen: boolean;
  manualName: string;
  manualSubmissionKey: string | null;
  manualNamePending: boolean;
  pendingReady: boolean;
  confirmCandidates: UseQueryResult<GuestCandidate[], Error>;
  manualCandidates: UseQueryResult<GuestCandidate[], Error>;
  pendingItems: CheckinDTO[];
}
export function useReviewIdentity({
  form,
  manualForm,
  confirming,
  manualOpen,
  manualName,
  manualSubmissionKey,
  manualNamePending,
  pendingReady,
  confirmCandidates,
  manualCandidates,
  pendingItems,
}: Options) {
  const [manualPreferred, setManualPreferred] = useState<{ id: number; name: string } | null>(null);
  useEffect(() => {
    manualForm.setFieldsValue({ guestId: undefined, newGuest: undefined });
  }, [manualName, manualForm]);
  const confirmIdentity = useRsvpAttendance(form, confirming?.guestName ?? '', confirmCandidates, {
    enabled: confirming != null,
    waitingForName: !pendingReady,
    draftKey: confirming?.id,
    checkinId: confirming?.id,
    preferredGuestId: confirming?.guestId ?? undefined,
    autoCreatedGuest: confirming?.autoCreatedGuest,
    relatedPendingIds: pendingItems
      .filter(
        (record) => record.id !== confirming?.id && record.guestName === confirming?.guestName,
      )
      .map((record) => record.id),
  });
  const manualIdentity = useRsvpAttendance(manualForm, manualName, manualCandidates, {
    enabled: manualOpen && !!manualName,
    waitingForName: manualNamePending || !pendingReady,
    draftKey: manualSubmissionKey,
    relatedPendingIds: pendingItems
      .filter((record) => record.guestName === manualName)
      .map((record) => record.id),
    preferredGuestId: manualPreferred?.name === manualName ? manualPreferred.id : undefined,
  });
  return { identity: manualOpen ? manualIdentity : confirmIdentity, setManualPreferred };
}
