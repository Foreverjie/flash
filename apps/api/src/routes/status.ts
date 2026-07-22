/**
 * Status Routes
 * Public system status/configuration consumed by clients at boot.
 *
 * Response shape follows the @follow-app/client-sdk contract:
 *   GET /status/configs → { code: 0, data: StatusConfigs }
 *
 * Clients cache this payload and treat falsy keys as "feature disabled",
 * so anything Flash doesn't implement server-side must stay off here.
 */
import { Hono } from "hono"

const statusRouter = new Hono()

const SERVER_CONFIGS = {
  ANNOUNCEMENT: "",
  MAS_IN_REVIEW_VERSION: "",
  IS_RSS: true,
  // AI chat/shortcut endpoints are not implemented in this API yet
  AI_CHAT_ENABLED: false,
  AI_SHORTCUTS: [],
  // Power/wallet economy is not part of Flash
  PAYMENT_ENABLED: false,
  PAYMENT_PLAN_LIST: [],
  REFERRAL_ENABLED: false,
  REFERRAL_RULE_LINK: "",
  INVITATION_PRICE: 0,
  DAILY_CLAIM_AMOUNT: { normal: 0, verify: 0 },
  DAILY_POWER_SUPPLY: 0,
  DAILY_POWER_PERCENTAGES: [],
  LEVEL_PERCENTAGES: [],
}

statusRouter.get("/configs", (c) => {
  return c.json({ code: 0, data: SERVER_CONFIGS })
})

export default statusRouter
