import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/** 后台账号 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'staff'] }).notNull(),
  createdAt: integer('created_at').notNull(),
});

/** 宾客 */
export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  salutation: text('salutation'),
  phone: text('phone'),
  groupName: text('group_name'),
  side: text('side', { enum: ['male', 'female', 'both'] }),
  inviteToken: text('invite_token').notNull().unique(),
  status: text('status', { enum: ['pending', 'sent', 'viewed', 'rsvp'] })
    .notNull()
    .default('pending'),
  note: text('note'),
  invitedAt: integer('invited_at'),
  viewedAt: integer('viewed_at'),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** 回执 */
export const rsvps = sqliteTable('rsvps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id'),
  guestName: text('guest_name').notNull(),
  attending: text('attending', { enum: ['yes', 'no', 'maybe'] }).notNull(),
  headcount: integer('headcount').notNull().default(1),
  childrenCount: integer('children_count').notNull().default(0),
  message: text('message'),
  source: text('source', { enum: ['link', 'universal'] })
    .notNull()
    .default('link'),
  submittedAt: integer('submitted_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  clientInfo: text('client_info'),
  /** 通用回执的私有修改凭证摘要；历史记录与专属回执为空。 */
  editTokenHash: text('edit_token_hash').unique(),
});

/** 签到 / 现场提交 */
export const checkins = sqliteTable('checkins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id'),
  guestName: text('guest_name').notNull(),
  source: text('source', { enum: ['self', 'manual'] })
    .notNull()
    .default('self'),
  status: text('status', { enum: ['pending', 'confirmed', 'rejected', 'cancelled'] })
    .notNull()
    .default('pending'),
  note: text('note'),
  submittedAt: integer('submitted_at').notNull(),
  confirmedAt: integer('confirmed_at'),
  // 旧签到保留 NULL，不能用预计人数推算实际到场。
  actualHeadcount: integer('actual_headcount'),
  actualChildrenCount: integer('actual_children_count'),
});

/** 同一次登记的重试结果；多个设备的提交可指向同一签到记录。 */
export const checkinSubmissions = sqliteTable('checkin_submissions', {
  keyHash: text('key_hash').primaryKey().notNull(),
  payloadHash: text('payload_hash').notNull(),
  checkinId: integer('checkin_id').notNull().references(() => checkins.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
});

/** 礼金 */
export const gifts = sqliteTable('gifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id'),
  guestName: text('guest_name').notNull(),
  amount: integer('amount').notNull(),
  method: text('method', { enum: ['wechat', 'alipay', 'cash'] }).notNull(),
  note: text('note'),
  checkinId: integer('checkin_id'),
  recordedAt: integer('recorded_at').notNull(),
  voidedAt: integer('voided_at'),
  version: integer('version').notNull().default(1),
});

export type UserRow = typeof users.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;
export type CheckinRow = typeof checkins.$inferSelect;
export type GiftRow = typeof gifts.$inferSelect;

/** 归档、恢复、驳回、撤销和作废的追加式操作记录。 */
export const operationLogs = sqliteTable('operation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity: text('entity', { enum: ['guest', 'checkin', 'gift'] }).notNull(),
  entityId: integer('entity_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  actorId: integer('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  before: text('before_json').notNull(),
  after: text('after_json').notNull(),
  createdAt: integer('created_at').notNull(),
});
