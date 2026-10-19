import type { ReactNode } from 'react';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

// Presentation semantics only: callers keep ownership of business states and labels.
const tones = {
  neutral: { color: 'default', icon: null },
  inactive: { color: 'default', icon: <MinusCircleOutlined aria-hidden /> },
  pending: { color: 'warning', icon: <ClockCircleOutlined aria-hidden /> },
  info: { color: 'processing', icon: <InfoCircleOutlined aria-hidden /> },
  success: { color: 'success', icon: <CheckCircleOutlined aria-hidden /> },
  error: { color: 'error', icon: <CloseCircleOutlined aria-hidden /> },
};
export type StatusTone = keyof typeof tones;

/** Static status, distinct from removable filter tags and classification labels. */
export function StatusTag({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const { color, icon } = tones[tone];
  return (
    <Tag variant="filled" color={color} icon={icon}>
      {children}
    </Tag>
  );
}
