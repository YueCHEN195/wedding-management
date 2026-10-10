/** 返回二进制响应（图片 / Excel / ZIP） */
export function binaryResponse(data: Uint8Array, headers: Record<string, string>, status = 200): Response {
  return new Response(data as unknown as BodyInit, { status, headers });
}

export function attachmentHeaders(filename: string, mime: string): Record<string, string> {
  return {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
