import type { LifecycleAction } from '@shared/types';
export const giftCorrectionReasons = [
  '金额录入有误',
  '收款方式录入有误',
  '现场重新核对红包',
  '补充登记说明',
];
export const attendanceReasons = [
  '现场重新清点人数',
  '补记实际到场人数',
  '儿童人数录入有误',
  '同行人数发生变化',
  '同行家人晚到',
];
export const actionReasons: Record<LifecycleAction, readonly string[]> = {
  archive: ['重复建立档案', '不再使用此档案', '名单整理归档'],
  restore: ['误操作恢复', '重新核对后恢复'],
  reject: ['重复提交', '误提交签到', '核对后非本人到场'],
  cancel: ['误确认签到', '关联宾客有误', '实际尚未到场'],
  void: ['重复登记礼金', '金额或关联对象有误，重新登记', '实际未收到礼金', '误登记礼金'],
};
