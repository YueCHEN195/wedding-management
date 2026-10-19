import type { CSSProperties } from 'react';
import { adminPalette } from '../theme';

/** Dashboard-only chart palette and geometry; business values never live here. */
export const dashboardChart = {
  colors: {
    attending: adminPalette.success,
    declining: adminPalette.primary,
    undecided: adminPalette.warning,
    wechat: adminPalette.success,
    cash: adminPalette.primary,
    alipay: adminPalette.info,
    surface: adminPalette.surface,
  },
  ring: { inner: '72%', outer: '90%', center: ['50%', '50%'], gap: 4, border: 3 },
  motion: { enter: 800, update: 360 },
} as const;

export const dashboardCssVariables = {
  '--dash-chart-surface': adminPalette.surface,
} as CSSProperties;
