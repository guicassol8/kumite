ALTER TABLE "submissions" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_round_problem_team_idx" ON "submissions" USING btree ("round_id","problem_id","team_id");