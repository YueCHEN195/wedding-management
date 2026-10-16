import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { adminTheme } from './theme';
import zhCN from 'antd/locale/zh_CN';

// Static Modal/message methods render outside the React provider tree.
ConfigProvider.config({
  holderRender: (children) => <ConfigProvider locale={zhCN} theme={adminTheme}>{children}</ConfigProvider>,
});

/** 仅管理端引入 antd 的主题与中文语言包（懒加载，避免进入宾客端首屏） */
export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={adminTheme}>
      {children}
    </ConfigProvider>
  );
}
