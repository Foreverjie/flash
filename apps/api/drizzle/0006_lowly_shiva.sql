ALTER TABLE "subscriptions" ADD COLUMN "view" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "subscriptions"
SET "view" = CASE "feeds"."adapter_type"
	WHEN 'x_timeline' THEN 1
	WHEN 'bilibili_up_video' THEN 3
	ELSE 0
END
FROM "feeds"
WHERE "subscriptions"."feed_id" = "feeds"."id";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "hide_from_timeline" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "subscriptions_user_view_idx" ON "subscriptions" USING btree ("user_id","view");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_view_check" CHECK ("subscriptions"."view" between 0 and 5);
