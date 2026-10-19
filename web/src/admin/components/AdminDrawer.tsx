import { Drawer, type DrawerProps } from 'antd';
import { adminCssVariables } from '../theme';
import './admin-drawer.css';

/** Shared native drawer shell: portal tokens, fixed native footer and one body scroll owner. */
export function AdminDrawer(props: DrawerProps) {
  return (
    <Drawer
      {...props}
      size={props.size ?? 'var(--drawer-width)'}
      rootClassName={`admin-dialog ${props.rootClassName ?? ''}`}
      rootStyle={{ ...adminCssVariables, ...props.rootStyle }}
      classNames={(info) => {
        const classes =
          typeof props.classNames === 'function' ? props.classNames(info) : props.classNames;
        return {
          ...classes,
          body: ['admin-module-scroll', classes?.body].filter(Boolean).join(' '),
        };
      }}
    />
  );
}
