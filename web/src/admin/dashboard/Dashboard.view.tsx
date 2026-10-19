import { Alert, Button } from 'antd';
import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { wedding } from '@shared/wedding';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '../components/PageHeader';
import { DashboardOverview } from './DashboardOverview.view';
import { DashboardCharts } from './DashboardCharts.view';
import type { DashboardModel } from './useDashboard';
import { dashboardCssVariables } from './dashboardTokens';
import './dashboard.css';

export function DashboardView({ model }: { model: DashboardModel }) {
  const { summary, charts, s, refresh } = model;
  const updating = summary.isFetching || charts.isFetching;
  return (
    <div className="dashboard-page" style={dashboardCssVariables}>
      <PageHeader
        title="仪表盘"
        description="从筹备到相聚，让每一份到来都有迹可循。"
        actions={
          <>
            <span className="dashboard-update" role="status">
              {updating
                ? '正在读取…'
                : summary.dataUpdatedAt
                  ? `汇总读取于 ${formatDateTime(summary.dataUpdatedAt)}`
                  : '尚未读取汇总'}
            </span>
            <Button icon={<ReloadOutlined aria-hidden />} loading={updating} onClick={refresh}>
              刷新数据
            </Button>
          </>
        }
      />
      {summary.isError && (
        <Alert
          className="dashboard-feedback"
          type="error"
          showIcon
          title={s ? '汇总更新失败，当前显示上次读取的数据' : '汇总读取失败，暂时无法展示统计'}
          description="统计失败不表示数据为零。可重试读取，不影响已经保存的业务记录。"
          action={
            <Button
              onClick={() => {
                void summary.refetch();
              }}
            >
              重试汇总
            </Button>
          }
        />
      )}
      {!!s?.unknownHeadcountGroups && (
        <Alert
          className="dashboard-feedback"
          type="warning"
          showIcon
          title={`另有 ${s.unknownHeadcountGroups} 组已签到，人数待补记；已核对到场人数尚不完整。`}
          action={
            <Link to="/admin/checkins">
              去补记人数 <ArrowRightOutlined aria-hidden />
            </Link>
          }
        />
      )}
      <DashboardOverview model={model} />
      <DashboardCharts model={model} />
      <footer className="dashboard-wedding">
        <div>
          <span className="dashboard-eyebrow">婚礼配置 · 示例</span>
          <strong>
            {wedding.groomName} <span>&amp;</span> {wedding.brideName}
          </strong>
        </div>
        <span>
          {formatDateTime(new Date(wedding.date).getTime())} · {wedding.venue.name} /{' '}
          {wedding.venue.hall}
        </span>
        <p>页面展示当前累计数据，不代表实时推送。预计人数与实际到场分别记录，礼金自愿。</p>
      </footer>
    </div>
  );
}
