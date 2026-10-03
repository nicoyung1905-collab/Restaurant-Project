ALTER TABLE `order_items` ADD `unit_price` integer;--> statement-breakpoint
CREATE INDEX `items_served_report_idx` ON `order_items` (`served_at`);