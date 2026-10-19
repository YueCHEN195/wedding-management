import type { CSSProperties } from 'react';
// Preserve the existing guest-facing presentation during the logic-only migration.
export const RED = '#8c1c1c';
export const RED_DARK = '#5e1010';
export const GOLD = '#c8a45c';
export const PAPER = '#f7f3ea';
export const sectionStyle: CSSProperties = {
  padding: '40px 24px',
  maxWidth: 520,
  margin: '0 auto',
};
export const titleStyle: CSSProperties = {
  textAlign: 'center',
  color: GOLD,
  letterSpacing: 4,
  fontSize: 14,
  marginBottom: 20,
};
export const cardStyle: CSSProperties = {
  background: PAPER,
  color: '#2b2b2b',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
};

export const stepBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid #ddd',
  background: '#fff',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
};
