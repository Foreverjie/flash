CREATE TABLE "ai_chat_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"created_at" timestamp,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'completed',
	"finished_at" timestamp,
	"message_parts" jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_chat_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"feed_id" varchar(255),
	"entry_id" varchar(255) PRIMARY KEY NOT NULL,
	"created_at" text,
	"view" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" text,
	"url" text,
	"content" text,
	"source_content" text,
	"readability_updated_at" timestamp,
	"description" text,
	"guid" text NOT NULL,
	"author" text,
	"author_url" text,
	"author_avatar" text,
	"inserted_at" timestamp NOT NULL,
	"published_at" timestamp NOT NULL,
	"media" jsonb,
	"categories" jsonb,
	"attachments" jsonb,
	"extra" jsonb,
	"language" text,
	"feed_id" varchar(255),
	"inbox_handle" text,
	"read" boolean,
	"sources" jsonb,
	"settings" jsonb
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" text,
	"url" text NOT NULL,
	"description" text,
	"image" text,
	"error_at" text,
	"site_url" text,
	"owner_user_id" varchar(255),
	"error_message" text,
	"subscription_count" integer,
	"updates_per_week" integer,
	"latest_entry_published_at" text,
	"tip_users" jsonb,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "images" (
	"url" text PRIMARY KEY NOT NULL,
	"colors" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" text,
	"secret" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"title" text NOT NULL,
	"feed_ids" jsonb,
	"description" text,
	"view" integer NOT NULL,
	"image" text,
	"fee" integer,
	"owner_user_id" varchar(255),
	"subscription_count" integer,
	"purchase_amount" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"feed_id" varchar(255),
	"list_id" varchar(255),
	"inbox_id" varchar(255),
	"user_id" varchar(255) NOT NULL,
	"view" integer NOT NULL,
	"is_private" boolean NOT NULL,
	"hide_from_timeline" boolean,
	"title" text,
	"category" text,
	"created_at" text,
	"type" varchar(50) NOT NULL,
	"id" varchar(255) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"entry_id" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"readability_summary" text,
	"created_at" text,
	"language" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"entry_id" varchar(255) NOT NULL,
	"language" varchar(10) NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"readability_content" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unread" (
	"subscription_id" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" text,
	"handle" text,
	"name" text,
	"image" text,
	"is_me" boolean,
	"email_verified" boolean,
	"bio" text,
	"website" text,
	"social_links" jsonb
);
--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_chat_id_ai_chat_sessions_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_chat_id_created_at" ON "ai_chat_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_status" ON "ai_chat_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_chat_id_role" ON "ai_chat_messages" USING btree ("chat_id","role");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_sessions_updated_at" ON "ai_chat_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq" ON "summaries" USING btree ("entry_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "translation-unique-index" ON "translations" USING btree ("entry_id","language");