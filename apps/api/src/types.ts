// Minimal response typings mirroring the client SDK
// Keep these simple and precise; avoid using `any`.

export interface ResponseStruct<T = unknown> {
  code: number
  message?: string
  data?: T
}

export type StructuredSuccessResponse<T> = {
  code: 0
  data: T
}

export type PlainSuccessResponse<T extends object> = { code: 0 } & T

export const ok = <T>(data: T): StructuredSuccessResponse<T> => ({ code: 0, data })
