import { useState } from 'react';
import { Button, Empty } from 'antd';
import { formatDateTime } from '@/lib/format';
import type { ReviewWorkbenchModel } from './useReviewWorkbench';
type Props = Pick<
  ReviewWorkbenchModel,
  'pending' | 'items' | 'confirming' | 'manualOpen' | 'saving' | 'openTicket'
>;
export function ReviewQueue({ model }: { model: Props }) {
  const [queueExpanded, setQueueExpanded] = useState(true);
  const { pending, items, confirming, manualOpen, saving, openTicket } = model;
  return (
    <aside className="review-queue" aria-label="待审核队列">
      <div className="review-queue-heading">
        <h2>待审核 {pending.data ? `（${items.length}）` : ''}</h2>
        {items.length > 3 ? (
          <Button
            type="text"
            onClick={() => setQueueExpanded(!queueExpanded)}
            aria-expanded={queueExpanded}
          >
            {queueExpanded ? '收起队列' : `展开全部 ${items.length} 条`}
          </Button>
        ) : (
          <span className="review-connection">先到先处理</span>
        )}
      </div>
      <div className="review-queue-list admin-module-scroll">
        {pending.isPending ? (
          <div className="review-placeholder" role="status">
            正在加载待审提交…
          </div>
        ) : !pending.data ? (
          <div className="review-placeholder">队列尚未加载成功，请重试连接。</div>
        ) : items.length === 0 ? (
          <div className="review-placeholder">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                pending.isError ? '上次加载时无待审提交，当前状态未知' : '当前没有待审提交'
              }
            />
          </div>
        ) : (
          (queueExpanded ? items : items.slice(0, 3)).map((item) => (
            <button
              key={item.id}
              className="review-ticket"
              aria-pressed={confirming?.id === item.id && !manualOpen}
              disabled={saving}
              onClick={() => openTicket(item)}
            >
              <strong>{item.guestName}</strong>
              <small>
                #{item.id} · {item.source === 'self' ? '自助扫码' : '手动补录'} ·{' '}
                {formatDateTime(item.submittedAt)}
              </small>
              {(item.guestArchived || item.requiresGuestSelection) && (
                <small className="review-ticket-hint">
                  {item.guestArchived ? '关联宾客已归档' : '同名宾客，请核对本人'}
                </small>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
