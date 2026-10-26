import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { createSubmissionKey } from '@/lib/submissionKey';
import type { CheckinDTO, ReviewGuestRow } from '@shared/types';
import type { AdminOutletContext } from '../AdminLayout';
import type { RecordActionTarget } from '../components/RecordAction';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useReviewRealtime } from './useReviewRealtime';
import { useReviewQueries } from './useReviewQueries';
import { useReviewSubmission } from './useReviewSubmission';
import { useReviewIdentity } from './useReviewIdentity';
import { reviewInitialValues } from './checkinFormDefaults';
import { isReviewSaveBlocked, type CheckinFormValues } from './checkinForm';
export function useReviewWorkbench() {
  const realtimeConnected = useReviewRealtime();
  const navigate = useNavigate();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [recordAction, setRecordAction] = useState<RecordActionTarget | null>(null);
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [manualSubmissionKey, setManualSubmissionKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [nameComposing, setNameComposing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form] = Form.useForm<CheckinFormValues>();
  const [manualForm] = Form.useForm<CheckinFormValues>();
  const activeForm = manualOpen ? manualForm : form;
  const confirmValues = Form.useWatch([], form);
  const manualValues = Form.useWatch([], manualForm);
  const values = ((manualOpen ? manualValues : confirmValues) ?? {}) as CheckinFormValues;
  const manualName = ((Form.useWatch('guestName', manualForm) as string | undefined) ?? '').trim();
  const {
    me,
    stats,
    pending,
    confirmCandidates,
    manualCandidates,
    manualNamePending,
    candidateNamePending,
    candidateLookupPending,
    invalidate,
  } = useReviewQueries(confirming, manualOpen, manualName, nameComposing);
  const { identity, setManualPreferred } = useReviewIdentity({
    form,
    manualForm,
    confirming,
    manualOpen,
    manualName,
    manualSubmissionKey,
    manualNamePending,
    confirmCandidates,
    manualCandidates,
    pendingItems: pending.data ?? [],
    pendingReady: !pending.isPending && !pending.isError,
  });

  const { confirm, manual, saving } = useReviewSubmission({
    confirming,
    manualSubmissionKey,
    invalidate,
    onSaved: () => {
      setDirty(false);
      setSubmitError(null);
      setActive(false);
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
    setNameComposing(false);
    setSubmitError(null);
    next();
  };
  const openTicket = (item: CheckinDTO) => {
    if (active && confirming?.id === item.id && !manualOpen) return;
    void switchDraft(() => {
      form.resetFields();
      setManualOpen(false);
      setConfirming(item);
      setActive(true);
      form.setFieldsValue(reviewInitialValues);
    });
  };
  const openManual = () => {
    if (active && manualOpen) return;
    void switchDraft(() => {
      manualForm.resetFields();
      setManualPreferred(null);
      setConfirming(null);
      setManualSubmissionKey(createSubmissionKey());
      setManualOpen(true);
      setActive(true);
    });
  };
  const goToRecords = () => {
    void switchDraft(() => {
      void navigate('/admin/checkins');
    });
  };
  const items = pending.data ?? [];
  const noLongerPending =
    active &&
    confirming != null &&
    pending.data != null &&
    !items.some((r) => r.id === confirming.id);
  const candidates = manualOpen ? manualCandidates : confirmCandidates;
  const blockSave =
    !active ||
    pending.isPending ||
    pending.isError ||
    identity.blocked ||
    isReviewSaveBlocked({
      saving,
      candidatesFetching: candidateLookupPending,
      candidatesError: candidates.isError,
      noLongerPending,
      guestArchived: !!confirming?.guestArchived,
      manualOpen,
      manualReady: !!manualName && !!manualSubmissionKey,
      pendingReady: !!confirming && !pending.isError && !pending.isPending,
    });
  const closeDrawer = () => {
    void switchDraft(() => {
      setActive(false);
    });
  };
  // Keep the actual record and form visible until Ant Design finishes closing.
  const afterDrawerClose = () => {
    if (active) return;
    setConfirming(null);
    setManualOpen(false);
  };
  const onNavigate = (path: string) => {
    void switchDraft(() => {
      void navigate(path);
    });
  };
  const onProcess = (row: ReviewGuestRow) => {
    if (row.pendingId != null) {
      openRelatedPending(row.pendingId);
    } else {
      void switchDraft(() => {
        manualForm.resetFields();
        setConfirming(null);
        setManualSubmissionKey(createSubmissionKey());
        setManualOpen(true);
        setActive(true);
        setManualPreferred(row.guestId == null ? null : { id: row.guestId, name: row.name });
        manualForm.setFieldsValue({ guestName: row.name });
      });
    }
  };
  const openRelatedPending = (id: number) => {
    const item = pending.data?.find((record) => record.id === id);
    if (item) openTicket(item);
    else {
      void pending.refetch();
      message.info('待审记录已变化，正在刷新队列，请重新核对');
    }
  };
  const submit = (input: CheckinFormValues) => {
    if (blockSave) return;
    if (manualOpen) manual.mutate({ ...input, guestName: input.guestName! });
    else confirm.mutate(input);
  };
  return {
    realtimeConnected,
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
    identity,
    openRelatedPending,
    candidateNamePending,
    setNameComposing,
    active,
    blockSave,
    closeDrawer,
    afterDrawerClose,
    onNavigate,
    onProcess,
    submit,
    setDirty,
  };
}
export type ReviewWorkbenchModel = ReturnType<typeof useReviewWorkbench>;
