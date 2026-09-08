CREATE TYPE "public"."password_reset_action" AS ENUM('request', 'complete');--> statement-breakpoint
CREATE TABLE "password_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "password_reset_action" NOT NULL,
	"email_key" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "password_reset_requests_email_idx" ON "password_reset_requests" USING btree ("action","email_key","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_requests_ip_idx" ON "password_reset_requests" USING btree ("action","ip","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_requests_created_at_idx" ON "password_reset_requests" USING btree ("created_at");