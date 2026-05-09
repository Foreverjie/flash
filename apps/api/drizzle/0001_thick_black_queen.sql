CREATE TABLE "feed_topics" (
	"feed_id" varchar(255) NOT NULL,
	"topic_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"color" varchar(32),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scrape_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scrape_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scrape_error" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scraped_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_topics" ADD CONSTRAINT "feed_topics_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_topics" ADD CONSTRAINT "feed_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_topics_feed_topic_idx" ON "feed_topics" USING btree ("feed_id","topic_id");--> statement-breakpoint
CREATE INDEX "feed_topics_topic_id_idx" ON "feed_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topics_sort_order_idx" ON "topics" USING btree ("sort_order");