export const DEFAULT_VALUES = {
  PROD: {
    API_URL: "https://api.scflash.win",
    WEB_URL: "https://app.scflash.win",
    INBOXES_EMAIL: "@scflash.win",
    OPENPANEL_CLIENT_ID: "",
    OPENPANEL_API_URL: "",
    RECAPTCHA_V3_SITE_KEY: "",
    HCAPTCHA_SITE_KEY: "",

    POSTHOG_KEY: "",
    POSTHOG_HOST: "",
  },
  DEV: {
    API_URL: "https://api.dev.follow.is",
    WEB_URL: "https://dev.follow.is",
    INBOXES_EMAIL: "__dev@follow.re",
  },
  STAGING: {
    API_URL: "https://api.follow.is",
    WEB_URL: "https://staging.follow.is",
    INBOXES_EMAIL: "@follow.re",
    OPENPANEL_CLIENT_ID: "4382168f-b8d2-40c1-9a26-133a312d072b",
    OPENPANEL_API_URL: "https://openpanel.follow.is/api",

    POSTHOG_KEY: "phc_EZGEvBt830JgBHTiwpHqJAEbWnbv63m5UpreojwEWNL",
    POSTHOG_HOST: "https://us.posthog.com",
  },
  LOCAL: {
    API_URL: "http://localhost:3000",
    WEB_URL: "http://localhost:2233",
    INBOXES_EMAIL: "@follow.re",
  },
}
