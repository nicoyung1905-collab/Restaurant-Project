import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const visits = sqliteTable('visits', {
 id:text('id').primaryKey(), tableId:text('table_id').notNull(),
 men:integer('men').notNull(), women:integer('women').notNull(), children:integer('children').notNull(),
 arrivedAt:integer('arrived_at').notNull(), endedAt:integer('ended_at'),
 revision:integer('revision').notNull().default(1), lastChangeId:text('last_change_id').notNull(),
},t=>[uniqueIndex('visits_active_table_idx').on(t.tableId).where(sql`${t.endedAt} IS NULL`),index('visits_arrival_idx').on(t.arrivedAt)]);
export const orders = sqliteTable('orders', {
 id: text('id').primaryKey(), tableId: text('table_id').notNull(), createdAt: integer('created_at').notNull(),
 notes: text('notes').notNull().default(''), allergies: text('allergies').notNull().default(''),
 revision: integer('revision').notNull().default(1), lastChangeId: text('last_change_id').notNull(), archivedAt: integer('archived_at'),
 visitId:text('visit_id').references(()=>visits.id),
 serviceType:text('service_type').notNull().default('dine_in'),
 takeawayDay:text('takeaway_day'), takeawayNumber:integer('takeaway_number'),
}, t => [index('orders_table_active_idx').on(t.tableId,t.archivedAt),uniqueIndex('orders_takeaway_daily_idx').on(t.takeawayDay,t.takeawayNumber)]);
export const items = sqliteTable('order_items', {
 id: text('id').primaryKey(), orderId: text('order_id').notNull().references(()=>orders.id), menuId: text('menu_id').notNull(),
 qty: integer('qty').notNull(), note: text('note').notNull().default(''), status: text('status').notNull().default('new'),
 createdAt: integer('created_at').notNull(), startedAt: integer('started_at'), readyAt: integer('ready_at'), servedAt: integer('served_at'), cancelledAt: integer('cancelled_at'),
}, t => [index('items_order_idx').on(t.orderId),index('items_report_idx').on(t.readyAt)]);
export const events = sqliteTable('events', {
 seq: integer('seq').primaryKey({autoIncrement:true}), id:text('id').notNull().unique(), orderId:text('order_id').references(()=>orders.id),
 type:text('type').notNull(), message:text('message').notNull(), createdAt:integer('created_at').notNull(),
});
export const availability = sqliteTable('menu_availability', {
 menuId:text('menu_id').primaryKey(), available:integer('available').notNull().default(1), updatedAt:integer('updated_at').notNull(),
});
