CREATE TABLE `course_people` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`role` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`student_number` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "course_people_role" CHECK("course_people"."role" IN ('student','instructor'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_people_email` ON `course_people` (`course_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_people_number` ON `course_people` (`course_id`,`student_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_people_identity` ON `course_people` (`id`,`course_id`);--> statement-breakpoint
CREATE INDEX `idx_course_people_access` ON `course_people` (`email`,`role`);--> statement-breakpoint
CREATE TABLE `course_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`phase` text NOT NULL,
	`instructor_id` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`,`course_id`) REFERENCES `course_people`(`id`,`course_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "course_rooms_phase" CHECK("course_rooms"."phase" IN ('before_midterm','after_midterm'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_rooms_name` ON `course_rooms` (`course_id`,`phase`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_rooms_identity` ON `course_rooms` (`id`,`course_id`,`phase`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`academic_year` integer NOT NULL,
	`semester` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_courses_code_term` ON `courses` (`code`,`academic_year`,`semester`);--> statement-breakpoint
CREATE INDEX `idx_courses_owner` ON `courses` (`owner_id`);--> statement-breakpoint
CREATE TABLE `room_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`student_id` text NOT NULL,
	`room_id` text NOT NULL,
	`phase` text NOT NULL,
	FOREIGN KEY (`student_id`,`course_id`) REFERENCES `course_people`(`id`,`course_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`,`course_id`,`phase`) REFERENCES `course_rooms`(`id`,`course_id`,`phase`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_memberships_student_phase` ON `room_memberships` (`course_id`,`student_id`,`phase`);--> statement-breakpoint
CREATE INDEX `idx_room_memberships_room` ON `room_memberships` (`room_id`);
