CREATE TABLE `finviz_screen_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`screen_key` text NOT NULL,
	`screen_name` text NOT NULL,
	`source_url` text NOT NULL,
	`source_kind` text DEFAULT 'public-finviz' NOT NULL,
	`fetched_at` integer NOT NULL,
	`stock_count` integer NOT NULL,
	`stocks` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finviz_snapshots_screen_fetched_at_idx` ON `finviz_screen_snapshots` (`screen_key`,`fetched_at`);--> statement-breakpoint
CREATE INDEX `finviz_snapshots_run_id_idx` ON `finviz_screen_snapshots` (`run_id`);--> statement-breakpoint
CREATE TABLE `finviz_sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`source_url` text NOT NULL,
	`successful_screens` integer DEFAULT 0 NOT NULL,
	`failed_screens` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `finviz_sync_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`schedule_enabled` integer DEFAULT true NOT NULL,
	`sync_in_progress` integer DEFAULT false NOT NULL,
	`sync_started_at` integer,
	`last_manual_triggered_at` integer,
	`last_successful_run_id` integer,
	`last_successful_at` integer
);
