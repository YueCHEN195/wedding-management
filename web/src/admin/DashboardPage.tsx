import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Row, Statistic, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { api } from '@/api/client';
import { yuan } from '@/lib/format';
import { wedding } from '@shared/wedding';

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['stats', 'summary'], queryFn: api.stats.summary });
  const charts = useQuery({ queryKey: ['stats', 'charts'], queryFn: api.stats.charts });
  const s = summary.data;

  return (
    <div>
      <Typography.Title level={4}>仪表盘</Typography.Title>
      {s && s.unknownHeadcountGroups > 0 && <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={`另有${s.unknownHeadcountGroups}组已签到，人数待补记；以下到场人数尚不完整。请到签到记录补记。`} />}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card><Statistic title="宾客总数" value={s?.guestTotal ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="预计出席人数（回执）" value={s?.attendingHeadcount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="已到场人数（已核对）" value={s?.actualHeadcount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="礼金总额" prefix="¥" value={yuan(s?.giftTotal ?? 0)} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="待审核" value={s?.pendingCheckinCount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="已回执" value={s?.rsvpCount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="礼金笔数" value={s?.giftCount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="已邀请" value={s?.invitedCount ?? 0} loading={summary.isLoading} /></Card>
        </Col>
        <Col xs={12} md={6}><Card><Statistic title="已签到组数" value={s?.checkinCount ?? 0} loading={summary.isLoading} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="到场儿童（包含在总人数内）" value={s?.actualChildrenCount ?? 0} loading={summary.isLoading} /></Card></Col>
      </Row>

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
                      name: m.method === 'wechat' ? '微信' : m.method === 'alipay' ? '支付宝' : '现金',
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
                xAxis: { type: 'category', data: (charts.data?.guestByGroup ?? []).map((g) => g.group) },
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

      <Card style={{ marginTop: 16 }} title="婚礼信息（demo 占位）">
        <p>新人：{wedding.groomName} &amp; {wedding.brideName}</p>
        <p>时间：{wedding.date}</p>
        <p>地点：{wedding.venue.name} · {wedding.venue.hall}</p>
      </Card>
    </div>
  );
}
