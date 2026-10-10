import ExcelJS from 'exceljs';
import type { Side } from '../../shared/types';

export interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, unknown>[];
}

export async function buildWorkbook(sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'wedding-management';
  wb.created = new Date();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) ws.addRow(row);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const SIDE_MAP: Record<string, Side> = {
  男方: 'male',
  女方: 'female',
  双方: 'both',
  male: 'male',
  female: 'female',
  both: 'both',
};

export interface ParsedGuest {
  name: string;
  salutation: string | null;
  phone: string | null;
  groupName: string | null;
  side: Side | null;
}

export interface ParseGuestResult {
  guests: ParsedGuest[];
  failed: { row: number; reason: string }[];
}

/** 解析导入的 Excel：表头需含"姓名"（必填），可选"称谓/手机号/分组/归属方" */
export async function parseGuestWorkbook(buffer: Buffer): Promise<ParseGuestResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  const guests: ParsedGuest[] = [];
  const failed: { row: number; reason: string }[] = [];
  if (!ws) return { guests, failed: [{ row: 0, reason: '未找到工作表' }] };

  const headerRow = ws.getRow(1);
  const headerMap: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    headerMap[String(cell.value ?? '').trim()] = col;
  });
  const nameCol = headerMap['姓名'] ?? headerMap['name'];
  if (!nameCol) {
    return { guests, failed: [{ row: 1, reason: '缺少"姓名"列' }] };
  }
  const col = (...keys: string[]) => keys.map((k) => headerMap[k]).find((v) => v) ?? 0;

  const salutationCol = col('称谓', 'salutation');
  const phoneCol = col('手机号', '电话', 'phone');
  const groupCol = col('分组', '关系', 'group', 'groupName');
  const sideCol = col('归属方', 'side');

  const cellText = (row: ExcelJS.Row, c: number): string =>
    c ? String(row.getCell(c).value ?? '').trim() : '';

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellText(row, nameCol);
    if (!name) {
      // 完全空行忽略；否则记失败
      const isEmpty = row.values === undefined || (Array.isArray(row.values) && row.values.every((v) => v == null || v === ''));
      if (!isEmpty) failed.push({ row: r, reason: '姓名为空' });
      continue;
    }
    const sideRaw = cellText(row, sideCol);
    guests.push({
      name,
      salutation: cellText(row, salutationCol) || null,
      phone: cellText(row, phoneCol) || null,
      groupName: cellText(row, groupCol) || null,
      side: sideRaw ? SIDE_MAP[sideRaw] ?? null : null,
    });
  }
  return { guests, failed };
}
