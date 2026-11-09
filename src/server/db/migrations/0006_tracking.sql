CREATE TABLE `day_log` (
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`rest_day` integer DEFAULT false NOT NULL,
	`marked_complete` integer DEFAULT false NOT NULL,
	`first_completed_at` text,
	PRIMARY KEY(`profile_id`, `local_date`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `streak_cache` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`current` integer NOT NULL,
	`longest` integer NOT NULL,
	`total_recorded_days` integer NOT NULL,
	`total_completed_days` integer NOT NULL,
	`eligible_completed_days` integer NOT NULL,
	`freezes_available` integer NOT NULL,
	`computed_through_date` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
