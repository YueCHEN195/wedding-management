import { Typography } from 'antd';

/** Keep table rows single-line; Ant Design shows the full value when truncated. */
export function TableText({ value }: { value: string | null | undefined }) {
  return <Typography.Text className="guest-cell-text" ellipsis={{ tooltip: value || '—' }}>{value || '—'}</Typography.Text>;
}
