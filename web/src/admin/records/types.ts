import type { LifecycleAction, LifecycleEntity } from '@shared/types';
export interface RecordActionTarget {
  entity: LifecycleEntity;
  id: number;
  action: LifecycleAction;
}
export const ACTION_LABEL: Record<LifecycleAction, string> = {
  archive: '归档宾客',
  restore: '恢复记录',
  reject: '驳回提交',
  cancel: '撤销确认',
  void: '作废礼金',
};
