import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { adminFeedback } from '../theme';
import { requestExport } from './requestExport';
import type { ExportItem, ExportType } from './exportItems';
// Give the browser time to consume the attachment URL; also release it on page exit.
const ATTACHMENT_URL_LIFETIME_MS = 60_000;
type ExportState = { pending: boolean; error?: string };
export function useExportsPage() {
  const [states, setStates] = useState<Partial<Record<ExportType, ExportState>>>({});
  const requests = useRef(new Map<ExportType, AbortController>());
  const attachments = useRef(new Map<string, number>());
  useEffect(() => {
    const activeRequests = requests.current,
      activeAttachments = attachments.current;
    return () => {
      for (const controller of activeRequests.values()) controller.abort();
      activeRequests.clear();
      for (const [url, timer] of activeAttachments) {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      activeAttachments.clear();
    };
  }, []);
  const download = async (item: ExportItem) => {
    if (requests.current.has(item.type)) return;
    const controller = new AbortController();
    requests.current.set(item.type, controller);
    setStates((current) => ({ ...current, [item.type]: { pending: true } }));
    try {
      const { blob, filename } = await requestExport(item, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const timer = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        attachments.current.delete(url);
      }, ATTACHMENT_URL_LIFETIME_MS);
      attachments.current.set(url, timer);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      message.success({
        content: `已将「${filename}」交给浏览器下载，请查看下载列表`,
        duration: adminFeedback.toastDuration,
      });
      setStates((current) => ({ ...current, [item.type]: { pending: false } }));
    } catch (error) {
      if (controller.signal.aborted) return;
      setStates((current) => ({
        ...current,
        [item.type]: {
          pending: false,
          error: error instanceof Error ? error.message : '导出失败，请重试。',
        },
      }));
    } finally {
      if (requests.current.get(item.type) === controller) requests.current.delete(item.type);
    }
  };
  return { states, download };
}
export type ExportsModel = ReturnType<typeof useExportsPage>;
