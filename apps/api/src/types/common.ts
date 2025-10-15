/**
 * Standard Follow API response wrapper
 */
export interface FollowAPIResponse<T = any> {
  code: number
  data: T
  message?: string
}

/**
 * Error response from Follow API
 */
export interface FollowAPIErrorResponse {
  code: number
  message: string
  data?: any
}

/**
 * Structured success response
 */
export interface StructuredSuccessResponse<T = any> {
  code: 0
  data: T
}

/**
 * Plain success response
 */
export interface PlainSuccessResponse<T = any> {
  code: 0
  data: T
}

/**
 * Empty response
 */
export interface EmptyResponse {
  code: 0
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  limit?: number
  before?: string
  after?: string
}

/**
 * Pagination response
 */
export interface PaginationResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Generic request types
 */
export interface IdRequest {
  id: string
}

export interface FeedIdRequest {
  feedId: string
}

export interface ListIdRequest {
  listId: string
}

export interface UserIdRequest {
  userId: string
}

export interface EntryIdRequest {
  entryId: string
}
