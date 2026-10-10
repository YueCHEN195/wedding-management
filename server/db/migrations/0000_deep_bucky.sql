CREATE TABLE `checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_id` integer,
	`guest_name` text NOT NULL,
	`source` text DEFAULT 'self' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`submitted_at` integer NOT NULL,
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_id` integer,
	`guest_name` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`note` text,
	`checkin_id` integer,
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`salutation` text,
	`phone` text,
	`group_name` text,
	`side` text,
	`invite_token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`invited_at` integer,
	`viewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_invite_token_unique` ON `guests` (`invite_token`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_id` integer,
	`guest_name` text NOT NULL,
	`attending` text NOT NULL,
	`headcount` integer DEFAULT 1 NOT NULL,
	`children_count` integer DEFAULT 0 NOT NULL,
	`message` text,
	`source` text DEFAULT 'link' NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`client_info` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);