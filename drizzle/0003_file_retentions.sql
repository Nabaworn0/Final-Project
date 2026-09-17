CREATE TABLE `file_retentions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`file_key` text NOT NULL,
	`delete_after` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `lesson_plan_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_file_retentions_plan_version` ON `file_retentions` (`plan_version_id`);
--> statement-breakpoint
CREATE INDEX `idx_file_retentions_delete_after` ON `file_retentions` (`delete_after`);
--> statement-breakpoint
INSERT OR IGNORE INTO `file_retentions` (`id`, `plan_version_id`, `file_key`, `delete_after`, `deleted_at`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, `source_file_key`, `created_at` + 15552000000, NULL, `created_at`
FROM `lesson_plan_versions` WHERE `source_file_key` IS NOT NULL;
