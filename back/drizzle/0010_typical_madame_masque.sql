DROP INDEX "teams_lower_name_idx";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_lower_name_idx" ON "teams" USING btree (lower("name")) WHERE "teams"."removed_at" IS NULL;