import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Dropdown, Image, Modal, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '@/api/client';
import { StaffGuestsPage } from './StaffGuestsPage';
import { PageHeader } from './components/PageHeader';
import { GuestListTools } from './components/GuestListTools';
import { RecordAction, RecordHistory } from './components/RecordAction';
import { GuestListTable } from './guests/GuestListTable';
import { GuestEditorDrawer } from './guests/GuestEditorDrawer';
import { useGuestManagement } from './guests/useGuestManagement';
import { showImportReport } from './guests/guestFeedback';
import './guests.css';

export function GuestsPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  if (!me.data) return null;
  return me.data.role === 'staff' ? <StaffGuestsPage /> : <AdminGuestsPage />;
}
function AdminGuestsPage() {
  const model = useGuestManagement();
  const {
    params,
    action,
    setAction,
    historyId,
    setHistoryId,
    openCreate,
    changeFilters,
    groups,
    filtered,
    list,
    importing,
    importGuests,
    importError,
    setImportError,
    media,
    setMedia,
  } = model;
  return (
    <div className="guest-list-page">
      {action && (
        <RecordAction
          key={`${action.id}-${action.action}`}
          target={action}
          onClose={() => setAction(null)}
        />
      )}
      {historyId != null && (
        <RecordHistory entity="guest" id={historyId} onClose={() => setHistoryId(null)} />
      )}
      <PageHeader
        title="宾客管理"
        description="维护来宾档案，安排邀请与回执。"
        actions={
          <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={openCreate}>
            新增宾客
          </Button>
        }
      />
      <GuestListTools
        admin
        params={params}
        onChange={changeFilters}
        groups={groups.data}
        groupsLoading={groups.isPending}
        groupsError={groups.isError}
        onRetryGroups={() => {
          void groups.refetch();
        }}
      />
      <div className="guest-list-toolbar">
        <span className="guest-result-count">
          {list.data
            ? `${filtered ? '符合筛选' : '当前范围'} ${list.data.total} 位宾客`
            : list.isError
              ? '名单暂不可用'
              : '正在加载名单…'}
        </span>
        <Space wrap>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={async (file) => {
              const result = await importGuests(file);
              if (result) showImportReport(result);
              return false;
            }}
          >
            <Button loading={importing} icon={<ImportOutlined aria-hidden />}>
              导入 Excel
            </Button>
          </Upload>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'excel', label: <a href={api.guests.exportUrl()}>导出宾客 Excel</a> },
                {
                  key: 'posters',
                  label: <a href={api.guests.postersZipUrl()}>下载批量海报 ZIP</a>,
                },
              ],
            }}
          >
            <Button icon={<DownloadOutlined aria-hidden />}>导出 / 下载 ▾</Button>
          </Dropdown>
        </Space>
      </div>
      {params.archived && (
        <Typography.Paragraph type="secondary">
          归档宾客的历史回执、签到和礼金均保留；恢复前会核对关联影响。
        </Typography.Paragraph>
      )}
      {importError && (
        <Alert
          type="error"
          showIcon
          title="导入未获得成功确认"
          description={importError}
          closable
          onClose={() => setImportError(null)}
        />
      )}
      {list.isError && (
        <Alert
          type="error"
          showIcon
          title={list.data ? '名单刷新失败，当前显示上次数据' : '宾客名单加载失败'}
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>重试</Button>}
        />
      )}
      <GuestListTable model={model} />
      <GuestEditorDrawer model={model} />
      <Modal
        className="admin-dialog"
        open={media != null}
        title={`${media?.type === 'poster' ? '专属海报' : '专属二维码'} · ${media?.guest.name ?? ''}`}
        footer={null}
        onCancel={() => setMedia(null)}
        style={{ top: 'var(--space-6)' }}
        styles={{ body: { maxHeight: 'var(--guest-media-max-height)', overflowY: 'auto' } }}
      >
        {media && (
          <div className="guest-media">
            <Image
              src={
                media.type === 'poster'
                  ? api.guests.posterUrl(media.guest.id)
                  : api.guests.qrUrl(media.guest.id)
              }
              width={media.type === 'poster' ? '100%' : 'var(--guest-media-width)'}
            />
            <div className="guest-media-link">
              <Typography.Paragraph copyable>{media.guest.inviteUrl}</Typography.Paragraph>
            </div>
            {media.type === 'poster' && (
              <Button
                icon={<DownloadOutlined aria-hidden />}
                href={api.guests.posterUrl(media.guest.id)}
              >
                下载海报
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
