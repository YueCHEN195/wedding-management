import { Alert, Button, Empty, Spin } from 'antd';
import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import { METHOD_LABEL, SIDE_LABEL, yuan } from '@/lib/format';
import type { Side } from '@shared/types';
import { TableText } from '../components/TableText';
import { RsvpRing } from './RsvpRing.view';
import { dashboardChart } from './dashboardTokens';
import type { DashboardModel } from './useDashboard';
import './dashboard-charts.css';

export function DashboardCharts({ model: { charts, reducedMotion } }: { model: DashboardModel }) {
  const data = charts.data;
  const rsvp = data
    ? [
        { label: '出席', value: data.rsvp.yes, color: dashboardChart.colors.attending },
        { label: '待定', value: data.rsvp.maybe, color: dashboardChart.colors.undecided },
        { label: '不出席', value: data.rsvp.no, color: dashboardChart.colors.declining },
      ]
    : [];
  const giftMax = Math.max(1, ...(data?.giftByMethod.map((x) => x.amount) ?? []));
  const groupMax = Math.max(1, ...(data?.guestByGroup.map((x) => x.count) ?? []));
  return (
    <section
      aria-label="婚礼统计图表"
      className="dashboard-charts-section"
      aria-busy={charts.isFetching}
    >
      {charts.isError && (
        <Alert
          className="dashboard-feedback"
          type="error"
          showIcon
          title={data ? '图表更新失败，以下保留上次数据' : '统计图表读取失败'}
          action={
            <Button
              onClick={() => {
                void charts.refetch();
              }}
            >
              重试图表
            </Button>
          }
        />
      )}
      <div className="dashboard-charts">
        <ChartPanel
          title="回执意向"
          description="按回执份数统计，排除已归档宾客"
          action={<Link to="/admin/rsvps">管理回执 →</Link>}
        >
          <ChartState
            pending={charts.isPending}
            failed={!data && charts.isError}
            empty={!rsvp.some((x) => x.value > 0)}
          >
            <div className="dashboard-ring-wrap">
              <RsvpRing items={rsvp} reducedMotion={reducedMotion} />
              <div className="dashboard-ring-center" aria-hidden="true">
                <strong>赴一场相聚</strong>
                <span>出席 · 待定 · 不出席</span>
              </div>
            </div>
            <dl className="dashboard-ring-legend">
              {rsvp.map((x) => (
                <div key={x.label}>
                  <dt>
                    <span className="dashboard-dot" style={{ background: x.color }} />
                    {x.label}
                  </dt>
                  <dd>
                    {x.value}
                    <small>份</small>
                  </dd>
                </div>
              ))}
            </dl>
          </ChartState>
        </ChartPanel>
        <ChartPanel
          title="礼金方式"
          description="有效实收金额 · 不含已作废礼金"
          action={<Link to="/admin/gifts">查看账目 →</Link>}
        >
          <ChartState
            pending={charts.isPending}
            failed={!data && charts.isError}
            empty={!data?.giftByMethod.some((x) => x.amount > 0)}
          >
            <div className="dashboard-methods">
              {data?.giftByMethod.map((x) => (
                <div className="dashboard-method" key={x.method}>
                  <div className="dashboard-bar-heading">
                    <span>{METHOD_LABEL[x.method]}</span>
                    <strong>¥{yuan(x.amount)}</strong>
                  </div>
                  <div className="dashboard-bar-track" aria-hidden="true">
                    <span
                      className="dashboard-bar"
                      style={barStyle(x.amount, giftMax, dashboardChart.colors[x.method])}
                    />
                  </div>
                  <span className="dashboard-chart-note">{x.count} 笔有效登记</span>
                </div>
              ))}
            </div>
          </ChartState>
        </ChartPanel>
        <ChartPanel
          title="宾客构成"
          description="当前未归档宾客 · 分组与归属"
          action={<Link to="/admin/guests">查看名单 →</Link>}
        >
          <ChartState
            pending={charts.isPending}
            failed={!data && charts.isError}
            empty={!data?.guestByGroup.some((x) => x.count > 0)}
          >
            <div
              className="dashboard-groups admin-module-scroll"
              tabIndex={0}
              role="region"
              aria-label="宾客分组，可滚动查看更多"
            >
              {data?.guestByGroup.map((x) => (
                <div className="dashboard-group" key={x.group}>
                  <div className="dashboard-bar-heading">
                    <TableText value={x.group} />
                    <strong>
                      {x.count}
                      <small>组</small>
                    </strong>
                  </div>
                  <div className="dashboard-bar-track" aria-hidden="true">
                    <span
                      className="dashboard-bar"
                      style={barStyle(x.count, groupMax, dashboardChart.colors.attending)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <dl className="dashboard-side-legend">
              {data?.guestBySide.map((x) => (
                <div key={x.side}>
                  <dt>{SIDE_LABEL[x.side as Side] ?? '未填写归属'}</dt>
                  <dd>{x.count} 组</dd>
                </div>
              ))}
            </dl>
          </ChartState>
        </ChartPanel>
      </div>
    </section>
  );
}
function barStyle(value: number, max: number, color: string): CSSProperties {
  // Ratio controls geometry only; displayed values always come from the server.
  return { '--bar-share': `${(value / max) * 100}%`, '--bar-color': color } as CSSProperties;
}
function ChartPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-chart-panel">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="dashboard-chart-body">{children}</div>
      <footer>{action}</footer>
    </section>
  );
}
function ChartState({
  pending,
  failed,
  empty,
  children,
}: {
  pending: boolean;
  failed: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  if (pending)
    return (
      <div className="dashboard-chart-state" role="status">
        <Spin />
        <span>正在读取图表…</span>
      </div>
    );
  if (failed)
    return (
      <div className="dashboard-chart-state">
        <span>图表暂不可用，请重试读取</span>
      </div>
    );
  if (empty)
    return (
      <div className="dashboard-chart-state">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可展示的数据" />
      </div>
    );
  return <>{children}</>;
}
