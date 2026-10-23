import type { GiftMethod, NewCheckinGuest } from '@shared/types';
import { parseGiftYuan } from '@shared/numericInput';
import { ApiError } from '@/api/client';
import type { AttendanceValues } from '../components/AttendanceFields';
export interface CheckinFormValues extends AttendanceValues {
  guestName?: string;
  giftReceipt?: 'none' | 'received';
  guestId?: number | 'new';
  newGuest?: NewCheckinGuest;
  amountYuan?: string;
  method?: GiftMethod;
  note?: string;
}
export function checkedAmount(v: CheckinFormValues) {
  if (v.giftReceipt !== 'received') return 0;
  const amount = parseGiftYuan(v.amountYuan);
  if (amount == null) throw new ApiError('VALIDATION', '金额须为0.01–100000元，最多两位小数', 400);
  return amount;
}
export function guestChoice(v: CheckinFormValues) {
  return v.guestId === 'new' ? { newGuest: v.newGuest ?? {} } : { guestId: v.guestId };
}

interface ReviewSaveState {
  saving: boolean;
  candidatesFetching: boolean;
  candidatesError: boolean;
  noLongerPending: boolean;
  guestArchived: boolean;
  manualOpen: boolean;
  manualReady: boolean;
  pendingReady: boolean;
}
/** UI availability only: the server remains authoritative for check-in validation. */
export function isReviewSaveBlocked(state: ReviewSaveState) {
  return (
    state.saving ||
    state.candidatesFetching ||
    state.candidatesError ||
    state.noLongerPending ||
    state.guestArchived ||
    (state.manualOpen ? !state.manualReady : !state.pendingReady)
  );
}
