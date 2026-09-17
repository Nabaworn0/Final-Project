CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_version_id` text NOT NULL,
	`analyzer_type` text NOT NULL,
	`rubric_version` text NOT NULL,
	`structure_score` integer NOT NULL,
	`alignment_score` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_version_id`) REFERENCES `lesson_plan_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_plan_version` ON `analysis_runs` (`plan_version_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `criterion_results` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_run_id` text NOT NULL,
	`code` text NOT NULL,
	`stage` text NOT NULL,
	`title` text NOT NULL,
	`score` integer NOT NULL,
	`status` text NOT NULL,
	`rationale` text NOT NULL,
	`evidence` text NOT NULL,
	`suggestion` text NOT NULL,
	`confidence` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_criterion_results_analysis` ON `criterion_results` (`analysis_run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_criterion_results_analysis_code` ON `criterion_results` (`analysis_run_id`,`code`);--> statement-breakpoint
CREATE TABLE `lesson_plan_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`objectives` text NOT NULL,
	`motivation` text NOT NULL,
	`information` text NOT NULL,
	`application` text NOT NULL,
	`progress` text NOT NULL,
	`assessment` text NOT NULL,
	`time_allocation` text NOT NULL,
	`source_file_key` text,
	`source_file_name` text,
	`source_mime_type` text,
	`source_file_size` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `lesson_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lesson_plan_versions_plan_version` ON `lesson_plan_versions` (`plan_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `lesson_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`learner_level` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`status` text DEFAULT 'analyzed' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_lesson_plans_owner_updated` ON `lesson_plans` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_lesson_plans_status` ON `lesson_plans` (`status`);