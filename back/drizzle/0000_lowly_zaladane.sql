CREATE TYPE "public"."role" AS ENUM('participant', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."university" AS ENUM('pucrs', 'merida');--> statement-breakpoint
CREATE TABLE "event_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"university" "university" NOT NULL,
	"allowed_email_suffixes" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"university" "university" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_lower_email_idx" ON "users" USING btree (lower("email"));