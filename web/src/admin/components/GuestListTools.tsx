import { useEffect, useState } from 'react';
import { Button, Input, Select, Tabs, Tag } from 'antd';
import type { GuestListParams } from '@/api/client';
import { SIDE_LABEL, STATUS_LABEL } from '@/lib/format';

/** Stable query pattern for the admin list and the staff's restricted guest lookup. */
export function GuestListTools({ admin = false, params, onChange, groups = [], groupsLoading = false, groupsError = false, onRetryGroups }: {
  admin?: boolean; params: GuestListParams; onChange: (patch: Partial<GuestListParams>) => void;
  groups?: string[]; groupsLoading?: boolean; groupsError?: boolean; onRetryGroups?: () => void;
}) {
  const [draft, setDraft] = useState(params.keyword ?? '');
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => setDraft(params.keyword ?? ''), [params.keyword]);
  const advancedCount = Number(!!params.groupName) + Number(!!params.side);
  const filtered = !!(params.keyword || params.status || params.groupName || params.side);
  return <section className="guest-list-tools" aria-label="宾客搜索与筛选">
    <Tabs activeKey={params.archived ?? 'active'} items={[{ key: 'active', label: '当前宾客' }, { key: 'only', label: '已归档宾客' }, { key: 'all', label: '全部宾客' }]}
      onChange={(v) => onChange({ archived: v === 'active' ? undefined : v as 'only' | 'all' })} />
    <div className="admin-filter-row">
      <Input.Search aria-label={admin ? '搜索姓名或手机号' : '搜索宾客姓名'} placeholder={admin ? '姓名 / 手机号' : '搜索宾客姓名'} allowClear value={draft}
        onChange={(e) => { setDraft(e.target.value); if (!e.target.value) onChange({ keyword: undefined }); }} onSearch={(keyword) => onChange({ keyword: keyword.trim() || undefined })} />
      {admin && <Select aria-label="邀请状态" placeholder="全部邀请状态" allowClear value={params.status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} onChange={(status) => onChange({ status })} />}
      {admin && <Button type="text" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>更多筛选{advancedCount ? `（${advancedCount}）` : ''} {advanced ? '−' : '+'}</Button>}
      {filtered && <Button type="text" onClick={() => { setDraft(''); onChange({ keyword: undefined, status: undefined, groupName: undefined, side: undefined }); }}>清除筛选</Button>}
    </div>
    {admin && advanced && <div className="admin-filter-row guest-advanced-filters">
      <Select aria-label="宾客分组" placeholder="全部分组" allowClear showSearch optionFilterProp="label" loading={groupsLoading} value={params.groupName} options={groups.map((g) => ({ value: g, label: g }))} onChange={(groupName) => onChange({ groupName })} />
      <Select aria-label="归属方" placeholder="全部归属" allowClear value={params.side} options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))} onChange={(side) => onChange({ side })} />
      {groupsError && <Button type="text" onClick={onRetryGroups}>分组加载失败，重试</Button>}
    </div>}
    {filtered && <div className="guest-filter-chips" aria-label="已应用筛选">
      {params.keyword && <Tag closable onClose={() => onChange({ keyword: undefined })}>关键词：{params.keyword}</Tag>}
      {params.status && <Tag closable onClose={() => onChange({ status: undefined })}>邀请：{STATUS_LABEL[params.status]}</Tag>}
      {params.groupName && <Tag closable onClose={() => onChange({ groupName: undefined })}>分组：{params.groupName}</Tag>}
      {params.side && <Tag closable onClose={() => onChange({ side: undefined })}>归属：{SIDE_LABEL[params.side]}</Tag>}
    </div>}
  </section>;
}
