ALTER TABLE "submissions" DROP CONSTRAINT "submissions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_team_id_teams_id_fk";
--> statement-breakpoint
DROP INDEX "submissions_team_problem_attempt_idx";--> statement-breakpoint
DROP INDEX "submissions_team_problem_score_idx";--> statement-breakpoint
DELETE FROM "submissions" WHERE "team_id" IS NULL OR "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_team_problem_attempt_idx" ON "submissions" USING btree ("team_id","problem_id","attempt_number");--> statement-breakpoint
CREATE INDEX "submissions_team_problem_score_idx" ON "submissions" USING btree ("team_id","problem_id","score" desc,"created_at" asc);