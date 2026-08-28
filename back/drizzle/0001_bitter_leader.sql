CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('pt', 'es', 'en');--> statement-breakpoint
CREATE TYPE "public"."problem_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "problem_translations" (
	"problem_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"statement_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_translations_problem_id_locale_pk" PRIMARY KEY("problem_id","locale")
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"points" integer DEFAULT 100 NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"status" "problem_status" NOT NULL,
	"test_cases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_translations" ADD CONSTRAINT "problem_translations_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;