CREATE TYPE "public"."round_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "round_problems" (
	"round_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "round_problems_round_id_problem_id_pk" PRIMARY KEY("round_id","problem_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "round_status" DEFAULT 'draft' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"opened_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round_problems" ADD CONSTRAINT "round_problems_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_problems" ADD CONSTRAINT "round_problems_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "round_problems_round_id_position_idx" ON "round_problems" USING btree ("round_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_single_open_idx" ON "rounds" USING btree ((true)) WHERE "rounds"."status" = 'open';