/**
 * Posts Routes
 * Public post listing and detail endpoints (no auth required)
 */
import { zValidator } from "@hono/zod-validator"
import { desc, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db, feeds, posts } from "../db/index.js"
import { structuredSuccess } from "../utils/response.js"

const postsRouter = new Hono()

/**
 * GET /posts
 * Public timeline — recent posts across all feeds, with feed metadata.
 */
postsRouter.get(
  "/",
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
      feedId: z.string().optional(),
    }),
  ),
  async (c) => {
    const { page, limit, feedId } = c.req.valid("query")
    const offset = (page - 1) * limit

    const whereClause = feedId ? eq(posts.feedId, feedId) : undefined

    // Fetch posts joined with feed info, ordered by latest first
    const postsList = await db
      .select({
        id: posts.id,
        feedId: posts.feedId,
        guid: posts.guid,
        title: posts.title,
        url: posts.url,
        description: posts.description,
        content: posts.content,
        author: posts.author,
        authorUrl: posts.authorUrl,
        authorAvatar: posts.authorAvatar,
        publishedAt: posts.publishedAt,
        insertedAt: posts.insertedAt,
        categories: posts.categories,
        media: posts.media,
        // Feed info
        feedTitle: feeds.title,
        feedSiteUrl: feeds.siteUrl,
        feedImage: feeds.image,
      })
      .from(posts)
      .leftJoin(feeds, eq(posts.feedId, feeds.id))
      .where(whereClause)
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset)

    const countQuery = feedId
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(posts)
          .where(eq(posts.feedId, feedId))
      : db.select({ count: sql<number>`count(*)::int` }).from(posts)
    const [countResult] = await countQuery
    const total = countResult?.count ?? 0

    return c.json(
      structuredSuccess({
        data: postsList,
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      }),
    )
  },
)

/**
 * GET /posts/:id
 * Get a single post by ID with feed metadata.
 */
postsRouter.get("/:id", zValidator("param", z.object({ id: z.string().min(1) })), async (c) => {
  const { id } = c.req.valid("param")

  const [post] = await db
    .select({
      id: posts.id,
      feedId: posts.feedId,
      guid: posts.guid,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      content: posts.content,
      author: posts.author,
      authorUrl: posts.authorUrl,
      authorAvatar: posts.authorAvatar,
      formattedContent: posts.formattedContent,
      publishedAt: posts.publishedAt,
      insertedAt: posts.insertedAt,
      categories: posts.categories,
      media: posts.media,
      attachments: posts.attachments,
      language: posts.language,
      extra: posts.extra,
      // Feed info
      feedTitle: feeds.title,
      feedSiteUrl: feeds.siteUrl,
      feedImage: feeds.image,
    })
    .from(posts)
    .leftJoin(feeds, eq(posts.feedId, feeds.id))
    .where(eq(posts.id, id))
    .limit(1)

  if (!post) {
    return c.json({ code: 404, message: "Post not found" }, 404)
  }

  return c.json(structuredSuccess({ post }))
})

export default postsRouter
