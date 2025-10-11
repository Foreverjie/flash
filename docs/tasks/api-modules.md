# API Modules Tasklist

This checklist captures the API surface from `@follow-app/client-sdk` type declarations. It groups endpoints by module and lists request/response types for each route. This is organizational only — no implementations.

- Source: `node_modules/@follow-app/client-sdk/dist/index.d.ts`
- Conventions: success responses are `StructuredSuccessResponse<T>` unless noted; some routes return raw `Response`.

## Achievement

- [ ] `list` — Request: `ListAchievementsRequest`; Response: `ListAchievementsResponse`
- [ ] `claim` — Request: `ClaimAchievementRequest`; Response: `ClaimAchievementResponse`
- [ ] `check` — Request: `CheckAchievementRequest`; Response: `CheckAchievementResponse`
- [ ] `audit` — Request: `AuditAchievementRequest`; Response: `EmptyResponse`

## Actions

- [ ] `get` — Request: `never`; Response: `ActionsGetResponse`
- [ ] `put` — Request: `ActionsPutRequest`; Response: `EmptyResponse`

## Admin

- [ ] `featureFlags.list` — Request: `never`; Response: `FeatureFlagListResponse`
- [ ] `featureFlags.update` — Request: `FeatureFlagUpdateInput`; Response: `FeatureFlagResponse`
- [ ] `featureFlags.override` — Request: `UserOverrideInput`; Response: `MessageResponse`
- [ ] `featureFlags.removeOverride` — Request: `RemoveOverrideInput`; Response: `MessageResponse`
- [ ] `featureFlags.stats` — Request: `FeatureStatsInput`; Response: `FeatureStatsResponse`
- [ ] `featureFlags.affectedUsers` — Request: `AffectedUsersInput`; Response: `AffectedUsersResponse`
- [ ] `clean.execute` — Request: `CleanRequest`; Response: `EmptyResponse`
- [ ] `mint.execute` — Request: `MintRequest`; Response: `MintResponse`

## Auth (prefix: `/better-auth`)

- [ ] `getSession` — Request: `void`; Response: `AuthSessionResponse`

## AI

- [ ] `chat` — Request: `ChatRequest`; Response: `Response`
- [ ] `summary` — Request: `SummaryRequest`; Response: `SummaryResponse`
- [ ] `translation` — Request: `TranslationRequest`; Response: `TranslationResponse`
- [ ] `summaryTitle` — Request: `TitleRequest`; Response: `TitleResponse`
- [ ] `daily` — Request: `DailyRequest`; Response: `DailyResponse`
- [ ] `config` — Request: `never`; Response: `ConfigResponse`

## AIAnalytics

- [ ] `get` — Request: `AnalyticsRequest`; Response: `AnalyticsData`

## AIChatSessions (prefix: `/ai/chat-sessions`)

- [ ] `list` — Request: `ListSessionsQuery`; Response: `ListSessionsResponse`
- [ ] `get` — Request: `GetSessionRequest`; Response: `SessionResponse`
- [ ] `update` — Request: `UpdateSessionRequest`; Response: `SessionResponse`
- [ ] `delete` — Request: `DeleteSessionRequest`; Response: `{ success: boolean }`
- [ ] `messages.get` — Request: `GetMessagesQuery`; Response: `GetMessagesResponse`
- [ ] `markSeen` — Request: `MarkSeenRequest`; Response: `SessionResponse`
- [ ] `unread` — Request: `GetUnreadQuery`; Response: `GetUnreadResponse`

## AITask (prefix: `/ai/task`)

- [ ] `list` — Request: `never`; Response: `TaskListResponse`
- [ ] `get` — Request: `{ id: string }`; Response: `TaskGetResponse`
- [ ] `create` — Request: `CreateTaskRequest`; Response: `TaskCreateResponse`
- [ ] `update` — Request: `UpdateTaskRequest`; Response: `TaskUpdateResponse`
- [ ] `delete` — Request: `{ id: string }`; Response: `EmptyResponse`
- [ ] `testRun` — Request: `{ id: string }`; Response: `TaskTestRunResponse`

## Boosts

- [ ] `getFeedBoostLevel` — Request: `GetFeedBoostLevelRequest`; Response: `GetFeedBoostLevelResponse`
- [ ] `boostFeed` — Request: `BoostFeedRequest`; Response: `BoostFeedResponse`
- [ ] `getFeedBoosters` — Request: `GetFeedBoostersRequest`; Response: `GetFeedBoostersResponse`

## Categories

- [ ] `get` — Request: `CategoriesGetQuery`; Response: `CategoriesGetResponse`
- [ ] `update` — Request: `CategoryPatchRequest`; Response: `EmptyResponse`
- [ ] `delete` — Request: `CategoryDeleteRequest`; Response: `EmptyResponse`

## Collections

- [ ] `get` — Request: `CollectionCheckQuery`; Response: `CollectionCheckResponse`
- [ ] `post` — Request: `CollectionCreateRequest`; Response: `EmptyResponse`
- [ ] `delete` — Request: `CollectionDeleteRequest`; Response: `EmptyResponse`

## Data

- [ ] `sendAnalytics` — Request: `GoogleAnalyticsRequest`; Response: `null`

## Discover

- [ ] `discover` — Request: `DiscoverRequest`; Response: `DiscoverResponse`
- [ ] `rsshub` — Request: `RSSHubQuery`; Response: `RSSHubResponse`
- [ ] `rsshubRoute` — Request: `RSSHubRouteQuery`; Response: `RSSHubRouteResponse`
- [ ] `rsshubAnalytics` — Request: `RSSHubAnalyticsQuery`; Response: `RSSHubAnalyticsResponse`

## Entries

- [ ] `get` — Request: `EntryGetQuery`; Response: `EntryGetByIdResponse`
- [ ] `list` — Request: `EntryListRequest`; Response: `EntryListResponse`
- [ ] `preview` — Request: `EntryPreviewRequest`; Response: `EntryPreviewResponse`
- [ ] `readability` — Request: `EntryReadabilityRequest`; Response: `EntryReadabilityResponse`
- [ ] `transcription` — Request: `EntryTranscriptionRequest`; Response: `EntryTranscriptionResponse`
- [ ] `stream` — Request: `EntryStreamRequest`; Response: `Response`
- [ ] `checkNew` — Request: `CheckNewEntriesQuery`; Response: `CheckNewEntriesResponse`
- [ ] `readHistories` — Request: `ReadHistoriesInput`; Response: `ReadHistoriesResponse`
- [ ] `inbox.get` — Request: `InboxEntryGetQuery`; Response: `InboxEntryGetResponse`
- [ ] `inbox.list` — Request: `InboxListEntryRequestInput`; Response: `InboxListEntryResponse`
- [ ] `inbox.delete` — Request: `InboxRemoveInput`; Response: `StructuredSuccessResponse<any>`

## Feeds

- [ ] `get` — Request: `FeedGetQuery`; Response: `FeedGetResponse`
- [ ] `refresh` — Request: `FeedRefreshQuery`; Response: `EmptyResponse`
- [ ] `reset` — Request: `FeedResetQuery`; Response: `EmptyResponse`
- [ ] `analytics` — Request: `FeedAnalyticsRequest`; Response: `FeedAnalyticsResponse`
- [ ] `claim.challenge` — Request: `FeedClaimChallengeRequest`; Response: `EmptyResponse`
- [ ] `claim.list` — Request: `{}`; Response: `FeedClaimListResponse`
- [ ] `claim.message` — Request: `FeedClaimMessageQuery`; Response: `FeedClaimMessageResponse`

## Inboxes

- [ ] `get` — Request: `InboxGetQuery`; Response: `InboxGetResponse`
- [ ] `list` — Request: `never`; Response: `InboxListResponse`
- [ ] `post` — Request: `InboxCreateRequest`; Response: `EmptyResponse`
- [ ] `put` — Request: `InboxUpdateRequest`; Response: `EmptyResponse`
- [ ] `delete` — Request: `InboxDeleteRequest`; Response: `EmptyResponse`
- [ ] `email` — Request: `InboxEmailRequest`; Response: `EmptyResponse`
- [ ] `webhook` — Request: `InboxWebhookRequest` (complex object); Response: `EmptyResponse`

## Invitations

- [ ] `getLimitation` — Request: `never`; Response: `GetInvitationLimitationResponse`
- [ ] `list` — Request: `never`; Response: `GetInvitationsListResponse`
- [ ] `create` — Request: `CreateInvitationRequest`; Response: `CreateInvitationResponse`
- [ ] `use` — Request: `UseInvitationRequest`; Response: `UseInvitationResponse`

## Lists

- [ ] `get` — Request: `GetListQuery`; Response: `GetListResponse`
- [ ] `list` — Request: `ListsListQuery`; Response: `ListUserListsResponse`
- [ ] `create` — Request: `CreateListRequest`; Response: `CreateListResponse`
- [ ] `update` — Request: `UpdateListRequest`; Response: `UpdateListResponse`
- [ ] `delete` — Request: `DeleteListRequest`; Response: `DeleteListResponse`
- [ ] `addFeeds` — Request: `AddFeedsRequest`; Response: `AddFeedsResponse`
- [ ] `removeFeed` — Request: `RemoveFeedRequest`; Response: `RemoveFeedResponse`

## MCP

- [ ] `createConnection` — Request: `CreateConnectionRequest`; Response: `CreateConnectionResponse`
- [ ] `updateConnection` — Request: `UpdateConnectionRequest`; Response: `UpdateConnectionResponse`
- [ ] `getConnections` — Request: `never`; Response: `GetConnectionsResponse`
- [ ] `deleteConnection` — Request: `ConnectionParams`; Response: `DeleteConnectionResponse`
- [ ] `getTools` — Request: `ConnectionParams`; Response: `GetToolsResponse`
- [ ] `refreshTools` — Request: `RefreshToolsRequest`; Response: `RefreshToolsResponse`

## Messaging

- [ ] `getTokens` — Request: `never`; Response: `GetMessagingTokensResponse`
- [ ] `createToken` — Request: `CreateMessagingTokenRequest`; Response: `EmptyResponse`
- [ ] `deleteToken` — Request: `DeleteMessagingTokenRequest`; Response: `EmptyResponse`
- [ ] `testNotification` — Request: `TestMessagingQuery`; Response: `EmptyResponse`

## Profiles

- [ ] `getProfile` — Request: `GetProfileRequest`; Response: `GetProfileResponse`
- [ ] `getBatch` — Request: `GetProfilesBatchRequest`; Response: `GetProfilesBatchResponse`

## Probes

- [ ] `checkPostgreSQL` — Request: `never`; Response: `CheckPostgreSQLResponse`
- [ ] `checkRedis` — Request: `never`; Response: `CheckRedisResponse`
- [ ] `checkBullMQ` — Request: `CheckBullMQRequest`; Response: `CheckBullMQResponse`
- [ ] `getRSSHubAnalytics` — Request: `GetRSSHubAnalyticsRequest`; Response: `GetRSSHubAnalyticsResponse`

## Reads

- [ ] `get` — Request: `ReadStatusQuery`; Response: `ReadStatusResponse`
- [ ] `markAsRead` — Request: `MarkAsReadRequest`; Response: `ReadOperationResponse`
- [ ] `markAsUnread` — Request: `MarkAsUnreadRequest`; Response: `ReadOperationResponse`
- [ ] `markAllAsRead` — Request: `MarkAllAsReadRequest`; Response: `MarkAllAsReadResponse`
- [ ] `getTotalCount` — Request: `never`; Response: `TotalUnreadCountResponse`

## Referrals

- [ ] `getReferrals` — Request: `never`; Response: `GetReferralsResponse`
- [ ] `getDays` — Request: `GetReferralDaysRequest`; Response: `GetReferralDaysResponse`
- [ ] `verifyReceipt` — Request: `VerifyReceiptRequest`; Response: `EmptyResponse`

## RSSHub

- [ ] `create` — Request: `RSSHubCreateRequest`; Response: `RSSHubCreateResponse`
- [ ] `list` — Request: `{}`; Response: `RSSHubListResponse`
- [ ] `delete` — Request: `RSSHubDeleteRequest`; Response: `RSSHubDeleteResponse`
- [ ] `use` — Request: `RSSHubUseRequest`; Response: `RSSHubUseResponse`
- [ ] `get` — Request: `RSSHubGetQuery`; Response: `RSSHubGetResponse`
- [ ] `status` — Request: `{}`; Response: `RSSHubStatusResponse`

## Settings

- [ ] `get` — Request: `SettingsGetQuery`; Response: `SettingsGetResponse`
- [ ] `update` — Request: `SettingsUpdateInput`; Response: `EmptyResponse`

## Status

- [ ] `getConfigs` — Request: `never`; Response: `GetStatusConfigsResponse`

## Subscriptions

- [ ] `get` — Request: `SubscriptionGetQuery`; Response: `SubscriptionGetResponse`
- [ ] `create` — Request: `SubscriptionCreateRequest`; Response: `SubscriptionCreateResponse`
- [ ] `update` — Request: `SubscriptionUpdateRequest`; Response: `SubscriptionUpdateResponse`
- [ ] `delete` — Request: `SubscriptionDeleteRequest`; Response: `SubscriptionDeleteResponse`
- [ ] `batchUpdate` — Request: `SubscriptionBatchRequest`; Response: `SubscriptionBatchResponse`
- [ ] `import` — Request: `FormData`; Response: `SubscriptionImportResponse`
- [ ] `export` — Request: `SubscriptionExportQuery`; Response: `SubscriptionExportResponse`
- [ ] `parseOpml` — Request: `ArrayBuffer`; Response: `SubscriptionParseOpmlResponse`

## Trending

- [ ] `getFeeds` — Request: `GetTrendingFeedsRequest`; Response: `GetTrendingFeedsResponse`

## Upload

- [ ] `uploadAvatar` — Request: `UploadAvatarRequest`; Response: `UploadAvatarResponse`
- [ ] `uploadChatAttachment` — Request: `UploadChatAttachmentRequest`; Response: `UploadChatAttachmentResponse`

## Wallets

- [ ] `get` — Request: `never`; Response: `WalletsGetResponse`
- [ ] `post` — Request: `never`; Response: `WalletsPostResponse`
- [ ] `refresh` — Request: `never`; Response: `EmptyResponse`
- [ ] `ranking` — Request: `WalletRankingQuery`; Response: `WalletRankingResponse`
- [ ] `powerPrice` — Request: `never`; Response: `PowerPriceResponse`
- [ ] `transactions.get` — Request: `TransactionQuery`; Response: `TransactionsGetResponse`
- [ ] `transactions.tip` — Request: `TipRequest`; Response: `TipResponse`
- [ ] `transactions.claimDaily` — Request: `never`; Response: `ClaimDailyResponse`
- [ ] `transactions.withdraw` — Request: `WithdrawRequest`; Response: `WithdrawResponse`
- [ ] `transactions.claimCheck` — Request: `never`; Response: `ClaimCheckResponse`
- [ ] `airdrop.get` — Request: `never`; Response: `AirdropGetResponse`
- [ ] `airdrop.claim` — Request: `never`; Response: `AirdropClaimResponse`
- [ ] `airdrop.update` — Request: `never`; Response: `EmptyResponse`
