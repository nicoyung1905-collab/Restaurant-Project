ALTER TABLE `orders` ADD `service_type` text DEFAULT 'dine_in' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `takeaway_day` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `takeaway_number` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_takeaway_daily_idx` ON `orders` (`takeaway_day`,`takeaway_number`);