import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import type { CheckinDTO } from '@shared/types';
import { api, ApiError } from '@/api/client';
import { METHOD_LABEL, yuan } from '@/lib/format';
import { adminFeedback } from '../theme';
import { attendanceValues } from '../components/AttendanceFields';
import { checkedAmount, guestChoice, type CheckinFormValues } from './checkinForm';
interface Options {
  confirming: CheckinDTO | null;
  manualSubmissionKey: string | null;
  onSaved: () => void;
  onFailed: (message: string) => void;
  invalidate: () => void;
}
export function useReviewSubmission({
  confirming,
  manualSubmissionKey,
  onSaved,
  onFailed,
  invalidate,
}: Options) {
  const saved = (data: CheckinDTO, duplicate = false) => {
    message.success({
      duration: adminFeedback.toastDuration,
      content: `${data.guestName} · 已确认到场${data.actualHeadcount}人（其中儿童${data.actualChildrenCount}人） · ${data.giftAmount == null ? '未登记礼金' : `礼金 ¥${yuan(data.giftAmount)} · ${data.giftMethod ? METHOD_LABEL[data.giftMethod] : ''}`}${duplicate ? '。本次为重试，未重复登记。' : ''}`,
    });
    onSaved();
    invalidate();
  };
  const failed = (e: Error) => {
    onFailed(
      e instanceof ApiError && e.code === 'NETWORK'
        ? '连接中断，保存结果待确认。输入已保留，请先刷新待审列表或查看签到记录，再用本次原操作重试。'
        : `${e.message || '保存失败'}。输入已保留，请核对后重试。`,
    );
    // 不清空宾客选择或人数，保留现场已经核对的输入。
  };
  const confirm = useMutation({
    mutationFn: (v: CheckinFormValues) =>
      api.checkins.confirm(confirming!.id, {
        ...attendanceValues(v),
        ...guestChoice(v),
        amount: checkedAmount(v),
        method: v.method ?? 'cash',
        note: v.note,
      }),
    onSuccess: (data) => saved(data),
    onError: failed,
  });
  const manual = useMutation({
    mutationFn: (v: CheckinFormValues & { guestName: string }) =>
      api.checkins.createManual({
        ...attendanceValues(v),
        guestName: v.guestName,
        submissionKey: manualSubmissionKey!,
        ...guestChoice(v),
        amount: checkedAmount(v),
        method: v.method ?? 'cash',
        note: v.note,
      }),
    onSuccess: (data) => saved(data, data.duplicate),
    onError: failed,
  });
  return { confirm, manual, saving: confirm.isPending || manual.isPending };
}
