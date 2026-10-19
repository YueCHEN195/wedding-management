import { Alert, Button, Card, Col, Row, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { yuan } from '@/lib/format';
import { wedding } from '@shared/wedding';

import type { DashboardModel } from './useDashboard';
import '../components/summary-strip.css';
export function DashboardView({ model: { summary, charts, s } }: { model: DashboardModel }) {
  return (
    <div>
      <Typography.Title level={4}>仪表盘</Typography.Title>
      {s && s.unknownHeadcountGroups > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`另有${s.unknownHeadcountGroups}组已签到，人数待补记；以下到场人数尚不完整。请到签到记录补记。`}
        />
      )}
      <DashboardSummary summary={summary} s={s} />
      <DashboardCharts charts={charts} />
      <Card style={{ marginTop: 16 }} title="婚礼信息（demo 占位）">
        <p>
          新人：{wedding.groomName} &amp; {wedding.brideName}
        </p>
        <p>时间：{wedding.date}</p>
        <p>
          地点：{wedding.venue.name} · {wedding.venue.hall}
        </p>
      </Card>
    </div>
  );
}

function DashboardSummary({ summary, s }: Pick<DashboardModel, 'summary' | 's'>) {
  const items = [
    { label: '宾客总数', value: s?.guestTotal, unit: '组' },
    { label: '预计出席（回执）', value: s?.attendingHeadcount, unit: '人' },
    { label: '已核对到场', value: s?.actualHeadcount, unit: '人' },
    { label: '礼金总额', value: s?.giftTotal == null ? undefined : `¥${yuan(s.giftTotal)}` },
    { label: '待审核', value: s?.pendingCheckinCount, unit: '条' },
    { label: '已回执', value: s?.rsvpCount, unit: '份' },
    { label: '礼金笔数', value: s?.giftCount, unit: '笔' },
    { label: '已邀请', value: s?.invitedCount, unit: '组' },
    { label: '已签到', value: s?.checkinCount, unit: '组' },
    { label: '其中到场儿童', value: s?.actualChildrenCount, unit: '人' },
  ];
  return (
    <section className="admin-summary" aria-label="婚礼数据汇总" aria-busy={summary.isFetching}>
      {items.map((item) => (
        <dl key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.value ?? (summary.isPending ? '—' : '未记录')}
            {item.value != null && item.unit && <small>{item.unit}</small>}
          </dd>
        </dl>
      ))}
      {summary.isError && (
        <Alert
          type="warning"
          title={s ? '汇总更新失败，当前显示上次数据' : '汇总读取失败'}
          action={
            <Button
              onClick={() => {
                void summary.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
    </section>
  );
}
function DashboardCharts({ charts }: Pick<DashboardModel, 'charts'>) {
  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} md={8}>
        <Card title="回执情况">
          <ReactECharts
            style={{ height: 260 }}
            option={{
              tooltip: { trigger: 'item' },
              series: [
                {
                  type: 'pie',
                  radius: '65%',
                  data: [
                    { name: '出席', value: charts.data?.rsvp.yes ?? 0 },
                    { name: '不出席', value: charts.data?.rsvp.no ?? 0 },
                    { name: '待定', value: charts.data?.rsvp.maybe ?? 0 },
                  ],
                  color: ['#52c41a', '#cf1322', '#d4a017'],
                },
              ],
            }}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card title="礼金方式分布（元）">
          <ReactECharts
            style={{ height: 260 }}
            option={{
              tooltip: { trigger: 'item' },
              series: [
                {
                  type: 'pie',
                  radius: '65%',
                  data: (charts.data?.giftByMethod ?? []).map((m) => ({
                    name:
                      m.method === 'wechat' ? '微信' : m.method === 'alipay' ? '支付宝' : '现金',
                    value: m.amount / 100,
                  })),
                  color: ['#07c160', '#1677ff', '#d4a017'],
                },
              ],
            }}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card title="宾客分组">
          <ReactECharts
            style={{ height: 260 }}
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 40, right: 16, top: 16, bottom: 24 },
              xAxis: {
                type: 'category',
                data: (charts.data?.guestByGroup ?? []).map((g) => g.group),
              },
              yAxis: { type: 'value' },
              series: [
                {
                  type: 'bar',
                  data: (charts.data?.guestByGroup ?? []).map((g) => g.count),
                  itemStyle: { color: '#b22222' },
                },
              ],
            }}
          />
        </Card>
      </Col>
    </Row>
  );
}
