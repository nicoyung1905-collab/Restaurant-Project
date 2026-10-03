CREATE TABLE `menu_availability` (
	`menu_id` text PRIMARY KEY NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`order_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`menu_id` text NOT NULL,
	`qty` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ready_at` integer,
	`served_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `items_report_idx` ON `order_items` (`ready_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`allergies` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`last_change_id` text NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE INDEX `orders_table_active_idx` ON `orders` (`table_id`,`archived_at`);