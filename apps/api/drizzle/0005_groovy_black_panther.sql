ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp;
--> statement-breakpoint
-- Backfill: existing accounts predate onboarding tracking, so treat them as
-- already onboarded to avoid replaying the flow on their next login.
UPDATE "users" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;