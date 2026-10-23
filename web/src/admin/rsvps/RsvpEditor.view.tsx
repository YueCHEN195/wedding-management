import { Alert, Button, Descriptions, Form, Input, Select, Typography } from 'antd';
import { parseHeadcount } from '@shared/numericInput';
import { MAX_HEADCOUNT, MAX_TEXT_LENGTH } from '@shared/constraints';
import { ATTENDING_LABEL, formatDateTime } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import type { RsvpsModel } from './useRsvpsPage';
const FORM_ID = 'rsvp-editor';

export function RsvpEditor({ model }: { model: RsvpsModel }) {
  const { editing, form, attending, save, closeEditor, dirty, setDirty, submit } = model;
  return (
    <AdminDrawer
      rootClassName="rsvp-drawer"
      open={editing != null}
      destroyOnHidden
      title={editing ? `修改回执 · ${editing.guestName} #${editing.id}` : '修改回执'}
      onClose={() => {
        void closeEditor();
      }}
      closable={!save.isPending}
      keyboard={!save.isPending}
      mask={{ closable: !save.isPending }}
      extra={dirty ? <Typography.Text type="secondary">有未保存的填写</Typography.Text> : undefined}
      footer={
        <div className="admin-drawer-footer">
          <Button
            disabled={save.isPending}
            onClick={() => {
              void closeEditor();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            form={FORM_ID}
            loading={save.isPending}
            disabled={model.conflict}
          >
            保存回执
          </Button>
        </div>
      }
    >
      {editing && (
        <Descriptions
          className="rsvp-record-context"
          size="small"
          column={1}
          items={[
            {
              key: 'guest',
              label: '关联宾客',
              children:
                editing.guestId == null ? '未关联宾客，按原回执独立保存' : `#${editing.guestId}`,
            },
            { key: 'time', label: '提交时间', children: formatDateTime(editing.submittedAt) },
          ]}
        />
      )}
      {save.isError && (
        <Alert
          className="rsvp-feedback"
          type="error"
          showIcon
          title="回执尚未保存，填写已保留"
          description={save.error.message}
          action={
            model.conflict ? (
              <Button
                loading={model.latest.isFetching}
                disabled={
                  !model.latest.data || model.latest.isError || model.latest.data.guestArchived
                }
                onClick={model.recheckDraft}
              >
                保留修改并载入最新内容
              </Button>
            ) : undefined
          }
        />
      )}
      {model.conflict && model.latest.isError && (
        <Alert
          type="error"
          title="最新回执读取失败"
          action={<Button onClick={() => model.latest.refetch()}>重试读取</Button>}
        />
      )}
      {model.conflict && model.latest.data?.guestArchived && (
        <Alert type="warning" title="宾客已归档，请先恢复宾客；当前草稿仍保留" />
      )}
      <Form
        autoComplete="off"
        id={FORM_ID}
        form={form}
        layout="vertical"
        disabled={save.isPending}
        onFinish={submit}
        onValuesChange={() => setDirty(true)}
      >
        <Form.Item
          name="attending"
          label="是否出席"
          rules={[{ required: true, message: '请选择出席状态' }]}
        >
          <Select
            options={Object.entries(ATTENDING_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(v) => {
              if (v !== 'yes') form.setFieldsValue({ headcount: '0', childrenCount: '0' });
              else if (!Number(form.getFieldValue('headcount')))
                form.setFieldValue('headcount', '1');
            }}
          />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          回执为预计出席，不会修改现场实到人数。
          <br />
          总人数包含儿童，最多{MAX_HEADCOUNT}人；不出席和待定均按0人保存。
        </Typography.Paragraph>
        <Form.Item
          name="headcount"
          label="出席总人数（含儿童）"
          dependencies={['attending']}
          rules={[
            { required: true, message: '请填写总人数' },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                parseHeadcount(v) != null &&
                parseHeadcount(v)! >= (getFieldValue('attending') === 'yes' ? 1 : 0)
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        `请填写${getFieldValue('attending') === 'yes' ? '1' : '0'}–${MAX_HEADCOUNT}的整数`,
                      ),
                    ),
            }),
          ]}
        >
          <Input
            autoComplete="off"
            inputMode="numeric"
            maxLength={3}
            disabled={save.isPending || attending !== 'yes'}
            placeholder="1–20"
          />
        </Form.Item>
        <Form.Item
          name="childrenCount"
          label="其中儿童人数"
          dependencies={['headcount', 'attending']}
          rules={[
            { required: true, message: '请填写儿童人数，没有填0' },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                parseHeadcount(v) != null &&
                (getFieldValue('attending') !== 'yes' ||
                  (parseHeadcount(getFieldValue('headcount')) != null &&
                    parseHeadcount(v)! <= parseHeadcount(getFieldValue('headcount'))!))
                  ? Promise.resolve()
                  : Promise.reject(new Error('儿童人数须为整数，且不能超过总人数')),
            }),
          ]}
        >
          <Input
            autoComplete="off"
            inputMode="numeric"
            maxLength={3}
            disabled={save.isPending || attending !== 'yes'}
            placeholder="没有儿童填0"
          />
        </Form.Item>
        <Form.Item
          name="message"
          label="祝福留言"
          rules={[{ max: MAX_TEXT_LENGTH, message: `留言最多${MAX_TEXT_LENGTH}字` }]}
        >
          <Input.TextArea rows={3} maxLength={MAX_TEXT_LENGTH} showCount />
        </Form.Item>
      </Form>
    </AdminDrawer>
  );
}
