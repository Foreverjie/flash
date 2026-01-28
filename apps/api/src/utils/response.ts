import type { Context } from "hono"

import type { EmptyResponse, FollowAPIResponse, StructuredSuccessResponse } from "../types/common"

/**
 * Create a success response
 */
export function successResponse<T>(data: T, code = 0): FollowAPIResponse<T> {
  return {
    code,
    data,
  }
}

/**
 * Create a structured success response
 */
export function structuredSuccess<T>(data: T): StructuredSuccessResponse<T> {
  return {
    code: 0,
    data,
  }
}

/**
 * Create a structured error response
 */
export function structuredError(message: string, code = 1) {
  return {
    code,
    message,
  }
}

/**
 * Create an empty success response
 */
export function emptySuccess(): EmptyResponse {
  return {
    code: 0,
  }
}

/**
 * Create an error response
 */
export function errorResponse(message: string, code = 1, data?: any) {
  return {
    code,
    message,
    ...(data && { data }),
  }
}

/**
 * Send a success JSON response
 */
export function sendSuccess<T>(c: Context, data: T, code = 0) {
  return c.json(successResponse(data, code))
}

/**
 * Send an error JSON response
 */
export function sendError(
  c: Context,
  message: string,
  code = 1,
  statusCode: 400 | 401 | 403 | 404 | 500 = 400,
) {
  return c.json(errorResponse(message, code), statusCode)
}

/**
 * Send a not found error
 */
export function sendNotFound(c: Context, resource = "Resource") {
  return sendError(c, `${resource} not found`, 404, 404)
}

/**
 * Send unauthorized error
 */
export function sendUnauthorized(c: Context, message = "Unauthorized") {
  return sendError(c, message, 401, 401)
}

/**
 * Send forbidden error
 */
export function sendForbidden(c: Context, message = "Forbidden") {
  return sendError(c, message, 403, 403)
}

/**
 * Send validation error
 */
export function sendValidationError(c: Context, message: string) {
  return sendError(c, message, 400, 400)
}
