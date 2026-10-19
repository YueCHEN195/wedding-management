import { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { ReviewDirectory } from './components/ReviewDirectory';
import { CheckinEntry } from './components/CheckinEntry';
import { RecordAction } from './components/RecordAction';
import { useReviewWorkbench } from './review/useReviewWorkbench';
import { ReviewQueue } from './review/ReviewQueue.view';
import { ReviewSummary } from './review/ReviewSummary.view';
import { ReviewDrawer } from './review/ReviewDrawer.view';
import './review.css';
export function ReviewPage() {
  const model = useReviewWorkbench();
  const [qrOpen, setQrOpen] = useState(false);
  const {
    recordAction,
    setRecordAction,
    goToRecords,
    saving,
    openManual,
    pending,
    me,
    confirming,
    onNavigate,
    onProcess,
    invalidate,
  } = model;
  return (
    <div className="review-workbench">
      {recordAction && (
        <RecordAction
          key={`${recordAction.id}-${recordAction.action}`}
          target={recordAction}
          onClose={() => setRecordAction(null)}
        />
      )}
      <div className="review-heading">
        <div>
          <h1>现场审核</h1>
          <p>按提交先后核对宾客、到场人数与礼金</p>
        </div>
        <Button onClick={goToRecords} disabled={saving}>
          查看签到记录
        </Button>
      </div>
      <div className="review-toolbar">
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={openManual} disabled={saving}>
            查人 / 手动补录
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={pending.isFetching}
            onClick={() => {
              void pending.refetch();
            }}
          >
            刷新队列
          </Button>
          <Button onClick={() => setQrOpen(true)}>扫码 / 代登记</Button>
        </Space>
        <span className="review-connection">
          {pending.dataUpdatedAt
            ? `最近更新 ${new Date(pending.dataUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })} · 每5秒刷新`
            : '正在连接待审队列'}
        </span>
      </div>
      {pending.isError && (
        <Alert
          showIcon
          type="error"
          title={pending.data ? '队列刷新失败，当前显示上次成功的数据' : '无法加载待审队列'}
          description="请检查连接后重试；连接失败不代表没有待审宾客。当前填写内容会保留。"
          action={
            <Button
              onClick={() => {
                void pending.refetch();
              }}
            >
              重试连接
            </Button>
          }
        />
      )}
      <ReviewSummary model={model} />
      <div className="review-grid">
        <ReviewQueue model={model} />
        <ReviewDirectory
          admin={me.data?.role === 'admin'}
          disabled={saving}
          selectedId={confirming?.id}
          onNavigate={onNavigate}
          onProcess={onProcess}
        />
      </div>
      <ReviewDrawer model={model} />
      <CheckinEntry open={qrOpen} onClose={() => setQrOpen(false)} onCreated={invalidate} />
    </div>
  );
}
