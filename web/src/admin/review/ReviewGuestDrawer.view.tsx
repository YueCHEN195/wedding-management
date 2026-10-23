import { AdminDrawer } from '../components/AdminDrawer';
import { Alert, Button, Form, Input, Select } from 'antd';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { SIDE_LABEL } from '@/lib/format';
import type { ReviewDirectoryModel, ReviewDirectoryProps } from './useReviewDirectory';
import { ReviewGuestDetails } from './ReviewGuestDetails.view';
export function ReviewGuestDrawer({
  model,
  ...props
}: ReviewDirectoryProps & { model: ReviewDirectoryModel }) {
  const { selected, editing, setDirty, form, detail, update, close, openEdit } = model;
  const { admin, disabled } = props;
  return (
    <AdminDrawer
      title={`${selected?.name ?? '宾客详情'}${selected?.guestId ? ` · #${selected.guestId}` : ' · 未匹配档案'}`}
      size="var(--drawer-width)"
      open={selected != null}
      onClose={close}
      footer={
        <div className="admin-drawer-footer">
          <Button onClick={close} disabled={update.isPending}>
            关闭
          </Button>
          {editing ? (
            <Button
              type="primary"
              loading={update.isPending}
              disabled={model.conflict || model.rechecking || !!detail.data?.guest.archivedAt}
              onClick={() => form.submit()}
            >
              保存修改
            </Button>
          ) : (
            admin &&
            selected?.guestId != null && (
              <Button
                disabled={
                  !detail.data ||
                  detail.isFetching ||
                  detail.isError ||
                  disabled ||
                  !!detail.data.guest.archivedAt
                }
                onClick={openEdit}
              >
                编辑档案
              </Button>
            )
          )}
        </div>
      }
    >
      {detail.isError && admin && (
        <Alert
          type="error"
          title="档案加载失败"
          action={<Button onClick={() => detail.refetch()}>重试</Button>}
        />
      )}
      <ReviewGuestSaveFeedback model={model} />
      {editing ? (
        <Form
          autoComplete="off"
          form={form}
          layout="vertical"
          disabled={update.isPending}
          onValuesChange={() => setDirty(true)}
          onFinish={(v) => update.mutate({ ...v, side: v.side ?? null })}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, whitespace: true, max: MAX_NAME_LENGTH }]}
          >
            <Input autoComplete="off" maxLength={MAX_NAME_LENGTH} />
          </Form.Item>
          <Form.Item name="groupName" label="分组" rules={[{ max: 50 }]}>
            <Input autoComplete="off" maxLength={50} />
          </Form.Item>
          <Form.Item name="side" label="归属方">
            <Select
              allowClear
              options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注" rules={[{ max: MAX_TEXT_LENGTH }]}>
            <Input.TextArea rows={4} maxLength={MAX_TEXT_LENGTH} />
          </Form.Item>
        </Form>
      ) : (
        <ReviewGuestDetails {...props} model={model} />
      )}
    </AdminDrawer>
  );
}

function ReviewGuestSaveFeedback({ model }: { model: ReviewDirectoryModel }) {
  if (!model.update.isError) return null;
  return (
    <Alert
      type="error"
      showIcon
      title="修改未保存，输入已保留"
      description={model.update.error.message}
      action={
        model.conflict ? (
          <Button
            loading={model.rechecking}
            onClick={() => {
              void model.recheckDraft();
            }}
          >
            保留修改并载入最新档案
          </Button>
        ) : undefined
      }
    />
  );
}
