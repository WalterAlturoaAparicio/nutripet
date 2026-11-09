CREATE TABLE `activity_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`activity_type_id` text NOT NULL,
	`snap_name` text NOT NULL,
	`local_date` text NOT NULL,
	`duration_min` integer NOT NULL,
	`intensity` text,
	`estimate_method` text NOT NULL,
	`met_used` real,
	`weight_kg_used` real,
	`net_kcal` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_type_id`) REFERENCES `activity_type`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_entry_profile_date_idx` ON `activity_entry` (`profile_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `activity_type` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_profile_id` text,
	`name_es` text NOT NULL,
	`icon` text,
	`met_light` real,
	`met_moderate` real,
	`met_vigorous` real,
	`compendium_code` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_type_owner_idx` ON `activity_type` (`owner_profile_id`);