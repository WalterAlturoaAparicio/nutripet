CREATE TABLE `food_favorite` (
	`profile_id` text NOT NULL,
	`food_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `food_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `food_override` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`food_id` text NOT NULL,
	`food_version_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_version_id`) REFERENCES `food_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_override_unique` ON `food_override` (`profile_id`,`food_id`);