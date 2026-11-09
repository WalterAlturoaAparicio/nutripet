-- Recipes/preparations (FR-038, FR-039, FR-045–FR-049) and recipe-aware meal entries and template items.
-- Existing rows are copied as kind = 'food' with all their values unchanged (FR-033).
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`current_version_id` text,
	`hidden_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_profile_idx` ON `recipe` (`profile_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_version_id` text NOT NULL,
	`position` integer NOT NULL,
	`food_id` text NOT NULL,
	`food_version_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`approximate` integer NOT NULL,
	`snap_name` text NOT NULL,
	`snap_brand` text,
	`snap_preparation_state` text NOT NULL,
	`snap_product_form` text NOT NULL,
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
	FOREIGN KEY (`recipe_version_id`) REFERENCES `recipe_version`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_version_id`) REFERENCES `food_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredient_version_idx` ON `recipe_ingredient` (`recipe_version_id`);--> statement-breakpoint
CREATE TABLE `recipe_version` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`notes` text,
	`servings` real,
	`yield_quantity` real,
	`yield_unit` text,
	`homogeneous` integer NOT NULL,
	`approximate` integer NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_version_unique` ON `recipe_version` (`recipe_id`,`version_no`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meal_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`local_date` text NOT NULL,
	`kind` text DEFAULT 'food' NOT NULL,
	`food_id` text,
	`food_version_id` text,
	`recipe_id` text,
	`recipe_version_id` text,
	`portion_mode` text,
	`portion_servings` real,
	`portion_factor` real,
	`quantity` real,
	`unit` text,
	`approximate` integer NOT NULL,
	`eaten_at` text NOT NULL,
	`note` text,
	`snap_name` text NOT NULL,
	`snap_brand` text,
	`snap_preparation_state` text NOT NULL,
	`snap_data_source_id` text NOT NULL,
	`snap_source_version` text NOT NULL,
	`snap_product_form` text DEFAULT 'as_sold' NOT NULL,
	`snap_basis` text,
	`snap_density_g_per_ml` real,
	`snap_kcal_per100` real,
	`snap_protein_per100` real,
	`snap_carbs_per100` real,
	`snap_fat_per100` real,
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
	FOREIGN KEY (`food_version_id`) REFERENCES `food_version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_version_id`) REFERENCES `recipe_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_meal_entry`("id", "profile_id", "meal_id", "local_date", "food_id", "food_version_id", "quantity", "unit", "approximate", "eaten_at", "note", "snap_name", "snap_brand", "snap_preparation_state", "snap_data_source_id", "snap_source_version", "snap_basis", "snap_density_g_per_ml", "snap_kcal_per100", "snap_protein_per100", "snap_carbs_per100", "snap_fat_per100", "snap_fiber_per100", "snap_sugar_per100", "snap_sodium_per100", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg", "created_at", "updated_at") SELECT "id", "profile_id", "meal_id", "local_date", "food_id", "food_version_id", "quantity", "unit", "approximate", "eaten_at", "note", "snap_name", "snap_brand", "snap_preparation_state", "snap_data_source_id", "snap_source_version", "snap_basis", "snap_density_g_per_ml", "snap_kcal_per100", "snap_protein_per100", "snap_carbs_per100", "snap_fat_per100", "snap_fiber_per100", "snap_sugar_per100", "snap_sodium_per100", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg", "created_at", "updated_at" FROM `meal_entry`;--> statement-breakpoint
DROP TABLE `meal_entry`;--> statement-breakpoint
ALTER TABLE `__new_meal_entry` RENAME TO `meal_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `meal_entry_profile_date_idx` ON `meal_entry` (`profile_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `meal_entry_meal_idx` ON `meal_entry` (`meal_id`);--> statement-breakpoint
CREATE INDEX `meal_entry_food_idx` ON `meal_entry` (`profile_id`,`food_id`);--> statement-breakpoint
CREATE INDEX `meal_entry_recipe_idx` ON `meal_entry` (`profile_id`,`recipe_id`);--> statement-breakpoint
CREATE TABLE `__new_meal_template_item` (
	`template_id` text NOT NULL,
	`food_id` text,
	`recipe_id` text,
	`portion_mode` text,
	`portion_servings` real,
	`quantity` real,
	`unit` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `meal_template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_meal_template_item`("template_id", "food_id", "quantity", "unit", "position") SELECT "template_id", "food_id", "quantity", "unit", "position" FROM `meal_template_item`;--> statement-breakpoint
DROP TABLE `meal_template_item`;--> statement-breakpoint
ALTER TABLE `__new_meal_template_item` RENAME TO `meal_template_item`;--> statement-breakpoint
ALTER TABLE `food` ADD `product_form` text DEFAULT 'as_sold' NOT NULL;--> statement-breakpoint
ALTER TABLE `food` ADD `preparation_instructions` text;