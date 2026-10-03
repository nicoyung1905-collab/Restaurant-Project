import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const orders = sqliteTable('orders', {
 id: text('id').primaryKey(), tableId: text('table_id').notNull(), createdAt: integer('created_at').notNull(),
 notes: text('notes').notNull().default(''), allergies: text('allergies').notNull().default(''),
 revision: integer('revision').notNull().default(1), lastChangeId: text('last_change_id').notNull(), archivedAt: integer('archived_at'),
}, t => [index('orders_table_active_idx').on(t.tableId,t.archivedAt)]);
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
