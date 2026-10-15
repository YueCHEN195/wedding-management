ALTER TABLE `rsvps` ADD `edit_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `rsvps_edit_token_hash_unique` ON `rsvps` (`edit_token_hash`);