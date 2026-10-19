import { ArrowRightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { yuan } from '@/lib/format';
import type { DashboardModel } from './useDashboard';
import '../components/summary-strip.css';

export function DashboardOverview({ model: { summary, s } }: { model: DashboardModel }) {
  const missing = summary.isPending ? '—' : summary.isError ? '暂不可用' : '未记录';
  const items = [
    { label: '当前宾客档案', value: s?.guestTotal, unit: '组' },
    { label: '已邀请', value: s?.invitedCount, unit: '组' },
    { label: '已回执档案', value: s?.rsvpCount, unit: '组' },
    { label: '待审核提交', value: s?.pendingCheckinCount, unit: '条' },
  ];
  return (
    <>
      <section className="dashboard-stage" aria-label="婚礼核心统计" aria-busy={summary.isFetching}>
        <div className="dashboard-arrival">
          <div className="dashboard-stage-heading">
            <span className="dashboard-eyebrow">相聚 · 现场概览</span>
            <Link to="/admin/review">
              进入现场审核 <ArrowRightOutlined aria-hidden />
            </Link>
          </div>
          <div className="dashboard-arrival-grid">
            <div className="dashboard-main-number">
              <h2>已核对到场</h2>
              <div className="dashboard-number" data-testid="actual-headcount">
                {s?.actualHeadcount ?? '—'}
                {s?.actualHeadcount != null && <small>人</small>}
              </div>
              <p>按已确认签到记录统计{s?.unknownHeadcountGroups ? ' · 尚有人数待补记' : ''}</p>
            </div>
            <AttendanceDetails s={s} missing={missing} />
          </div>
        </div>
        <GiftOverview s={s} missing={missing} />
      </section>
      <section
        className="admin-summary dashboard-summary"
        aria-label="筹备与待办汇总"
        aria-busy={summary.isFetching}
      >
        {items.map((item) => (
          <dl key={item.label}>
            <dt>{item.label}</dt>
            <dd>
              {item.value ?? missing}
              {item.value != null && <small>{item.unit}</small>}
            </dd>
          </dl>
        ))}
        <Link to="/admin/guests" className="dashboard-summary-link">
          查看宾客名单 <ArrowRightOutlined aria-hidden />
        </Link>
      </section>
    </>
  );
}

function GiftOverview({ s, missing }: { s: DashboardModel['s']; missing: string }) {
  return (
    <div className="dashboard-gift">
      <span className="dashboard-eyebrow">心意 · 有效礼金</span>
      <div className="dashboard-gift-value" data-testid="gift-total">
        {s?.giftTotal == null ? '—' : `¥${yuan(s.giftTotal)}`}
      </div>
      <p>
        有效登记 <strong>{s?.giftCount ?? missing}</strong>
        {s?.giftCount != null ? ' 笔' : ''}
      </p>
      <div className="dashboard-gift-footer">
        <span>不含已作废记录</span>
        <Link to="/admin/gifts">
          查看明细 <ArrowRightOutlined aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function AttendanceDetails({ s, missing }: { s: DashboardModel['s']; missing: string }) {
  const items = [
    { label: '预计出席 · 回执', value: s?.attendingHeadcount, unit: '人' },
    { label: '已确认签到', value: s?.checkinCount, unit: '组' },
    { label: '其中到场儿童', value: s?.actualChildrenCount, unit: '人' },
  ];
  return (
    <dl className="dashboard-arrival-details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.value ?? missing}
            {item.value != null && <small>{item.unit}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
