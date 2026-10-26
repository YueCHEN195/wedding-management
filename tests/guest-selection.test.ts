import test from 'node:test';
import assert from 'node:assert/strict';
import type { GuestCandidate } from '../shared/types';
import { defaultGuestChoice, guestSelectionState } from '../web/src/admin/review/guestSelection';
const guest = (id: number, values: Partial<GuestCandidate> = {}): GuestCandidate => ({
  id,
  name: '同名来宾',
  groupName: null,
  side: null,
  attending: null,
  headcount: null,
  childrenCount: null,
  checkedIn: false,
  pendingCheckinIds: [],
  ...values,
});

test('无同名档案默认新建并隐藏选择', () => {
  assert.equal(defaultGuestChoice([], {}), 'new');
  assert.equal(guestSelectionState([], 'new', {}).showSelection, false);
});
test('唯一未签到默认选中，有无回执均保留新增入口', () => {
  for (const attending of ['yes', 'no', 'maybe', null] as const) {
    const candidates = [guest(1, { attending })];
    assert.equal(defaultGuestChoice(candidates, {}), 1);
    assert.equal(guestSelectionState(candidates, 1, {}).showSelection, true);
    assert.equal(guestSelectionState(candidates, 'new', {}).showSelection, true);
  }
});
test('混合同名只剩一位可签到时默认选中，两位以上不猜测', () => {
  assert.equal(defaultGuestChoice([guest(1, { checkedIn: true }), guest(2)], {}), 2);
  assert.equal(defaultGuestChoice([guest(1), guest(2)], {}), undefined);
});
test('全部同名已签到才自动新建隐藏，有待审时仍要求核对', () => {
  const candidates = [guest(1, { checkedIn: true }), guest(2, { checkedIn: true })];
  assert.equal(defaultGuestChoice(candidates, {}), 'new');
  assert.equal(guestSelectionState(candidates, 'new', {}).showSelection, false);
  assert.equal(defaultGuestChoice(candidates, { relatedPendingIds: [8] }), undefined);
  assert.equal(
    guestSelectionState(candidates, 'new', { relatedPendingIds: [8] }).showSelection,
    true,
  );
});
test('待审不等于已签到，当前提交可用但另一条待审占用不可选', () => {
  const candidates = [guest(1, { pendingCheckinIds: [8] })];
  assert.equal(defaultGuestChoice(candidates, { checkinId: 8 }), 1);
  assert.equal(defaultGuestChoice(candidates, { checkinId: 9 }), undefined);
  assert.equal(guestSelectionState(candidates, 1, { checkinId: 9 }).blocked, true);
});
test('明确档案ID优先，已失效的选择保持并阻止保存而非偷偷新建', () => {
  assert.equal(defaultGuestChoice([guest(1), guest(2)], { preferredGuestId: 2 }), 2);
  assert.equal(defaultGuestChoice([guest(2, { checkedIn: true })], { preferredGuestId: 2 }), 2);
  assert.equal(guestSelectionState([guest(2, { checkedIn: true })], 2, {}).blocked, true);
  assert.equal(guestSelectionState([], 2, {}).blocked, true);
});
test('仅有可靠自动建档来源时隐藏，不能用临时分组或无回执猜测', () => {
  const candidates = [guest(1, { groupName: '临时到场', pendingCheckinIds: [8] })];
  const context = { checkinId: 8, preferredGuestId: 1 };
  assert.equal(guestSelectionState(candidates, 1, context).showSelection, true);
  assert.equal(
    guestSelectionState(candidates, 1, { ...context, autoCreatedGuest: true }).showSelection,
    false,
  );
  assert.equal(
    guestSelectionState(candidates, 1, {
      ...context,
      autoCreatedGuest: true,
      relatedPendingIds: [9],
    }).showSelection,
    true,
  );
});

test('已确认档案仍关联另一条待审时不能自动走隐藏新建', () => {
  const candidates = [guest(1, { checkedIn: true, pendingCheckinIds: [8] })];
  assert.equal(defaultGuestChoice(candidates, {}), undefined);
  assert.equal(guestSelectionState(candidates, 'new', {}).showSelection, true);
});
