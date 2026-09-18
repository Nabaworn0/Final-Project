CREATE TABLE `weekly_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`student_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`week` integer NOT NULL,
	`comment` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`,`course_id`) REFERENCES `course_people`(`id`,`course_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_feedback_entry` ON `weekly_feedback` (`course_id`,`student_id`,`instructor_id`,`week`);--> statement-breakpoint
CREATE INDEX `idx_weekly_feedback_student` ON `weekly_feedback` (`course_id`,`student_id`);
