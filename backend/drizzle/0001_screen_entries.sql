CREATE TABLE `screen_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`screen_key` text NOT NULL,
	`ticker` text NOT NULL,
	`session_date` text NOT NULL,
	`snapshot_price` real,
	`entry_close` real,
	`ret_1d` real,
	`ret_5d` real,
	`ret_20d` real,
	`spy_1d` real,
	`spy_5d` real,
	`spy_20d` real,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `screen_entries_unique_idx` ON `screen_entries` (`screen_key`,`ticker`,`session_date`);--> statement-breakpoint
CREATE INDEX `screen_entries_pending_idx` ON `screen_entries` (`completed`,`session_date`);