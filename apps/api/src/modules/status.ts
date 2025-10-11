import type { StatusConfigs } from "@folo-services/shared"
import { Hono } from "hono"

import { ok } from "../types"

// Provide a minimal, sensible default config matching StatusConfigs
const defaultStatusConfigs: StatusConfigs = {
  AI_CHAT_ENABLED: false,
  ANNOUNCEMENT: "",
  DAILY_CLAIM_AMOUNT: { trial: 10, normal: 20 },
  DAILY_POWER_PERCENTAGES: [1, 1, 1, 1, 1, 1, 1],
  DAILY_POWER_SUPPLY: 1000,
  IMPORTING_TITLE: "Importing",
  INVITATION_ENABLED: false,
  INVITATION_INTERVAL_DAYS: 7,
  INVITATION_PRICE: 0,
  IS_RSS3_TESTNET: true,
  LEVEL_PERCENTAGES: [60, 80, 100],
  MAS_IN_REVIEW_VERSION: undefined,
  MAX_ACTIONS: 10,
  MAX_INBOXES: 10,
  MAX_LISTS: 10,
  MAX_SUBSCRIPTIONS: 500,
  MAX_TRIAL_USER_FEED_SUBSCRIPTION: 20,
  MAX_TRIAL_USER_LIST_SUBSCRIPTION: 10,
  MAX_WEBHOOKS_PER_ACTION: 5,
  PRODUCT_HUNT_VOTE_URL: "",
  REFERRAL_ENABLED: false,
  REFERRAL_REQUIRED_INVITATIONS: 0,
  REFERRAL_RULE_LINK: "",
  TAX_POINT: "0.00",
}

export const statusRoutes = new Hono()
  // GET /api/status/configs
  .get("/configs", (c) => c.json(ok(defaultStatusConfigs)))
