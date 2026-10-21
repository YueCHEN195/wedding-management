import type { Attending } from '@shared/types';
export const RSVP_FORM_ID = 'invitation-rsvp';

export function rsvpSubmitLabel({
  saving,
  submitError,
  submitted,
}: {
  saving: boolean;
  submitError: string | null;
  submitted: boolean;
}) {
  return saving ? '正在保存…' : submitError ? '重新保存回执' : submitted ? '保存修改' : '保存回执';
}
export const rsvpCopy = {
  yes: {
    label: '欣然赴约',
    helper: '期待与你相见，请确认出席人数。',
    title: '期待与你相见',
    note: '为这次相聚，留下一份温暖的期待。',
  },
  maybe: {
    label: '暂未确定',
    helper: '还没安排好也没关系，确定后再来修改。',
    title: '等你一声回音',
    note: '待行程确定，再回来告诉我们就好。',
  },
  no: {
    label: '遗憾缺席',
    helper: '心意同样珍贵，欢迎留下一句祝福。',
    title: '心意，我们珍藏',
    note: '即使未能相聚，也感谢你的惦念。',
  },
} satisfies Record<Attending, { label: string; helper: string; title: string; note: string }>;
