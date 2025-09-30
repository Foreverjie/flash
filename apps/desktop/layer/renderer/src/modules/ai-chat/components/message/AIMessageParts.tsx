import "@xyflow/react/dist/style.css"

import { alwaysFalse } from "@follow/utils"
import { ErrorBoundary } from "@sentry/react"
import type { ReasoningUIPart, TextUIPart, ToolUIPart } from "ai"
import * as React from "react"

import type {
  AIDisplayEntriesTool,
  AIDisplayFeedTool,
  AIDisplayFlowTool,
  AIDisplaySubscriptionsTool,
  BizUIMessage,
  BizUITools,
} from "~/modules/ai-chat/store/types"

import { useChatStatus } from "../../store/hooks"
import {
  AIChainOfThought,
  AIDisplayEntriesPart,
  AIDisplayFeedPart,
  AIDisplaySubscriptionsPart,
} from "../displays"
import type { ChainReasoningPart } from "../displays/AIChainOfThought"
import { AIMarkdownStreamingMessage } from "./AIMarkdownMessage"
import { ToolInvocationComponent } from "./ToolInvocationComponent"

const LazyAIDisplayFlowPart = React.lazy(() =>
  import("../displays/AIDisplayFlowPart").then((mod) => ({ default: mod.AIDisplayFlowPart })),
)

interface AIMessagePartsProps {
  message: BizUIMessage
  isLastMessage: boolean
}

export const AIMessageParts: React.FC<AIMessagePartsProps> = React.memo(
  ({ message, isLastMessage }) => {
    const [shouldStreamingAnimation, setShouldStreamingAnimation] = React.useState(false)
    const chatStatus = useChatStatus()

    React.useEffect(() => {
      // Delay 2s to set shouldStreamingAnimation
      const timerId = setTimeout(() => {
        setShouldStreamingAnimation(true)
      }, 2000)
      return () => clearTimeout(timerId)
    }, [])

    const shouldMessageAnimation = React.useMemo(() => {
      return chatStatus === "streaming" && shouldStreamingAnimation && isLastMessage
    }, [chatStatus, isLastMessage, shouldStreamingAnimation])

    const displayParts = React.useMemo(() => {
      const parts = [] as (ChainReasoningPart[] | TextUIPart | ToolUIPart<BizUITools>)[]

      let chainReasoningParts: ChainReasoningPart[] | null = null
      for (const part of message.parts) {
        const isReasoning = part.type === "reasoning" && !!(part as ReasoningUIPart).text
        const isTool = part.type.startsWith("tool-")
        const isDisplayTool = isTool && part.type.startsWith("tool-display")

        if (isReasoning) {
          if (!chainReasoningParts) {
            chainReasoningParts = []
            // insert by reference once; keep appending to the same array thereafter
            parts.push(chainReasoningParts)
          }
          chainReasoningParts.push(part as ReasoningUIPart)
          continue
        }

        if (isTool) {
          if (chainReasoningParts && chainReasoningParts.length > 0 && !isDisplayTool) {
            chainReasoningParts.push(part as ToolUIPart<BizUITools>)
          } else {
            parts.push(part as ToolUIPart<BizUITools>)
          }
          continue
        }

        // Only add text to top-level; do not break an active chain
        if (part.type === "text") {
          parts.push(part)
          continue
        }

        // Unknown/meta parts (e.g., step-start, source) are skipped here without breaking an active chain
      }

      // No final flush needed; chain array already referenced in parts
      return parts
    }, [message.parts])

    // console.info("displayParts", displayParts)

    const lowPriorityParts = React.useDeferredValue(displayParts)

    return (
      <>
        {lowPriorityParts.map((partOrParts, index) => {
          const partKey = `${message.id}-${index}`

          if (Array.isArray(partOrParts)) {
            const reasoningParts = partOrParts as ChainReasoningPart[]
            return (
              <AIChainOfThought
                key={partKey}
                groups={reasoningParts}
                isStreaming={shouldMessageAnimation}
              />
            )
          }

          const part = partOrParts as TextUIPart | ToolUIPart<BizUITools>

          switch (part.type) {
            case "text": {
              return (
                <AIMarkdownStreamingMessage
                  key={partKey}
                  text={part.text}
                  className={"text-text"}
                  isStreaming={shouldMessageAnimation}
                />
              )
            }

            case "tool-displayEntries": {
              return <AIDisplayEntriesPart key={partKey} part={part as AIDisplayEntriesTool} />
            }
            case "tool-displaySubscriptions": {
              return (
                <AIDisplaySubscriptionsPart
                  key={partKey}
                  part={part as AIDisplaySubscriptionsTool}
                />
              )
            }
            case "tool-displayFeed": {
              return <AIDisplayFeedPart key={partKey} part={part as AIDisplayFeedTool} />
            }

            case "tool-displayFlowChart": {
              const loadingElement = (
                <div className="bg-material-medium my-2 flex aspect-[4/3] w-[calc(var(--ai-chat-message-container-width,65ch))] max-w-full items-center justify-center rounded">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      <i className="i-mgc-loading-3-cute-re text-text-secondary size-4 animate-spin" />
                      <span className="text-text-secondary text-sm font-medium">
                        Generating Flow Chart...
                      </span>
                    </div>
                  </div>
                </div>
              )
              return (
                <ErrorBoundary key={partKey} beforeCapture={alwaysFalse}>
                  <React.Suspense fallback={loadingElement}>
                    <LazyAIDisplayFlowPart part={part as AIDisplayFlowTool} />
                  </React.Suspense>
                </ErrorBoundary>
              )
            }

            default: {
              if (part.type.startsWith("tool-")) {
                return (
                  <ToolInvocationComponent
                    key={partKey}
                    part={part as ToolUIPart<BizUITools>}
                    variant="tight"
                  />
                )
              }

              return null
            }
          }
        })}
      </>
    )
  },
)

AIMessageParts.displayName = "AIMessageParts"
