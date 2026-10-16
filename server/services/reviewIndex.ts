import { sqlite } from '../db/client';
import type { ReviewGuestRow, ReviewGuestStatus } from '../../shared/types';

// Read-only projection: never join guests by name; unmatched submissions remain independent.
const projection = `WITH latest_rsvp AS (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY guest_id ORDER BY submitted_at DESC,id DESC) AS rn FROM rsvps
), attendance AS (
 SELECT guest_id, COUNT(*) AS confirmed_count,
 CASE WHEN COUNT(actual_headcount)=COUNT(*) THEN SUM(actual_headcount) END AS actual,
 MAX(confirmed_at) AS confirmed_at FROM checkins WHERE status='confirmed' GROUP BY guest_id
), waiting AS (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY guest_id ORDER BY submitted_at,id) AS rn FROM checkins WHERE status='pending'
), money AS (
 SELECT guest_id, SUM(amount) AS amount FROM gifts WHERE voided_at IS NULL GROUP BY guest_id
), directory AS (
 SELECT 'guest-' || g.id AS key, g.id AS guestId, g.name, g.group_name AS groupName, g.side,
 CASE WHEN r.attending='yes' THEN r.headcount END AS expected,
 a.actual, CASE WHEN a.confirmed_count>0 THEN 'confirmed' WHEN w.id IS NOT NULL THEN 'pending' ELSE 'unconfirmed' END AS status,
 w.id AS pendingId, COALESCE(a.confirmed_at,w.submitted_at) AS time,
 m.amount AS giftTotal, g.note
 FROM guests g LEFT JOIN latest_rsvp r ON r.guest_id=g.id AND r.rn=1
 LEFT JOIN attendance a ON a.guest_id=g.id LEFT JOIN waiting w ON w.guest_id=g.id AND w.rn=1
 LEFT JOIN money m ON m.guest_id=g.id WHERE g.archived_at IS NULL
 UNION ALL
 SELECT 'submission-' || c.id, NULL, c.guest_name, NULL, NULL, NULL, NULL, 'pending', c.id, c.submitted_at, NULL, NULL
 FROM checkins c WHERE c.status='pending' AND c.guest_id IS NULL
) `;

export function reviewIndex(params: { keyword: string; status?: ReviewGuestStatus; side?: string; page: number; pageSize: number; offset: number }, admin: boolean) {
  const where = ` WHERE (name LIKE @keyword OR COALESCE(groupName,'') LIKE @keyword)
    AND (@status IS NULL OR status=@status) AND (@side IS NULL OR side=@side)`;
  const bindings = { keyword: `%${params.keyword}%`, status: params.status ?? null, side: params.side ?? null };
  const total = (sqlite.prepare(projection + 'SELECT COUNT(*) AS total FROM directory' + where).get(bindings) as { total: number }).total;
  const rows = sqlite.prepare(projection + 'SELECT * FROM directory' + where + ' ORDER BY name, key LIMIT @limit OFFSET @offset')
    .all({ ...bindings, limit: params.pageSize, offset: params.offset }) as ReviewGuestRow[];
  return { items: rows.map(({ giftTotal, note, ...row }) => admin ? { ...row, giftTotal, note } : row), total, page: params.page, pageSize: params.pageSize };
}
