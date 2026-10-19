import { Button, Input, Select, Tag } from 'antd';
import { CHECKIN_STATUS_LABEL } from '@/lib/format';
import type { CheckinsModel } from './useCheckinsPage';
import '../components/filter-bar.css';

export function CheckinFilters({ model }: { model: CheckinsModel }) {
  const { params, searchDraft, setSearchDraft, search, clearKeyword, resetFilters, changeFilters } =
    model;
  const filtered = !!(params.keyword || params.status);
  return (
    <section aria-label="签到搜索与筛选">
      <div className="admin-filter-row">
        <Input.Search
          aria-label="搜索签到姓名"
          placeholder="搜索姓名"
          allowClear
          value={searchDraft}
          onSearch={search}
          onChange={(e) => {
            setSearchDraft(e.target.value);
            if (!e.target.value) clearKeyword();
          }}
        />
        <Select
          aria-label="筛选签到状态"
          placeholder="全部签到状态"
          allowClear
          value={params.status}
          options={Object.entries(CHECKIN_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(status) => changeFilters({ status })}
        />
        {filtered && (
          <Button type="text" onClick={resetFilters}>
            清除筛选
          </Button>
        )}
      </div>
      {filtered && (
        <div className="checkin-filter-chips" aria-label="已应用筛选">
          {params.keyword && (
            <Tag closable onClose={clearKeyword}>
              姓名：{params.keyword}
            </Tag>
          )}
          {params.status && (
            <Tag closable onClose={() => changeFilters({ status: undefined })}>
              状态：{CHECKIN_STATUS_LABEL[params.status]}
            </Tag>
          )}
        </div>
      )}
    </section>
  );
}
