import { Alert, Button, Descriptions, Form, Input, Typography } from 'antd';
import { formatDateTime } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import { AttendanceFields } from '../components/AttendanceFields';
import type { CheckinsModel } from './useCheckinsPage';
const FORM_ID = 'checkin-attendance-editor';
export function AttendanceEditor({ model }: { model: CheckinsModel }) {
  const { editing, form, correction, closeEditor, dirty, setDirty, submit, conflict, list } = model;
  return (
    <AdminDrawer
      rootClassName="checkin-drawer"
      open={editing != null}
      destroyOnHidden
      title={
        editing
          ? `${editing.actualHeadcount == null ? '补记' : '更正'}到场人数 · ${editing.guestName} #${editing.id}`
          : '到场人数'
      }
      onClose={() => {
        void closeEditor();
      }}
      closable={!correction.isPending}
      keyboard={!correction.isPending}
      mask={{ closable: !correction.isPending }}
      extra={dirty ? <Typography.Text type="secondary">有未保存的填写</Typography.Text> : undefined}
      footer={
        <div className="admin-drawer-footer">
          <Button
            disabled={correction.isPending}
            onClick={() => {
              void closeEditor();
            }}
          >
            取消
          </Button>
          <Button type="primary" htmlType="submit" form={FORM_ID} loading={correction.isPending}>
            保存人数
          </Button>
        </div>
      }
    >
      {editing && (
        <Descriptions
          className="checkin-record-context"
          size="small"
          column={1}
          items={[
            {
              key: 'guest',
              label: '关联宾客',
              children: editing.guestId == null ? '未关联' : `#${editing.guestId}`,
            },
            { key: 'time', label: '确认时间', children: formatDateTime(editing.confirmedAt) },
            {
              key: 'total',
              label: '原实到总人数',
              children:
                editing.actualHeadcount == null
                  ? '待补记（历史未知）'
                  : `${editing.actualHeadcount} 人`,
            },
            {
              key: 'children',
              label: '原儿童人数',
              children:
                editing.actualChildrenCount == null
                  ? '未记录'
                  : `${editing.actualChildrenCount} 人`,
            },
          ]}
        />
      )}
      <p className="checkin-editor-helper">
        仅修改实际到场人数，不改变回执、签到组数或礼金；原值与原因会留在操作记录中。
      </p>
      {correction.isError && (
        <Alert
          className="checkin-feedback"
          type={conflict ? 'warning' : 'error'}
          showIcon
          title={conflict ? '记录已发生变化，请重新核对' : '人数尚未保存，填写已保留'}
          description={`${correction.error.message}${conflict ? '；请刷新列表，关闭抽屉后重新打开该记录核对，再填写保存。当前草稿仍保留。' : ''}`}
          action={
            conflict ? (
              <Button
                loading={list.isFetching}
                onClick={() => {
                  void list.refetch();
                }}
              >
                刷新列表
              </Button>
            ) : undefined
          }
        />
      )}
      <Form
        id={FORM_ID}
        form={form}
        layout="vertical"
        disabled={correction.isPending}
        onFinish={submit}
        onValuesChange={() => setDirty(true)}
      >
        <AttendanceFields />
        <Form.Item
          name="reason"
          label="补记或更正原因"
          rules={[
            { required: true, whitespace: true, max: 200, message: '请填写原因（最多200字）' },
          ]}
        >
          <Input.TextArea
            maxLength={200}
            rows={3}
            showCount
            placeholder="请说明现场核对结果及调整原因"
          />
        </Form.Item>
      </Form>
    </AdminDrawer>
  );
}
