CREATE TABLE `midterm_committees` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`cohort` text NOT NULL,
	`group_number` integer NOT NULL,
	`slot` integer NOT NULL,
	`instructor_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`,`course_id`) REFERENCES `course_people`(`id`,`course_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_midterm_committee_slot` ON `midterm_committees` (`course_id`,`cohort`,`group_number`,`slot`);
