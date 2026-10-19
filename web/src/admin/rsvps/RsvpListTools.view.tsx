import { Button, Input, Select, Tag } from 'antd';
import { ATTENDING_LABEL } from '@/lib/format';
import type { RsvpsModel } from './useRsvpsPage';
import '../components/filter-bar.css';
import '../components/summary-strip.css';

export function RsvpFilters({ model }: { model: RsvpsModel }) {
  const { params, searchDraft, setSearchDraft, search, clearKeyword, resetFilters, changeFilters } =
    model;
  const filtered = !!(params.keyword || params.attending);
  return (
    <section className="rsvp-filters" aria-label="回执搜索与筛选">
      <div className="admin-filter-row">
        <Input.Search
          aria-label="搜索回执姓名"
          placeholder="搜索姓名"
          value={searchDraft}
          allowClear
          onSearch={search}
          onChange={(e) => {
            setSearchDraft(e.target.value);
            if (!e.target.value) clearKeyword();
          }}
        />
        <Select
          aria-label="筛选出席状态"
          placeholder="全部出席状态"
          allowClear
          value={params.attending}
          options={Object.entries(ATTENDING_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(attending) => changeFilters({ attending })}
        />
        {filtered && (
          <Button type="text" onClick={resetFilters}>
            清除筛选
          </Button>
        )}
      </div>
      {filtered && (
        <div className="rsvp-filter-chips" aria-label="已应用筛选">
          {params.keyword && (
            <Tag closable onClose={clearKeyword}>
              姓名：{params.keyword}
            </Tag>
          )}
          {params.attending && (
            <Tag closable onClose={() => changeFilters({ attending: undefined })}>
              出席：{ATTENDING_LABEL[params.attending]}
            </Tag>
          )}
        </div>
      )}
    </section>
  );
}

export function RsvpSummary({ model: { list, s } }: { model: RsvpsModel }) {
  const items = s
    ? [
        { key: 'people', label: '预计出席总人数', value: s.headcountYes, unit: '人', main: true },
        { key: 'children', label: '其中儿童', value: s.childrenYes, unit: '人' },
        { key: 'yes', label: '出席回执', value: s.yes, unit: '份' },
        { key: 'no', label: '不出席', value: s.no, unit: '份' },
        { key: 'maybe', label: '待定', value: s.maybe, unit: '份' },
      ]
    : [];
  return (
    <section
      className="admin-summary rsvp-summary"
      aria-label="当前筛选内未归档宾客的回执汇总"
      aria-busy={list.isFetching}
    >
      {s ? (
        items.map((item) => (
          <dl key={item.key} className={item.main ? 'admin-summary-main' : undefined}>
            <dt>{item.label}</dt>
            <dd>
              {item.value ?? '未记录'}
              <small> {item.unit}</small>
            </dd>
          </dl>
        ))
      ) : (
        <dl>
          <dt>预计出席汇总</dt>
          <dd>{list.isError ? '暂不可用' : list.isPending ? '正在读取…' : '未提供汇总'}</dd>
        </dl>
      )}
    </section>
  );
}
