CREATE TABLE `accessory` (
	`id` text PRIMARY KEY NOT NULL,
	`name_es` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `milestone` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`threshold` integer NOT NULL,
	`xp_reward` integer NOT NULL,
	`treat_reward` integer NOT NULL,
	`accessory_id` text
);
--> statement-breakpoint
CREATE TABLE `milestone_unlock` (
	`profile_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`unlocked_at` text NOT NULL,
	`logged_date` text NOT NULL,
	PRIMARY KEY(`profile_id`, `milestone_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestone`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pet` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`max_xp_reached` integer DEFAULT 0 NOT NULL,
	`stage` text DEFAULT 'newborn' NOT NULL,
	`mood` integer DEFAULT 70 NOT NULL,
	`mood_updated_date` text NOT NULL,
	`treats` integer DEFAULT 0 NOT NULL,
	`equipped_accessory_ids` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pet_accessory_unlock` (
	`profile_id` text NOT NULL,
	`accessory_id` text NOT NULL,
	`unlocked_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `accessory_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accessory_id`) REFERENCES `accessory`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `treat_event` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_record_id` text NOT NULL,
	`logged_date` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `treat_event_unique` ON `treat_event` (`profile_id`,`kind`,`source_record_id`);--> statement-breakpoint
CREATE TABLE `xp_event` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`source` text NOT NULL,
	`source_record_id` text NOT NULL,
	`logged_date` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xp_event_unique` ON `xp_event` (`profile_id`,`source`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `xp_event_date_idx` ON `xp_event` (`profile_id`,`logged_date`);