import '../components/table-toolbar.css';
import { RefreshButton } from '../components/RefreshButton';
import { Alert, Button } from 'antd';
import { GiftTable } from './GiftTable.view';
import { PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import { RecordAction, RecordHistory } from '../components/RecordAction';
import { GiftEditor } from './GiftEditor.view';
import { GiftFilters, GiftSummary } from './GiftListTools.view';
import type { GiftsModel } from './useGiftsPage';
import './gifts.css';

export function GiftsView({ model }: { model: GiftsModel }) {
  const { params, action, setAction, historyId, setHistoryId, list, isAdmin, openCreate } = model;
  return (
    <div className="gift-page">
      <PageHeader
        title={isAdmin ? '礼金管理' : '礼金查询'}
        description="核对每一笔实收礼金，保留每一次更正记录。"
        actions={
          isAdmin && (
            <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={openCreate}>
              新增礼金
            </Button>
          )
        }
      />
      {action && (
        <RecordAction
          key={`${action.id}-${action.action}`}
          target={action}
          onClose={() => setAction(null)}
        />
      )}
      {historyId != null && (
        <RecordHistory entity="gift" id={historyId} onClose={() => setHistoryId(null)} />
      )}
      <GiftFilters model={model} />
      {isAdmin && <GiftSummary model={model} />}
      <div className="gift-list-meta admin-table-toolbar">
        <span>
          {list.data
            ? `当前范围 ${list.data.total} 笔${params.keyword || params.method ? ' · 已筛选' : ''}`
            : list.isError
              ? '账目暂不可用'
              : '正在读取账目…'}
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
          title={list.data ? '账目刷新失败，当前显示上次数据' : '礼金记录加载失败'}
          description="请重试读取；连接失败不代表没有礼金记录。"
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
      <GiftTable model={model} />
      <p className="gift-helper">
        {params.state === 'voided'
          ? '作废记录保留原金额，不计入有效汇总；恢复后重新计入。'
          : '礼金自愿，仅记录实际收到的金额。未登记不表示欠款。'}
      </p>
      {isAdmin && <GiftEditor model={model} />}
    </div>
  );
}
