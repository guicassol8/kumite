CREATE TYPE "public"."problem_visibility" AS ENUM('round', 'practice');--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "visibility" "problem_visibility" DEFAULT 'round' NOT NULL;