import '../components/table-toolbar.css';
import { RefreshButton } from '../components/RefreshButton';
import { Alert, Button } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { RecordAction, RecordHistory } from '../components/RecordAction';
import { CheckinFilters } from './CheckinFilters.view';
import { CheckinTable } from './CheckinTable.view';
import { AttendanceEditor } from './AttendanceEditor.view';
import type { CheckinsModel } from './useCheckinsPage';
import './checkins.css';

export function CheckinsView({ model }: { model: CheckinsModel }) {
  const { action, setAction, historyId, setHistoryId, list, params } = model;
  return (
    <div className="checkin-page">
      <PageHeader title="签到记录" description="追溯现场签到，补记或更正实际到场人数。" />
      <CheckinFilters model={model} />
      <div className="checkin-list-meta admin-table-toolbar">
        <span>
          {list.data
            ? `当前范围 ${list.data.total} 条签到${params.keyword || params.status ? ' · 已筛选' : ''}`
            : list.isError
              ? '签到记录暂不可用'
              : '正在读取签到记录…'}
        </span>
        <div className="admin-table-actions">
          <span role="status">{list.isFetching && !list.isPending ? '正在更新…' : ''}</span>
          <RefreshButton
            loading={list.isFetching}
            onRefresh={() => {
              void list.refetch();
            }}
          />
        </div>
      </div>
      {list.isError && (
        <Alert
          type="error"
          showIcon
          title={list.data ? '签到记录刷新失败，当前显示上次数据' : '签到记录加载失败'}
          description="连接失败不代表没有签到，请重试读取。"
          action={
            <Button
              onClick={() => {
                void list.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      <CheckinTable model={model} />
      <p className="checkin-helper">
        实到总人数包含儿童，与回执预计人数分别记录；待补记表示历史人数未知。礼金自愿，未登记不表示欠款，作废金额不计入有效汇总。
      </p>
      <AttendanceEditor model={model} />
      {action && (
        <RecordAction
          key={`${action.id}-${action.action}`}
          target={action}
          onClose={() => setAction(null)}
        />
      )}
      {historyId != null && (
        <RecordHistory entity="checkin" id={historyId} onClose={() => setHistoryId(null)} />
      )}
    </div>
  );
}
