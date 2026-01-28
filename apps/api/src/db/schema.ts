/**
 * Database Schema Definitions
 * Includes Better-auth standard tables and custom application tables
 */
import { relations, sql } from "drizzle-orm"
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

// ============================================================
// Better-auth Standard Tables
// ============================================================

/**
 * Users table - Better-auth standard with additional fields
 */
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
  // Better-auth twoFactor plugin fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  // Additional custom fields
  handle: varchar("handle", { length: 50 }).unique(),
  bio: text("bio"),
  website: text("website"),
  socialLinks: jsonb("social_links").$type<{
    twitter?: string
    github?: string
    instagram?: string
    youtube?: string
    discord?: string
  }>(),
  role: varchar("role", { length: 20 }).default("user"),
  // Better-auth admin plugin fields
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),
  // Better-auth anonymous plugin fields
  isAnonymous: boolean("is_anonymous"),
})

/**
 * Sessions table - Better-auth standard
 */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Better-auth admin impersonation
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
)

/**
 * Accounts table - Better-auth standard for OAuth providers
 */
export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
  ],
)

/**
 * Verifications table - Better-auth standard for email verification, password reset, etc.
 */
export const verifications = pgTable(
  "verifications",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" }).default(sql`now()`),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
)

/**
 * Two-factor authentication table - Better-auth twoFactor plugin
 */
export const twoFactors = pgTable(
  "two_factors",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("two_factors_user_id_idx").on(table.userId)],
)

// ============================================================
// Application Tables
// ============================================================

/**
 * Feeds table - RSS source information
 */
export const feeds = pgTable(
  "feeds",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    url: text("url").notNull().unique(),
    title: text("title"),
    description: text("description"),
    siteUrl: text("site_url"),
    image: text("image"),
    language: varchar("language", { length: 10 }),
    // RSS metadata
    lastFetchedAt: timestamp("last_fetched_at", { mode: "date" }),
    lastBuildDate: timestamp("last_build_date", { mode: "date" }),
    ttl: integer("ttl"), // Cache time in minutes
    // Adapter configuration
    adapterType: varchar("adapter_type", { length: 50 }).default("default"),
    adapterConfig: jsonb("adapter_config").$type<Record<string, unknown>>(),
    // Status
    errorAt: timestamp("error_at", { mode: "date" }),
    errorMessage: text("error_message"),
    // Stats
    subscriptionCount: integer("subscription_count").default(0),
    updatesPerWeek: integer("updates_per_week"),
    // Ownership
    ownerUserId: varchar("owner_user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("feeds_owner_user_id_idx").on(table.ownerUserId),
    index("feeds_last_fetched_at_idx").on(table.lastFetchedAt),
  ],
)

/**
 * Posts table - Fetched and formatted RSS entries
 */
export const posts = pgTable(
  "posts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    feedId: varchar("feed_id", { length: 255 })
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    // Core content
    guid: text("guid").notNull(),
    title: text("title"),
    url: text("url"),
    description: text("description"),
    content: text("content"), // Raw HTML content
    author: text("author"),
    authorUrl: text("author_url"),
    authorAvatar: text("author_avatar"),
    // Formatted content (JSONB for structured data)
    formattedContent: jsonb("formatted_content").$type<{
      html?: string
      markdown?: string
      text?: string
      images?: Array<{
        url: string
        alt?: string
        width?: number
        height?: number
      }>
      videos?: Array<{
        url: string
        thumbnail?: string
        duration?: number
      }>
      links?: Array<{
        url: string
        title?: string
        type?: string
      }>
      metadata?: Record<string, unknown>
    }>(),
    // Media
    media: jsonb("media").$type<
      Array<{
        url: string
        type: "image" | "video" | "audio"
        width?: number
        height?: number
        duration?: number
        blurhash?: string
      }>
    >(),
    attachments: jsonb("attachments").$type<
      Array<{
        url: string
        title?: string
        mimeType?: string
        size?: number
      }>
    >(),
    categories: jsonb("categories").$type<string[]>(),
    // Dates
    publishedAt: timestamp("published_at", { mode: "date" }),
    insertedAt: timestamp("inserted_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    // Extra data
    language: varchar("language", { length: 10 }),
    extra: jsonb("extra").$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex("posts_feed_guid_idx").on(table.feedId, table.guid),
    index("posts_feed_id_idx").on(table.feedId),
    index("posts_published_at_idx").on(table.publishedAt),
  ],
)

/**
 * Subscriptions table - User to Feed associations
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: varchar("feed_id", { length: 255 })
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    // Customization
    title: text("title"), // User's custom title
    category: text("category"),
    tags: jsonb("tags").$type<string[]>(),
    // Settings
    isPrivate: boolean("is_private").default(false),
    notify: boolean("notify").default(true),
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("subscriptions_user_feed_idx").on(table.userId, table.feedId),
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_feed_id_idx").on(table.feedId),
  ],
)

/**
 * Comments table - User comments on posts
 */
export const comments = pgTable(
  "comments",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    postId: varchar("post_id", { length: 255 })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: varchar("parent_id", { length: 255 }),
    content: text("content").notNull(),
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("comments_post_id_idx").on(table.postId),
    index("comments_user_id_idx").on(table.userId),
    index("comments_parent_id_idx").on(table.parentId),
  ],
)

/**
 * Read status table - Track user's read posts
 */
export const readStatus = pgTable(
  "read_status",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: varchar("post_id", { length: 255 })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("read_status_user_post_idx").on(table.userId, table.postId),
    index("read_status_user_id_idx").on(table.userId),
  ],
)

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactors: many(twoFactors),
  subscriptions: many(subscriptions),
  comments: many(comments),
  readStatus: many(readStatus),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}))

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  owner: one(users, {
    fields: [feeds.ownerUserId],
    references: [users.id],
  }),
  posts: many(posts),
  subscriptions: many(subscriptions),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  feed: one(feeds, {
    fields: [posts.feedId],
    references: [feeds.id],
  }),
  comments: many(comments),
  readStatus: many(readStatus),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  feed: one(feeds, {
    fields: [subscriptions.feedId],
    references: [feeds.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
  replies: many(comments),
}))

export const readStatusRelations = relations(readStatus, ({ one }) => ({
  user: one(users, {
    fields: [readStatus.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [readStatus.postId],
    references: [posts.id],
  }),
}))

// ============================================================
// Types
// ============================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Feed = typeof feeds.$inferSelect
export type NewFeed = typeof feeds.$inferInsert
export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert
export type TwoFactor = typeof twoFactors.$inferSelect
export type NewTwoFactor = typeof twoFactors.$inferInsert
