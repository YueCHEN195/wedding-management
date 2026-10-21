import { Alert, Button, Collapse } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import { EXPORT_ITEMS, type ExportItem } from './exportItems';
import type { ExportsModel } from './useExportsPage';
import { MediaOutputs } from './MediaOutputs.view';
import './exports.css';

export function ExportsView({ model }: { model: ExportsModel }) {
  return (
    <div className="export-page">
      <PageHeader title="数据导出" description="选择需要留存的业务数据，下载为 Excel 工作簿。" />
      <section className="export-overview" aria-label="导出说明">
        <div>
          <span className="export-eyebrow">文件与范围</span>
          <h2>四份数据，各有清晰口径。</h2>
          <p>每次导出一个 .xlsx 文件，按下方范围读取当前数据，不跟随其他页面的搜索、筛选或分页。</p>
        </div>
        <dl>
          <div>
            <dt>文件格式</dt>
            <dd>Excel · .xlsx</dd>
          </div>
          <div>
            <dt>使用权限</dt>
            <dd>仅管理员</dd>
          </div>
        </dl>
      </section>
      <div className="export-list-heading" aria-hidden="true">
        <span>数据内容与范围</span>
        <span>操作</span>
      </div>
      <section className="export-list" aria-label="可导出的业务数据">
        {EXPORT_ITEMS.map((item) => (
          <ExportRow key={item.type} item={item} model={model} />
        ))}
      </section>
      <p className="export-page-note">
        文件可能包含手机号、邀请链接及礼金信息，请按需要妥善留存。下载是否完成及保存位置，以浏览器下载列表为准。
      </p>
      <MediaOutputs model={model} />
    </div>
  );
}
function ExportRow({
  item,
  model: { states, download },
}: {
  item: ExportItem;
  model: ExportsModel;
}) {
  const state = states[item.type];
  return (
    <article className="export-row" aria-labelledby={`export-${item.type}-title`}>
      <div className="export-row-main">
        <div className="export-row-title">
          <FileExcelOutlined aria-hidden />
          <div>
            <h2 id={`export-${item.type}-title`}>{item.title}</h2>
            <p>{item.summary}</p>
          </div>
        </div>
        <div className="export-row-scope">
          <strong>{item.scope}</strong>
          <p>{item.detail}</p>
        </div>
        <div className="export-row-action">
          <Button
            icon={<DownloadOutlined aria-hidden />}
            loading={state?.pending}
            aria-label={`${state?.error ? '重试导出' : '导出'}${item.title}`}
            onClick={() => {
              void download(item);
            }}
          >
            {state?.pending ? '正在准备…' : state?.error ? '重试导出' : '导出 Excel'}
          </Button>
        </div>
      </div>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: item.type,
            label: `查看 ${item.fields.length} 个导出字段`,
            children: (
              <div className="export-fields">
                <p>
                  文件：{item.filename} · 工作表：{item.sheet}
                </p>
                <ul>
                  {item.fields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]}
      />
      {state?.pending && (
        <p className="export-progress" role="status">
          正在生成「{item.title}」文件，请稍候；同一份文件不会重复请求。
        </p>
      )}
      {state?.error && (
        <Alert
          className="export-feedback"
          type="error"
          showIcon
          title={`${item.title}导出失败`}
          description={state.error}
        />
      )}
    </article>
  );
}
