CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`player` integer NOT NULL,
	`assignment_date` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_player_date_unique` ON `assignments` (`player`,`assignment_date`);--> statement-breakpoint
CREATE INDEX `idx_assignments_date` ON `assignments` (`assignment_date`);--> statement-breakpoint
CREATE TABLE `challenge_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`player_one` text NOT NULL,
	`player_two` text NOT NULL,
	`prize` text NOT NULL,
	`start_date` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
