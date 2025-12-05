import type { FeedViewType } from "@follow/constants"
import type { SupportedActionLanguage } from "@follow/shared/language"
import type { EntrySettings } from "@follow-app/client-sdk"
import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

import type { AttachmentsModel, ExtraModel, ImageColorsResult, MediaModel } from "./types"

export const feedsTable = pgTable("feeds", {
  id: varchar("id", { length: 255 }).primaryKey(),
  title: text("title"),
  url: text("url").notNull(),
  description: text("description"),
  image: text("image"),
  errorAt: text("error_at"),
  siteUrl: text("site_url"),
  ownerUserId: varchar("owner_user_id", { length: 255 }),
  errorMessage: text("error_message"),
  subscriptionCount: integer("subscription_count"),
  updatesPerWeek: integer("updates_per_week"),
  latestEntryPublishedAt: text("latest_entry_published_at"),
  tipUserIds: jsonb("tip_users").$type<string[]>(),
  updatedAt: timestamp("published_at", { mode: "date" }),
})

export const subscriptionsTable = pgTable("subscriptions", {
  feedId: varchar("feed_id", { length: 255 }),
  listId: varchar("list_id", { length: 255 }),
  inboxId: varchar("inbox_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  view: integer("view").notNull().$type<FeedViewType>(),
  isPrivate: boolean("is_private").notNull(),
  hideFromTimeline: boolean("hide_from_timeline"),
  title: text("title"),
  category: text("category"),
  createdAt: text("created_at"),
  type: varchar("type", { length: 50 }).notNull().$type<"feed" | "list" | "inbox">(),
  id: varchar("id", { length: 255 }).primaryKey(),
})

export const inboxesTable = pgTable("inboxes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  title: text("title"),
  secret: text("secret").notNull(),
})

export const listsTable = pgTable("lists", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  title: text("title").notNull(),
  feedIds: jsonb("feed_ids").$type<string>(),
  description: text("description"),
  view: integer("view").notNull().$type<FeedViewType>(),
  image: text("image"),
  fee: integer("fee"),
  ownerUserId: varchar("owner_user_id", { length: 255 }),
  subscriptionCount: integer("subscription_count"),
  purchaseAmount: text("purchase_amount"),
})

export const unreadTable = pgTable("unread", {
  id: varchar("subscription_id", { length: 255 }).notNull().primaryKey(),
  count: integer("count").notNull(),
})

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: text("email"),
  handle: text("handle"),
  name: text("name"),
  image: text("image"),
  isMe: boolean("is_me"),
  emailVerified: boolean("email_verified"),
  bio: text("bio"),
  website: text("website"),
  socialLinks: jsonb("social_links").$type<{
    twitter?: string
    github?: string
    instagram?: string
    facebook?: string
    youtube?: string
    discord?: string
  }>(),
})

export const entriesTable = pgTable("entries", {
  id: varchar("id", { length: 255 }).primaryKey(),
  title: text("title"),
  url: text("url"),
  content: text("content"),
  readabilityContent: text("source_content"),
  readabilityUpdatedAt: timestamp("readability_updated_at", { mode: "date" }),
  description: text("description"),
  guid: text("guid").notNull(),
  author: text("author"),
  authorUrl: text("author_url"),
  authorAvatar: text("author_avatar"),
  insertedAt: timestamp("inserted_at", { mode: "date" }).notNull(),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
  media: jsonb("media").$type<MediaModel[]>(),
  categories: jsonb("categories").$type<string[]>(),
  attachments: jsonb("attachments").$type<AttachmentsModel[]>(),
  extra: jsonb("extra").$type<ExtraModel>(),
  language: text("language"),

  feedId: varchar("feed_id", { length: 255 }),

  inboxHandle: text("inbox_handle"),
  read: boolean("read"),
  sources: jsonb("sources").$type<string[]>(),
  settings: jsonb("settings").$type<EntrySettings>(),
})

export const collectionsTable = pgTable("collections", {
  feedId: varchar("feed_id", { length: 255 }),
  entryId: varchar("entry_id", { length: 255 }).notNull().primaryKey(),
  createdAt: text("created_at"),
  view: integer("view").notNull().$type<FeedViewType>(),
})

export const summariesTable = pgTable(
  "summaries",
  {
    entryId: varchar("entry_id", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    readabilitySummary: text("readability_summary"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    language: varchar("language", { length: 10 }).$type<SupportedActionLanguage>(),
  },
  (t) => [uniqueIndex("unq").on(t.entryId, t.language)],
)

export const translationsTable = pgTable(
  "translations",
  (t) => ({
    entryId: t.varchar("entry_id", { length: 255 }).notNull(),
    language: t.varchar("language", { length: 10 }).$type<SupportedActionLanguage>().notNull(),
    title: t.text("title"),
    description: t.text("description"),
    content: t.text("content"),
    readabilityContent: t.text("readability_content"),
    createdAt: t
      .text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  }),
  (t) => [uniqueIndex("translation-unique-index").on(t.entryId, t.language)],
)

export const imagesTable = pgTable("images", (t) => ({
  url: t.text("url").notNull().primaryKey(),
  colors: t.jsonb("colors").$type<ImageColorsResult>().notNull(),
  createdAt: t
    .timestamp("created_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
}))

// AI Chat Sessions Table
export const aiChatTable = pgTable(
  "ai_chat_sessions",
  (t) => ({
    chatId: t.varchar("id", { length: 255 }).notNull().primaryKey(),
    title: t.text("title"),
    createdAt: t
      .timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: t
      .timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  }),
  (table) => [index("idx_ai_chat_sessions_updated_at").on(table.updatedAt)],
)

// Message Part types based on Vercel AI SDK UIMessage parts
interface TextUIPart {
  type: "text"
  text: string
}

interface ReasoningUIPart {
  type: "reasoning"
  reasoning: string
}

interface ToolInvocationUIPart {
  type: "tool-invocation"
  toolInvocation: {
    state: "partial-call" | "call" | "result"
    toolCallId: string
    toolName: string
    args: any
    result?: any
  }
}

interface SourceUIPart {
  type: "source"
  source: {
    sourceType: "url"
    id: string
    url: string
    title?: string
  }
}

interface StepStartUIPart {
  type: "step-start"
}

type UIMessagePart =
  | TextUIPart
  | ReasoningUIPart
  | ToolInvocationUIPart
  | SourceUIPart
  | StepStartUIPart

// AI Chat Messages Table - Rich text support
export const aiChatMessagesTable = pgTable(
  "ai_chat_messages",
  (t) => ({
    id: t.varchar("id", { length: 255 }).notNull().primaryKey(),
    chatId: t
      .varchar("chat_id", { length: 255 })
      .notNull()
      .references(() => aiChatTable.chatId, { onDelete: "cascade" }),

    role: t.varchar("role", { length: 20 }).notNull().$type<"user" | "assistant" | "system">(),

    createdAt: t.timestamp("created_at", { mode: "date" }),
    metadata: t.jsonb("metadata").$type<any>(),

    status: t
      .varchar("status", { length: 20 })
      .$type<"pending" | "streaming" | "completed" | "error">()
      .default("completed"),
    finishedAt: t.timestamp("finished_at", { mode: "date" }),

    // Store UIMessage parts for complex assistant responses (tools, reasoning, etc)
    messageParts: t.jsonb("message_parts").$type<UIMessagePart[]>(),
  }),
  (table) => [
    index("idx_ai_chat_messages_chat_id_created_at").on(table.chatId, table.createdAt),
    index("idx_ai_chat_messages_status").on(table.status),
    index("idx_ai_chat_messages_chat_id_role").on(table.chatId, table.role),
  ],
)
