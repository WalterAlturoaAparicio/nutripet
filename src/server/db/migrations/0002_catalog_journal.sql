CREATE TABLE `data_source` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`license` text NOT NULL,
	`attribution_text` text NOT NULL,
	`url` text
);
--> statement-breakpoint
CREATE TABLE `food` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`source_food_id` text,
	`owner_profile_id` text,
	`name_es` text NOT NULL,
	`name_en` text,
	`category` text NOT NULL,
	`preparation_state` text NOT NULL,
	`brand` text,
	`current_version_id` text,
	`source_note` text,
	`hidden_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_source_unique` ON `food` (`data_source_id`,`source_food_id`);--> statement-breakpoint
CREATE INDEX `food_owner_idx` ON `food` (`owner_profile_id`);--> statement-breakpoint
CREATE TABLE `food_alias` (
	`food_id` text NOT NULL,
	`alias` text NOT NULL,
	`lang` text NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_alias_unique` ON `food_alias` (`food_id`,`alias`,`lang`);--> statement-breakpoint
CREATE TABLE `food_version` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`basis` text NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`density_g_per_ml` real,
	`data_source_id` text NOT NULL,
	`source_version` text NOT NULL,
	`import_run_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_version_unique` ON `food_version` (`food_id`,`version_no`);--> statement-breakpoint
CREATE TABLE `import_run` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`source_version` text NOT NULL,
	`input_checksum` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`created` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`unchanged` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`report_path` text,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_source`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meal` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`occasion` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_unique_occasion` ON `meal` (`profile_id`,`local_date`,`occasion`) WHERE occasion <> 'extra';--> statement-breakpoint
CREATE INDEX `meal_profile_date_idx` ON `meal` (`profile_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `meal_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`local_date` text NOT NULL,
	`food_id` text NOT NULL,
	`food_version_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`approximate` integer NOT NULL,
	`eaten_at` text NOT NULL,
	`note` text,
	`snap_name` text NOT NULL,
	`snap_brand` text,
	`snap_preparation_state` text NOT NULL,
	`snap_data_source_id` text NOT NULL,
	`snap_source_version` text NOT NULL,
	`snap_basis` text NOT NULL,
	`snap_density_g_per_ml` real,
	`snap_kcal_per100` real NOT NULL,
	`snap_protein_per100` real NOT NULL,
	`snap_carbs_per100` real NOT NULL,
	`snap_fat_per100` real NOT NULL,
	`snap_fiber_per100` real,
	`snap_sugar_per100` real,
	`snap_sodium_per100` real,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_version_id`) REFERENCES `food_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meal_entry_profile_date_idx` ON `meal_entry` (`profile_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `meal_entry_meal_idx` ON `meal_entry` (`meal_id`);--> statement-breakpoint
CREATE INDEX `meal_entry_food_idx` ON `meal_entry` (`profile_id`,`food_id`);--> statement-breakpoint
CREATE TABLE `meal_template` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_template_profile_idx` ON `meal_template` (`profile_id`);--> statement-breakpoint
CREATE TABLE `meal_template_item` (
	`template_id` text NOT NULL,
	`food_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `meal_template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action
);
