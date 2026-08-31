CREATE TYPE "public"."submission_case_status" AS ENUM('passed', 'failed', 'timeout', 'error');--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"workspace" jsonb NOT NULL,
	"generated_code" text NOT NULL,
	"case_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_team_problem_attempt_idx" ON "submissions" USING btree ("team_id","problem_id","attempt_number") WHERE "submissions"."team_id" is not null;--> statement-breakpoint
CREATE INDEX "submissions_team_problem_score_idx" ON "submissions" USING btree ("team_id","problem_id","score" desc,"created_at" asc) WHERE "submissions"."team_id" is not null;