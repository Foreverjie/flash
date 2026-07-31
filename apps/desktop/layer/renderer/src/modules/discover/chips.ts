/**
 * The "add a feed" flows the Discover hero chips shortcut into. `search` is the
 * default surface and is handled by the search field itself, so it has no chip.
 */
export const DISCOVER_QUICK_CHIPS: {
  type: string
  icon: string
  label: I18nKeys
  shortLabel: I18nKeys
}[] = [
  {
    type: "rss",
    icon: "i-mgc-link-cute-re",
    label: "discover.chip.rss",
    shortLabel: "words.rss",
  },
  {
    type: "rsshub",
    icon: "i-mgc-world-2-cute-re",
    label: "discover.chip.rsshub",
    shortLabel: "words.rsshub",
  },
  {
    type: "import",
    icon: "i-mgc-file-import-cute-re",
    label: "discover.chip.import",
    shortLabel: "words.import",
  },
  {
    type: "inbox",
    icon: "i-mgc-inbox-cute-re",
    label: "discover.chip.inbox",
    shortLabel: "words.inbox",
  },
  {
    type: "user",
    icon: "i-mgc-user-3-cute-re",
    label: "discover.chip.user",
    shortLabel: "words.user",
  },
  {
    type: "transform",
    icon: "i-mgc-magic-2-cute-re",
    label: "discover.chip.transform",
    shortLabel: "words.transform",
  },
]
