ALTER TABLE `gifts` ADD `submission_key_hash` text;--> statement-breakpoint
ALTER TABLE `gifts` ADD `submission_payload_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `gifts_submission_key_hash_unique` ON `gifts` (`submission_key_hash`);