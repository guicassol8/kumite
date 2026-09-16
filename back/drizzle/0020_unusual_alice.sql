DROP INDEX "submissions_team_problem_score_idx";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "accepted_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "submissions_team_problem_score_idx" ON "submissions" USING btree ("team_id","problem_id","score" desc,"accepted_at" asc);