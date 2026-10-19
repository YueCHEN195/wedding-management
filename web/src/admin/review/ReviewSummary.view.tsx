import { Alert, Button } from 'antd';
import type { ReviewWorkbenchModel } from './useReviewWorkbench';
import '../components/summary-strip.css';
export function ReviewSummary({
  model: { me, stats, pending },
}: {
  model: Pick<ReviewWorkbenchModel, 'me' | 'stats' | 'pending'>;
}) {
  return (
    <>
      {me.data?.role === 'admin' && (
        <section className="admin-summary review-summary" aria-label="婚礼现场概览">
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
              <dl>
                <dt>当前宾客档案</dt>
                <dd>
                  {stats.data?.guestTotal ?? '—'} <small>组</small>
                </dd>
              </dl>
              <dl>
                <dt>预计出席（回执）</dt>
                <dd>
                  {stats.data?.attendingHeadcount ?? '—'} <small>人</small>
                </dd>
              </dl>
              <dl>
                <dt>已核对到场</dt>
                <dd>
                  {stats.data?.actualHeadcount ?? '—'} <small>人</small>
                </dd>
              </dl>
              <dl>
                <dt>待处理提交</dt>
                <dd>
                  {pending.data?.length ?? '—'} <small>条</small>
                </dd>
              </dl>
              {!!stats.data?.unknownHeadcountGroups && (
                <p className="admin-summary-note">
                  另有{stats.data.unknownHeadcountGroups}组人数待补记
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
