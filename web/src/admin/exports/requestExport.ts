import { api, ApiError } from '@/api/client';
import type { ExportItem } from './exportItems';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Existing JSON apiFetch cannot read attachments; keep binary transport local to this feature. */
export async function requestExport(item: ExportItem, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(api.exportUrl(item.type), { credentials: 'include', signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError('NETWORK', '无法连接服务器，请检查网络后重试。', 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: unknown };
    } | null;
    const detail =
      typeof body?.error?.message === 'string' ? body.error.message : '文件生成失败，请稍后重试。';
    const message =
      response.status === 401
        ? '登录状态已失效，请重新登录后重试。'
        : response.status === 403
          ? '当前账号没有导出权限，请联系管理员核对。'
          : detail;
    throw new ApiError('EXPORT_FAILED', message, response.status);
  }
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== XLSX_MIME)
    throw new Error('服务器未返回 Excel 文件，请重试；若仍失败，请联系管理员。');
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError('NETWORK', '文件接收中断，请重新导出。', 0);
  }
  if (!blob.size) throw new Error('收到的文件为空，请重新导出。');
  return {
    blob,
    filename: attachmentFilename(response.headers.get('content-disposition'), item.filename),
  };
}
function attachmentFilename(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encoded) return fallback;
  try {
    const filename = decodeURIComponent(encoded.trim());
    return filename.endsWith('.xlsx') && !/[\\/\r\n]/.test(filename) ? filename : fallback;
  } catch {
    return fallback;
  }
}
