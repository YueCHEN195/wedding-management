CREATE TABLE `operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` integer NOT NULL,
	`actor_name` text NOT NULL,
	`actor_role` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `gifts` ADD `voided_at` integer;--> statement-breakpoint
ALTER TABLE `guests` ADD `archived_at` integer;