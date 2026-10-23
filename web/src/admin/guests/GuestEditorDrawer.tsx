import { Alert, AutoComplete, Button, Form, Input, Select, Typography } from 'antd';
import { MAX_GROUP_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { GuestBasicFields } from './GuestBasicFields.view';
import { SIDE_LABEL } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import { GuestDetails } from './GuestDetails';
import type { GuestManagementModel } from './useGuestManagement';
const GUEST_FORM_ID = 'guest-editor';
type Props = Pick<
  GuestManagementModel,
  | 'groups'
  | 'mode'
  | 'selectedId'
  | 'save'
  | 'dirty'
  | 'editing'
  | 'guest'
  | 'detail'
  | 'closeDrawer'
  | 'readyToEdit'
  | 'openEdit'
  | 'initializing'
  | 'form'
  | 'setDirty'
  | 'markSent'
  | 'setMedia'
  | 'setHistoryId'
  | 'setAction'
  | 'conflict'
  | 'rechecking'
  | 'recheckDraft'
>;
export function GuestEditorDrawer({ model }: { model: Props }) {
  const {
    mode,
    selectedId,
    save,
    dirty,
    editing,
    guest,
    detail,
    closeDrawer,
    readyToEdit,
    openEdit,
    initializing,
    form,
    setDirty,
  } = model;
  return (
    <AdminDrawer
      rootClassName="guest-drawer"
      open={mode != null}
      destroyOnHidden
      title={
        mode === 'create'
          ? '新增宾客'
          : `${mode === 'edit' ? '编辑宾客' : '宾客详情'}${selectedId ? ` · #${selectedId}` : ''}`
      }
      onClose={() => {
        void closeDrawer();
      }}
      mask={{ closable: !save.isPending }}
      keyboard={!save.isPending}
      closable={!save.isPending}
      extra={dirty ? <Typography.Text type="secondary">有未保存的修改</Typography.Text> : undefined}
      footer={
        <div className="admin-drawer-footer">
          <Button
            onClick={() => {
              void closeDrawer();
            }}
            disabled={save.isPending}
          >
            关闭
          </Button>
          {editing ? (
            <Button
              type="primary"
              htmlType="submit"
              form={GUEST_FORM_ID}
              loading={save.isPending}
              disabled={!readyToEdit}
            >
              保存宾客
            </Button>
          ) : (
            guest &&
            !guest.archivedAt &&
            !guest.checkedIn && (
              <Button
                type="primary"
                disabled={detail.isFetching || detail.isError}
                onClick={() => {
                  void openEdit(guest.id);
                }}
              >
                编辑档案
              </Button>
            )
          )}
        </div>
      }
    >
      {selectedId != null && detail.isError && (
        <Alert
          type="error"
          showIcon
          title="档案加载失败"
          description={detail.error.message}
          action={
            <Button
              onClick={() => {
                if (mode === 'edit') void openEdit(selectedId);
                else void detail.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {selectedId != null && (initializing || detail.isPending) && (
        <Typography.Paragraph role="status">正在读取最新宾客档案…</Typography.Paragraph>
      )}
      {save.isError && (
        <Alert
          type="error"
          showIcon
          title="本次修改尚未保存"
          description={save.error.message}
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
      )}
      {editing ? (
        <Form
          autoComplete="off"
          id={GUEST_FORM_ID}
          form={form}
          layout="vertical"
          initialValues={{ side: 'both' }}
          disabled={save.isPending || !readyToEdit}
          onValuesChange={() => setDirty(true)}
          onFinish={(values) => save.mutate({ ...values, side: values.side ?? null })}
        >
          <GuestBasicFields />
          <section className="guest-editor-section">
            <h2>关系与归属</h2>
            <div className="guest-form-grid">
              <Form.Item name="groupName" label="分组" rules={[{ max: MAX_GROUP_LENGTH }]}>
                <AutoComplete
                  options={(model.groups.data ?? []).map((value) => ({ value }))}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  <Input
                    autoComplete="off"
                    maxLength={MAX_GROUP_LENGTH}
                    placeholder="输入新分组或选择已有分组"
                  />
                </AutoComplete>
              </Form.Item>
              <Form.Item name="side" label="归属方">
                <Select
                  allowClear
                  placeholder="未填写"
                  options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            </div>
          </section>
          <section className="guest-editor-section">
            <h2>补充说明</h2>
            <Form.Item name="note" label="备注" rules={[{ max: MAX_TEXT_LENGTH }]}>
              <Input.TextArea rows={3} maxLength={MAX_TEXT_LENGTH} showCount />
            </Form.Item>
          </section>
        </Form>
      ) : (
        <GuestDetails model={model} />
      )}
    </AdminDrawer>
  );
}
