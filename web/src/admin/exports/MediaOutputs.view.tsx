import { useState } from 'react';
import { Alert, Button, Image, Modal, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { MEDIA_OUTPUTS } from '@shared/media';
import { MEDIA_EXPORT_ITEMS, type MediaExportItem } from './exportItems';
import type { ExportsModel } from './useExportsPage';

export function MediaOutputs({ model }: { model: ExportsModel }) {
  const { mediaInfo, states, download, mediaPreviewUrl } = model;
  const [preview, setPreview] = useState<MediaExportItem | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  return (
    <section className="export-media" aria-labelledby="export-media-title">
      <h2 id="export-media-title">婚礼展示物料</h2>
      <p>沿用已确认的照片与猫头二维码。分享海报在宾客名单中按人生成，以下为现场公共入口。</p>
      {mediaInfo.isPending ? (
        <p role="status">正在读取输出地址…</p>
      ) : mediaInfo.isError ? (
        <Alert
          type="error"
          showIcon
          title="无法读取物料信息"
          description={mediaInfo.error.message}
          action={
            <Button
              onClick={() => {
                void mediaInfo.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      ) : (
        <>
          <Alert
            type={mediaInfo.data.preview ? 'warning' : 'info'}
            showIcon
            title={mediaInfo.data.preview ? '目前仅供预览，请勿分发' : '下载前核对入口地址'}
            description={
              mediaInfo.data.preview
                ? '当前尚非正式 HTTPS 地址，图片会标注预览。确认对外域名后重新生成，并用手机和纸样验扫。'
                : '请先确认手机能打开下方地址，再下载、验扫和安排印制。'
            }
          />
          <Typography.Paragraph copyable className="export-media-url">
            {mediaInfo.data.url}
          </Typography.Paragraph>
        </>
      )}
      {MEDIA_EXPORT_ITEMS.map((item) => {
        const spec = MEDIA_OUTPUTS[item.format],
          state = states[item.type];
        return (
          <article className="export-media-row" key={item.type}>
            <div>
              <h3>{item.title}</h3>
              <p>
                {spec.width} × {spec.height} px · {spec.dpi} ppi
              </p>
              <p>
                {item.format === 'qr'
                  ? '独立白底总码；请完整保留四周静区，勿裁切或拉伸。'
                  : item.format === 'table'
                    ? 'A5 比例，夜景合照保留两人取景，近距离扫码。'
                    : '600 × 900 mm 比例预览；大幅印制前需确认照片清晰度和印厂规格。'}
              </p>
            </div>
            <Space wrap>
              <Button
                disabled={!mediaInfo.data}
                onClick={() => {
                  setPreviewFailed(false);
                  setPreview(item);
                }}
              >
                预览{item.title}
              </Button>
              <Button
                icon={<DownloadOutlined aria-hidden />}
                loading={state?.pending}
                disabled={!mediaInfo.data}
                onClick={() => {
                  void download(item);
                }}
              >
                {state?.error ? '重试下载' : mediaInfo.data?.preview ? '下载预览 PNG' : '下载 PNG'}
              </Button>
            </Space>
            {state?.error && (
              <Alert
                type="error"
                showIcon
                title={`${item.title}下载失败`}
                description={state.error}
              />
            )}
          </article>
        );
      })}
      <p>
        当前为 RGB 排版输出，不含出血和裁切标记；300 ppi
        不代表原片具有同等有效分辨率，送印前需核样。
      </p>
      <Modal
        className="admin-dialog export-media-preview"
        title={preview?.title}
        open={Boolean(preview)}
        style={{ top: 'var(--space-6)', paddingBottom: 0 }}
        footer={null}
        onCancel={() => setPreview(null)}
        styles={{ body: { maxHeight: 'var(--export-media-preview-height)', overflowY: 'auto' } }}
        classNames={{ body: 'admin-module-scroll' }}
      >
        {previewFailed && (
          <Alert
            type="error"
            showIcon
            title="预览加载失败"
            description="图片尚未生成成功，请重试。"
            action={
              <Button
                onClick={() => {
                  setPreviewFailed(false);
                  setPreviewVersion((version) => version + 1);
                }}
              >
                重新加载
              </Button>
            }
          />
        )}
        {preview && !previewFailed && (
          <Image
            key={`${preview.type}-${previewVersion}`}
            width="100%"
            preview={false}
            src={mediaPreviewUrl(preview.format)}
            alt={`${preview.title}输出预览`}
            placeholder={<p role="status">正在生成预览…</p>}
            onError={() => setPreviewFailed(true)}
          />
        )}
      </Modal>
    </section>
  );
}
