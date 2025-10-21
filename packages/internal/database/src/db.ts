import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as schema from "./schemas"
import type { DB } from "./types"

export declare const client: unknown
export declare const db: DB
export declare function initializeDB(): Promise<void>
export declare function migrateDB(): Promise<void>
export declare function getDBFile(): Promise<Blob>
export declare function exportDB(): Promise<void>
/**
 * Closes the database connection (for PostgreSQL)
 */
export declare function deleteDB(): Promise<void>

export type AsyncDb = PostgresJsDatabase<typeof schema>
