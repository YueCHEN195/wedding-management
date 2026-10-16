import type { ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';

/** 深侧栏 · 珊瑚：品牌操作与成功、警告、错误保持独立语义。 */
export const adminPalette = {
  primary: '#824e40', primaryHover: '#98604e', primaryActive: '#693d32',
  coral: '#e9a182', copper: '#283f3e', page: '#faf7f3',
  surface: '#fffefd', processing: '#f7eee7', selected: '#faeee5',
  text: '#3f3934', secondary: '#786d65', border: '#d7ccc3', divider: '#ece5de',
  success: '#28645b', warning: '#8a611c', error: '#b52d43', info: '#395e89',
};

/** Shared by the app shell and portals (drawers do not inherit the shell DOM). */
export const adminCssVariables = {
  '--admin-primary': adminPalette.primary, '--admin-coral': adminPalette.coral,
  '--admin-copper': adminPalette.copper, '--admin-processing': adminPalette.processing,
  '--admin-selected': adminPalette.selected, '--admin-text': adminPalette.text,
  '--admin-secondary': adminPalette.secondary, '--admin-divider': adminPalette.divider,
} as CSSProperties;
export const adminFeedback = { toastDuration: 4 };

export const adminTheme: ThemeConfig = {
  token: {
    colorPrimary: adminPalette.primary,
    colorLink: adminPalette.primary, colorLinkHover: adminPalette.primaryHover, colorLinkActive: adminPalette.primaryActive,
    colorPrimaryHover: adminPalette.primaryHover,
    colorPrimaryActive: adminPalette.primaryActive,
    colorSuccess: adminPalette.success, colorWarning: adminPalette.warning,
    colorError: adminPalette.error, colorInfo: adminPalette.info,
    colorInfoBg: '#eef3f7', colorInfoBorder: '#cbd8e3',
    colorSuccessBg: '#edf5f1', colorSuccessBorder: '#c9ded4',
    colorWarningBg: '#fff5df', colorWarningBorder: '#ebd5a3',
    colorErrorBg: '#fff0f2', colorErrorBorder: '#e9bdc5',
    colorText: adminPalette.text, colorTextSecondary: adminPalette.secondary,
    colorTextTertiary: '#857b73', colorBorder: adminPalette.border,
    colorBorderSecondary: adminPalette.divider,
    colorBgLayout: adminPalette.page, colorBgContainer: adminPalette.surface,
    colorBgElevated: adminPalette.surface, colorBgContainerDisabled: '#f0ede9',
    borderRadius: 6, controlHeight: 36, controlHeightLG: 44, controlHeightSM: 28,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14, fontSizeHeading1: 28, fontSizeHeading2: 24, fontSizeHeading3: 22,
    fontSizeHeading4: 20, fontSizeHeading5: 16,
    padding: 16, paddingLG: 24, margin: 16, marginLG: 24,
    motionDurationMid: '0.16s', motionDurationSlow: '0.2s',
    boxShadowSecondary: '0 8px 32px rgba(40,63,62,0.12)',
  },
  components: {
    Layout: { siderBg: adminPalette.copper, headerBg: adminPalette.page, headerHeight: 56, bodyBg: adminPalette.page },
    Menu: {
      darkItemBg: adminPalette.copper, darkSubMenuItemBg: adminPalette.copper,
      darkItemColor: '#cbd7d1', darkItemHoverColor: '#fff8f1',
      darkItemHoverBg: '#36504c', darkItemSelectedBg: adminPalette.coral,
      darkItemSelectedColor: adminPalette.copper, itemBorderRadius: 6, itemHeight: 40,
    },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Input: { activeShadow: '0 0 0 2px rgba(130,78,64,0.14)' },
    InputNumber: { activeShadow: '0 0 0 2px rgba(130,78,64,0.14)' },
    Select: { optionSelectedBg: '#f5e2d7', optionSelectedColor: adminPalette.text },
    DatePicker: { activeShadow: '0 0 0 2px rgba(130,78,64,0.14)' },
    Form: { itemMarginBottom: 16, verticalLabelPadding: '0 0 6px', labelColor: adminPalette.secondary },
    Table: {
      headerBg: '#f4eee7', headerColor: adminPalette.secondary,
      borderColor: adminPalette.divider, rowHoverBg: '#faf4ee', rowSelectedBg: '#f6e4d9',
      cellPaddingBlock: 12, cellPaddingInline: 12, headerSplitColor: 'transparent',
    },
    Tabs: { inkBarColor: adminPalette.primary, itemSelectedColor: adminPalette.primary, horizontalItemGutter: 24 },
    Drawer: { paddingLG: 24, footerPaddingBlock: 16, footerPaddingInline: 24 },
    Modal: { paddingContentHorizontalLG: 24, borderRadiusLG: 8 },
  },
};
