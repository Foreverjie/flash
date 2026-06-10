CREATE TABLE "starter_pack_feeds" (
	"pack_id" varchar(255) NOT NULL,
	"feed_id" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "starter_packs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(32),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "starter_packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "starter_pack_feeds" ADD CONSTRAINT "starter_pack_feeds_pack_id_starter_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."starter_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_pack_feeds" ADD CONSTRAINT "starter_pack_feeds_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "starter_pack_feeds_pack_feed_idx" ON "starter_pack_feeds" USING btree ("pack_id","feed_id");--> statement-breakpoint
CREATE INDEX "starter_pack_feeds_pack_id_idx" ON "starter_pack_feeds" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "starter_packs_sort_order_idx" ON "starter_packs" USING btree ("sort_order");