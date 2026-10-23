import type { DisplayFormat, MediaOutputInfo } from '@shared/media';
import type {
  ReviewGuestRow,
  ReviewGuestStatus,
  CheckinDTO,
  LifecycleEntity,
  LifecycleAction,
  LifecyclePreview,
  OperationLogDTO,
  NewCheckinGuest,
  GuestCandidate,
  PendingCheckinDTO,
  PublicCheckinResult,
  GiftDTO,
  GiftListDTO,
  GuestDTO,
  StaffGuestDTO,
  StaffGuestDetailDTO,
  GuestDetailDTO,
  ImportResult,
  InviteData,
  Paginated,
  RsvpDTO,
  RsvpListDTO,
  SessionUser,
  StatsCharts,
  StatsSummary,
  GuestStatus,
  Side,
  Attending,
  GiftMethod,
  CheckinStatus,
} from '@shared/types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('NETWORK', '无法连接服务器，请检查网络或稍后重试', 0);
  }

  const body = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } }
    | null;

  if (!body) {
    // 后端未启动 / 端口不通时，开发代理会返回非 JSON 的错误页
    const hint =
      res.status === 0 || res.status >= 500
        ? '无法连接后端服务，请确认后端已启动（开发环境运行 pnpm dev）'
        : '服务响应异常，请稍后重试';
    throw new ApiError('NETWORK', hint, res.status);
  }
  if (!body.ok) throw new ApiError(body.error.code, body.error.message, res.status);
  return body.data;
}

function qs(params: object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export interface GuestListParams {
  archived?: 'only' | 'all';
  keyword?: string;
  status?: GuestStatus;
  groupName?: string;
  side?: Side;
  page?: number;
  pageSize?: number;
}

export const api = {
  me: () => apiFetch<SessionUser>('/api/auth/me'),
  login: (username: string, password: string) =>
    apiFetch<SessionUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => apiFetch<boolean>('/api/auth/logout', { method: 'POST' }),

  guests: {
    workbench: (p: { keyword?: string; status?: ReviewGuestStatus; side?: Side; page?: number; pageSize?: number }) =>
      apiFetch<Paginated<ReviewGuestRow>>(`/api/guests/workbench${qs(p)}`),
    staffList: (p: GuestListParams) => apiFetch<Paginated<StaffGuestDTO>>(`/api/guests${qs(p)}`),
    staffDetail: (id: number) => apiFetch<StaffGuestDetailDTO>(`/api/guests/${id}/detail`),
    list: (p: GuestListParams) => apiFetch<Paginated<GuestDTO>>(`/api/guests${qs(p)}`),
    groups: () => apiFetch<string[]>('/api/guests/groups'),
    create: (data: Partial<GuestDTO>) =>
      apiFetch<GuestDTO>('/api/guests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<GuestDTO>, updatedAt: number) =>
      apiFetch<GuestDTO>(`/api/guests/${id}`, { method: 'PATCH', headers: { 'If-Match': String(updatedAt) }, body: JSON.stringify(data) }),
    markSent: (id: number) => apiFetch<GuestDTO>(`/api/guests/${id}/mark-sent`, { method: 'POST' }),
    detail: (id: number) => apiFetch<GuestDetailDTO>(`/api/guests/${id}/detail`),
    import: async (file: File): Promise<ImportResult> => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/guests/import', { method: 'POST', body: fd, credentials: 'include' });
      const body = await res.json();
      if (!body.ok) throw new ApiError(body.error.code, body.error.message, res.status);
      return body.data;
    },
    qrUrl: (id: number) => `/api/guests/${id}/qr`,
    posterUrl: (id: number) => `/api/guests/${id}/poster`,
    exportUrl: () => '/api/guests/export',
    postersZipUrl: () => '/api/guests/posters/export',
  },

  rsvps: {
    list: (p: { keyword?: string; attending?: Attending; page?: number; pageSize?: number }) =>
      apiFetch<RsvpListDTO>(`/api/rsvps${qs(p)}`),
    get: (id: number) => apiFetch<RsvpDTO>(`/api/rsvps/${id}`),
    update: (id: number, data: Partial<RsvpDTO>, updatedAt: number) =>
      apiFetch<RsvpDTO>(`/api/rsvps/${id}`, { method: 'PATCH', headers: { 'If-Match': String(updatedAt) }, body: JSON.stringify(data) }),
  },

  lifecycle: {
    preview: (entity: LifecycleEntity, id: number, action: LifecycleAction) =>
      apiFetch<LifecyclePreview>(`/api/lifecycle/${entity}/${id}/preview${qs({ action })}`),
    apply: (entity: LifecycleEntity, id: number, data: { action: LifecycleAction; reason: string; token: string }) =>
      apiFetch<boolean>(`/api/lifecycle/${entity}/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    history: (entity: LifecycleEntity, id: number) => apiFetch<OperationLogDTO[]>(`/api/lifecycle/${entity}/${id}/history`),
  },
  checkins: {
    list: (p: { status?: CheckinStatus; keyword?: string; page?: number; pageSize?: number }) =>
      apiFetch<Paginated<CheckinDTO>>(`/api/checkins${qs(p)}`),
    pending: () => apiFetch<PendingCheckinDTO[]>('/api/checkins/pending'),
    candidates: (name: string) => apiFetch<GuestCandidate[]>(`/api/checkins/candidates${qs({ name })}`),
    createManual: (data: { actualHeadcount: number; actualChildrenCount: number; guestName: string; submissionKey: string; guestId?: number; newGuest?: NewCheckinGuest; amount?: number; method?: GiftMethod; note?: string }) =>
      apiFetch<CheckinDTO & { duplicate: boolean }>('/api/checkins', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: number, data: { actualHeadcount: number; actualChildrenCount: number; guestId?: number; newGuest?: NewCheckinGuest; amount: number; method: GiftMethod; note?: string }) =>
      apiFetch<CheckinDTO>(`/api/checkins/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(data) }),
    correctAttendance: (id: number, data: { actualHeadcount: number; actualChildrenCount: number; expectedHeadcount: number | null; expectedChildrenCount: number | null; reason: string }) =>
      apiFetch<CheckinDTO>(`/api/checkins/${id}/attendance`, { method: 'PATCH', body: JSON.stringify(data) }),
    qrUrl: (download = false) => `/api/checkin/qr${download ? '?download=1' : ''}`,
    materials: () => apiFetch<MediaOutputInfo>('/api/checkin/materials'),
    displayUrl: (format: DisplayFormat, download = false) =>
      `/api/checkin/display?format=${format}${download ? '&download=1' : ''}`,
  },

  gifts: {
    list: (p: { state?: 'voided' | 'all'; method?: GiftMethod; keyword?: string; page?: number; pageSize?: number }) =>
      apiFetch<GiftListDTO>(`/api/gifts${qs(p)}`),
    create: (data: { submissionKey: string; guestName: string; guestId?: number; amount: number; method: GiftMethod; note?: string }) =>
      apiFetch<GiftDTO>('/api/gifts', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => apiFetch<GiftDTO>(`/api/gifts/${id}`),
    update: (id: number, data: { amount?: number; method?: GiftMethod; note?: string | null; expectedVersion: number; reason: string }) =>
      apiFetch<GiftDTO>(`/api/gifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  stats: {
    summary: () => apiFetch<StatsSummary>('/api/stats/summary'),
    charts: () => apiFetch<StatsCharts>('/api/stats/charts'),
  },

  exportUrl: (type: 'guests' | 'rsvps' | 'checkins' | 'gifts') => `/api/export/${type}`,

  invite: {
    getUniversalRsvp: () => apiFetch<RsvpDTO | null>('/api/invite/rsvp'),
    get: (token: string) => apiFetch<InviteData>(`/api/invite/${token}`),
    rsvp: (token: string, data: Record<string, unknown>) =>
      apiFetch<RsvpDTO>(`/api/invite/${token}/rsvp`, { method: 'POST', body: JSON.stringify(data) }),
    universalRsvp: (data: Record<string, unknown>) =>
      apiFetch<RsvpDTO>('/api/invite/rsvp', { method: 'POST', body: JSON.stringify(data) }),
  },

  publicCheckin: {
    self: (name: string, submissionKey: string) =>
      apiFetch<PublicCheckinResult>('/api/checkin/self', {
        method: 'POST',
        body: JSON.stringify({ name, submissionKey }),
      }),
  },
};
