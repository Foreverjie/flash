import { Hono } from "hono"

import { structuredSuccess } from "../utils/response.js"

const ai = new Hono()

/**
 * POST /ai/summary
 * Generate AI summary for an entry
 */
ai.post("/summary", async (c) => {
  const body = await c.req.json<{
    id: string
    language?: string
    target?: "content" | "readabilityContent"
  }>()

  // Mock AI summary generation
  const mockSummary = `This is an AI-generated summary of the content with ID ${body.id}. 
The summary is generated in ${body.language || "auto"} language for the ${body.target || "content"} field.`

  return c.json(structuredSuccess(mockSummary))
})

/**
 * POST /ai/translation
 * Translate entry fields
 */
ai.post("/translation", async (c) => {
  const body = await c.req.json<{
    id: string
    language: string
    fields: string
    part?: string
  }>()

  // Mock translation
  const translatedData: Record<string, string> = {}
  const fields = body.fields.split(",")

  for (const field of fields) {
    translatedData[field] = `[Translated to ${body.language}] Original ${field} content`
  }

  return c.json(structuredSuccess(translatedData))
})

/**
 * POST /ai/chat
 * AI chat endpoint (streaming)
 */
ai.post("/chat", async (c) => {
  const body = await c.req.json<{
    messages: Array<{ role: string; content: string }>
    model?: string
    context?: {
      mainEntryId?: string
      referEntryIds?: string[]
      referFeedIds?: string[]
      selectedText?: string
    }
  }>()

  // Mock streaming response
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const mockResponse = `AI response to: ${body.messages.at(-1)?.content || "message"}`

      // Simulate streaming chunks
      const chunks = mockResponse.match(/.{1,10}/g) || []

      let index = 0
      const interval = setInterval(() => {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]))
          index++
        } else {
          clearInterval(interval)
          controller.close()
        }
      }, 50)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  })
})

/**
 * POST /ai/summary-title
 * Generate title for AI summary
 */
ai.post("/summary-title", async (c) => {
  await c.req.json<{
    messages: Array<{ role: string; content: string }>
  }>()

  // Mock title generation
  return c.json(
    structuredSuccess({
      title: "AI Generated Title",
      remainingTokens: 95000,
    }),
  )
})

/**
 * POST /ai/daily
 * Generate daily digest
 */
ai.post("/daily", async (c) => {
  const body = await c.req.json<{
    startDate: string
    view: "0" | "1"
  }>()

  const mockDigest =
    `Daily digest for ${body.startDate} in view ${body.view}:\n\n` +
    "1. Important update from Feed A\n" +
    "2. Breaking news from Feed B\n" +
    "3. Interesting article from Feed C"

  return c.json(structuredSuccess(mockDigest))
})

/**
 * GET /ai/config
 * Get AI configuration and usage limits
 */
ai.get("/config", (c) => {
  return c.json(
    structuredSuccess({
      defaultModel: "openai/gpt-4o-mini",
      availableModels: ["openai/gpt-4o-mini", "openai/gpt-4o", "anthropic/claude-3-5-sonnet"],
      modelBillingStrategy: {
        "openai/gpt-4o-mini": 1,
        "openai/gpt-4o": 10,
        "anthropic/claude-3-5-sonnet": 8,
      },
      rateLimit: {
        maxTokens: 100000,
        currentTokens: 5000,
        remainingTokens: 95000,
        windowDuration: 86400,
        windowResetTime: Date.now() + 86400000,
        usageRate: 0.05,
        projectedLimitTime: null,
        warningLevel: "normal",
      },
      attachmentLimits: {
        maxFiles: 10,
        remainingFiles: 8,
        windowDuration: 86400,
        windowResetTime: Date.now() + 86400000,
      },
      usage: {
        total: 100000,
        used: 5000,
        remaining: 95000,
        resetAt: new Date(Date.now() + 86400000),
      },
    }),
  )
})

export default ai
