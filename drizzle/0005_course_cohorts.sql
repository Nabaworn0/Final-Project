ALTER TABLE `course_people` ADD `cohort` text;
--> statement-breakpoint
ALTER TABLE `course_rooms` ADD `cohort` text;
--> statement-breakpoint
CREATE INDEX `idx_course_people_cohort` ON `course_people` (`course_id`,`cohort`);
--> statement-breakpoint
CREATE INDEX `idx_course_rooms_cohort` ON `course_rooms` (`course_id`,`cohort`);
