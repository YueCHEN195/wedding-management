import { Button, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
export function RefreshButton({
  loading,
  onRefresh,
  children = '刷新数据',
  compact = false,
}: {
  loading: boolean;
  onRefresh: () => unknown;
  children?: string;
  compact?: boolean;
}) {
  return (
    <Tooltip title={compact ? children : undefined}>
      <Button
        aria-label={children}
        icon={<ReloadOutlined aria-hidden />}
        loading={loading}
        onClick={() => {
          onRefresh();
        }}
      >
        {compact ? null : children}
      </Button>
    </Tooltip>
  );
}
