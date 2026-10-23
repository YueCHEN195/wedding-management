import { Form, Input, Typography } from 'antd';
import { parseHeadcount } from '@shared/numericInput';

export interface AttendanceValues { actualHeadcountInput?: string; actualChildrenInput?: string }
export function attendanceValues(v: AttendanceValues) {
  const actualHeadcount = parseHeadcount(v.actualHeadcountInput);
  const actualChildrenCount = parseHeadcount(v.actualChildrenInput);
  if (actualHeadcount == null || actualHeadcount < 1 || actualChildrenCount == null || actualChildrenCount > actualHeadcount) {
    throw new Error('请核对实际总人数（1–20人），其中儿童人数不能超过总人数');
  }
  return { actualHeadcount, actualChildrenCount };
}
export function AttendanceFields({ showHint = true }: { showHint?: boolean }) {
  return <>
    {showHint && <Typography.Paragraph type="secondary">按现场实际到场填写；总人数包含儿童，与请柬回执的预计人数分别记录。</Typography.Paragraph>}
    <Form.Item name="actualHeadcountInput" label="实际总人数（含儿童）" rules={[{ validator: (_, v) => {
      const n = parseHeadcount(v);
      return n != null && n >= 1 ? Promise.resolve() : Promise.reject(new Error('请填1–20的整数'));
    } }]}>
      <Input autoComplete="off" inputMode="numeric" maxLength={3} placeholder="例如：3" />
    </Form.Item>
    <Form.Item name="actualChildrenInput" label="其中儿童人数" dependencies={['actualHeadcountInput']} rules={[({ getFieldValue }) => ({ validator: (_, v) => {
      const n = parseHeadcount(v);
      const total = parseHeadcount(getFieldValue('actualHeadcountInput'));
      return n != null && total != null && n <= total ? Promise.resolve() : Promise.reject(new Error('请填0至总人数之间的整数'));
    } })]}>
      <Input autoComplete="off" inputMode="numeric" maxLength={3} placeholder="没有儿童填0" />
    </Form.Item>
  </>;
}
