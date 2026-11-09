CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_weight_kg` real NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`height_unit` text DEFAULT 'cm' NOT NULL,
	`food_unit` text DEFAULT 'metric' NOT NULL,
	`time_zone` text DEFAULT 'America/Bogota' NOT NULL,
	`pin_hash` text NOT NULL,
	`recovery_code_hash` text NOT NULL,
	`failed_pin_attempts` integer DEFAULT 0 NOT NULL,
	`pin_lock_series` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`failed_recovery_attempts` integer DEFAULT 0 NOT NULL,
	`recovery_lock_series` integer DEFAULT 0 NOT NULL,
	`recovery_locked_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_name_unique` ON `profile` (lower("name"));--> statement-breakpoint
CREATE TABLE `session` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_profile_idx` ON `session` (`profile_id`);--> statement-breakpoint
CREATE TABLE `weight_record` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weight_profile_date_idx` ON `weight_record` (`profile_id`,`local_date`);