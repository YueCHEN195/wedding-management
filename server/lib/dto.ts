import type { CheckinDTO, GiftDTO, GuestDTO, RsvpDTO } from '../../shared/types';
import type { CheckinRow, GiftRow, GuestRow, RsvpRow } from '../db/schema';
import { env } from '../env';

export function inviteUrl(token: string): string {
  const base = env.publicBaseUrl;
  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

export function guestToDTO(row: GuestRow, attending: RsvpRow['attending'] | null = null): GuestDTO {
  return {
    id: row.id,
    name: row.name,
    salutation: row.salutation,
    phone: row.phone,
    groupName: row.groupName,
    side: row.side,
    status: row.status,
    note: row.note,
    inviteToken: row.inviteToken,
    inviteUrl: inviteUrl(row.inviteToken),
    invitedAt: row.invitedAt,
    viewedAt: row.viewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attending,
  };
}

export function rsvpToDTO(row: RsvpRow): RsvpDTO {
  return {
    id: row.id,
    guestId: row.guestId,
    guestName: row.guestName,
    attending: row.attending,
    headcount: row.headcount,
    childrenCount: row.childrenCount,
    message: row.message,
    source: row.source,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

export function checkinToDTO(row: CheckinRow, gift?: GiftRow | null): CheckinDTO {
  return {
    id: row.id,
    guestId: row.guestId,
    guestName: row.guestName,
    source: row.source,
    status: row.status,
    note: row.note,
    submittedAt: row.submittedAt,
    confirmedAt: row.confirmedAt,
    giftAmount: gift ? gift.amount : null,
    giftMethod: gift ? gift.method : null,
    attending: null,
  };
}

export function giftToDTO(row: GiftRow): GiftDTO {
  return {
    id: row.id,
    guestId: row.guestId,
    guestName: row.guestName,
    amount: row.amount,
    method: row.method,
    note: row.note,
    checkinId: row.checkinId,
    recordedAt: row.recordedAt,
  };
}
