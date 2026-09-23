CREATE TABLE `assignment_recipients` (
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`attempts_used` integer DEFAULT 0 NOT NULL,
	`best_score` integer,
	`completed_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`assignment_id`, `user_id`),
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipients_user_idx` ON `assignment_recipients` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`config_overrides` text DEFAULT '{}' NOT NULL,
	`targets` text DEFAULT '[]' NOT NULL,
	`deadline` integer,
	`max_attempts` integer,
	`points` integer DEFAULT 0 NOT NULL,
	`reward_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`cancelled_at` integer,
	FOREIGN KEY (`preset_id`) REFERENCES `game_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assignments_created_idx` ON `assignments` (`created_at`);--> statement-breakpoint
ALTER TABLE `plays` ADD `assignment_id` text;