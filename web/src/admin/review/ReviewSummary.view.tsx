import { Alert, Button } from 'antd';
import type { ReviewWorkbenchModel } from './useReviewWorkbench';
export function ReviewSummary({
  model: { me, stats, pending },
}: {
  model: Pick<ReviewWorkbenchModel, 'me' | 'stats' | 'pending'>;
}) {
  return (
    <>
      {' '}
      {me.data?.role === 'admin' && (
        <div className="review-summary" aria-label="婚礼现场概览">
          {stats.isError ? (
            <Alert
              type="warning"
              title="统计更新失败，请重试"
              action={
                <Button
                  onClick={() => {
                    void stats.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : (
            <>
              <div>
                <span>当前宾客档案</span>
                <strong>
                  {stats.data?.guestTotal ?? '—'} <small>组</small>
                </strong>
              </div>
              <div>
                <span>预计出席（回执）</span>
                <strong>
                  {stats.data?.attendingHeadcount ?? '—'} <small>人</small>
                </strong>
              </div>
              <div>
                <span>已核对到场</span>
                <strong>
                  {stats.data?.actualHeadcount ?? '—'} <small>人</small>
                </strong>
                {!!stats.data?.unknownHeadcountGroups && (
                  <small>另有{stats.data.unknownHeadcountGroups}组人数待补记</small>
                )}
              </div>
              <div>
                <span>待处理提交</span>
                <strong>
                  {pending.data?.length ?? '—'} <small>条</small>
                </strong>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
