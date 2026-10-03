CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`men` integer NOT NULL,
	`women` integer NOT NULL,
	`children` integer NOT NULL,
	`arrived_at` integer NOT NULL,
	`ended_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`last_change_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visits_active_table_idx` ON `visits` (`table_id`) WHERE "visits"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `visits_arrival_idx` ON `visits` (`arrived_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `visit_id` text REFERENCES visits(id);