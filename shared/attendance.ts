import type { GuestCandidate } from './types';
import { MAX_HEADCOUNT } from './constraints';

/** 回执只作为现场可修改的初始值；未出席、待定或异常旧回执不填入实际人数。 */
export function attendanceFromRsvp(guest?: Pick<GuestCandidate, 'attending' | 'headcount' | 'childrenCount'>) {
  const total = guest?.headcount;
  const children = guest?.childrenCount;
  if (guest?.attending === 'yes' && Number.isInteger(total) && total! >= 1 && total! <= MAX_HEADCOUNT
    && Number.isInteger(children) && children! >= 0 && children! <= total!) {
    return { actualHeadcount: total!, actualChildrenCount: children! };
  }
  return { actualHeadcount: 1, actualChildrenCount: 0 };
}
