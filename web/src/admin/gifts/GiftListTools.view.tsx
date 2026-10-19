import { Input, Select, Tabs, Button, Tag } from 'antd';
import { METHOD_LABEL, yuan } from '@/lib/format';
import type { GiftsModel } from './useGiftsPage';
import '../components/filter-bar.css';
import '../components/summary-strip.css';

export function GiftFilters({ model }: { model: GiftsModel }) {
  const { params, changeFilters, searchDraft, setSearchDraft, search, clearKeyword, resetFilters } =
    model;
  const filtered = !!(params.keyword || params.method);
  return (
    <section className="gift-filters" aria-label="礼金搜索与筛选">
      <Tabs
        activeKey={params.state ?? 'active'}
        items={[
          { key: 'active', label: '有效礼金' },
          { key: 'voided', label: '已作废礼金' },
          { key: 'all', label: '全部礼金' },
        ]}
        onChange={(value) =>
          changeFilters({ state: value === 'active' ? undefined : (value as 'voided' | 'all') })
        }
      />
      <div className="admin-filter-row">
        <Input.Search
          aria-label="搜索礼金登记姓名"
          placeholder="搜索姓名"
          value={searchDraft}
          allowClear
          onChange={(e) => {
            setSearchDraft(e.target.value);
            if (!e.target.value) clearKeyword();
          }}
          onSearch={search}
        />
        <Select
          aria-label="收款方式"
          placeholder="全部收款方式"
          allowClear
          value={params.method}
          options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(method) => changeFilters({ method })}
        />
        {filtered && (
          <Button type="text" onClick={resetFilters}>
            清除筛选
          </Button>
        )}
      </div>
      {filtered && (
        <div className="gift-filter-chips" aria-label="已应用筛选">
          {params.keyword && (
            <Tag closable onClose={clearKeyword}>
              姓名：{params.keyword}
            </Tag>
          )}
          {params.method && (
            <Tag closable onClose={() => changeFilters({ method: undefined })}>
              方式：{METHOD_LABEL[params.method]}
            </Tag>
          )}
        </div>
      )}
    </section>
  );
}

export function GiftSummary({ model: { list } }: { model: GiftsModel }) {
  const summary = list.data?.summary;
  return (
    <section
      className="admin-summary gift-summary"
      aria-label="当前筛选内的有效礼金汇总"
      aria-busy={list.isFetching}
    >
      <dl className="admin-summary-main gift-summary-total">
        <dt>有效礼金 · 当前筛选</dt>
        <dd>
          {summary
            ? `¥${yuan(summary.total)}`
            : list.isError
              ? '暂不可用'
              : list.isPending
                ? '正在读取…'
                : '未提供汇总'}
        </dd>
      </dl>
      {summary && (
        <>
          <dl>
            <dt>有效笔数</dt>
            <dd>
              {summary.count}
              <small> 笔</small>
            </dd>
          </dl>
          {summary.byMethod.map((m) => (
            <dl key={m.method}>
              <dt>
                {METHOD_LABEL[m.method]} · {m.count}笔
              </dt>
              <dd>¥{yuan(m.amount)}</dd>
            </dl>
          ))}
        </>
      )}
    </section>
  );
}
