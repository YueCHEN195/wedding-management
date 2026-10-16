import { Drawer, type DrawerProps } from 'antd';
import { adminCssVariables } from '../theme';

/** Shared native drawer shell: theme tokens in portals and a single body scroll owner. */
export function AdminDrawer(props: DrawerProps) {
  return <Drawer {...props} size={props.size ?? 'var(--drawer-width)'}
    rootClassName={`admin-dialog ${props.rootClassName ?? ''}`} rootStyle={{ ...adminCssVariables, ...props.rootStyle }}
    classNames={(info) => ({ body: 'admin-module-scroll', ...(typeof props.classNames === 'function' ? props.classNames(info) : props.classNames) })} />;
}
