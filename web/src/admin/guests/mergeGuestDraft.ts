import type { GuestDTO } from '@shared/types';

/** Keep edited fields; refresh untouched fields only, without changing identity. */
export function mergeGuestDraft(base: GuestDTO, latest: GuestDTO, draft: Partial<GuestDTO>) {
  const fields = ['name', 'salutation', 'phone', 'groupName', 'side', 'note'] as const;
  const normalized = (value: string | null | undefined) => value?.trim() || null;
  return {
    ...draft,
    ...Object.fromEntries(
      fields
        .filter((key) => key in draft && normalized(draft[key]) === normalized(base[key]))
        .map((key) => [key, latest[key]]),
    ),
  };
}
