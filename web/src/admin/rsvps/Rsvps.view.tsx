import { Alert, Button } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { RsvpEditor } from './RsvpEditor.view';
import { RsvpTable } from './RsvpTable.view';
import { RsvpFilters, RsvpSummary } from './RsvpListTools.view';
import type { RsvpsModel } from './useRsvpsPage';
import './rsvps.css';

export function RsvpsView({ model }: { model: RsvpsModel }) {
  const { list, params } = model;
  return (
    <div className="rsvp-page">
      <PageHeader
        title="回执管理"
        description="核对来宾的出席意向与预计人数，为婚宴安排做好准备。"
      />
      <RsvpFilters model={model} />
      <RsvpSummary model={model} />
      <p className="rsvp-helper">汇总基于当前筛选，排除已归档宾客；列表仍保留其原回执。</p>
      <div className="rsvp-list-meta">
        <span>
          {list.data
            ? `当前范围 ${list.data.total} 份回执${params.keyword || params.attending ? ' · 已筛选' : ''}`
            : list.isError
              ? '回执暂不可用'
              : '正在读取回执…'}
        </span>
        <span role="status">{list.isFetching && !list.isPending ? '正在更新…' : ''}</span>
      </div>
      {list.isError && (
        <Alert
          type="error"
          showIcon
          title={list.data ? '回执刷新失败，当前显示上次数据' : '回执列表加载失败'}
          description="请重试读取；连接失败不代表没有回执。"
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
      <RsvpTable model={model} />
      <p className="rsvp-helper">
        回执人数为预计出席，与现场实到分别记录。已归档宾客需先恢复后再修改回执。
      </p>
      <RsvpEditor model={model} />
    </div>
  );
}
