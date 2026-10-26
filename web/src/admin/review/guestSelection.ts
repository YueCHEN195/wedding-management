import type { GuestCandidate } from '@shared/types';
export type GuestChoice = number | 'new' | undefined;
export interface GuestSelectionContext {
  checkinId?: number;
  relatedPendingIds?: number[];
  preferredGuestId?: number;
  autoCreatedGuest?: boolean | null;
}
export function otherPendingIds(guest: GuestCandidate, checkinId?: number) {
  return (guest.pendingCheckinIds ?? []).filter((id) => id !== checkinId);
}
export function defaultGuestChoice(
  guests: GuestCandidate[],
  context: GuestSelectionContext,
): GuestChoice {
  if (context.preferredGuestId != null) return context.preferredGuestId;
  if (
    context.relatedPendingIds?.length ||
    guests.some((guest) => otherPendingIds(guest, context.checkinId).length)
  )
    return undefined;
  const available = guests.filter(
    (guest) => !guest.checkedIn && !otherPendingIds(guest, context.checkinId).length,
  );
  if (available.length === 1) return available[0].id;
  if (!guests.length || guests.every((guest) => guest.checkedIn)) return 'new';
  return undefined;
}
export function guestSelectionState(
  guests: GuestCandidate[],
  selection: GuestChoice,
  context: GuestSelectionContext,
) {
  const pendingIds = [
    ...new Set([
      ...(context.relatedPendingIds ?? []),
      ...guests.flatMap((guest) => otherPendingIds(guest, context.checkinId)),
    ]),
  ];
  const selected = guests.find((guest) => guest.id === selection);
  const blocked =
    typeof selection === 'number' &&
    (!selected || selected.checkedIn || otherPendingIds(selected, context.checkinId).length > 0);
  const allCheckedIn = guests.length > 0 && guests.every((guest) => guest.checkedIn);
  const ownTemporary = Boolean(
    context.autoCreatedGuest &&
    guests.length === 1 &&
    selection === context.preferredGuestId &&
    !blocked &&
    !pendingIds.length,
  );
  const automaticNew =
    selection === 'new' && (!guests.length || allCheckedIn) && !pendingIds.length;
  return {
    selection,
    blocked,
    allCheckedIn,
    ownTemporary,
    checkinId: context.checkinId,
    showSelection: !ownTemporary && !automaticNew,
    pendingIds,
  };
}
export type GuestSelectionState = ReturnType<typeof guestSelectionState>;
