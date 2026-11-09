CREATE TABLE `day_energy_snapshot` (
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`settings_version_id` text NOT NULL,
	`weight_kg` real NOT NULL,
	`weight_record_id` text NOT NULL,
	`age` integer NOT NULL,
	`bmr_kcal` real NOT NULL,
	`activity_multiplier` real NOT NULL,
	`baseline_tdee_kcal` real NOT NULL,
	`adjustment_kcal` integer NOT NULL,
	`recommended_target_kcal` real NOT NULL,
	`active_target_kcal` real NOT NULL,
	`target_is_override` integer NOT NULL,
	`protein_target_g` real,
	`carbs_target_g` real,
	`fat_target_g` real,
	`bmr_formula` text NOT NULL,
	`calc_version` integer NOT NULL,
	`created_at` text NOT NULL,
	`refreshed_at` text,
	PRIMARY KEY(`profile_id`, `local_date`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`settings_version_id`) REFERENCES `profile_settings_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profile_settings_version` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` text NOT NULL,
	`birth_date` text NOT NULL,
	`sex_for_formula` text NOT NULL,
	`height_cm` real NOT NULL,
	`goal_type` text NOT NULL,
	`activity_level` text NOT NULL,
	`activity_multiplier` real NOT NULL,
	`bmr_formula` text NOT NULL,
	`calorie_adjustment_kcal` integer NOT NULL,
	`calorie_target_override_kcal` integer,
	`protein_target_g` real,
	`carbs_target_g` real,
	`fat_target_g` real,
	`calc_version` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `settings_profile_effective_idx` ON `profile_settings_version` (`profile_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `device` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`enrolled_via` text NOT NULL,
	`enrolled_by_profile_id` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`enrolled_by_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_token_hash_unique` ON `device` (`token_hash`);--> statement-breakpoint
CREATE INDEX `device_token_idx` ON `device` (`token_hash`);--> statement-breakpoint
CREATE TABLE `pairing_code` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`issued_by_profile_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`issued_by_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
