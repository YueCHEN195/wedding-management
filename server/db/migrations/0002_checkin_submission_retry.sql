CREATE TABLE `checkin_submissions` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`payload_hash` text NOT NULL,
	`checkin_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE cascade
);
