/**
 * Comments Routes
 * Comment management for posts
 */
import { zValidator } from "@hono/zod-validator"
import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { comments, db, posts } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { logger } from "../utils/logger.js"
import { sendError, sendNotFound, structuredSuccess } from "../utils/response.js"

// Helper to generate IDs
const generateId = () => `comment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

// Route types
type CommentsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

// Validation schemas
const createCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1, "Comment cannot be empty").max(5000),
  parentId: z.string().optional(),
})

const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
})

const commentsRouter = new Hono<{ Variables: CommentsVariables }>()

/**
 * GET /comments/post/:postId
 * Get comments for a post
 */
commentsRouter.get(
  "/post/:postId",
  zValidator("param", z.object({ postId: z.string().min(1) })),
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
      parentId: z.string().optional(),
    }),
  ),
  async (c) => {
    const { postId } = c.req.valid("param")
    const { page, limit, parentId } = c.req.valid("query")
    const offset = (page - 1) * limit

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    })

    if (!post) {
      return sendNotFound(c, "Post")
    }

    // Get comments with user info
    const whereConditions = parentId
      ? and(eq(comments.postId, postId), eq(comments.parentId, parentId))
      : and(eq(comments.postId, postId), isNull(comments.parentId))

    const postComments = await db.query.comments.findMany({
      where: whereConditions,
      limit,
      offset,
      orderBy: (comments, { desc }) => [desc(comments.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            handle: true,
            image: true,
          },
        },
        replies: {
          limit: 3,
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                handle: true,
                image: true,
              },
            },
          },
        },
      },
    })

    const totalComments = await db.query.comments.findMany({
      where: whereConditions,
    })

    return c.json(
      structuredSuccess({
        data: postComments,
        page,
        limit,
        total: totalComments.length,
        hasMore: offset + limit < totalComments.length,
      }),
    )
  },
)

/**
 * GET /comments/:id
 * Get a single comment by ID
 */
commentsRouter.get("/:id", zValidator("param", z.object({ id: z.string().min(1) })), async (c) => {
  const { id } = c.req.valid("param")

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, id),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          handle: true,
          image: true,
        },
      },
      replies: {
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              handle: true,
              image: true,
            },
          },
        },
      },
    },
  })

  if (!comment) {
    return sendNotFound(c, "Comment")
  }

  return c.json(structuredSuccess({ comment }))
})

/**
 * POST /comments
 * Create a new comment
 */
commentsRouter.post("/", requireAuth, zValidator("json", createCommentSchema), async (c) => {
  try {
    const user = c.get("user")
    const { postId, content, parentId } = c.req.valid("json")

    if (!user) {
      return sendError(c, "User not found", 401, 401)
    }

    // Check if post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    })

    if (!post) {
      return sendNotFound(c, "Post")
    }

    // If parentId provided, check if parent comment exists
    if (parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: eq(comments.id, parentId),
      })

      if (!parentComment) {
        return sendNotFound(c, "Parent comment")
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.postId !== postId) {
        return sendError(c, "Parent comment does not belong to this post", 400, 400)
      }
    }

    // Create comment
    const [comment] = await db
      .insert(comments)
      .values({
        id: generateId(),
        postId,
        userId: user.id,
        parentId: parentId || null,
        content,
      })
      .returning()

    if (!comment) {
      return sendError(c, "Failed to create comment", 500, 500)
    }

    // Fetch with user info
    const newComment = await db.query.comments.findFirst({
      where: eq(comments.id, comment.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            handle: true,
            image: true,
          },
        },
      },
    })

    logger.info(`[Comments] New comment created by user ${user.id} on post ${postId}`)

    return c.json(structuredSuccess({ comment: newComment }), 201)
  } catch (error) {
    logger.error("[Comments] Create error:", error)
    return sendError(c, "Failed to create comment", 500, 500)
  }
})

/**
 * PATCH /comments/:id
 * Update a comment
 */
commentsRouter.patch(
  "/:id",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  zValidator("json", updateCommentSchema),
  async (c) => {
    try {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const { content } = c.req.valid("json")

      if (!user) {
        return sendError(c, "User not found", 401, 401)
      }

      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, id),
      })

      if (!comment) {
        return sendNotFound(c, "Comment")
      }

      // Check ownership (only author or admin can update)
      if (comment.userId !== user.id && user.role !== "admin") {
        return sendError(c, "Not authorized to update this comment", 403, 403)
      }

      const [updatedComment] = await db
        .update(comments)
        .set({
          content,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, id))
        .returning()

      if (!updatedComment) {
        return sendError(c, "Failed to update comment", 500, 500)
      }

      // Fetch with user info
      const result = await db.query.comments.findFirst({
        where: eq(comments.id, updatedComment.id),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              handle: true,
              image: true,
            },
          },
        },
      })

      logger.info(`[Comments] Comment updated: ${id} by user ${user.id}`)

      return c.json(structuredSuccess({ comment: result }))
    } catch (error) {
      logger.error("[Comments] Update error:", error)
      return sendError(c, "Failed to update comment", 500, 500)
    }
  },
)

/**
 * DELETE /comments/:id
 * Delete a comment
 */
commentsRouter.delete(
  "/:id",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  async (c) => {
    try {
      const user = c.get("user")
      const { id } = c.req.valid("param")

      if (!user) {
        return sendError(c, "User not found", 401, 401)
      }

      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, id),
      })

      if (!comment) {
        return sendNotFound(c, "Comment")
      }

      // Check ownership (only author or admin can delete)
      if (comment.userId !== user.id && user.role !== "admin") {
        return sendError(c, "Not authorized to delete this comment", 403, 403)
      }

      // Delete comment (cascades to replies due to FK)
      await db.delete(comments).where(eq(comments.id, id))

      logger.info(`[Comments] Comment deleted: ${id} by user ${user.id}`)

      return c.json(structuredSuccess({ message: "Comment deleted successfully" }))
    } catch (error) {
      logger.error("[Comments] Delete error:", error)
      return sendError(c, "Failed to delete comment", 500, 500)
    }
  },
)

export default commentsRouter
