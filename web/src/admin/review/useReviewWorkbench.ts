import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { CheckinDTO, ReviewGuestRow } from '@shared/types';
import type { AdminOutletContext } from '../AdminLayout';
import type { RecordActionTarget } from '../components/RecordAction';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useReviewQueries } from './useReviewQueries';
import { useReviewSubmission } from './useReviewSubmission';
import { useRsvpAttendance } from './useRsvpAttendance';
import { isReviewSaveBlocked, type CheckinFormValues } from './checkinForm';
export function useReviewWorkbench() {
  const navigate = useNavigate();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [recordAction, setRecordAction] = useState<RecordActionTarget | null>(null);
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmissionKey, setManualSubmissionKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form] = Form.useForm<CheckinFormValues>();
  const [manualForm] = Form.useForm<CheckinFormValues>();
  const activeForm = manualOpen ? manualForm : form;
  const confirmValues = Form.useWatch([], form);
  const manualValues = Form.useWatch([], manualForm);
  const values = ((manualOpen ? manualValues : confirmValues) ?? {}) as CheckinFormValues;
  const manualName = ((Form.useWatch('guestName', manualForm) as string | undefined) ?? '').trim();
  const { me, stats, pending, confirmCandidates, manualCandidates, invalidate } = useReviewQueries(
    confirming,
    manualOpen,
    manualName,
  );
  useEffect(() => {
    manualForm.setFieldsValue({ guestId: undefined, newGuest: undefined });
  }, [manualName, manualForm]);
  useRsvpAttendance(form, confirming?.guestName ?? '', confirmCandidates, confirming != null);
  useRsvpAttendance(manualForm, manualName, manualCandidates, manualOpen && !!manualName);

  const { confirm, manual, saving } = useReviewSubmission({
    confirming,
    manualSubmissionKey,
    invalidate,
    onSaved: () => {
      setDirty(false);
      setSubmitError(null);
      setConfirming(null);
      setManualOpen(false);
    },
    onFailed: (error) => {
      setSubmitError(error);
      void pending.refetch();
    },
  });
  const canLeave = useUnsavedChanges({
    dirty,
    busy: saving,
    content: '离开这条记录会丢弃本次输入，确认离开吗？',
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const switchDraft = async (next: () => void) => {
    if (!(await canLeave())) return;
    setDirty(false);
    setSubmitError(null);
    next();
  };
  const openTicket = (item: CheckinDTO) => {
    if (confirming?.id === item.id && !manualOpen) return;
    void switchDraft(() => {
      form.resetFields();
      setManualOpen(false);
      setConfirming(item);
      form.setFieldsValue({
        giftReceipt: 'received',
        actualHeadcountInput: '1',
        actualChildrenInput: '0',
      });
    });
  };
  const openManual = () => {
    if (manualOpen) return;
    void switchDraft(() => {
      manualForm.resetFields();
      setConfirming(null);
      setManualSubmissionKey(crypto.randomUUID());
      setManualOpen(true);
    });
  };
  const goToRecords = () => {
    void switchDraft(() => {
      void navigate('/admin/checkins');
    });
  };
  const items = pending.data ?? [];
  const noLongerPending =
    confirming != null && pending.data != null && !items.some((r) => r.id === confirming.id);
  const candidates = manualOpen ? manualCandidates : confirmCandidates;
  const active = manualOpen || confirming != null;
  const blockSave = isReviewSaveBlocked({
    saving,
    candidatesFetching: candidates.isFetching,
    candidatesError: candidates.isError,
    noLongerPending,
    guestArchived: !!confirming?.guestArchived,
    manualOpen,
    manualReady: !!manualName && !!manualSubmissionKey,
    pendingReady: !!confirming && !pending.isError && !pending.isPending,
  });
  const closeDrawer = () => {
    void switchDraft(() => {
      setConfirming(null);
      setManualOpen(false);
    });
  };
  const onNavigate = (path: string) => {
    void switchDraft(() => {
      void navigate(path);
    });
  };
  const onProcess = (row: ReviewGuestRow) => {
    if (row.pendingId != null) {
      const item = pending.data?.find((item) => item.id === row.pendingId);
      if (item) openTicket(item);
      else {
        void pending.refetch();
        message.info('待审记录已变化，正在刷新队列，请重新核对');
      }
    } else {
      void switchDraft(() => {
        manualForm.resetFields();
        setConfirming(null);
        setManualSubmissionKey(crypto.randomUUID());
        setManualOpen(true);
        manualForm.setFieldsValue({ guestName: row.name });
      });
    }
  };
  const submit = (input: CheckinFormValues) => {
    if (manualOpen) manual.mutate({ ...input, guestName: input.guestName! });
    else confirm.mutate(input);
  };
  return {
    me,
    stats,
    pending,
    invalidate,
    recordAction,
    setRecordAction,
    confirming,
    manualOpen,
    dirty,
    submitError,
    activeForm,
    values,
    manualName,
    saving,
    openTicket,
    openManual,
    goToRecords,
    items,
    noLongerPending,
    candidates,
    active,
    blockSave,
    closeDrawer,
    onNavigate,
    onProcess,
    submit,
    setDirty,
  };
}
export type ReviewWorkbenchModel = ReturnType<typeof useReviewWorkbench>;
