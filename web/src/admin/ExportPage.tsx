import { Button, Card, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { api } from '@/api/client';

const ITEMS = [
  { type: 'guests', title: '宾客名单', desc: '姓名、称谓、手机号、分组、归属方、状态、邀请链接、备注' },
  { type: 'rsvps', title: '回执', desc: '是否出席、出席人数、随行儿童、来源、祝福留言、提交时间' },
  { type: 'checkins', title: '签到记录', desc: '姓名、来源、状态、提交与确认时间、备注' },
  { type: 'gifts', title: '礼金', desc: '姓名、金额、方式、时间、备注' },
] as const;

export function ExportPage() {
  return (
    <div>
      <Typography.Title level={4}>导出</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {ITEMS.map((it) => (
          <Card
            key={it.type}
            title={it.title}
            extra={
              <Button type="primary" icon={<DownloadOutlined />} href={api.exportUrl(it.type)}>
                导出 Excel
              </Button>
            }
          >
            <Typography.Text type="secondary">{it.desc}</Typography.Text>
          </Card>
        ))}
      </Space>
    </div>
  );
}
