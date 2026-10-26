/** 共享类型与枚举（前后端通用） */

export type Role = 'admin' | 'staff';

export type GuestStatus = 'pending' | 'sent' | 'viewed' | 'rsvp';
export type Side = 'male' | 'female' | 'both';
export type Attending = 'yes' | 'no' | 'maybe';
export type RsvpSource = 'link' | 'universal';
export type CheckinSource = 'self' | 'manual';
export type CheckinStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';
/** 现场核对后明确新建的另一位宾客，可补充归属信息。 */
export interface NewCheckinGuest {
  groupName?: string;
  side?: Side;
}
export interface PublicCheckinResult {
  id: number;
  duplicate: boolean;
  status: CheckinStatus;
}
export type GiftMethod = 'wechat' | 'alipay' | 'cash';

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------- DTO ---------- */

export interface GuestDTO {
  id: number;
  name: string;
  salutation: string | null;
  phone: string | null;
  groupName: string | null;
  side: Side | null;
  status: GuestStatus;
  note: string | null;
  inviteToken: string;
  inviteUrl: string;
  invitedAt: number | null;
  viewedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  attending: Attending | null;
  checkedIn?: boolean;
}

export interface GuestDetailDTO {
  guest: GuestDTO;
  rsvp: RsvpDTO | null;
  checkins: CheckinDTO[];
  gifts: GiftDTO[];
  giftTotal: number;
}

export interface RsvpDTO {
  guestArchived?: boolean;
  id: number;
  guestId: number | null;
  guestName: string;
  attending: Attending;
  headcount: number;
  childrenCount: number;
  message: string | null;
  source: RsvpSource;
  submittedAt: number;
  updatedAt: number;
}

export interface RsvpSummary {
  yes: number;
  no: number;
  maybe: number;
  headcountYes: number;
  childrenYes: number;
  total: number;
}

export interface RsvpListDTO {
  items: RsvpDTO[];
  total: number;
  page: number;
  pageSize: number;
  summary: RsvpSummary;
}

export interface CheckinDTO {
  autoCreatedGuest?: boolean | null;
  guestArchived?: boolean;
  id: number;
  guestId: number | null;
  guestName: string;
  source: CheckinSource;
  status: CheckinStatus;
  note: string | null;
  submittedAt: number;
  confirmedAt: number | null;
  actualHeadcount: number | null;
  actualChildrenCount: number | null;
  giftCount?: number;
  giftActiveCount?: number;
  giftAmount: number | null;
  giftMethod: GiftMethod | null;
  giftVoided?: boolean;
  attending: Attending | null;
}

/** 现场辨认宾客所需的信息，不包含电话、备注或邀请凭证。 */
export interface GuestCandidate {
  /** Active submissions associated with this ID, including the current one. */
  pendingCheckinIds?: number[];
  id: number;
  name: string;
  groupName: string | null;
  side: Side | null;
  attending: Attending | null;
  headcount: number | null;
  childrenCount: number | null;
  /** 至少有一条已确认签到；待审核提交不算已签到。 */
  checkedIn: boolean;
}

export interface PendingCheckinDTO extends CheckinDTO {
  guestCandidates: GuestCandidate[];
  requiresGuestSelection: boolean;
}

export interface GiftDTO {
  version: number;
  id: number;
  guestId: number | null;
  guestName: string;
  amount: number;
  method: GiftMethod;
  note: string | null;
  checkinId: number | null;
  recordedAt: number;
  voidedAt: number | null;
}

export interface GiftSummary {
  total: number;
  count: number;
  byMethod: { method: GiftMethod; amount: number; count: number }[];
}

export interface GiftListDTO {
  items: GiftDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** 仅管理员返回；工作人员为 null */
  summary: GiftSummary | null;
}

export interface StatsSummary {
  guestTotal: number;
  invitedCount: number;
  rsvpCount: number;
  attendingHeadcount: number;
  checkinCount: number;
  actualHeadcount: number;
  actualChildrenCount: number;
  unknownHeadcountGroups: number;
  pendingCheckinCount: number;
  giftTotal: number;
  giftCount: number;
}

export interface StatsCharts {
  rsvp: { yes: number; no: number; maybe: number };
  giftByMethod: { method: GiftMethod; amount: number; count: number }[];
  guestBySide: { side: string; count: number }[];
  guestByGroup: { group: string; count: number }[];
}

export interface InviteData {
  guestName: string;
  salutation: string | null;
  rsvp: RsvpDTO | null;
}

export interface ImportResult {
  created: number;
  failed: { row: number; reason: string }[];
}

export type LifecycleEntity = 'guest' | 'checkin' | 'gift';
export type LifecycleAction = 'archive' | 'restore' | 'reject' | 'cancel' | 'void';
export interface OperationLogDTO {
  detail?: string;
  id: number;
  action: string;
  reason: string;
  actorName: string;
  createdAt: number;
}
export interface LifecyclePreview {
  entity: LifecycleEntity;
  id: number;
  action: LifecycleAction;
  name: string;
  token: string;
  rsvpCount: number;
  checkinCount: number;
  giftCount: number;
  giftTotal: number;
  originalGiftTotal: number;
  effect: string;
  history: OperationLogDTO[];
}

/** 工作人员现场查询白名单，不包含联系方式、备注或邀请凭证。 */
export interface StaffGuestDTO {
  id: number;
  name: string;
  groupName: string | null;
  side: Side | null;
  archivedAt: number | null;
  attending: Attending | null;
  headcount: number | null;
  childrenCount: number | null;
  checkedIn: boolean;
}
export interface StaffGuestDetailDTO {
  gifts: GiftDTO[];
  guest: StaffGuestDTO;
  checkins: Pick<CheckinDTO, 'id' | 'status' | 'submittedAt' | 'confirmedAt' | 'actualHeadcount' | 'actualChildrenCount'>[];
}

export interface CheckinReassignmentPreview {
  token: string;
  from: { id: number | null; name: string };
  to: { id: number; name: string };
  gifts: Pick<GiftDTO, 'id' | 'amount' | 'voidedAt'>[];
  actualHeadcount: number | null;
  actualChildrenCount: number | null;
}

/** Read-only onsite directory; financial/private fields are admin-only. */
export type ReviewGuestStatus = 'pending' | 'confirmed' | 'unconfirmed';
export interface ReviewGuestRow {
  key: string;
  guestId: number | null;
  name: string;
  groupName: string | null;
  side: Side | null;
  expected: number | null;
  actual: number | null;
  status: ReviewGuestStatus;
  pendingId: number | null;
  time: number | null;
  giftTotal?: number | null;
  note?: string | null;
}
