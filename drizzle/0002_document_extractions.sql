CREATE TABLE `document_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`format` text NOT NULL,
	`page_count` integer,
	`extracted_text` text NOT NULL,
	`confidence` text NOT NULL,
	`warnings` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `lesson_plan_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_extractions_plan_version` ON `document_extractions` (`plan_version_id`);
